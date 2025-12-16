import Worm from './Worm.js';
import Food from './Food.js';
import Powerup from './Powerup.js';
import Scoreboard from './Scoreboard.js';

const colors = ['#19E9FF', '#FF2B6F', '#FFF034', '#FF94A6'];

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = 24;
    this.gap = 6;
    this.cols = 34;
    this.rows = 17;
    this.introBgColor = '#646464';
    this.gameBgColor = '#2D2D2D';
    this.cellColor = '#646464';
    this.obstacleColor = '#2D2D2D';
    this.isRunning = false;
    this.isMultiplayer = false;
    this.isHost = false;
    this.api = null;
    this.myPlayerIndex = null;
    this.lastFrameTime = 0;
    this.frameInterval = 66;  // FIX: ~15 FPS för bättre känsla (120 BPM-syncbart)
    this.frameCounter = 0;
    this.worms = [];
    this.food = null;
    this.powerup = null;
    this.powerupTimer = 0;
    this.foodEaten = false;
    this.obstacles = [];
    this.timeLeft = 999;
    this.timerEl = document.getElementById('timer');
    this.scoreEls = [...document.querySelectorAll('.scoreContainer')].map(el => el.lastChild);
    this.updateOffsets();
  }

  opposite(dir) {
    if (dir === 'up') return 'down';
    if (dir === 'down') return 'up';
    if (dir === 'left') return 'right';
    if (dir === 'right') return 'left';
    return null;
  }

  updateOffsets() {
    this.offsetX = (1024 - (this.cols * this.cellSize + (this.cols - 1) * this.gap)) / 2;
    this.offsetY = (512 - (this.rows * this.cellSize + (this.rows - 1) * this.gap)) / 2;
  }

  drawTitleScreen() {
    this.ctx.fillStyle = this.introBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '192px VT323, monospace';
    this.ctx.fillStyle = '#2D2D2D';
    this.ctx.fillText('WORM SLAYER', this.canvas.width / 2, this.canvas.height / 2 - 60);
    this.ctx.font = '48px Silkscreen, sans-serif';
    this.ctx.fillText('Press enter to play', this.canvas.width / 2, this.canvas.height / 2 + 70);
  }

  drawGrid() {
    this.ctx.fillStyle = this.gameBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = this.cellColor;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const pos = { x: col, y: row };
        if (!this.obstacles.some(obs => obs.x === pos.x && obs.y === pos.y)) {
          const x = this.offsetX + col * (this.cellSize + this.gap);
          const y = this.offsetY + row * (this.cellSize + this.gap);
          this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        }
      }
    }
  }

  start(isMulti = false) {
    this.isMultiplayer = isMulti;
    this.isRunning = true;
    this.timeLeft = 999;
    this.obstacles = [];
    this.powerupTimer = 0;
    this.powerup = null;
    this.foodEaten = false;
    if (this.isHost || !isMulti) {
      this.worms = [new Worm('#19E9FF', 3, 3, 0)];
      if (!isMulti) {
        this.worms.push(new Worm('#FF2B6F', 30, 3, 1));
        this.worms.push(new Worm('#FFF034', 3, 14, 2));
        this.worms.push(new Worm('#FF94A6', 30, 14, 3));
      }
      this.food = new Food(this.cols, this.rows);
    } else {
      this.worms = [];
    }
    this.lastFrameTime = performance.now();
    this.frameCounter = 0;
    requestAnimationFrame(this.update.bind(this));
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, '0')}`;
    this.scoreEls.forEach(el => el.textContent = '000');
  }

  stop() {
    this.isRunning = false;
  }

  update(timestamp) {
    if (!this.isRunning) return;

    const delta = timestamp - this.lastFrameTime;
    if (delta >= this.frameInterval) {
      this.lastFrameTime = timestamp - (delta % this.frameInterval);
      this.updateLogic();
      this.frameCounter++;
    }

    this.drawAll();

    requestAnimationFrame(this.update.bind(this));
  }

  updateLogic() {
    this.timeLeft--;
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, '0')}`;

    if (this.timeLeft <= 0) {
      this.gameOver();
      return;
    }

    const isFullLogic = this.isHost || !this.isMultiplayer;

    // FIX: ALLTID move alla worms (prediktion på klient)
    this.worms.forEach(worm => {
      worm.move(this.cols, this.rows);
      worm.updateShoot();
    });

    // FIX: Powerup spawn bara på host/lokal
    this.powerupTimer++;
    if (this.powerupTimer >= 75 && !this.powerup && isFullLogic) {
      const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
      this.powerup = new Powerup(this.cols, this.rows, occupied);
      this.powerupTimer = 0;
    }

    // FIX: Collision/logic GROW/FOOD/RESET bara på host/lokal
    if (isFullLogic) {
      this.foodEaten = false;
      this.worms.forEach(worm => {
        const head = worm.segments[0];
        const powerupPos = this.powerup ? this.powerup.pos : null;
        const collision = worm.checkCollision(
          head,
          this.cols,
          this.rows,
          worm.segments,
          this.food ? this.food.pos : null,
          powerupPos,
          this.obstacles
        );
        if (collision === 'wall' || collision === 'self' || collision === 'obstacle') {
          const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
          worm.reset(null, null, this.cols, this.rows, occupied);
        } else if (collision === 'food') {
          worm.grow();
          this.obstacles.push({ ...this.food.pos });
          this.foodEaten = true;
          // Ljud här: new Audio('eat.wav').play();
        } else if (collision === 'powerup') {
          worm.tongueShots++;
          this.powerup = null;
          this.powerupTimer = 0;
        }
      });

      if (this.foodEaten) {
        const occupied = this.worms.flatMap(w => w.segments).concat(this.obstacles);
        this.food.newPos(occupied);
      }

      // Tunga-effekter bara på host
      this.worms.forEach(worm => {
        if (worm.isShooting) {
          const tonguePos = worm.getTonguePositions(this.cols, this.rows);
          tonguePos.forEach(pos => {
            this.worms.forEach(other => {
              if (other !== worm && other.segments.some(seg => seg.x === pos.x && seg.y === pos.y)) {
                const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
                other.reset(null, null, this.cols, this.rows, occupied);
              }
            });
            const obsIndex = this.obstacles.findIndex(obs => obs.x === pos.x && obs.y === pos.y);
            if (obsIndex > -1) {
              this.obstacles.splice(obsIndex, 1);
            }
          });
        }
      });

      // Mask-mot-mask kollision
      this.worms.forEach((worm, i) => {
        const head = worm.segments[0];
        const hitOther = this.worms.some((other, j) => i !== j && other.segments.some(seg => seg.x === head.x && seg.y === head.y));
        if (hitOther) {
          const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
          worm.reset(null, null, this.cols, this.rows, occupied);
        }
      });
    }

    // Scores alltid
    this.worms.forEach((worm, i) => {
      const score = (worm.segments.length - 1) % 1000;
      if (this.scoreEls[i]) this.scoreEls[i].textContent = score.toString().padStart(3, '0');
    });

    // FIX: Sync VARJE frame på host (minimal lag)
    if (this.isMultiplayer && this.isHost) {
      try {
        this.api.transmit({ type: 'state', ...this.getFullState() });
      } catch (e) {
        console.error('Transmit error:', e);
      }
    }
  }

  drawAll() {
    this.drawGrid();
    if (this.food) this.drawFood();
    if (this.powerup) this.drawPowerup();
    this.drawWorms();
  }

  getFullState() {
    return {
      worms: this.worms.map(w => ({
        playerIndex: w.playerIndex,
        segments: w.segments.map(s => ({ x: s.x, y: s.y })),
        direction: w.direction,
        tongueShots: w.tongueShots,
        isShooting: w.isShooting,
        shootTimer: w.shootTimer
      })),
      food: this.food ? { x: this.food.pos.x, y: this.food.pos.y } : null,
      powerup: this.powerup ? { x: this.powerup.pos.x, y: this.powerup.pos.y } : null,
      obstacles: this.obstacles.map(o => ({ x: o.x, y: o.y })),
      timeLeft: this.timeLeft
    };
  }

  processMessage(data, clientId) {
    if (data.type === 'assign' && this.myPlayerIndex === -1) {
      this.myPlayerIndex = data.playerIndex;
      console.log('Client assigned playerIndex:', data.playerIndex);
      return;
    }
    if (data.type === 'state') {
      // FIX: Snap ALL state (prediktion korrigeras)
      this.timeLeft = data.timeLeft || this.timeLeft;
      if (data.food) {
        this.food = new Food(this.cols, this.rows);
        this.food.pos = data.food;
      }
      if (data.powerup) {
        this.powerup = new Powerup(this.cols, this.rows);
        this.powerup.pos = data.powerup;
      } else {
        this.powerup = null;
      }
      this.obstacles = data.obstacles || [];

      // Rebuild worms (snap)
      this.worms = [];
      (data.worms || []).forEach(wState => {
        const worm = new Worm(colors[wState.playerIndex % colors.length], 0, 0, wState.playerIndex);
        worm.segments = wState.segments;
        worm.direction = wState.direction;
        worm.tongueShots = wState.tongueShots;
        worm.isShooting = wState.isShooting;
        worm.shootTimer = wState.shootTimer;
        this.worms.push(worm);
      });
      return;
    }
    if (data.type === 'input' && this.isHost) {
      const worm = this.worms.find(w => w.playerIndex === data.playerIndex);
      if (worm) {
        if (data.direction && worm.direction !== this.opposite(data.direction)) {
          worm.direction = data.direction;
        }
        if (data.shoot) worm.shootTongue();
      }
    }
    if (data.type === 'request_assign' && this.isHost) {
      const playerIndex = this.worms.length;
      const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
      const newWorm = new Worm(colors[playerIndex % colors.length], null, null, playerIndex);
      newWorm.reset(null, null, this.cols, this.rows, occupied);
      this.worms.push(newWorm);
      this.api.transmit({ type: 'assign', playerIndex }, clientId);
      this.api.transmit({ type: 'state', ...this.getFullState() });
    }
  }

  drawPowerup() {
    if (!this.powerup) return;
    const x = this.offsetX + this.powerup.pos.x * (this.cellSize + this.gap);
    const y = this.offsetY + this.powerup.pos.y * (this.cellSize + this.gap);
    this.ctx.fillStyle = '#5CFFE8';
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
  }

  drawFood() {
    if (!this.food) return;
    const x = this.offsetX + this.food.pos.x * (this.cellSize + this.gap);
    const y = this.offsetY + this.food.pos.y * (this.cellSize + this.gap);
    this.ctx.fillStyle = '#EEEEEE';
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
  }

  drawWorms() {
    // FIX: Borttagen spammig logg
    this.worms.forEach(worm => {
      worm.segments.forEach((segment, index) => {
        if (segment.x >= 0 && segment.x < this.cols && segment.y >= 0 && segment.y < this.rows) {
          const x = this.offsetX + segment.x * (this.cellSize + this.gap);
          const y = this.offsetY + segment.y * (this.cellSize + this.gap);
          this.ctx.fillStyle = worm.color;
          if (index === 0) {
            this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
          } else {
            const tailSize = Math.round(this.cellSize * 0.6);
            const tailOffset = (this.cellSize - tailSize) / 2;
            this.ctx.fillRect(x + tailOffset, y + tailOffset, tailSize, tailSize);
          }
        }
      });

      if (worm.isShooting) {
        const tonguePos = worm.getTonguePositions(this.cols, this.rows);
        tonguePos.forEach(pos => {
          if (pos.x >= 0 && pos.x < this.cols && pos.y >= 0 && pos.y < this.rows) {
            const x = this.offsetX + pos.x * (this.cellSize + this.gap);
            const y = this.offsetY + pos.y * (this.cellSize + this.gap);
            this.ctx.fillStyle = worm.color;
            const thickness = Math.max(2, Math.round(this.cellSize * 0.12));
            if (worm.direction === 'left' || worm.direction === 'right') {
              const height = thickness;
              this.ctx.fillRect(x, y + (this.cellSize - height) / 2, this.cellSize, height);
            } else {
              const width = thickness;
              this.ctx.fillRect(x + (this.cellSize - width) / 2, y, width, this.cellSize);
            }
          }
        });
      }
    });
  }

  gameOver() {
    this.stop();
    this.ctx.fillStyle = this.gameBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '192px VT323, monospace';
    this.ctx.fillStyle = '#EEEEEE';
    this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 60);

    if (this.worms.length > 0) {
      const winner = this.worms.reduce((win, w) => {
        const winLen = win.segments.length;
        const wLen = w.segments.length;
        if (wLen > winLen || (wLen === winLen && w.playerIndex < win.playerIndex)) {
          return w;
        }
        return win;
      }, this.worms[0]);
      this.ctx.font = '48px Silkscreen, sans-serif';
      this.ctx.fillStyle = winner.color;
      this.ctx.fillText('WINNER', this.canvas.width / 2, this.canvas.height / 2 + 70);
    }

    this.ctx.fillStyle = '#EEEEEE';
    this.ctx.font = '32px Silkscreen, sans-serif';
    this.ctx.fillText('Press enter to play again', this.canvas.width / 2, this.canvas.height / 2 + 130);

    // Scoreboard för vinnare
    const finalScores = this.worms.map(w => ({ name: `Player ${w.playerIndex + 1}`, score: w.segments.length - 1 }));
    const maxScore = Math.max(...finalScores.map(s => s.score));
    const winnerName = finalScores.find(s => s.score === maxScore)?.name || 'Player 1';
    const name = prompt('Ditt namn för highscore? (för vinnaren)');
    if (name) Scoreboard.add(name, maxScore);
    else Scoreboard.add(winnerName, maxScore);

    const sbContainer = document.createElement('div');
    sbContainer.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
      background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
      z-index: 1000;
    `;
    Scoreboard.render(sbContainer);
    document.body.appendChild(sbContainer);
  }
}