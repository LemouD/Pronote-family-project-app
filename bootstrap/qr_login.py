"""
Etape 2 du bootstrap ENT : recoit sur stdin le jeton/pin/login/url captures
par Playwright (login.mjs) et tente la connexion via pronotepy (bibliotheque
Python plus activement maintenue que pawnote, avec des utilisateurs
confirmant que ce pont ENT fonctionne pour d'autres etablissements).

N'est jamais deploye sur Cloudflare - script local uniquement.

Entree (JSON sur stdin) : {"jeton": "...", "login": "...", "pin": "...", "url": "...", "uuid": "..."}
Sortie (JSON sur stdout) si succes : {"ok": true, "credentials": {...}}
Sortie (JSON sur stdout) si echec : {"ok": false, "error": "..."}
"""

import json
import sys

import pronotepy


def main() -> None:
    payload = json.load(sys.stdin)

    qr_code = {
        "jeton": payload["jeton"],
        "login": payload["login"],
        "url": payload["url"]
    }

    try:
        client = pronotepy.Client.qrcode_login(
            qr_code,
            payload["pin"],
            payload["uuid"]
        )
    except Exception as error:  # noqa: BLE001 - on veut capturer et rapporter n'importe quelle erreur
        print(json.dumps({"ok": False, "error": f"{type(error).__name__}: {error}"}))
        return

    if not client.logged_in:
        print(json.dumps({"ok": False, "error": "Client cree mais pas connecte (logged_in=False)"}))
        return

    print(json.dumps({"ok": True, "credentials": client.export_credentials()}))


if __name__ == "__main__":
    main()
