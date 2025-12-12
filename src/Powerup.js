export default class Powerup {
  constructor(cols, rows, obstacles = []) {
    this.cols = cols;
    this.rows = rows;
    this.obstacles = obstacles;
    this.pos = this.randomPos();
  }

  randomPos(occupied = []) {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * this.cols),
        y: Math.floor(Math.random() * this.rows)
      };
    } while (
      occupied.some(occ => occ.x === pos.x && occ.y === pos.y) ||
      this.obstacles.some(obs => obs.x === pos.x && obs.y === pos.y)
    );
    return pos;
  }

  newPos(occupied) {
    this.pos = this.randomPos(occupied);
  }
}