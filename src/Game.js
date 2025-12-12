// src/Game.js (uppdaterad – tagit bort powerup och tunga-relaterat)
import Worm from './Worm.js';
import Food from './Food.js';
import Scoreboard from './Scoreboard.js';

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
    this.worms = [];
    this.food = null;
    this.obstacles = [];
    this.timeLeft = 999;
    this.tickInterval = null;
    this.timerEl = document.getElementById('timer');
    this.scoreEls = [...document.querySelectorAll('.scoreContainer')].map(el => el.lastChild);
    this.updateOffsets();
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

  start() {
    this.isRunning = true;
    this.offsetX = 0;
    this.offsetY = 0;
    this.timeLeft = 999;
    this.obstacles = [];
    this.worms = [
      new Worm('#19E9FF', 3, 3, 0),
      new Worm('#FF2B6F', 30, 3, 1),
      new Worm('#FFF034', 3, 14, 2),
      new Worm('#FF94A6', 30, 14, 3)
    ];
    this.food = new Food(this.cols, this.rows, this.obstacles);
    this.tickInterval = setInterval(this.update.bind(this), 132);
    this.update();
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, '0')}`;
    this.scoreEls.forEach(el => el.textContent = '000');
  }

  stop() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.isRunning = false;
  }

  update() {
    if (!this.isRunning) return;

    this.timeLeft--;
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, '0')}`;

    if (this.timeLeft <= 0) {
      this.gameOver();
      return;
    }

    const allSegments = [];
    this.worms.forEach(worm => {
      worm.move();
      const head = worm.segments[0];
      const collision = worm.checkCollision(
        head,
        this.cols,
        this.rows,
        worm.segments,
        this.food.pos,
        this.obstacles
      );
      if (collision === 'wall' || collision === 'self' || collision === 'obstacle') {
        const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
        worm.reset(null, null, this.cols, this.rows, occupied);
      } else if (collision === 'food') {
        worm.grow();
        this.obstacles.push({ ...this.food.pos });
        this.food.newPos(allSegments, this.obstacles);
      }

      allSegments.push(...worm.segments);
    });

    this.worms.forEach((worm, i) => {
      const head = worm.segments[0];
      const hitOther = this.worms.some((other, j) => i !== j && other.segments.some(seg => seg.x === head.x && seg.y === head.y));
      if (hitOther) {
        const occupied = this.obstacles.concat(this.worms.flatMap(w => w.segments));
        worm.reset(null, null, this.cols, this.rows, occupied);
      }
    });

    this.drawGrid();
    this.drawFood();
    this.drawWorms();

    this.worms.forEach((worm, i) => {
      const score = (worm.segments.length - 1) % 1000;
      if (this.scoreEls[i]) this.scoreEls[i].textContent = score.toString().padStart(3, '0');
    });
  }

  drawFood() {
    const x = this.offsetX + this.food.pos.x * (this.cellSize + this.gap);
    const y = this.offsetY + this.food.pos.y * (this.cellSize + this.gap);
    this.ctx.fillStyle = '#EEEEEE';
    this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
  }

  drawWorms() {
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
    this.ctx.fillText('Press enter to play again', this.canvas.width / 2, this.canvas.height / 2 + 130);

    // Scoreboard
    const finalScores = this.worms.map(w => ({ name: `Player ${w.playerIndex + 1}`, score: w.segments.length - 1 }));
    const maxScore = Math.max(...finalScores.map(s => s.score));
    const winnerName = finalScores.find(s => s.score === maxScore).name;
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