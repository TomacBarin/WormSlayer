import Game from './Game.js';

const canvas = document.getElementById('game-board');
const game = new Game(canvas);

// Keymaps för 4 spelare
const keyMaps = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },    // P1: Piltangenter
  { up: 'w', down: 's', left: 'a', right: 'd' },                                    // P2: WASD
  { up: 't', down: 'g', left: 'f', right: 'h' },                                    // P3: TFGH
  { up: 'i', down: 'k', left: 'j', right: 'l' }                                     // P4: IJKL
];

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!game.isRunning) {
      game.start();
    } else {
      game.stop();
      game.start();  // Restart
    }
    return;
  }
  if (game.isRunning) {
    const key = e.key.toLowerCase();
    if (key === ' ') {  // Shoot tunga för alla (kaos!)
      game.worms.forEach(worm => worm.shootTongue());
      return;
    }
    keyMaps.forEach((map, i) => {
      const worm = game.worms[i];
      if (!worm) return;
      if (key === map.up.toLowerCase() && worm.direction !== 'down') worm.direction = 'up';
      if (key === map.down.toLowerCase() && worm.direction !== 'up') worm.direction = 'down';
      if (key === map.left.toLowerCase() && worm.direction !== 'right') worm.direction = 'left';
      if (key === map.right.toLowerCase() && worm.direction !== 'left') worm.direction = 'right';
    });
  }
});

// Info-popup (?-knapp)
const infoBtn = document.getElementById('infoBtn');
infoBtn.addEventListener('click', () => {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
    background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
    z-index: 1000; font-family: VT323; color: #EEEEEE; padding: 64px; box-sizing: border-box;
  `;
  popup.innerHTML = `
    <div style="background: #484848; padding: 48px; max-width: 80%; max-height: 80%; overflow: auto; border: 4px solid #646464;">
      <h1 style="font-size: 64px; text-align: center; margin-bottom: 32px;">REGLER</h1>
      <p style="font-size: 28px; line-height: 1.4;">
        • Styr din mask med pilar/WASD/TFGH/IJKL.<br>
        • Ät vit mat → växt + poäng + mörkt hål (farligt!).<br>
        • Ät aqua-ruta → +1 tungskott (space skjuter!).<br>
        • Tunga dödar annan mask eller fyller igen hål inom 3 rutor.<br>
        • Krock vägg/kropp/hål/annan mask → reset (längd 2).<br>
        • Längst vid tid 0 vinner!<br>
        • 4 spelare lokal. Multiplayer kommer!
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 32px; padding: 16px; font-size: 32px; background: #19E9FF; border: none; cursor: pointer;">Stäng</button>
    </div>
  `;
  document.body.appendChild(popup);
});

game.drawTitleScreen();