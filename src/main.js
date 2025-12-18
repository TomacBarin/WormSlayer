// main.js (ingen förändring behövs här, men för kompletthet)
import Game from "./Game.js";
import { mpapi } from "./mpapi.js";

const canvas = document.getElementById("game-board");
const game = new Game(canvas);
// const api = new mpapi("wss://mpapi.se/net", "squarecrawler"); Detta är före byte av repo
const api = new mpapi('ws://localhost:8080/net', 'wormslayer');

const keyMaps = [
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
  { up: "w", down: "s", left: "a", right: "d" },
  { up: "t", down: "g", left: "f", right: "h" },
  { up: "i", down: "k", left: "j", right: "l" },
];

document.addEventListener("keydown", (e) => {
  if (game.gameOverActive && e.key === "Enter") {
    game.resetToTitle();
    return;
  }
  if (!game.isRunning && !game.gameOverActive && !game.lobbyState) {
    if (e.key === "Enter") {
      game.start(false);
    } else if (e.key.toLowerCase() === "h") {
      startMultiplayer(true);
    } else if (e.key.toLowerCase() === "j") {
      startMultiplayer(false);
    }
    return;
  }
  if (game.lobbyState) {
    if (game.isHost && e.key.toLowerCase() === "s" && game.connectedPlayers.length >= 2) {
      game.lobbyCountdown = 5;
      game.lobbyStartTime = Date.now() + 5000;
      game.api.transmit({
        type: "lobby_countdown",
        startTime: game.lobbyStartTime
      });
    }
    return;
  }
  if (game.isRunning) {
    const key = e.key.toLowerCase();
    if (key === " ") {
      if (game.isMultiplayer) {
        if (game.isHost) {
          game.worms[0]?.shootTongue();
        } else {
          const myWorm = game.worms[game.myPlayerIndex];
          if (myWorm) {
            myWorm.shootTongue();
            game.api.transmit({
              type: "input",
              playerIndex: game.myPlayerIndex,
              shoot: true,
            });
          }
        }
      } else {
        game.worms.forEach((worm) => worm.shootTongue());
      }
      return;
    }

    if (game.isMultiplayer) {
      if (game.isHost) {
        const map = keyMaps[0];
        const worm = game.worms[0];
        if (!worm) return;
        if (key === map.up.toLowerCase() && worm.direction !== "down")
          worm.direction = "up";
        if (key === map.down.toLowerCase() && worm.direction !== "up")
          worm.direction = "down";
        if (key === map.left.toLowerCase() && worm.direction !== "right")
          worm.direction = "left";
        if (key === map.right.toLowerCase() && worm.direction !== "left")
          worm.direction = "right";
      } else {
        const map = keyMaps[game.myPlayerIndex] || keyMaps[1];
        let direction = null;
        if (key === map.up.toLowerCase()) direction = "up";
        if (key === map.down.toLowerCase()) direction = "down";
        if (key === map.left.toLowerCase()) direction = "left";
        if (key === map.right.toLowerCase()) direction = "right";
        const myWorm = game.worms[game.myPlayerIndex];
        if (
          direction &&
          myWorm &&
          myWorm.direction !== game.opposite(direction)
        ) {
          myWorm.direction = direction;
          game.api.transmit({
            type: "input",
            playerIndex: game.myPlayerIndex,
            direction,
          });
        }
      }
    } else {
      keyMaps.forEach((map, i) => {
        const worm = game.worms[i];
        if (!worm) return;
        if (key === map.up.toLowerCase() && worm.direction !== "down")
          worm.direction = "up";
        if (key === map.down.toLowerCase() && worm.direction !== "up")
          worm.direction = "down";
        if (key === map.left.toLowerCase() && worm.direction !== "right")
          worm.direction = "left";
        if (key === map.right.toLowerCase() && worm.direction !== "left")
          worm.direction = "right";
      });
    }
  }
});

const infoBtn = document.getElementById("infoBtn");
infoBtn.addEventListener("click", () => {
  const popup = document.createElement("div");
  popup.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
    background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
    z-index: 1000; font-family: VT323; color: #EEEEEE; padding: 64px; box-sizing: border-box;
  `;
  popup.innerHTML = `
    <div style="background: #484848; padding: 48px; max-width: 80%; max-height: 80%; overflow: auto; border: 4px solid #646464;">
      <h1 style="font-size: 64px; text-align: center; margin-bottom: 32px;">REGLER</h1>
      <p style="font-size: 28px; line-height: 1.4;">
        • Styr med pilar/WASD/TFGH/IJKL.<br>
        • Vit mat → växt + poäng + skapar hål.<br>
        • Orange mat → PowerUp.<br>
        • PowerUp = Dödar fiender och lagar hål.<br>
        • Använd space för powerup.<br>
        • Krock med vägg/kropp/hål/mask → reset.<br>
        • Flest poäng när timern tagit slut vinner.
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top: 32px; padding: 16px; font-size: 32px; background: #EEEEEE; border: none; cursor: pointer;">Stäng</button>
    </div>
  `;
  document.body.appendChild(popup);
});

async function startMultiplayer(isHost) {
  game.isMultiplayer = true;
  game.isHost = isHost;
  game.api = api;
  game.myPlayerIndex = null;

  let assignResolve;

  const unsubscribe = api.listen((event, messageId, clientId, data) => {
    if (event === "game") {
      game.processMessage(data, clientId);
      if (data.type === "assign" && assignResolve) {
        assignResolve();
      }
    }
  });

  if (isHost) {
    const hostPromise = api.host({ name: "SquareCrawler", private: false });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject("Timeout: No response from server"), 15000)
    );
    Promise.race([hostPromise, timeoutPromise])
      .then(({ session, clientId }) => {
        game.sessionId = session;
        game.myClientId = clientId;
        game.connectedPlayers.push({clientId: game.myClientId, playerIndex: 0});
        game.lobbyState = true;
        game.initLobbyBgFoods();
        game.animate();
      })
      .catch((e) => {
        console.error("Host error:", e);
        alert("Failed to host: " + e);
      });
  } else {
    const assignPromise = new Promise((resolve) => (assignResolve = resolve));

    const popup = document.createElement("div");
    popup.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
      background: rgba(0,0,0,0.8); display: flex; justify-content: center; align-items: center; 
      z-index: 1000; font-family: VT323; color: #EEEEEE; padding: 64px; box-sizing: border-box;
    `;
    popup.innerHTML = `
      <div style="background: #484848; padding: 48px; max-width: 80%; max-height: 80%; overflow: auto; border: 4px solid #646464;">
        <h1 style="font-size: 64px; text-align: center; margin-bottom: 32px;">Join Game</h1>
        <input id="sessionInput" type="text" placeholder="Ange Session ID..." 
               style="font-family: VT323; font-size: 32px; padding: 16px; background: #646464; color: #EEEEEE; border: 2px solid #19E9FF; width: 80%; margin-bottom: 32px;">
        <button id="joinButton" style="padding: 16px 32px; font-size: 32px; background: #F39420; border: none; cursor: pointer; margin-right: 16px;">Join</button>
        <button id="cancelButton" style="padding: 16px 32px; font-size: 32px; background: #646464; border: none; cursor: pointer;">Cancel</button>
      </div>
    `;
    document.body.appendChild(popup);

    const joinButton = document.getElementById("joinButton");
    const cancelButton = document.getElementById("cancelButton");
    const sessionInput = document.getElementById("sessionInput");

    cancelButton.onclick = () => {
      document.body.removeChild(popup);
    };

    joinButton.onclick = async () => {
      const sessionID = sessionInput.value.trim();
      if (!sessionID) return;
      document.body.removeChild(popup);

      const joinPromise = api.join(sessionID, { name: "Guest" });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject("Timeout: No response from server"), 15000)
      );
      Promise.race([joinPromise, timeoutPromise])
        .then(({ clientId }) => {
          game.myClientId = clientId;
          game.sessionId = sessionID;
          game.api.transmit({ type: "request_assign" });
          game.myPlayerIndex = -1;
          assignPromise
            .then(() => {
              game.lobbyState = true;
              game.initLobbyBgFoods();
              game.animate();
            })
            .catch((e) => {
              console.error("Sync timeout:", e);
              alert("Failed to sync with host: " + e);
            });
        })
        .catch((e) => {
          console.error("Join error:", e);
          alert("Failed to join: " + e);
        });
    };
  }
}

document.fonts.ready.then(() => {
  game.drawTitleScreen();
});