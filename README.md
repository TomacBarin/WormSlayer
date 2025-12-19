# Square Crawler: The Game

![Screenshot from the game](/assets/images/screenCrawlGame.webp)

A simple Snake game with power-ups and an increasing number of holes that the player must avoid, plus multiplayer support.
Built in JavaScript using Canvas.

## Installation

1. Clone the repo: `git clone https://github.com/TomacBarin/WormSlayer.git`
2. Open `index.html` in a web browser (use a local server like VS Code Live Server to avoid CORS issues with audio/fonts).

## How to Play

**Start the game**: Enter for single player, H to host multiplayer, J to join (enter session ID).

**Controls**:

All worms are controlled with the arrow keys, both in Single Player and Multiplayer.
When a PowerUp has been eaten (orange square), the tongue is activated with space. The tongue stays active for about four seconds and can both repair holes on the board and kill enemies.

**Rules**:

- White food: Causes growth + points, but leaves deadly holes.
- Orange food: Grants powerup (tongue).
- Powerup: The tongue kills enemies and repairs holes. Activate with spacebar.
- Collision with wall, own body, hole, or another worm: Reset.
- Most points when the timer runs out wins.

**?-button**: Click for game rules.

## Music and Sound Effects

The sound effects and the Very Beautiful Music were made by me.
