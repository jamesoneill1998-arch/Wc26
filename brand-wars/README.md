# Brand Wars

An arcade wrestling game with a General Manager mode, in the spirit of the mid-2000s console wrestling games. Two rival brands, **IGNITE** (Monday Night) and **UPRISING** (Friday Night), share an original roster of 34 wrestlers.

Every wrestler, brand, title and move name is original. Use the in-game **Superstars** editor to rename anyone, change their look, stats and finisher, or create new wrestlers.

## Play it

There is no build step and there are no dependencies. Serve the folder with any static server and open it:

```bash
cd brand-wars
```

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` straight from disk also works.

## Modes

- **Exhibition**: Singles, Tag Team, Triple Threat, Fatal 4-Way and Submission matches, in any arena, for 1 or 2 players or CPU vs CPU.
- **General Manager**: pick a brand, draft 14 wrestlers under a $1M weekly salary cap, crown champions, then book a show every week for 12, 24 or 52 weeks. TV ratings decide the weekly ratings war against the CPU general manager. Every fourth week is a pay-per-view. Play any match yourself or simulate it. You also manage morale, fatigue, injuries, rivalries, face/heel turns, free agents and trades. Progress saves automatically in the browser.
- **Superstars**: the roster editor.

## Controls

| Action | Keyboard (P1) | Gamepad |
| --- | --- | --- |
| Move | WASD or arrows | Left stick / D-pad |
| Run | Hold Shift | LT |
| Strike / Kick | J / I | X / Y |
| Grapple | K, then J (quick), K (strong), E (Irish whip), P (submission); hold a direction for a different move | A |
| Reverse | L when the prompt appears | RB / RT |
| Signature / Finisher | U | LB |
| Pin / ground submission | P / K next to a downed opponent | B |
| Pick up / climb the turnbuckle | E | L3 |
| Taunt / tag your partner | T | Back |
| Pause | Esc | Start |

Player 2 uses the arrow keys and the numpad (1 strike, 4 kick, 2 grapple, 3 reverse, 5 special, 6 pin, 7 climb/lift, 8 taunt, 0 run). On touch screens an on-screen stick and buttons appear.

## Code layout

| File | What it does |
| --- | --- |
| `js/data.js` | Brands, titles, move sets per wrestling style, and the default roster |
| `js/render.js` | Ring, arena and articulated wrestler drawing on canvas |
| `js/engine.js` | The match simulation: moves, reversals, pins, submissions, tag rules, CPU AI, HUD |
| `js/gm.js` | General Manager logic: draft, booking, show ratings, money, feuds, injuries, the rival GM |
| `js/play.js` | Game loop, keyboard, gamepad and touch input |
| `js/ui.js` | Menus and screens |
| `js/audio.js` | Synthesized sound (no audio files) |
