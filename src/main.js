import Game from './Game.js';
import { mpapi } from './mpapi.js';  // NY: Från nya repo

const canvas = document.getElementById('game-board');
const game = new Game(canvas);
const api = new mpapi('wss://mpapi.se/multiplayer', crypto.randomUUID());  // NY: Public server, ingen lokal!

// Keymaps för 4 spelare
const keyMaps = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },    // P1: Piltangenter
  { up: 'w', down: 's', left: 'a', right: 'd' },                                    // P2: WASD
  { up: 't', down: 'g', left: 'f', right: 'h' },                                    // P3: TFGH
  { up: 'i', down: 'k', left: 'j', right: 'l' }                                     // P4: IJKL
];

// Override drawTitleScreen med multiplayer-text
game.drawTitleScreen = function() {
  this.ctx.fillStyle = this.introBgColor;
  this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  this.ctx.textAlign = 'center';
  this.ctx.textBaseline = 'middle';
  this.ctx.font = '192px VT323, monospace';
  this.ctx.fillStyle = '#2D2D2D';
  this.ctx.fillText('WORM SLAYER', this.canvas.width / 2, this.canvas.height / 2 - 100);
  this.ctx.font = '48px Silkscreen, sans-serif';
  this.ctx.fillText('Enter: Local | H: Host Multi | J: Join Multi', this.canvas.width / 2, this.canvas.height / 2 + 100);
};

document.addEventListener('keydown', (e) => {
  if (!game.isRunning) {
    if (e.key === 'Enter') {
      game.start(false);  // Local
    } else if (e.key.toLowerCase() === 'h') {
      startMultiplayer(true);  // Host
    } else if (e.key.toLowerCase() === 'j') {
      startMultiplayer(false);  // Join
    }
    return;
  }
  if (game.isRunning) {
    const key = e.key.toLowerCase();
    if (key === ' ') {  // Space skjuter tunga
      if (!game.isMultiplayer) {
        game.worms.forEach(worm => worm.shootTongue());
      } else if (!game.isHost) {
        game.api.transmit({ type: 'input', playerIndex: game.myPlayerIndex, shoot: true });
      }
      return;
    }
    if (!game.isMultiplayer) {
      keyMaps.forEach((map, i) => {
        const worm = game.worms[i];
        if (!worm) return;
        if (key === map.up.toLowerCase() && worm.direction !== 'down') worm.direction = 'up';
        if (key === map.down.toLowerCase() && worm.direction !== 'up') worm.direction = 'down';
        if (key === map.left.toLowerCase() && worm.direction !== 'right') worm.direction = 'left';
        if (key === map.right.toLowerCase() && worm.direction !== 'left') worm.direction = 'right';
      });
    } else if (!game.isHost) {
      let direction = null;
      const map = keyMaps[game.myPlayerIndex] || keyMaps[0];
      if (key === map.up.toLowerCase()) direction = 'up';
      if (key === map.down.toLowerCase()) direction = 'down';
      if (key === map.left.toLowerCase()) direction = 'left';
      if (key === map.right.toLowerCase()) direction = 'right';
      if (direction && game.worms[game.myPlayerIndex]?.direction !== opposite(direction)) {
        game.api.transmit({ type: 'input', playerIndex: game.myPlayerIndex, direction });
      }
    }
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
        • Ät aqua-ruta (var 10s) → +1 tungskott.<br>
        • Space skjuter tunga (3 rutor fram, för alla!).<br>
        • Tunga dödar fiende eller fyller hål inom räckvidd.<br>
        • Krock vägg/kropp/hål/annan mask → reset (längd 2).<br>
        • Längst vid tid 0 vinner! 4P lokal kaos.
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 32px; padding: 16px; font-size: 32px; background: #19E9FF; border: none; cursor: pointer;">Stäng</button>
    </div>
  `;
  document.body.appendChild(popup);
});

// Start multiplayer
async function startMultiplayer(isHost) {
  game.isMultiplayer = true;
  game.isHost = isHost;
  game.api = api;
  game.messageBuffer = [];
  game.lastMessageId = -1;

  const unsubscribe = api.listen((event, messageId, clientId, data) => {
    if (event === 'joined') {
      if (game.isHost) {
        const playerIndex = game.worms.length;
        const occupied = game.obstacles.concat(game.worms.flatMap(w => w.segments));
        const newWorm = new Worm(colors[playerIndex % colors.length], null, null, playerIndex);
        newWorm.reset(null, null, game.cols, game.rows, occupied);
        game.worms.push(newWorm);
        game.api.transmit({ type: 'assign', playerIndex }, clientId);
        game.api.transmit({ type: 'state', ...game.getFullState() });
      }
    } else if (event === 'game') {
      game.messageBuffer.push({ messageId, data });
      game.messageBuffer.sort((a, b) => a.messageId - b.messageId);
      while (game.messageBuffer.length && game.messageBuffer[0].messageId === game.lastMessageId + 1) {
        const msg = game.messageBuffer.shift();
        game.lastMessageId = msg.messageId;
        game.processMessage(msg.data);
      }
    }
  });

  if (isHost) {
    const hostPromise = api.host({ name: 'WormSlayer', private: false });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout: No response from server'), 5000));
    Promise.race([hostPromise, timeoutPromise])
      .then(({ session }) => {
        alert(`Session ID: ${session}`);
        game.myPlayerIndex = 0;
        game.start(true);
      })
      .catch(e => {
        console.error('Host error:', e);
        alert('Failed to host: ' + e);
      });
  } else {
    const sessionID = prompt('Ange Session ID:');
    if (!sessionID) return; // Avbryt om tomt
    const joinPromise = api.join(sessionID, { name: 'Guest' });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject('Timeout: No response from server'), 5000));
    Promise.race([joinPromise, timeoutPromise])
      .then(() => {
        game.myPlayerIndex = -1;  // Vänta på assign
        game.start(true);
      })
      .catch(e => {
        console.error('Join error:', e);
        alert('Failed to join: ' + e);
      });
  }
}

// Hjälpfunktion
function opposite(dir) {
  if (dir === 'up') return 'down';
  if (dir === 'down') return 'up';
  if (dir === 'left') return 'right';
  if (dir === 'right') return 'left';
}

const colors = ['#19E9FF', '#FF2B6F', '#FFF034', '#FF94A6'];

game.drawTitleScreen();