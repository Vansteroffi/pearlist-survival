/*
  Phaser Loader (robust)
  - Tries local phaser.min.js first (offline-friendly)
  - Then falls back to 2 CDNs
  - Only loads game.js once Phaser is available
*/
(function(){
  const container = document.getElementById('game-container');

  function showFatal(msg){
    const div = document.createElement('div');
    div.className = 'overlay box-shadow';
    // Utilisation des styles du nouveau thème
    div.style.opacity = "1"; div.style.visibility = "visible";
    div.innerHTML = `
      <div class="panel panel--paper" style="border-color:var(--danger)">
        <h2 style="margin-top:0;color:var(--danger)">Erreur de lancement</h2>
        <p class="lead" style="margin:10px 0;font-size:1rem">${msg}</p>
        <p class="muted" style="margin:10px 0 0 0;font-size:0.9rem">
          Solution : lance le jeu via un serveur local (ex: Extension "Live Server" sur VS Code, ou "python -m http.server").
        </p>
      </div>`;
    const mainMenu = document.getElementById('main-menu');
    if(mainMenu) mainMenu.classList.add('hidden');
    container.appendChild(div);
  }

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve(src);
      s.onerror = () => reject(new Error('failed: ' + src));
      document.head.appendChild(s);
    });
  }

  async function boot(){
    if(window.Phaser){ await loadScript('game.js'); return; }
    const candidates = [
      'phaser.min.js',
      'https://cdn.jsdelivr.net/npm/phaser@3.60.0/dist/phaser-arcade-physics.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser-arcade-physics.min.js'
    ];
    let ok = false;
    for(const src of candidates){
      try{ await loadScript(src); if(window.Phaser){ ok = true; break; } }catch(e){}
    }
    if(!ok){ showFatal("Impossible de charger Phaser. Vérifie ta connexion ou utilise un serveur local."); return; }
    try{ await loadScript('game.js'); }catch(e){ showFatal("Impossible de charger game.js."); }
  }
  boot();
})();