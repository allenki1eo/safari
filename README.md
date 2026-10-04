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

### The journey

Every run is a chase across East Africa. Each region has its own ground, plants, animals, weather, music, story beat and signature hazard:

| | Region | Signature hazard |
| --- | --- | --- |
| 🇹🇿 | Serengeti | Charging rhinos, poacher trucks |
| 🇹🇿 | Ngorongoro Crater | Charging buffalo · flamingo lake inside the crater wall |
| 🇹🇿 | Lake Manyara | Lakeshore water crossings and charging lions · flamingos under the Rift wall |
| 🇹🇿 | Tarangire | Elephant families crossing · baobabs and termite towers |
| 🇹🇿 | Mount Kilimanjaro | Rockfalls · snow, giant groundsels |
| 🇹🇿 | Ruaha | Charging lions · painted wild dogs at dusk by the Great Ruaha River |
| 🇹🇿 | Selous · Nyerere | Napping crocodiles · the Rufiji River |
| 🇹🇿 | Zanzibar | Falling coconuts, boda-boda scooters, spice-market carts and fishing nets · no big game on the beach |
| 🇰🇪 | Maasai Mara | Wildebeest stampedes |
| 🇰🇪 | Amboseli | Elephants crossing beneath Kilimanjaro |
| 🇺🇬 | Bwindi Forest | Mountain gorillas in misty rainforest |

After Bwindi the run loops into a *legend lap*. Regions you reach unlock on the **Journey map**, and you can start future runs from any of them. Adding a region is mostly data: see `app/data/regions.js`.

### What keeps players coming back

- **A story told across eleven regions.** Each one has its own narrator, and the sun moves with you: morning on the Serengeti, sunset on Kilimanjaro, dusk in Ruaha, night on the Rufiji, a bright day on the Zanzibar coast.
- **Missions** in sets of three that raise a permanent score multiplier.
- **Six unlockable runners** (Zuri, Juma, Neema, Baraka, Amani, Kito) and ally upgrades.
- **Daily rewards** with a 7-day streak.
- **Challenge sharing**: the game renders a score card image and a link (`/?c=<score>&n=<name>`) that greets your friend with *"Allen challenges you to beat 12,000!"*
- **Global leaderboard**: a finished run is saved to the board. A name already stored on the device is used immediately; otherwise the game-over card asks for one and saves when you confirm. Run again and Home will not drop that score. Rank is decided on the server. Open the board from the trophy on the title screen, or from the game-over card.
- **Ngao shield charms**: buy them with seeds and tap 🛡️ mid-run to survive one crash.
- **Powerups** in glowing gems on the trail (and sometimes in a Zawadi box): 🌟 Dhahabu golden seeds worth 3, ⚡ Pointi ×2 double points, 🐢 Pole Pole slows the chase, and 🌪️ Kimbunga, a whirlwind that sweeps the next stretch clear.
- **Score cards**: the WhatsApp button shares an image of your run with the challenge link (the phone's share sheet where it can share files; a WhatsApp text link elsewhere).
- **Seed combos, slow-motion close calls**, and music that builds as you speed up.
- **Installable PWA** that works offline. An Install button on the title screen (and in Settings) uses the browser's own prompt where there is one, and shows step-by-step help on iPhone and in in-app browsers like WhatsApp (`app/ui/install.js`). The score API is network-only; the rest of the game still plays offline.

## Tech

- [three.js](https://threejs.org) and vanilla ES modules, bundled with [Vite](https://vitejs.dev). About 175 KB gzipped in total.
- **Runners:** fully modelled characters from Quaternius's CC0 [Universal Base Characters](https://quaternius.itch.io/universal-base-characters), animated with the CC0 [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) (sprint, jump, slide, roll, sit, stumble, fall). Each runner is dressed in code (`app/game/kids.js`): a skin tone, an outfit painted onto the body with kitenge, kanga, shuka and jersey patterns, hair, and their kit (headwrap, sweatband, bucket hat, beaded collar, braids). Before a run you pick one outfit for the device (a racing kit, a football jersey, a kanga wrap, a ranger vest or a road cloak); it is saved locally and worn on the select screen and the track. `scripts/build-kids.mjs` compresses everything to about 1.3 MB for a run. The hand-built runner in `people.js` stands in until the files arrive.
- **Animals:** every savanna animal is a textured, animated model from [0 A.D.](https://play0ad.com) by Wildfire Games, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) (`static/models/animals/`, licence text alongside; credited in Settings). Lion, lioness, African elephant, giraffe, zebra, wildebeest, rhino, hippo, gazelle, crocodile and the elephant and giraffe calves (which walk at their mothers' side) are 0 A.D.'s own; 0 A.D. has no hyena, cheetah, Cape buffalo, African wild dog or warthog, so Fisi's pack and the painted wild dogs are its wolf, the cheetah its tiger, the buffalo its black bull and the warthog its boar, each given a new coat in a shader (`app/game/wildlife.js`). Those model files, and any changes to them, stay under that licence; the game's code is unaffected. The code-rigged animals (`app/game/rigkit.js`, `fauna.js`) stand in while the models load.
- **No model, texture or audio files.** Trees, trucks and the remaining animals are built from low-poly primitives in `app/game/models.js`. Music (kalimba, djembe, shaker) and sound effects are synthesized with WebAudio in `app/game/audio.js`.
- A curved-world vertex shader gives the rolling horizon (`app/game/materials.js`).
- Static meshes are merged into vertex-coloured batches at build time, keeping each frame around 150–250 draw calls on phones. Pixel ratio adapts automatically if the frame rate drops.

```
app/
  main.js            boot + wiring
  game/game.js       run loop, physics, spawner, collisions, allies, camera
  game/world.js      sky, day/night cycle, ground, scenery, herds, particles
  game/models.js     procedural low-poly characters, animals, props
  game/rigkit.js     toolkit for skinned characters: shapes, bones, patterns, keyframed clips
  game/kids.js       the runners: loading the modelled characters, dressing them, their clips
  game/people.js     hand-built stand-in runners (used while the models load)
  game/wardrobe.js   outfits for the hand-built runners
  game/fauna.js      code-rigged animals (cheetah, hyenas, buffalo) and stand-ins
  game/wildlife.js   0 A.D. animals: loading, sizing, clips, Tembo's blanket
  game/materials.js  curved-world shader, material cache, mesh baking
  game/audio.js      procedural soundtrack + SFX
  game/input.js      swipe + keyboard
  data/content.js    story, runners, allies, missions
  data/regions.js    the journey: every region's look, wildlife, hazards, music
  game/patterns.js   obstacle pattern generator (pure, unit-tested)
  game/regionModels.js  flora, fauna and hazards beyond the Serengeti
  data/save.js       local progress, missions, daily reward
  ui/ui.js           all screens (title, intro, HUD, game over, shop…)
  ui/leaderboard.js  fetch + render the global board (no database credentials)
  ui/share.js        share-card renderer + Web Share
api/scores.js        Vercel function: GET the top 20, POST a score
server/              libSQL access, validation, and the Vite dev/preview middleware
migrations/          SQL schema for the scores table
tests/               vitest suites (pattern fairness, regions, save data)
static/              PWA manifest, service worker, icons, fonts, og image
static/models/       the runners' character models and clips (CC0, Quaternius)
static/models/animals/  0 A.D. animal models (CC BY-SA 3.0, Wildfire Games)
scripts/             database init, character build
```

## Develop

```bash
npm install
cp .env.example .env   # then fill in Turso credentials
npm run db:init        # create the scores table
npm run dev            # http://localhost:5173  (also serves /api/scores)
npm test               # vitest suites + leaderboard server tests
npm run build          # outputs dist/
```

For a local database without Turso Cloud, set `TURSO_DATABASE_URL=file:data/kimbia.db` and leave the token empty. Cloud databases use a `libsql://` URL and require `TURSO_AUTH_TOKEN`.

`tests/patterns.test.js` generates thousands of obstacle chunks for every region and fails if any of them blocks all three lanes. CI (`.github/workflows/ci.yml`) runs the tests and the build on every pull request.

## Leaderboard

Scores live in [Turso](https://turso.tech) (libSQL). The browser only calls `/api/scores`. `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are read on the server — do not prefix them with `VITE_`, or Vite will ship them to the client.

- **One row per runner.** Each player has a single row with their best run. A new run replaces it only if it scores higher. Every posted run is also logged in `scores`.
- **Unique names.** Names are 1–16 characters and unique ignoring case and spacing ("Zuri" = "zuri" = " ZURI "). Each device creates a random secret key on first use, and the server stores only its SHA-256 hash. Holding the key is what makes a name yours, so nobody can post under someone else's name. Renaming (in Settings) keeps your best score.
- **Automatic posting.** Players pick a name once, on their first game over. After that, every run posts by itself and the card shows their rank and whether they set a new personal best.
- **Migrations.** `migrations/001_scores.sql` and `002_players.sql` run in order through `npm run db:init`, or automatically on the API's first request. `002` folds the old one-row-per-run table into one player per name, keeping each name's best. The first device to post under a folded name claims it.

The board returns the top 20 runners by best score, with earlier players ahead on ties. Rank is computed in SQL and anything the client sends as a rank is ignored.

## Analytics

Vercel Web Analytics is wired into `index.html`. Turn it on in the Vercel dashboard (Project → Analytics) to start collecting page views.

## Deploy to Vercel

The repo includes `vercel.json` (Vite framework, `dist` output, `/api/scores` as a Node function, long-lived caching for hashed assets). Import the repository in Vercel and set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for Production and Preview. Then run `npm run db:init` once with those same values, or open the game and post a score so the API creates the table.
