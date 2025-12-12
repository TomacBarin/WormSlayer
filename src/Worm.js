// src/Worm.js (uppdaterad – playerIndex + safe reset + multi-collision ready)
export default class Worm {
  constructor(color, startX, startY, playerIndex) {
    this.color = color;
    this.playerIndex = playerIndex;
    this.reset(startX, startY);
    this.direction = 'right';
  }

  reset(startX = null, startY = null, cols = 34, rows = 17, occupied = []) {
    let attempts = 0;
    let x, y;
    while (attempts < 100) {
      x = Math.floor(Math.random() * (cols - 4)) + 2;
      y = Math.floor(Math.random() * (rows - 4)) + 2;
      const headPos = { x, y };
      if (!occupied.some(pos => pos.x === headPos.x && pos.y === headPos.y) &&
          !occupied.some(pos => pos.x === headPos.x - 1 && pos.y === headPos.y)) {  // Svans också fri
        break;
      }
      attempts++;
    }
    // Fallback om ingen plats
    if (attempts >= 100) {
      x = 2; y = 2;  // Standard
    }
    this.segments = [
      { x, y },       // Huvud
      { x: x - 1, y } // Svans (längd 2)
    ];
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

  checkCollision(head, cols, rows, segments, foodPos, obstacles) {
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return 'wall';
    if (obstacles.some(obs => obs.x === head.x && obs.y === head.y)) return 'obstacle';
    if (segments.slice(1).some(seg => seg.x === head.x && seg.y === head.y)) return 'self';
    if (head.x === foodPos.x && head.y === foodPos.y) return 'food';
    return null;
  }
}