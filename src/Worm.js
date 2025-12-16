export default class Worm {
  constructor(color, startX, startY, playerIndex) {
    this.color = color;
    this.playerIndex = playerIndex;
    this.direction = 'right';
    this.tongueShots = 0;
    this.isShooting = false;
    this.shootTimer = 0;
    this.segments = [
      { x: startX || 5, y: startY || 5 },
      { x: (startX || 5) - 1, y: startY || 5 }
    ];  // NY: Start med 2 segment (huvud + 1 svans)
  }

  move(isFullLogic, cols, rows) {
    const head = { ...this.segments[0] };
    switch (this.direction) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }

    // På klient (inte full logic), enkel bounds-check för att stoppa ut-åkning
    if (!isFullLogic) {
      if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) {
        return;  // Stoppa move - vänta på sync
      }
    }

    this.segments.unshift(head);
    this.segments.pop();
  }

  grow() {
    const tail = { ...this.segments[this.segments.length - 1] };
    this.segments.push(tail);
  }

  reset(startX, startY, cols, rows, occupied) {
    let x = startX || Math.floor(Math.random() * cols);
    let y = startY || Math.floor(Math.random() * rows);
    while (occupied.some(o => o.x === x && o.y === y)) {
      x = Math.floor(Math.random() * cols);
      y = Math.floor(Math.random() * rows);
    }
    this.segments = [
      { x: x, y: y },
      { x: x - 1, y: y }
    ];
    this.direction = 'right';
    this.tongueShots = 0;
    this.isShooting = false;
    this.shootTimer = 0;
  }

  shootTongue() {
    if (this.tongueShots > 0 && !this.isShooting) {
      this.tongueShots--;
      this.isShooting = true;
      this.shootTimer = 3;  // T.ex. 3 ticks lång tunga
    }
  }

  updateShoot() {
    if (this.isShooting) {
      this.shootTimer--;
      if (this.shootTimer <= 0) {
        this.isShooting = false;
      }
    }
  }

  getTonguePositions(cols, rows) {
    const positions = [];
    let pos = { ...this.segments[0] };
    for (let i = 0; i < 3; i++) {  // 3 rutor fram
      switch (this.direction) {
        case 'up': pos.y--; break;
        case 'down': pos.y++; break;
        case 'left': pos.x--; break;
        case 'right': pos.x++; break;
      }
      if (pos.x >= 0 && pos.x < cols && pos.y >= 0 && pos.y < rows) {
        positions.push({ ...pos });
      }
    }
    return positions;
  }

  checkCollision(head, cols, rows, segments, foodPos, powerupPos, obstacles) {
    if (head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows) return 'wall';
    if (segments.slice(1).some(seg => seg.x === head.x && seg.y === head.y)) return 'self';
    if (obstacles.some(obs => obs.x === head.x && obs.y === head.y)) return 'obstacle';
    if (foodPos && foodPos.x === head.x && foodPos.y === head.y) return 'food';
    if (powerupPos && powerupPos.x === head.x && powerupPos.y === head.y) return 'powerup';
    return null;
  }
}