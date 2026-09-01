/* Einstieg: Spiel anlegen, Oberfläche binden, Titelbild zeigen. */
(function (ATL) {
  window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('scene');
    const g = new ATL.Game(canvas);
    ATL.game = g;
    const ui = new ATL.UI(g);
    g.start();
    const params = new URLSearchParams(location.search);
    if (params.get('test') === '1') { g.fast = true; }
    g.state = g.newState();
    g.hero = g.actor('falk');
    await g.goto('title', 0, 0, 'd', { noFade: true });
    g.fade = 0;
    if (params.get('test') !== '1') ui.toggleMenu(true);
    else if (params.get('start') === '1') await ATL.story.newGame(g);
  });
})(window.ATL);
