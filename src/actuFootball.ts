import { cachedDaily, type FootballChoice, readSecret } from "./actu";
import type { Env } from "./env";

/**
 * Resultats du club suivi, depuis football-data.org.
 *
 * Le palier gratuit couvre douze competitions, dont les dix competitions de
 * clubs listees ci-dessous - verifie en interrogeant /v4/competitions. C'est
 * une limite reelle : un club hors de ces championnats ne peut pas etre suivi
 * ici.
 *
 * L'interet de cette API pour nous : le parent choisit un championnat, puis un
 * club dans la liste renvoyee pour ce championnat. Aucun champ libre, comme
 * pour le catalogue du brevet.
 */

const ENDPOINT = "https://api.football-data.org/v4";
const TEAMS_TTL_SECONDS = 60 * 60 * 24 * 7;
const MATCHES_TTL_SECONDS = 60 * 60 * 3;

export interface Competition {
  code: string;
  label: string;
}

/** Competitions de clubs du palier gratuit. Les selections nationales (Euro,
 *  Coupe du monde) en sont volontairement absentes : on choisit un club. */
export const COMPETITIONS: Competition[] = [
  { code: "FL1", label: "Ligue 1 (France)" },
  { code: "PL", label: "Premier League (Angleterre)" },
  { code: "PD", label: "Liga (Espagne)" },
  { code: "SA", label: "Serie A (Italie)" },
  { code: "BL1", label: "Bundesliga (Allemagne)" },
  { code: "PPL", label: "Primeira Liga (Portugal)" },
  { code: "DED", label: "Eredivisie (Pays-Bas)" },
  { code: "ELC", label: "Championship (Angleterre)" },
  { code: "BSA", label: "Serie A (Bresil)" },
  { code: "CL", label: "Ligue des champions" }
];

export function findCompetition(code: unknown): Competition | undefined {
  return COMPETITIONS.find((competition) => competition.code === code);
}

export interface Team {
  id: number;
  name: string;
  crest: string | null;
}

export interface Match {
  date: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  /** null pour un match a venir. */
  homeScore: number | null;
  awayScore: number | null;
  played: boolean;
}

async function callFootball(env: Env, path: string): Promise<unknown | null> {
  const apiKey = readSecret(env, "FOOTBALL_API_KEY");
  if (!apiKey) return null;

  try {
    const response = await fetch(`${ENDPOINT}${path}`, {
      headers: { "X-Auth-Token": apiKey },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.error(`callFootball(${path}) : ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`callFootball(${path}) failed:`, error);
    return null;
  }
}

/**
 * Clubs d'un championnat, pour la liste deroulante du parent. Mis en cache une
 * semaine : la composition d'un championnat ne bouge pas dans la saison, et le
 * palier gratuit plafonne a dix requetes par minute.
 */
export async function getTeams(env: Env, code: string): Promise<Team[]> {
  if (!findCompetition(code)) return [];

  const teams = await cachedDaily<Team[]>(env, `actu-foot-clubs:${code}`, TEAMS_TTL_SECONDS, async () => {
    const body = (await callFootball(env, `/competitions/${code}/teams`)) as {
      teams?: { id?: unknown; name?: unknown; crest?: unknown }[];
    } | null;

    const list = (body?.teams ?? [])
      .map((team) => ({
        id: Number(team.id),
        name: typeof team.name === "string" ? team.name : "",
        crest: typeof team.crest === "string" ? team.crest : null
      }))
      .filter((team) => Number.isFinite(team.id) && team.name.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return list.length > 0 ? list : null;
  });

  return teams ?? [];
}

function readMatches(body: unknown): Match[] {
  const raw = (body as { matches?: unknown[] })?.matches;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const match = entry as {
        utcDate?: unknown;
        status?: unknown;
        competition?: { name?: unknown };
        homeTeam?: { name?: unknown };
        awayTeam?: { name?: unknown };
        score?: { fullTime?: { home?: unknown; away?: unknown } };
      };

      const played = match.status === "FINISHED";
      return {
        date: typeof match.utcDate === "string" ? match.utcDate : "",
        competition: typeof match.competition?.name === "string" ? match.competition.name : "",
        homeTeam: typeof match.homeTeam?.name === "string" ? match.homeTeam.name : "",
        awayTeam: typeof match.awayTeam?.name === "string" ? match.awayTeam.name : "",
        homeScore: played && typeof match.score?.fullTime?.home === "number" ? match.score.fullTime.home : null,
        awayScore: played && typeof match.score?.fullTime?.away === "number" ? match.score.fullTime.away : null,
        played
      };
    })
    .filter((match) => match.date.length > 0 && match.homeTeam.length > 0 && match.awayTeam.length > 0);
}

export interface FootballView {
  team: FootballChoice;
  /** Les derniers matchs joues, le plus recent d'abord. */
  results: Match[];
  /** Le prochain match, s'il est connu. */
  next: Match | null;
}

/**
 * Derniers resultats du club suivi et prochain match. Les deux appels sont
 * caches trois heures : un score ne change plus une fois le match fini, et
 * cela laisse largement de la marge sous la limite de dix requetes/minute.
 */
export async function getFootballView(env: Env, choice: FootballChoice): Promise<FootballView | null> {
  const [finished, scheduled] = await Promise.all([
    cachedDaily<Match[]>(env, `actu-foot-resultats:${choice.teamId}`, MATCHES_TTL_SECONDS, async () => {
      const matches = readMatches(await callFootball(env, `/teams/${choice.teamId}/matches?status=FINISHED&limit=5`));
      return matches.length > 0 ? matches : null;
    }),
    cachedDaily<Match[]>(env, `actu-foot-prochain:${choice.teamId}`, MATCHES_TTL_SECONDS, async () => {
      const matches = readMatches(await callFootball(env, `/teams/${choice.teamId}/matches?status=SCHEDULED&limit=1`));
      return matches.length > 0 ? matches : null;
    })
  ]);

  if (!finished && !scheduled) return null;

  return {
    team: choice,
    results: (finished ?? []).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    next: scheduled?.[0] ?? null
  };
}
