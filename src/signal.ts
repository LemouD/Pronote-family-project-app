/**
 * Signal de l'espace enfant : meme banniere, meme son, quelle que soit la
 * raison. La fin d'un bloc de "Mon temps" et l'heure d'une priere sonnent
 * pareil - un enfant apprend un signal, pas un par fonctionnalite.
 *
 * Le son est synthetise avec l'API Web Audio plutot que joue depuis un
 * fichier : rien a telecharger, rien a servir, et la CSP reste en 'self'.
 */

export const SIGNAL_STYLE = `
  .signal {
    position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
    z-index: 60; width: min(440px, calc(100vw - 32px));
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-radius: 18px;
    background: var(--accent); color: #fff;
    box-shadow: 0 10px 30px rgba(0, 0, 0, .25);
    font-weight: 800; font-size: 16px;
    animation: signal-in .25s ease-out;
  }
  .signal[hidden] { display: none; }
  .signal svg { width: 24px; height: 24px; flex-shrink: 0; }
  .signal span { flex: 1; }
  .signal button {
    font: inherit; font-size: 14px; font-weight: 800;
    min-height: 40px; padding: 8px 16px;
    background: rgba(255, 255, 255, .22); color: #fff;
    border: none; border-radius: 12px; cursor: pointer;
  }
  @keyframes signal-in { from { opacity: 0; transform: translate(-50%, 16px); } }

  /* Le clignotement double le son : sur une tablette en silencieux, il reste
     quelque chose a voir. */
  .signal-flash { animation: signal-flash 1s ease-in-out 3; }
  @keyframes signal-flash { 50% { background: var(--accent-soft); } }

  @media (prefers-reduced-motion: reduce) {
    .signal { animation: none; }
    .signal-flash { animation: none; }
  }
`;

const BELL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`;

/**
 * aria-live="assertive" : un enfant qui utilise un lecteur d'ecran doit etre
 * interrompu par ce message, c'est tout son interet.
 */
export const SIGNAL_BANNER = `
  <div class="signal" id="signal" role="status" aria-live="assertive" hidden>
    ${BELL}<span id="signal-text"></span>
    <button type="button" id="signal-ok">OK</button>
  </div>
`;

export const SIGNAL_SCRIPT = `
  (() => {
    let audio = null;

    function context() {
      if (audio) return audio;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try { audio = new Ctx(); } catch (error) { return null; }
      return audio;
    }

    // Un navigateur refuse de jouer un son avant que l'utilisateur ait touche
    // la page. On profite donc du premier geste, quel qu'il soit, pour ouvrir
    // le contexte audio - sinon le signal de fin de bloc serait muet.
    function unlock() {
      const ctx = context();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);

    function chime() {
      const ctx = context();
      if (!ctx || ctx.state !== "running") return;
      const notes = [880, 1174.7, 1318.5];
      const now = ctx.currentTime;
      notes.forEach((frequency, index) => {
        const start = now + index * 0.18;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    }

    const banner = document.getElementById("signal");
    const text = document.getElementById("signal-text");
    document.getElementById("signal-ok")?.addEventListener("click", () => {
      if (banner) banner.hidden = true;
    });

    // Expose au reste de la page. Le son peut echouer (onglet muet, pas de
    // geste prealable) : le visuel, lui, passe toujours.
    window.familySignal = (message) => {
      if (banner && text) {
        text.textContent = message;
        banner.hidden = false;
        banner.classList.remove("signal-flash");
        void banner.offsetWidth;
        banner.classList.add("signal-flash");
      }
      if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (error) {} }
      chime();
    };
  })();
`;
