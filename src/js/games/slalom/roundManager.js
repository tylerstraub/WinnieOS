import { Obstacle } from './obstacle.js';

export const OBSTACLE_COLORS = [
  { r: 255, g: 80, b: 80 },
  { r: 80, g: 200, b: 255 },
  { r: 255, g: 200, b: 50 },
  { r: 180, g: 100, b: 255 }
];

export class RoundManager {
  constructor(nextRoundScore, skyColor, groundColor) {
    this.nextRoundScore = nextRoundScore;
    this.skyColor = skyColor;
    this.groundColor = groundColor;
    this.gameTime = 0;
    this.prevRound = null;
  }

  createObstacle(recorder, x, width) {
    const ob = Obstacle.newObstacle();
    const p = ob.points;
    p[0].setXYZ(x - width, 2.0, 40.5);
    p[1].setXYZ(x, -1.4, 40.0);
    p[2].setXYZ(x + width, 2.0, 40.5);
    p[3].setXYZ(x, 2.0, 39.5);
    ob.color = OBSTACLE_COLORS[recorder.getRandom() % 4];
    ob.prepareNewObstacle();
    return ob;
  }

  createObstacleRandom(recorder, vx) {
    const x = (recorder.getRandom() % 256) / 8.0 - 16.0 - vx * 39;
    return this.createObstacle(recorder, x, 0.6);
  }

  generateObstacle() {}

  isNextRound(score) {
    return score >= this.nextRoundScore;
  }

  setPrevRound(prev) {
    this.prevRound = prev;
  }

  init() {}

  getGroundColor() {
    return this.groundColor;
  }

  getSkyColor() {
    if (this.prevRound !== null && this.gameTime <= 32) {
      const t = this.gameTime;
      const t2 = 32 - t;
      const prev = this.prevRound.skyColor;
      const r = ((prev.r * t2 + this.skyColor.r * t) / 32) | 0;
      const g = ((prev.g * t2 + this.skyColor.g * t) / 32) | 0;
      const b = ((prev.b * t2 + this.skyColor.b * t) / 32) | 0;
      return { r, g, b };
    }
    return this.skyColor;
  }

  move() {}
}
