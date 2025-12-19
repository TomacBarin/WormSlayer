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
    this.myClientId = null;
    this.lastFrameTime = 0;
    this.frameInterval = 120;
    this.frameCounter = 0;
    this.worms = [];
    this.food = null;
    this.powerup = null;
    this.powerupTimer = 0;           // NY: Timer för powerup-spawn
    this.foodEaten = false;
    this.obstacles = [];
    this.timeLeft = 999;
    this.timerEl = document.getElementById("timer");
    this.scoreEls = [...document.querySelectorAll(".scoreContainer")].map(
      (el) => el.lastChild
    );
    this.updateOffsets();
    this.gameOverActive = false;

    // Lobby properties
    this.lobbyState = false;
    this.connectedPlayers = [];
    this.sessionId = null;
    this.lobbyCountdown = 0;
    this.lobbyStartTime = null;
    this.lobbyBgFoods = [];

    // Ljud
    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.mainMusicBuffer = null;
    this.mainMusicSource = null;
    this.loadMainMusic();
    this.fxEatFood = "assets/music/FX_EatFood.ogg";
    this.fxPowerUp = "assets/music/FX_PowerUp.ogg";
    this.fxNewPower = "assets/music/FX_NewPower.ogg";
    this.fxMiss = "assets/music/FX_Miss.ogg";
  }

  async loadMainMusic() {
    try {
      const response = await fetch("assets/music/SquareCrawlMainMusic.ogg");
      const arrayBuffer = await response.arrayBuffer();
      this.mainMusicBuffer = await this.audioContext.decodeAudioData(
        arrayBuffer
      );
    } catch (error) {
      console.error("Error loading main music:", error);
      this.mainMusic = new Audio("assets/music/SquareCrawlMainMusic.ogg");
      this.mainMusic.loop = true;
    }
  }

  playMainMusic() {
    if (this.mainMusicBuffer) {
      this.mainMusicSource = this.audioContext.createBufferSource();
      this.mainMusicSource.buffer = this.mainMusicBuffer;
      this.mainMusicSource.loop = true;
      this.mainMusicSource.connect(this.audioContext.destination);
      this.mainMusicSource.start(0);
    } else if (this.mainMusic) {
      this.mainMusic.play();
    }
  }

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
    this.ctx.fillStyle = this.introBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "192px VT323, monospace";
    this.ctx.fillStyle = "#2D2D2D";
    this.ctx.fillText("SQUARE", this.canvas.width / 2, this.canvas.height / 2 - 140);
    this.ctx.fillText("CRAWLER", this.canvas.width / 2, this.canvas.height / 2 + 10);

    this.ctx.strokeStyle = "#2D2D2D";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2 - 200, this.canvas.height / 2 + 105);
    this.ctx.lineTo(this.canvas.width / 2 + 200, this.canvas.height / 2 + 105);
    this.ctx.stroke();

    this.ctx.font = "24px Silkscreen, sans-serif";
    this.ctx.fillStyle = "#2D2D2D";
    this.ctx.fillText("Enter: Single Player", this.canvas.width / 2, this.canvas.height / 2 + 150);
    this.ctx.fillText("H: Host | J: Join", this.canvas.width / 2, this.canvas.height / 2 + 180);
    // this.ctx.fillText("J: Join Multiplayer", this.canvas.width / 2, this.canvas.height / 2 + 240);
  }

  drawLobby() {
    this.ctx.fillStyle = this.introBgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Titel: "LOBBY"
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.font = "128px VT323, monospace";
    this.ctx.fillStyle = "#2D2D2D";
    this.ctx.fillText("LOBBY", this.canvas.width / 2, this.canvas.height / 2 - 180); // Lite högre upp för mer plats

     this.ctx.strokeStyle = "#2D2D2D";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2 - 550, this.canvas.height / 2 - 105);
    this.ctx.lineTo(this.canvas.width / 2 + 550, this.canvas.height / 2 - 105);
    this.ctx.stroke();

    // Centrerad spelare-lista
    const startY = this.canvas.height / 2 - 90; // Startpunkt för första raden
    const rowHeight = 60;
    const boxSize = this.cellSize / 1.5; // Mindre än full cell – som en ormsvans (ca 16px istället för 24px)
    const boxPadding = 20; // Avstånd från ruta till text

    for (let i = 0; i < 4; i++) {
      const player = this.connectedPlayers.find(p => p.playerIndex === i);
      const isYou = player && player.playerIndex === this.myPlayerIndex;
      const status = player ? "Connected" : "Waiting...";
      const color = colors[i];
      // const controls = i === 0 ? "Arrows" : i === 1 ? "WASD" : i === 2 ? "TFGH" : "IJKL"; // Kommenterat ut för nu

      // Centrera hela raden: Beräkna x-position så att ruta + text hamnar i mitten
      const text = `Player ${i + 1}${i === 0 ? " (Host)" : ""}${isYou ? " (you)" : ""}: ${status}`;
      this.ctx.font = "24px VT323, monospace";
      this.ctx.textAlign = "left"; // För att kunna mäta texten korrekt
      const textWidth = this.ctx.measureText(text).width;
      const totalWidth = boxSize + boxPadding + textWidth;
      const rowX = (this.canvas.width - totalWidth) / 2; // Centrerad start-x

      // Rita ruta
      this.ctx.fillStyle = color;
      this.ctx.fillRect(rowX, startY + i * rowHeight + 10, boxSize, boxSize); // Rutan centrerad vertikalt på texten

      // Rita text
      this.ctx.fillStyle = "#2D2D2D";
      this.ctx.textAlign = "left";
      this.ctx.fillText(
        text,
        rowX + boxSize + boxPadding,
        startY + i * rowHeight + 25 // 25px ner för att centreras vertikalt med rutan
      );
    }

         this.ctx.strokeStyle = "#2D2D2D";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width / 2 - 550, this.canvas.height / 2 + 155);
    this.ctx.lineTo(this.canvas.width / 2 + 550, this.canvas.height / 2 + 155);
    this.ctx.stroke();

    // Nedre text: Antal spelare
    this.ctx.textAlign = "center";
    this.ctx.font = "16px Silkscreen, sans-serif";
    this.ctx.fillStyle = "#2D2D2D";
    const numConnected = this.connectedPlayers.length;
    this.ctx.fillText(
      `${numConnected} player${numConnected === 1 ? "" : "s"} connected. Need 4 to start.`,
      this.canvas.width / 2,
      this.canvas.height / 2 + 190
    );

    // Countdown om det finns
    if (this.lobbyCountdown > 0) {
      this.ctx.font = "16px Silkscreen, sans-serif";
      this.ctx.fillStyle = "#FF2B6F";
      this.ctx.fillText(
        `Game starts in ${this.lobbyCountdown} seconds...`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 220
      );
    }

    // Rita bakgrunds-mat (om du vill behålla)
    // this.drawLobbyBgFoods();

    // Kommenterade ut gamla delar – ta bort när du är nöjd
    // if (this.isHost && this.sessionId) { ... }
    // const controls = ... 
    // this.ctx.fillText(`Player ${i + 1}${i === 0 ? " (Host)" : ""}: ${status}`, ...);
  }

  initLobbyBgFoods() {
    this.lobbyBgFoods = [];
    for (let i = 0; i < 10; i++) {
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
    if (Math.random() < 0.1) {
      this.lobbyBgFoods.forEach(food => { food.blink = !food.blink; });
    }
  }

  checkStartLobbyCountdown() {
    if (this.connectedPlayers.length === 4 && this.lobbyCountdown === 0) {
      this.lobbyStartTime = Date.now() + 5000;
      this.lobbyCountdown = 5;
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
    this.powerupTimer = 0;           // NY: Starta powerup-timer från 0
    this.powerup = null;             // NY: Ingen powerup direkt vid start
    this.timerEl.textContent = `Time: ${this.timeLeft.toString().padStart(3, "0")}`;
    this.playMainMusic();

    if (isMultiplayer && !this.isHost) {
      this.worms = [];
    } else {
      this.food = new Food(this.cols, this.rows);
      if (isMultiplayer) {
        this.worms = this.connectedPlayers.map((p, i) => new Worm(colors[i], null, null, i));
      } else {
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
    this.stopMainMusic();
  }

  resetToTitle() {
    this.isRunning = false;
    this.gameOverActive = false;
    this.lobbyState = false;
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
    this.lastFrameTime = timestamp - (delta % this.frameInterval);

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
    // Uppdatera tungor
    this.worms.forEach(worm => worm.updateShoot());

    // Powerup-spawn (före moves)
    this.powerupTimer++;
    if (this.powerupTimer >= 75 && this.powerup === null) {
      const occupied = [...this.worms.flatMap(w => w.segments), ...this.obstacles];
      if (this.food) occupied.push(this.food.pos);
      this.powerup = new Powerup(this.cols, this.rows, occupied);
      this.powerupTimer = 0;
      new Audio(this.fxNewPower).play().catch(() => {});
    }

    // *** FAIR SIMULTANEOUS COLLISION DETECTION ***
    const oldSegments = this.worms.map(w => w.segments.map(s => ({ ...s }))); // Kopiera gamla positioner
    const newHeads = [];
    for (let i = 0; i < this.worms.length; i++) {
      const head = { ...this.worms[i].segments[0] };
      switch (this.worms[i].direction) {
        case 'up': head.y--; break;
        case 'down': head.y++; break;
        case 'left': head.x--; break;
        case 'right': head.x++; break;
      }
      newHeads.push(head);
    }

    const allOldSegments = oldSegments.flat();
    let eaterIndex = -1;
    let powerupEaterIndex = -1;
    const deaths = new Set();

    // Kolla kollisioner för varje orm (simultan!)
    for (let i = 0; i < this.worms.length; i++) {
      const newHead = newHeads[i];
      const isFood = this.food && this.food.pos.x === newHead.x && this.food.pos.y === newHead.y;
      const isPowerup = this.powerup && this.powerup.pos.x === newHead.x && this.powerup.pos.y === newHead.y;

      // Wall
      if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
        deaths.add(i);
        continue;
      }

      // Eat food/powerup (räddar från kollision)
      if (isFood) {
        if (eaterIndex === -1) eaterIndex = i;
      } else if (isPowerup) {
        if (powerupEaterIndex === -1) powerupEaterIndex = i;
      } else {
        // Self body (exkl. eget gamla huvud)
        if (oldSegments[i].slice(1).some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
          deaths.add(i);
          continue;
        }

        // Other old bodies/heads eller obstacles
        let bodyCollision = false;
        for (let j = 0; j < this.worms.length; j++) {
          if (j !== i && oldSegments[j].some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
            bodyCollision = true;
            break;
          }
        }
        if (bodyCollision || this.obstacles.some(obs => obs.x === newHead.x && obs.y === newHead.y)) {
          deaths.add(i);
          continue;
        }

        // Head-head (nya huvuden krockar)
        for (let j = 0; j < this.worms.length; j++) {
          if (j !== i && newHeads[j].x === newHead.x && newHeads[j].y === newHead.y) {
            deaths.add(i);
            deaths.add(j);  // Båda dör!
            break;
          }
        }
      }
    }

    // Hantera eats
    if (eaterIndex !== -1) {
      new Audio(this.fxEatFood).play().catch(() => {});
      this.obstacles.push({ ...this.food.pos });
      this.food.newPos([...allOldSegments, ...this.obstacles]);
    }
    if (powerupEaterIndex !== -1) {
      this.worms[powerupEaterIndex].tongueShots += 1;
      this.powerup = null;
      this.powerupTimer = 0;
      new Audio(this.fxPowerUp).play().catch(() => {});
    }

    // Applicera moves/resets
    const resetOccupied = [...allOldSegments, ...this.obstacles];
    if (this.food) resetOccupied.push(this.food.pos);
    if (this.powerup) resetOccupied.push(this.powerup.pos);
    for (let i = 0; i < this.worms.length; i++) {
      const worm = this.worms[i];
      if (deaths.has(i)) {
        new Audio(this.fxMiss).play().catch(() => {});
        if (this.isMultiplayer && this.isHost) {
          this.api.transmit({ type: "playMiss" });
        }
        worm.reset(null, null, this.cols, this.rows, resetOccupied);
      } else {
        // Vanlig move (grow vid eat)
        if (i === eaterIndex) {
          const oldTail = { ...worm.segments[worm.segments.length - 1] };
          worm.move(this.cols, this.rows);
          worm.segments.push(oldTail);  // Grow: behåll svans!
        } else {
          worm.move(this.cols, this.rows);
        }
      }
    }

    // Tongues (efter moves – fair!)
    this.worms.forEach((worm, index) => {
      if (!worm.isShooting) return;
      const tonguePos = worm.getTonguePositions(this.cols, this.rows);
      tonguePos.forEach(pos => {
        // Döda andra
        this.worms.forEach((otherWorm, otherIndex) => {
          if (otherIndex !== index && otherWorm.segments.some(seg => seg.x === pos.x && seg.y === pos.y)) {
            const currentResetOccupied = [...this.worms.flatMap(w => w.segments), ...this.obstacles];
            new Audio(this.fxMiss).play().catch(() => {});
            if (this.isMultiplayer && this.isHost) {
              this.api.transmit({ type: "playMiss" });
            }
            otherWorm.reset(null, null, this.cols, this.rows, currentResetOccupied);
            new Audio(this.fxNewPower).play().catch(() => {});
          }
        });
        // Laga hål
        const obsIndex = this.obstacles.findIndex(obs => obs.x === pos.x && obs.y === pos.y);
        if (obsIndex !== -1) this.obstacles.splice(obsIndex, 1);
      });
    });

    this.updateScores();
    this.timeLeft--;
    this.timerEl.textContent = `Time: ${String(this.timeLeft).padStart(3, "0")}`;
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

    processMessage(data, clientId) {
    if (data.type === "request_assign" && this.isHost) {
      const nextIndex = this.connectedPlayers.length;
      if (nextIndex < 4) {
        this.connectedPlayers.push({ clientId, playerIndex: nextIndex });
        this.api.transmit({
          type: "assign",
          playerIndex: nextIndex,
          connectedPlayers: this.connectedPlayers
        }, clientId);
        this.api.transmit({
          type: "lobby_state",
          connectedPlayers: this.connectedPlayers
        });
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
    } else if (data.type === "playMiss") {
      // Spela miss-ljud på alla joinade spelare när någon dör
      new Audio(this.fxMiss).play().catch(() => {});
    } else if (data.type === "state") {
      // Synka worms
      this.worms = data.worms.map(w => {
        const worm = new Worm(colors[w.playerIndex], null, null, w.playerIndex);
        worm.segments = w.segments;
        worm.direction = w.direction;
        worm.tongueShots = w.tongueShots;
        worm.isShooting = w.isShooting;
        worm.shootTimer = w.shootTimer;
        return worm;
      });

      // Synka vanlig mat (food)
      if (data.food) {
        if (!this.food) this.food = new Food(this.cols, this.rows);
        this.food.pos = data.food;
      } else {
        this.food = null;
      }

      // Synka powerup korrekt (fix för att orange rutan försvinner hos alla)
      if (data.powerup !== undefined) {
        if (data.powerup) {
          if (!this.powerup) this.powerup = new Powerup(this.cols, this.rows);
          this.powerup.pos = data.powerup;
        } else {
          this.powerup = null;
        }
      }

      // Synka hinder och timer
      this.obstacles = data.obstacles || [];
      this.timeLeft = data.timeLeft;

      // Uppdatera timer och poäng på skärmen
      this.timerEl.textContent = `Time: ${String(this.timeLeft).padStart(3, "0")}`;
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
          size = this.cellSize;
          offset = 0;
        } else {
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
        this.ctx.fillStyle = worm.color;
        const thickness = 2;
        worm.getTonguePositions(this.cols, this.rows).forEach(pos => {
          const x = this.offsetX + pos.x * (this.cellSize + this.gap);
          const y = this.offsetY + pos.y * (this.cellSize + this.gap);
          if (worm.direction === 'left' || worm.direction === 'right') {
            const height = thickness;
            this.ctx.fillRect(x, y + (this.cellSize - height) / 2, this.cellSize, height);
          } else {
            const width = thickness;
            this.ctx.fillRect(x + (this.cellSize - width) / 2, y, width, this.cellSize);
          }
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
    this.ctx.fillText("GAME OVER", this.canvas.width / 2, this.canvas.height / 2 - 60);

    if (this.worms.length > 0) {
      const winner = this.worms.reduce((win, w) => {
        const winLen = win.segments.length;
        const wLen = w.segments.length;
        if (wLen > winLen || (wLen === winLen && w.playerIndex < win.playerIndex)) return w;
        return win;
      }, this.worms[0]);
      this.ctx.font = "48px Silkscreen, sans-serif";
      this.ctx.fillStyle = winner.color;
      this.ctx.fillText("WINNER", this.canvas.width / 2, this.canvas.height / 2 + 70);
    }

    this.ctx.fillStyle = "#EEEEEE";
    this.ctx.font = "32px Silkscreen, sans-serif";
    this.ctx.fillText("Press Enter to play again", this.canvas.width / 2, this.canvas.height / 2 + 130);

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
        <div style="font-size: 48px; margin-bottom: 32px; color: ${finalScores.find((s) => s.score === maxScore)?.color || "#19E9FF"};">
          WINNER: Player ${finalScores.findIndex((s) => s.score === maxScore) + 1} (${maxScore} pts)
        </div>
        <input id="winnerName" type="text" placeholder="Enter your name..." 
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
      const name = document.getElementById("winnerName").value.trim() ||
        `Player ${finalScores.findIndex((s) => s.score === maxScore) + 1}`;
      Scoreboard.add(name, maxScore);
      Scoreboard.renderHighScoresOnly(highScoresDiv);
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