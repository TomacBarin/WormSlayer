// Game.js
import Worm from "./Worm.js";
import Food from "./Food.js";
import Powerup from "./Powerup.js";
import Scoreboard from "./Scoreboard.js";

const colors = ["#19E9FF", "#FF2B6F", "#FFF034", "#FF94A6"];

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cellSize = 24;
    this.gap = 6;
    this.cols = 34;
    this.rows = 17;
    this.introBgColor = "#646464";
    this.gameBgColor = "#2D2D2D";
    this.cellColor = "#646464";
    this.obstacleColor = "#2D2D2D";
    this.isRunning = false;
    this.isMultiplayer = false;
    this.isHost = false;
    this.api = null;
    this.myPlayerIndex = null;
    this.myClientId = null; // NY: För lobby
    this.lastFrameTime = 0;
    this.frameInterval = 120; // Återställt till original 120ms (500 BPM)
    this.frameCounter = 0;
    this.worms = [];
    this.food = null;
    this.powerup = null;
    this.powerupTimer = 0;
    this.foodEaten = false;
    this.obstacles = [];
    this.timeLeft = 999;
    this.timerEl = document.getElementById("timer");
    this.scoreEls = [...document.querySelectorAll(".scoreContainer")].map(
      (el) => el.lastChild
    );
    this.updateOffsets();
    this.gameOverActive = false;

    // NY: Lobby properties
    this.lobbyState = false;
    this.connectedPlayers = []; // {clientId, playerIndex}
    this.sessionId = null;
    this.lobbyCountdown = 0;
    this.lobbyStartTime = null;
    this.lobbyBgFoods = []; // För bakgrundsanimation

    // Ladda ljudfiler
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)(); // NY: För seamless musik
    this.mainMusicBuffer = null;
    this.mainMusicSource = null;
    this.loadMainMusic(); // NY: Ladda buffer asynkront
    this.fxEatFood = "assets/music/FX_EatFood.ogg";
    this.fxPowerUp = "assets/music/FX_PowerUp.ogg";
    this.fxNewPower = "assets/music/FX_NewPower.ogg";
    this.fxMiss = "assets/music/FX_Miss.ogg";
  }

  // NY: Metod för att ladda musik-buffer
  async loadMainMusic() {
    try {
      const response = await fetch("assets/music/SquareCrawlMainMusic.ogg");
      const arrayBuffer = await response.arrayBuffer();
      this.mainMusicBuffer = await this.audioContext.decodeAudioData(
        arrayBuffer
      );
    } catch (error) {
      console.error("Error loading main music:", error);
      // Fallback till gammal metod om fel
      this.mainMusic = new Audio("assets/music/SquareCrawlMainMusic.ogg");
      this.mainMusic.loop = true;
    }
  }

  // NY: Metod för att spela seamless loop
  playMainMusic() {
    if (this.mainMusicBuffer) {
      this.mainMusicSource = this.audioContext.createBufferSource();
      this.mainMusicSource.buffer = this.mainMusicBuffer;
      this.mainMusicSource.loop = true;
      this.mainMusicSource.connect(this.audioContext.destination);
      this.mainMusicSource.start(0);
    } else if (this.mainMusic) {
      this.mainMusic.play(); // Fallback
    }
  }

  // NY: Metod för att stoppa musik
  stopMainMusic() {
    if (this.mainMusicSource) {
      this.mainMusicSource.stop();
      this.mainMusicSource = null;
    } else if (this.mainMusic) {
      this.mainMusic.pause();
      this.mainMusic.currentTime = 0;
    }
  }

  opposite(dir) {
    if (dir === "up") return "down";
    if (dir === "down") return "up";
    if (dir === "left") return "right";
    if (dir === "right") return "left";
    return null;
  }

  updateOffsets() {
    this.offsetX =
      (1024 - (this.cols * this.cellSize + (this.cols - 1) * this.gap)) / 2;
    this.offsetY =
      (512 - (this.rows * this.cellSize + (this.rows - 1) * this.gap)) / 2;
  }

  drawTitleScreen() {
    let text = `SQUARE`;
    this.ctx.fillStyle = this.introBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "192px VT323, monospace";
    this.ctx.fillStyle = "#2D2D2D";
    let width = this.ctx.measureText(text).width;
    console.log("Tjosan", width);
    this.ctx.fillText(
      "SQUARE",
      this.canvas.width / 2,
      this.canvas.height / 2 - 140
    ); // Lite mer space upp
    this.ctx.fillText(
      "CRAWLER",
      this.canvas.width / 2,
      this.canvas.height / 2 + 10
    );

    // Streck (linje) mellan titel och undertext
    this.ctx.strokeStyle = "#2D2D2D";
    this.ctx.lineWidth = 2; // Tjocklek på strecket
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2 - 200, this.canvas.height / 2 + 95); // Start vänster
    this.ctx.lineTo(this.canvas.width / 2 + 200, this.canvas.height / 2 + 95); // Slut höger
    this.ctx.stroke();

    this.ctx.font = "36px Silkscreen, sans-serif";
    this.ctx.fillStyle = "#2D2D2D"; // Samma mörka färg
    this.ctx.fillText(
      "Enter: Local Play",
      this.canvas.width / 2,
      this.canvas.height / 2 + 140
    );
    this.ctx.fillText(
      "H: Host Multiplayer",
      this.canvas.width / 2,
      this.canvas.height / 2 + 190
    );
    this.ctx.fillText(
      "J: Join Multiplayer",
      this.canvas.width / 2,
      this.canvas.height / 2 + 240
    );
  }

  // NY: drawLobby-metod
  drawLobby() {
    this.ctx.fillStyle = this.introBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Rubrik
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "192px VT323, monospace";
    this.ctx.fillStyle = "#2D2D2D";
    this.ctx.fillText(
      "LOBBY",
      this.canvas.width / 2,
      this.canvas.height / 2 - 200
    );

    // Session ID för host
    if (this.isHost && this.sessionId) {
      this.ctx.font = "48px Silkscreen, sans-serif";
      this.ctx.fillText(
        `Session ID: ${this.sessionId}`,
        this.canvas.width / 2,
        this.canvas.height / 2 - 140
      );
    } else {
      this.ctx.font = "48px Silkscreen, sans-serif";
      this.ctx.fillText(
        "Waiting for players...",
        this.canvas.width / 2,
        this.canvas.height / 2 - 140
      );
    }

    // Spelarlista
    const startY = this.canvas.height / 2 - 80;
    for (let i = 0; i < 4; i++) {
      const player = this.connectedPlayers.find(p => p.playerIndex === i);
      const color = colors[i];
      const status = player ? "Connected" : "Waiting...";
      const controls = i === 0 ? "Arrows" : i === 1 ? "WASD" : i === 2 ? "TFGH" : "IJKL";

      // Ikon: Kvadrat i färg
      this.ctx.fillStyle = color;
      this.ctx.fillRect(
        this.canvas.width / 2 - 300,
        startY + i * 60,
        40,
        40
      );

      // Text
      this.ctx.font = "36px VT323, monospace";
      this.ctx.fillStyle = "#2D2D2D";
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        `Player ${i + 1}${i === 0 ? " (Host)" : ""}: ${status} - Color: ${color} - Controls: ${controls}`,
        this.canvas.width / 2 - 240,
        startY + i * 60 + 20
      );
    }

    // Statusmeddelande
    const numConnected = this.connectedPlayers.length;
    this.ctx.textAlign = "center";
    this.ctx.font = "48px Silkscreen, sans-serif";
    this.ctx.fillText(
      `${numConnected} players connected. Need 4 to start.`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 200
    );

    // Nedräkning om aktiv
    if (this.lobbyCountdown > 0) {
      this.ctx.font = "64px VT323, monospace";
      this.ctx.fillText(
        `Game starts in ${this.lobbyCountdown} seconds...`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 260
      );
    }

    // Bakgrundsanimation: Blinkande mat-rutor
    this.drawLobbyBgFoods();
  }

  // NY: Generera och rita bakgrundsmat
  initLobbyBgFoods() {
    this.lobbyBgFoods = [];
    for (let i = 0; i < 10; i++) { // 10 slumpmässiga mat-rutor
      this.lobbyBgFoods.push({
        x: Math.floor(Math.random() * this.cols),
        y: Math.floor(Math.random() * this.rows),
        blink: Math.random() > 0.5
      });
    }
  }

  drawLobbyBgFoods() {
    this.ctx.fillStyle = "#EEEEEE";
    this.lobbyBgFoods.forEach(food => {
      if (food.blink) {
        const x = this.offsetX + food.x * (this.cellSize + this.gap);
        const y = this.offsetY + food.y * (this.cellSize + this.gap);
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
      }
    });
    // Uppdatera blink: Slumpmässig toggle var frame (för animation)
    if (Math.random() < 0.1) {
      this.lobbyBgFoods.forEach(food => {
        food.blink = !food.blink;
      });
    }
  }

  // NY: Starta countdown om 4 spelare
  checkStartLobbyCountdown() {
    if (this.connectedPlayers.length === 4 && this.lobbyCountdown === 0) {
      this.lobbyStartTime = Date.now() + 5000;
      this.lobbyCountdown = 5;
      // Broadcast countdown-start till klienter
      if (this.isHost) {
        this.api.transmit({
          type: "lobby_countdown",
          startTime: this.lobbyStartTime
        });
      }
    }
  }

  start(isMultiplayer) {
    this.isMultiplayer = isMultiplayer;
    this.isRunning = true;
    this.obstacles = [];
    this.timeLeft = 999;
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, "0")}`;
    this.playMainMusic(); // Starta musik

    if (isMultiplayer && !this.isHost) {
      this.worms = [];
      // Do not initialize food and powerup for clients; they will be set from state
    } else {
      this.food = new Food(this.cols, this.rows);
      this.powerup = new Powerup(this.cols, this.rows);
      if (isMultiplayer) {
        // Host
        this.worms = this.connectedPlayers.map((p, i) => 
          new Worm(colors[i], null, null, i)
        );
      } else {
        // Local
        this.worms = [new Worm(colors[0], null, null, 0)];
      }
      this.worms.forEach((worm) => worm.reset(null, null, this.cols, this.rows, []));
      if (isMultiplayer && this.isHost) {
        this.broadcastState();
      }
    }
    this.updateScores();
    this.animate();
  }

  stop() {
    this.isRunning = false;
    this.stopMainMusic(); // Stoppa musik
  }

  resetToTitle() {
    this.isRunning = false;
    this.gameOverActive = false;
    this.lobbyState = false; // NY: Återställ lobby
    this.connectedPlayers = [];
    this.sessionId = null;
    this.lobbyCountdown = 0;
    this.lobbyStartTime = null;
    this.stopMainMusic();
    this.drawTitleScreen();
  }

  animate(timestamp = 0) {
    if (!this.isRunning && !this.lobbyState) return;

    requestAnimationFrame(this.animate.bind(this));

    if (this.lobbyState) {
      // NY: Rita lobby
      const now = Date.now();
      if (this.lobbyStartTime && now >= this.lobbyStartTime) {
        this.lobbyState = false;
        this.start(true);
        return;
      }
      if (this.lobbyStartTime) {
        this.lobbyCountdown = Math.max(0, Math.ceil((this.lobbyStartTime - now) / 1000));
      }
      this.drawLobby();
      return;
    }

    const delta = timestamp - this.lastFrameTime;
    if (delta < this.frameInterval) return;
    this.lastFrameTime = timestamp - (delta % this.frameInterval); // NY: Bättre timing för jämn hastighet

    this.drawGrid();
    this.drawObstacles();
    this.drawFood();
    this.drawPowerup();
    this.drawWorms();
    this.drawTongues();

    if (this.isHost || !this.isMultiplayer) {
      this.updateGame();
    }
  }

  updateGame() {
    this.worms.forEach(worm => worm.updateShoot());

    const allSegments = this.worms.flatMap(w => w.segments);

    this.worms.forEach((worm, index) => {
      worm.move(this.cols, this.rows);
      const head = worm.segments[0];
      const collision = worm.checkCollision(
        head,
        this.cols,
        this.rows,
        worm.segments,
        this.food ? this.food.pos : null,
        this.powerup ? this.powerup.pos : null,
        this.obstacles
      );

      // Additional check for other worms
      let otherCollision = false;
      this.worms.forEach((other, oi) => {
        if (oi !== index && other.segments.some(seg => seg.x === head.x && seg.y === head.y)) {
          otherCollision = true;
        }
      });

      if (collision === "food") {
        worm.grow();
        this.obstacles.push({ ...this.food.pos });
        this.food.newPos([...allSegments, ...this.obstacles]);
        new Audio(this.fxEatFood).play();
      } else if (collision === "powerup") {
        worm.tongueShots += 1;
        this.powerup.newPos([...allSegments, ...this.obstacles]);
        new Audio(this.fxPowerUp).play();
      } else if (collision || otherCollision) {
        worm.reset(null, null, this.cols, this.rows, [...allSegments, ...this.obstacles]);
      }

      if (worm.isShooting) {
        const tonguePos = worm.getTonguePositions(this.cols, this.rows);
        tonguePos.forEach(pos => {
          this.worms.forEach((otherWorm, otherIndex) => {
            if (otherIndex !== index && otherWorm.segments.some(seg => seg.x === pos.x && seg.y === pos.y)) {
              otherWorm.reset(null, null, this.cols, this.rows, [...allSegments, ...this.obstacles]);
              new Audio(this.fxNewPower).play();
            }
          });
          const obsIndex = this.obstacles.findIndex(obs => obs.x === pos.x && obs.y === pos.y);
          if (obsIndex !== -1) this.obstacles.splice(obsIndex, 1);
        });
      }
    });

    this.updateScores();
    this.timeLeft--;
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, "0")}`;
    if (this.timeLeft <= 0) this.gameOver();

    if (this.isMultiplayer && this.isHost) {
      this.broadcastState();
    }
  }

  broadcastState() {
    this.api.transmit({
      type: "state",
      worms: this.worms.map(w => ({
        segments: w.segments,
        direction: w.direction,
        tongueShots: w.tongueShots,
        isShooting: w.isShooting,
        shootTimer: w.shootTimer,
        playerIndex: w.playerIndex
      })),
      food: this.food ? this.food.pos : null,
      powerup: this.powerup ? this.powerup.pos : null,
      obstacles: this.obstacles,
      timeLeft: this.timeLeft
    });
  }

  // NY: Utökad processMessage för lobby
  processMessage(data, clientId) {
    if (data.type === "request_assign" && this.isHost) {
      const nextIndex = this.connectedPlayers.length;
      if (nextIndex < 4) {
        this.connectedPlayers.push({clientId, playerIndex: nextIndex});
        this.api.transmit({
          type: "assign",
          playerIndex: nextIndex,
          connectedPlayers: this.connectedPlayers
        }, clientId); // Skicka till nya klienten
        this.api.transmit({
          type: "lobby_state",
          connectedPlayers: this.connectedPlayers
        }); // Broadcast till alla
        this.checkStartLobbyCountdown();
      }
    } else if (data.type === "assign") {
      this.myPlayerIndex = data.playerIndex;
      this.connectedPlayers = data.connectedPlayers;
      this.checkStartLobbyCountdown();
    } else if (data.type === "lobby_state") {
      this.connectedPlayers = data.connectedPlayers;
      this.checkStartLobbyCountdown();
    } else if (data.type === "lobby_countdown") {
      this.lobbyStartTime = data.startTime;
    } else if (data.type === "start_game" && !this.isHost) {
      this.lobbyState = false;
      this.start(true);
    } else if (data.type === "input") {
      const worm = this.worms[data.playerIndex];
      if (worm) {
        if (data.direction && worm.direction !== this.opposite(data.direction)) {
          worm.direction = data.direction;
        }
        if (data.shoot) {
          worm.shootTongue();
        }
      }
    } else if (data.type === "state") {
      this.worms = data.worms.map(w => {
        const worm = new Worm(colors[w.playerIndex], null, null, w.playerIndex);
        worm.segments = w.segments;
        worm.direction = w.direction;
        worm.tongueShots = w.tongueShots;
        worm.isShooting = w.isShooting;
        worm.shootTimer = w.shootTimer;
        return worm;
      });
      if (!this.food && data.food) {
        this.food = new Food(this.cols, this.rows);
      }
      if (this.food && data.food) this.food.pos = data.food;
      if (!this.powerup && data.powerup) {
        this.powerup = new Powerup(this.cols, this.rows);
      }
      if (this.powerup && data.powerup) this.powerup.pos = data.powerup;
      this.obstacles = data.obstacles;
      this.timeLeft = data.timeLeft;
      this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, "0")}`;
      this.updateScores();
    }
  }

  updateScores() {
    this.worms.forEach((worm, i) => {
      if (this.scoreEls[i]) {
        this.scoreEls[i].textContent = (worm.segments.length - 1).toString().padStart(3, "0");
      }
    });
  }

  drawGrid() {
    this.ctx.fillStyle = this.gameBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        this.ctx.fillStyle = this.cellColor;
        this.ctx.fillRect(
          this.offsetX + x * (this.cellSize + this.gap),
          this.offsetY + y * (this.cellSize + this.gap),
          this.cellSize,
          this.cellSize
        );
      }
    }
  }

  drawObstacles() {
    this.ctx.fillStyle = this.obstacleColor;
    this.obstacles.forEach(obs => {
      this.ctx.fillRect(
        this.offsetX + obs.x * (this.cellSize + this.gap),
        this.offsetY + obs.y * (this.cellSize + this.gap),
        this.cellSize,
        this.cellSize
      );
    });
  }

  drawFood() {
    if (!this.food) return;
    this.ctx.fillStyle = "#EEEEEE";
    this.ctx.fillRect(
      this.offsetX + this.food.pos.x * (this.cellSize + this.gap),
      this.offsetY + this.food.pos.y * (this.cellSize + this.gap),
      this.cellSize,
      this.cellSize
    );
  }

  drawPowerup() {
    if (!this.powerup) return;
    this.ctx.fillStyle = "#F39420";
    this.ctx.fillRect(
      this.offsetX + this.powerup.pos.x * (this.cellSize + this.gap),
      this.offsetY + this.powerup.pos.y * (this.cellSize + this.gap),
      this.cellSize,
      this.cellSize
    );
  }

  drawWorms() {
    this.worms.forEach(worm => {
            worm.segments.forEach((pos, index) => {
        const cellX = this.offsetX + pos.x * (this.cellSize + this.gap);
        const cellY = this.offsetY + pos.y * (this.cellSize + this.gap);
        this.ctx.fillStyle = worm.color;
        let size, offset;
        if (index === 0) {
          // Huvudet: full storlek (24px)
          size = this.cellSize;
          offset = 0;
        } else {
          // Svansen/kroppen: ~60% storlek (14px), centrerad i rutan
          size = Math.floor(this.cellSize * 0.6);
          offset = Math.floor((this.cellSize - size) / 2);
        }
        this.ctx.fillRect(cellX + offset, cellY + offset, size, size);
      });
    });
  }

  drawTongues() {
    this.worms.forEach(worm => {
      if (worm.isShooting) {
        this.ctx.fillStyle = "#FF39D4";
        const thickness = Math.round(this.cellSize * 0.12);
        worm.getTonguePositions(this.cols, this.rows).forEach(pos => {
          const x = this.offsetX + pos.x * (this.cellSize + this.gap);
          const y = this.offsetY + pos.y * (this.cellSize + this.gap);
          this.ctx.fillRect(
            x + thickness / 2,
            y + thickness / 2,
            this.cellSize - thickness,
            this.cellSize - thickness
          );
        });
      }
    });
  }

  gameOver() {
    this.stop();
    this.gameOverActive = true;

    this.ctx.fillStyle = this.gameBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "192px VT323, monospace";
    this.ctx.fillStyle = "#EEEEEE";
    this.ctx.fillText(
      "GAME OVER",
      this.canvas.width / 2,
      this.canvas.height / 2 - 60
    );

    if (this.worms.length > 0) {
      const winner = this.worms.reduce((win, w) => {
        const winLen = win.segments.length;
        const wLen = w.segments.length;
        if (
          wLen > winLen ||
          (wLen === winLen && w.playerIndex < win.playerIndex)
        )
          return w;
        return win;
      }, this.worms[0]);
      this.ctx.font = "48px Silkscreen, sans-serif";
      this.ctx.fillStyle = winner.color;
      this.ctx.fillText(
        "WINNER",
        this.canvas.width / 2,
        this.canvas.height / 2 + 70
      );
    }

    this.ctx.fillStyle = "#EEEEEE";
    this.ctx.font = "32px Silkscreen, sans-serif";
    this.ctx.fillText(
      "Press Enter to play again",
      this.canvas.width / 2,
      this.canvas.height / 2 + 130
    );

    const finalScores = this.worms.map((w) => ({
      name: `Player ${w.playerIndex + 1}`,
      score: (w.segments.length - 1) % 1000,
    }));
    const maxScore = Math.max(...finalScores.map((s) => s.score));

    const popup = document.createElement("div");
    popup.id = "gameOverPopup";
    popup.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
      background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
      z-index: 1000; font-family: VT323, monospace; color: #EEEEEE; padding: 64px; box-sizing: border-box;
    `;
    popup.innerHTML = `
      <div style="background: #484848; padding: 48px; max-width: 80%; max-height: 80%; overflow: auto; border: 4px solid #646464; text-align: center;">
        <h1 style="font-size: 64px; margin-bottom: 32px;">GAME OVER</h1>
        <div style="font-size: 48px; margin-bottom: 32px; color: ${
          finalScores.find((s) => s.score === maxScore)?.color || "#19E9FF"
        };">
          WINNER: Player ${
            finalScores.findIndex((s) => s.score === maxScore) + 1
          } (${maxScore} pts)
        </div>
        <input id="winnerName" type="text" placeholder="Ditt namn för highscore..." 
               style="font-family: VT323; font-size: 32px; padding: 16px; background: #646464; color: #EEEEEE; border: 2px solid #19E9FF; width: 80%; margin-bottom: 32px;">
        <button id="saveScore" style="padding: 16px 32px; font-size: 32px; background: #F39420; border: none; cursor: pointer; margin-right: 16px;">Save</button>
        <button id="closeNoSave" style="padding: 16px 32px; font-size: 32px; background: #646464; border: none; cursor: pointer;">Close</button>
        <div id="highScores" style="margin-top: 32px; font-size: 24px;"></div>
      </div>
    `;
    document.body.appendChild(popup);

    const highScoresDiv = document.getElementById("highScores");
    Scoreboard.renderHighScoresOnly(highScoresDiv);

    const saveButton = document.getElementById("saveScore");
    saveButton.onclick = () => {
      const name =
        document.getElementById("winnerName").value.trim() ||
        `Player ${finalScores.findIndex((s) => s.score === maxScore) + 1}`;
      Scoreboard.add(name, maxScore);
      // Uppdatera listan direkt efter save
      Scoreboard.renderHighScoresOnly(highScoresDiv);
      // Inaktivera knappen efter save
      saveButton.disabled = true;
      saveButton.style.background = "#646464";
      saveButton.style.cursor = "not-allowed";
    };
    document.getElementById("closeNoSave").onclick = () => {
      document.body.removeChild(popup);
      this.resetToTitle();
    };
  }
}