const boardHtml = document.querySelector("#game-board");

boardHtml.classList.add("title-screen");

boardHtml.innerHTML = `
    <div class="main-title">WORM SLAYER</div>
    <div class="subtitle">Press enter to play</div>
`;