import type { ChildConfig } from "./children";

export interface Env {
  PRONOTE_CACHE: KVNamespace;
  PARENT_ACCESS_TOKEN?: string;
  [secretKey: string]: unknown;
}

export interface ChildSecrets {
  url: string;
  username: string;
  password: string;
}

export function readChildSecrets(env: Env, child: ChildConfig): ChildSecrets {
  const url = env[`PRONOTE_${child.secretPrefix}_URL`];
  const username = env[`PRONOTE_${child.secretPrefix}_USERNAME`];
  const password = env[`PRONOTE_${child.secretPrefix}_PASSWORD`];

  if (typeof url !== "string" || typeof username !== "string" || typeof password !== "string") {
    throw new Error(
      `Secrets manquants pour ${child.displayName}. Attendu: PRONOTE_${child.secretPrefix}_URL, ` +
        `PRONOTE_${child.secretPrefix}_USERNAME, PRONOTE_${child.secretPrefix}_PASSWORD.`
    );
  }

  return { url, username, password };
}
