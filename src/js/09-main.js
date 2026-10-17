// Inicialização e laço principal.
(function main() {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    Game.tick(dt);
    Render.draw(dt);
    requestAnimationFrame(frame);
  }

  function start() {
    UI.boot();
    requestAnimationFrame(frame);
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('10px "Bungee"'), document.fonts.load('800 10px "Nunito"')])
        .then(() => (Game.G.staticDirty = true))
        .catch(() => {});
    }
  }

  // Acesso para depuração no console.
  window.LucasKong = { Game, Store, UI, Sound, Input, Art, buildLevel };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
