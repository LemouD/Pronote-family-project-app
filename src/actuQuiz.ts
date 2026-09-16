import { cachedDaily, findQuizTheme } from "./actu";
import type { ChildConfig } from "./children";
import type { Env } from "./env";
import { translateQuiz } from "./gemini";

/**
 * Question du jour, depuis Open Trivia DB. Pas de cle a fournir : c'est la
 * seule categorie qui fonctionne sans configuration.
 *
 * La bonne reponse est gardee cote serveur jusqu'a ce que l'enfant reponde -
 * meme principe que la correction du brevet, sinon elle serait lisible dans
 * le code source de la page avant meme d'avoir reflechi.
 */

const ENDPOINT = "https://opentdb.com/api.php";
const TTL_SECONDS = 60 * 60 * 30;
const ANSWER_TTL_SECONDS = 60 * 60 * 48;

export interface QuizQuestion {
  themeLabel: string;
  question: string;
  /** Propositions dans l'ordre d'affichage. */
  answers: string[];
  /** Index de la bonne reponse. Jamais envoye a la page avant la reponse. */
  correctIndex: number;
  translated: boolean;
}

export interface QuizView {
  themeLabel: string;
  question: string;
  answers: string[];
  /** null tant que l'enfant n'a pas repondu. */
  chosenIndex: number | null;
  correctIndex: number | null;
  translated: boolean;
}

function questionKey(theme: number, date: string): string {
  return `actu-quiz:${theme}:${date}`;
}

function answerKey(child: ChildConfig, date: string): string {
  return `actu-quiz-reponse:${child.slug}:${date}`;
}

/**
 * Melange stable : la meme date et le meme theme donnent toujours le meme
 * ordre. Sans ca, la bonne reponse changerait de place a chaque rechargement
 * et l'index enregistre ne voudrait plus rien dire.
 */
function shuffle<T>(items: T[], seed: string): T[] {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) % 2147483647;

  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    hash = (hash * 1103515245 + 12345) % 2147483647;
    const target = hash % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function decode(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function getQuizQuestion(env: Env, theme: number, date: string): Promise<QuizQuestion | null> {
  const themeConfig = findQuizTheme(theme);
  if (!themeConfig) return null;

  return cachedDaily(env, questionKey(theme, date), TTL_SECONDS, async () => {
    let question = "";
    let correct = "";
    let wrong: string[] = [];

    try {
      const url = new URL(ENDPOINT);
      url.searchParams.set("amount", "1");
      url.searchParams.set("category", String(theme));
      url.searchParams.set("difficulty", "easy");
      url.searchParams.set("type", "multiple");
      // url3986 : sans ca l'API renvoie des entites HTML (&quot; etc.) qu'il
      // faudrait decoder a la main, et mal.
      url.searchParams.set("encode", "url3986");

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;

      const body = (await response.json()) as {
        response_code?: number;
        results?: { question?: unknown; correct_answer?: unknown; incorrect_answers?: unknown }[];
      };
      if (body.response_code !== 0) return null;

      const result = body.results?.[0];
      question = decode(result?.question);
      correct = decode(result?.correct_answer);
      wrong = Array.isArray(result?.incorrect_answers) ? result.incorrect_answers.map(decode) : [];
    } catch (error) {
      console.error(`getQuizQuestion(${theme}, ${date}) failed:`, error);
      return null;
    }

    if (!question || !correct || wrong.length === 0) return null;

    // Open Trivia DB n'existe qu'en anglais. Une question de culture generale
    // qu'un enfant de 5e ne peut pas lire ne sert a rien, donc on traduit -
    // et on garde l'anglais si la traduction echoue.
    const french = await translateQuiz(env, { question, answers: [correct, ...wrong] }).catch((error) => {
      console.error(`translateQuiz(${theme}, ${date}) failed:`, error);
      return null;
    });

    const source = french ?? { question, answers: [correct, ...wrong] };
    const shuffled = shuffle(source.answers, `${theme}:${date}`);

    return {
      themeLabel: themeConfig.label,
      question: source.question,
      answers: shuffled,
      correctIndex: shuffled.indexOf(source.answers[0]),
      translated: french !== null
    };
  });
}

async function getAnswer(env: Env, child: ChildConfig, date: string): Promise<number | null> {
  const stored = await env.PRONOTE_CACHE.get(answerKey(child, date), "json");
  return typeof stored === "number" ? stored : null;
}

/** Une seule tentative par jour : repondre deux fois n'aurait aucun sens. */
export async function recordAnswer(env: Env, child: ChildConfig, date: string, index: number): Promise<void> {
  if ((await getAnswer(env, child, date)) !== null) return;
  await env.PRONOTE_CACHE.put(answerKey(child, date), JSON.stringify(index), { expirationTtl: ANSWER_TTL_SECONDS });
}

export async function getQuizView(env: Env, child: ChildConfig, theme: number, date: string): Promise<QuizView | null> {
  const [question, chosenIndex] = await Promise.all([getQuizQuestion(env, theme, date), getAnswer(env, child, date)]);
  if (!question) return null;

  return {
    themeLabel: question.themeLabel,
    question: question.question,
    answers: question.answers,
    chosenIndex,
    // La bonne reponse n'apparait dans la page qu'une fois l'enfant engage.
    correctIndex: chosenIndex === null ? null : question.correctIndex,
    translated: question.translated
  };
}
