# Square Crawler: The Game

![Screenshot from spelet](/assets/images/screenCrawlGame.webp)

Ett enkelt Snakespel med power-ups och ett ökande antal hål som spelaren måste undvika, samt multiplayer-funktion.
Byggt i JavaScript med Canvas.

## Installation

1. Klona repot: `git clone https://github.com/TomacBarin/WormSlayer.git`
2. Öppna `index.html` i en webbläsare (använd en lokal server som VS Code Live Server för att undvika CORS-problem med ljud/fonter).

## Hur man spelar

**Starta spel**: Enter för lokalt spel, H för host multiplayer, J för join (ange session ID).

**Kontroller**:

Samtliga ormar kontrolleras med piltangerna, både i Local Play samt Multiplayer.
När en PowerUp har ätits (orange ruta) aktiveras tungan med space. Tungan är aktiv i cirka fyra sekunder, och kan både laga hål på spelplanen, samt döda fiender.

**Regler**:

- Vit mat: Skapar tillväxt + poäng, men lämnar dödliga hål.
- Orange mat: Ger powerup (tunga).
- Powerup: Tungan dödar fiender och reparerar hål. Aktivera med mellanslag.
- Krock med vägg, egen kropp, hål eller annan mask: Återställning.
- Flest poäng när timern tar slut vinner.

**?-knappen**: Klicka för spelregler.

## Musik och ljudeffekter

Ljudeffekterna samt den Mycket Vackra Musiken har gjorts utav mig.
