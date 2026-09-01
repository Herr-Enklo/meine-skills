/* Handlungsrahmen: Spielstart, Titelbild, Rätsel-Lösung der drei Siegel, Reiseziele. */
(function (ATL) {
  const A = ATL.A;
  const S = {};

  // Die Lösung des Ringschlosses hängt vom Spielstand-Startwert ab.
  S.solution = function (g) {
    const r = ATL.U.rng(g.state.seed + 77);
    const idx = [0, 1, 2, 3, 4, 5, 6, 7];
    const out = [];
    while (out.length < 3) { const k = Math.floor(r() * idx.length); out.push(idx.splice(k, 1)[0]); }
    return out;
  };
  S.riddle = function (g) {
    const sol = S.solution(g);
    const sy = ATL.puzzles.SYMBOLS;
    return 'Dies hörte Solon von den Priestern der Neith und ließ es hier bewahren:\n\n' +
      'Drei Siegel hüten das Tor unter dem brennenden Berg. Wer es öffnen will, drehe die Ringe.\n\n' +
      `Das Siegel der Sonne weise ${sy[sol[0]].riddle}.\n` +
      `Das Siegel des Stiers weise ${sy[sol[1]].riddle}.\n` +
      `Das Siegel der Flut weise ${sy[sol[2]].riddle}.\n\n` +
      'Das Siegel des Stiers ruht bei dem, der im Haus des Minos hinter dem Faden wartet. Das Siegel der Flut ruht bei den Weisen, die aus dem Meer kamen, im Haus des süßen Wassers.\n\n' +
      'Und der Erstgeborene öffne die Halle der Zehn, mit seinem Zwilling an der Hand.';
  };

  // Reiseziele auf der Karte
  S.locations = {
    whitmore: { name: 'Whitmore College', x: 150, y: 205, room: 'p_courtyard', pos: [480, 520], dir: 'd', cond: (g) => !g.flag('prolog_fertig') },
    newyork: { name: 'New York', x: 175, y: 240, room: 'ny_street', pos: [200, 520], dir: 'r', cond: (g) => g.flag('kessler_geflohen') },
    alexandria: { name: 'Alexandria', x: 655, y: 335, room: 'eg_harbor', pos: [200, 520], dir: 'r', cond: (g) => g.flag('ny_fertig') },
    kreta: { name: 'Kreta', x: 603, y: 300, room: 'cr_village', pos: [160, 520], dir: 'r', cond: (g) => g.flag('eg_fertig') },
    eridu: { name: 'Eridu', x: 815, y: 345, room: 'me_camp', pos: [160, 520], dir: 'r', cond: (g) => g.flag('eg_fertig') },
    thera: { name: 'Thera', x: 618, y: 272, room: 'th_harbor', pos: [200, 520], dir: 'r', cond: (g) => g.has('sonnensiegel') && g.has('stiersiegel') && g.has('flutsiegel') },
  };

  S.openMap = async function (g, from) {
    g.set('ort', from || g.flag('ort'));
    await g.goto('map');
  };

  S.travel = async function (g, destId) {
    const from = S.locations[g.flag('ort')] || S.locations.whitmore;
    const to = S.locations[destId];
    g.set('reise', { from: [from.x, from.y], to: [to.x, to.y], t: 0 });
    await g.scene(async () => {
      if (!g.fast) await new Promise((r) => { const st = performance.now(); const step = () => { const t = Math.min(1, (performance.now() - st) / 2200); g.state.flags.reise.t = t; if (t < 1) requestAnimationFrame(step); else r(); }; step(); });
      g.set('reise', null);
      g.set('ort', destId);
      await g.goto(to.room, to.pos[0], to.pos[1], to.dir);
    });
  };

  // ---------- Titelbild ----------
  ATL.rooms.define({
    id: 'title', name: '', noHero: true, ambient: 'map', noSave: true,
    paint(ctx) {
      A.sky(ctx, 960, 600, '#0a0f2a', '#3a2a5a');
      A.stars(ctx, 960, 300, 160, 8);
      A.sun(ctx, 480, 300, 60, '#ffd890');
      A.sea(ctx, 0, 320, 960, 280, '#2a3a6a', '#0a1020', 4);
      // Ringe von Atlantis als Silhouette
      for (let i = 0; i < 4; i++) A.ell(ctx, 480, 330, 300 - i * 70, 40 - i * 8, null, i % 2 ? 'rgba(100,220,200,0.35)' : 'rgba(40,60,100,0.8)', 6);
      A.ell(ctx, 480, 330, 40, 8, '#1a2a3a');
      A.column(ctx, 480, 332, 60, 14, '#8a9aa0', 'atlantis');
      A.mountains(ctx, 960, 330, '#141a2a', 21, 90, 130);
      A.vignette(ctx, 960, 600, 0.6);
      A.grain(ctx, 960, 600, 3, 0.04);
    },
    animate(ctx, t) { A.waterAnim(ctx, 0, 330, 960, 270, t, 'rgba(180,220,255,0.1)'); },
  });

  S.newGame = async function (g) {
    g.state = g.newState();
    g.actors = {};
    g.hero = g.actor('falk');
    g.busy = false; g.phase = null; g.cutscene = false; g.inDialog = false;
    if (g.ui) { g.ui.setCutscene(false); g.ui.hideDialog(); g.ui.refreshInventory(); }
    g.take('taschenmesser', { silent: true });
    g.take('uhr', { silent: true });
    g.take('muenzen', { silent: true });
    g.set('ort', 'whitmore');
    await g.goto('p_office', 480, 520, 'd');
  };

  ATL.story = S;
})(window.ATL);
