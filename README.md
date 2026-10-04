# KIMBIA! — Spirit of the Serengeti

A mobile-first 3D endless runner set on the Serengeti, playable in any phone browser.

> Every year, two million hooves follow the Song of the Savanna. Fisi the hyena king and his
> Rustmaw gang have stolen the Heart Seed that keeps the song alive. Run, gather the scattered
> golden seeds, and call on the animals of the plains to help you bring the song home.

## Play

| Action | Touch | Keyboard |
| --- | --- | --- |
| Switch lane | Swipe ← / → | ← → or A D |
| Jump | Swipe ↑ | ↑, W or Space |
| Slide / dive | Swipe ↓ | ↓ or S |
| Pause | ⏸ button | Esc or P |

### Animal allies (power-ups)

Grab glowing totems on the trail:

| Ally | Power |
| --- | --- |
| 🐘 **Tembo** the elephant | Ride him and smash through everything |
| 🦅 **Tai** the martial eagle | Fly over the plains along a river of seeds |
| 🐆 **Duma** the cheetah | Lightning dash: huge speed, untouchable |
| 🦒 **Twiga** the giraffe | Jumps go twice as high |
| 🐦 **Hondo** the hornbill | Seed magnet |
| 🦁 **Mfalme** the lion | Royal roar: double points |

### What keeps players coming back

- **Six-chapter story** that moves the sun across the sky: golden morning → kopjes → sunset stampede → a firefly night → dawn at the Rustmaw den → the song returns.
- **Missions** in sets of three that raise a permanent score multiplier.
- **Six unlockable runners** (Zuri, Juma, Neema, Baraka, Amani, Kito) and ally upgrades.
- **Daily rewards** with a 7-day streak.
- **Challenge sharing**: the game renders a score card image and a link (`/?c=<score>&n=<name>`) that greets your friend with *"Allen challenges you to beat 12,000!"*
- **Global leaderboard**: after a run, post your name and score. Rank is decided on the server. Open the board from the trophy on the title screen, or from the game-over card.
- **Installable PWA** that works offline. The score API is network-only; the rest of the game still plays offline.

## Tech

- [three.js](https://threejs.org) and vanilla ES modules, bundled with [Vite](https://vitejs.dev). About 175 KB gzipped in total.
- **No model, texture or audio files.** Every animal, tree and truck is built from low-poly primitives in `app/game/models.js`. Music (kalimba, djembe, shaker) and sound effects are synthesized with WebAudio in `app/game/audio.js`.
- A curved-world vertex shader gives the rolling horizon (`app/game/materials.js`).
- Static meshes are merged into vertex-coloured batches at build time, keeping each frame around 150–250 draw calls on phones. Pixel ratio adapts automatically if the frame rate drops.

```
app/
  main.js            boot + wiring
  game/game.js       run loop, physics, spawner, collisions, allies, camera
  game/world.js      sky, day/night cycle, ground, scenery, herds, particles
  game/models.js     procedural low-poly characters, animals, props
  game/materials.js  curved-world shader, material cache, mesh baking
  game/audio.js      procedural soundtrack + SFX
  game/input.js      swipe + keyboard
  data/content.js    story, chapters, runners, allies, missions
  data/save.js       local progress, missions, daily reward
  ui/ui.js           all screens (title, intro, HUD, game over, shop…)
  ui/leaderboard.js  fetch + render the global board (no database credentials)
  ui/share.js        share-card renderer + Web Share
api/scores.js        Vercel function: GET the top 20, POST a score
server/              libSQL access, validation, and the Vite dev/preview middleware
migrations/          SQL schema for the scores table
static/              PWA manifest, service worker, icons, fonts, og image
```

## Develop

```bash
npm install
cp .env.example .env   # then fill in Turso credentials
npm run db:init        # create the scores table
npm run dev            # http://localhost:5173  (also serves /api/scores)
npm run build          # outputs dist/
```

For a local database without Turso Cloud, set `TURSO_DATABASE_URL=file:data/kimbia.db` and leave the token empty. Cloud databases use a `libsql://` URL and require `TURSO_AUTH_TOKEN`.

## Leaderboard

Scores live in [Turso](https://turso.tech) (libSQL). The browser only calls `/api/scores`. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are read on the server — do not prefix them with `VITE_`, or Vite will ship them to the client.

`npm run db:init` runs `migrations/001_scores.sql`. The API also applies that file on first use (`CREATE TABLE IF NOT EXISTS`), so a new database is ready as soon as the env vars are set. The board returns the top 20 rows ordered by score, then by earlier submission. Rank is computed in SQL and any rank sent by the client is ignored. Names are 1–16 characters. Score, distance, seeds, and allies must be non-negative integers.

## Deploy to Vercel

The repo includes `vercel.json` (Vite framework, `dist` output, `/api/scores` as a Node function, long-lived caching for hashed assets). Import the repository in Vercel and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Production and Preview. Then run `npm run db:init` once with those same values, or open the game and post a score so the API creates the table.
