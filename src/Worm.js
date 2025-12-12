// src/Worm.js (uppdaterad – lägg till powerup i checkCollision)
export default class Worm {
  constructor(color, startX, startY, playerIndex) {
    this.color = color;
    this.playerIndex = playerIndex;
    this.reset(startX, startY);
    this.direction = 'right';
    this.tongueShots = 0;
    this.isShooting = false;
    this.shootTimer = 0;
  }

  reset(startX = null, startY = null, cols = 34, rows = 17, occupied = []) {
    let attempts = 0;
    let x, y;
    while (attempts < 100) {
      x = Math.floor(Math.random() * (cols - 4)) + 2;
      y = Math.floor(Math.random() * (rows - 4)) + 2;
      const headPos = { x, y };
      if (!occupied.some(pos => pos.x === headPos.x && pos.y === headPos.y) &&
          !occupied.some(pos => pos.x === headPos.x - 1 && pos.y === headPos.y)) {
        break;
      }
      attempts++;
    }
    if (attempts >= 100) {
      x = 2; y = 2;
    }
    this.segments = [
      { x, y },
      { x: x - 1, y }
    ];
    this.tongueShots = 0;
  }

  move() {
    const head = { ...this.segments[0] };
    switch (this.direction) {
      case 'right': head.x++; break;
      case 'left': head.x--; break;
      case 'up': head.y--; break;
      case 'down': head.y++; break;
    }
    this.segments.unshift(head);
    this.segments.pop();
  }

  grow() {
    const tail = { ...this.segments[this.segments.length - 1] };
    this.segments.push(tail);
  }

  checkCollision(head, cols, rows, segments, foodPos, powerupPos, obstacles) {
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return 'wall';
    if (obstacles.some(obs => obs.x === head.x && obs.y === head.y)) return 'obstacle';
    if (segments.slice(1).some(seg => seg.x === head.x && seg.y === head.y)) return 'self';
    if (head.x === foodPos.x && head.y === foodPos.y) return 'food';
    if (powerupPos && head.x === powerupPos.x && head.y === powerupPos.y) return 'powerup';  // NYTT
    return null;
  }

  shootTongue() {
    if (this.tongueShots > 0 && !this.isShooting) {
      this.tongueShots--;
      this.isShooting = true;
      this.shootTimer = 100;
    }
  }

  updateShoot(dt) {
    if (this.isShooting) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) this.isShooting = false;
    }
  }

  getTonguePositions() {
    if (!this.isShooting) return [];
    const head = this.segments[0];
    const positions = [];
    for (let i = 1; i <= 3; i++) {
      const pos = { ...head };
      switch (this.direction) {
        case 'right': pos.x += i; break;
        case 'left': pos.x -= i; break;
        case 'up': pos.y -= i; break;
        case 'down': pos.y += i; break;
      }
      positions.push(pos);
    }
    return positions;
  }
}