export default class Scoreboard {
  static KEY = 'wormSlayerScores';

  static getAll() {
    const stored = localStorage.getItem(this.KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static add(name, score) {
    const scores = this.getAll();
    scores.push({ name, score, date: new Date().toISOString() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(this.KEY, JSON.stringify(scores.slice(0, 50)));  // Top 50
    return scores;
  }

  static render(container) {
    const scores = this.getAll();
    container.innerHTML = `
      <div style="background: #646464; color: #EEEEEE; padding: 32px; border-radius: 8px; font-family: VT323; font-size: 32px;">
        <h2 style="text-align: center; margin-bottom: 24px;">HIGH SCORES</h2>
        <ul style="list-style: none; padding: 0;">
          ${scores.slice(0, 10).map((s, i) => `<li>#${i+1} ${s.name}: ${s.score}</li>`).join('')}
        </ul>
        <button onclick="this.parentElement.remove()" style="margin-top: 24px; padding: 8px 16px; font-size: 24px;">Close</button>
      </div>
    `;
  }
}