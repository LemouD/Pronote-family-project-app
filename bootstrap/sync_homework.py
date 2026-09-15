"""
Synchronise les devoirs Pronote pour les enfants dont l'etablissement impose
l'ENT (externallySynced=true dans src/children.ts). Lance periodiquement par
GitHub Actions (voir .github/workflows/sync-homework.yml) - ne tourne jamais
sur le Worker lui-meme (pronotepy ne fonctionne pas sur Cloudflare Workers).

Lecture seule cote Pronote : n'ecrit jamais de statut "fait" vers Pronote
(de toute facon injoignable en direct pour ces comptes). Le statut "fait"
est gere par le Worker lui-meme, cote KV (voir src/pronote.ts).

Important : les identifiants pronotepy (username/password) tournent a
CHAQUE connexion (comportement normal du "token_login" de Pronote). Ce
script met donc a jour les secrets GitHub correspondants apres chaque
synchro reussie - sinon la synchro suivante echoue avec des identifiants
perimes.

Variables d'environnement attendues, par enfant (PREFIX = secretPrefix dans
src/children.ts, ex. MALICK, CODOU) :
  PRONOTE_<PREFIX>_URL
  PRONOTE_<PREFIX>_USERNAME
  PRONOTE_<PREFIX>_PASSWORD
  PRONOTE_<PREFIX>_UUID
  PRONOTE_<PREFIX>_CLIENT_ID          (optionnel)
Pour ecrire dans Cloudflare KV :
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN                (permission Workers KV Storage:Edit)
  CLOUDFLARE_KV_NAMESPACE_ID
Pour mettre a jour les secrets GitHub apres rotation (voir plus haut) :
  GH_TOKEN                            (PAT avec la permission "Secrets: write")
  GITHUB_REPOSITORY                   (deja fourni automatiquement par Actions)
"""

import datetime
import json
import os
import subprocess
import sys
from html import unescape

import pronotepy
import requests

# Doit rester synchronise avec src/children.ts.
CHILDREN = [
    {"slug": "malick-K5p0nA65n8L1", "prefix": "MALICK"},
    {"slug": "codou-tBCiBx5FYmTB", "prefix": "CODOU"},
]


def env_or_none(name: str) -> str | None:
    value = os.environ.get(name)
    return value if value else None


def put_kv(key: str, value: object) -> None:
    account_id = os.environ["CLOUDFLARE_ACCOUNT_ID"]
    namespace_id = os.environ["CLOUDFLARE_KV_NAMESPACE_ID"]
    api_token = os.environ["CLOUDFLARE_API_TOKEN"]

    response = requests.put(
        f"https://api.cloudflare.com/client/v4/accounts/{account_id}"
        f"/storage/kv/namespaces/{namespace_id}/values/{key}",
        headers={"Authorization": f"Bearer {api_token}"},
        data=json.dumps(value),
        timeout=30,
    )
    response.raise_for_status()
    body = response.json()
    if not body.get("success"):
        raise RuntimeError(f"Ecriture KV echouee pour {key} : {body}")


def update_github_secret(name: str, value: str) -> None:
    # Necessite `gh` (deja present sur les runners GitHub Actions) et
    # GH_TOKEN avec la permission d'ecrire les secrets du repo.
    subprocess.run(
        ["gh", "secret", "set", name, "--body", value],
        check=True,
        env=os.environ,
    )


def sync_child(child: dict) -> None:
    prefix = child["prefix"]
    slug = child["slug"]

    url = env_or_none(f"PRONOTE_{prefix}_URL")
    username = env_or_none(f"PRONOTE_{prefix}_USERNAME")
    password = env_or_none(f"PRONOTE_{prefix}_PASSWORD")
    uuid = env_or_none(f"PRONOTE_{prefix}_UUID")
    client_identifier = env_or_none(f"PRONOTE_{prefix}_CLIENT_ID")

    if not all([url, username, password, uuid]):
        print(f"[{prefix}] secrets manquants, ignore.")
        return

    client = pronotepy.Client.token_login(
        url, username, password, uuid, client_identifier=client_identifier
    )

    if not client.logged_in:
        print(f"[{prefix}] connexion refusee.")
        return

    today = datetime.date.today()
    tomorrow = today + datetime.timedelta(days=1)
    homeworks = client.homework(today, tomorrow)

    items = [
        {
            "id": hw.id,
            "subject": hw.subject.name,
            "description": unescape(hw.description or ""),
            # Le statut "fait" reel est gere a part par le Worker (KV) ;
            # Pronote lui-meme n'est jamais mis a jour pour ces comptes.
            "done": False,
            "deadline": hw.date.isoformat() + "T00:00:00.000Z",
            "color": hw.background_color or "#999999",
        }
        for hw in homeworks
    ]

    put_kv(f"homework-external:{slug}", items)
    print(f"[{prefix}] {len(items)} devoir(s) synchronise(s).")

    # Les identifiants tournent a chaque connexion : on remet a jour les
    # secrets GitHub systematiquement, pour que la prochaine synchro
    # fonctionne encore.
    update_github_secret(f"PRONOTE_{prefix}_USERNAME", client.username)
    update_github_secret(f"PRONOTE_{prefix}_PASSWORD", client.password)


def main() -> None:
    had_error = False
    for child in CHILDREN:
        try:
            sync_child(child)
        except Exception as error:  # noqa: BLE001 - on veut rapporter n'importe quelle erreur, pas planter en silence
            had_error = True
            print(f"[{child['prefix']}] erreur : {type(error).__name__}: {error}", file=sys.stderr)

    if had_error:
        sys.exit(1)


if __name__ == "__main__":
    main()
