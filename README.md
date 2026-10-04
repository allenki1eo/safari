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
| 🇹🇿 | Mount Kilimanjaro | Rockfalls · snow, giant groundsels |
| 🇹🇿 | Selous · Nyerere | Napping crocodiles · the Rufiji River |
| 🇹🇿 | Zanzibar | Spice-market carts and fishing nets · dhows on turquoise water |
| 🇰🇪 | Maasai Mara | Wildebeest stampedes |
| 🇰🇪 | Amboseli | Elephants crossing beneath Kilimanjaro |
| 🇺🇬 | Bwindi Forest | Mountain gorillas in misty rainforest |

After Bwindi the run loops into a *legend lap*. Regions you reach unlock on the **Journey map**, and you can start future runs from any of them. Adding a region is mostly data: see `app/data/regions.js`.

### What keeps players coming back

- **A story told across eight regions.** Each one has its own animal narrator, and the sun moves with you: morning on the Serengeti, sunset on Kilimanjaro, night on the Rufiji, dawn over Zanzibar.
- **Missions** in sets of three that raise a permanent score multiplier.
- **Six unlockable runners** (Zuri, Juma, Neema, Baraka, Amani, Kito) and ally upgrades.
- **Daily rewards** with a 7-day streak.
- **Challenge sharing**: the game renders a score card image and a link (`/?c=<score>&n=<name>`) that greets your friend with *"Allen challenges you to beat 12,000!"*
- **Global leaderboard**: weekly and all-time boards (see below).
- **Ngao shield charms**: buy them with seeds and tap 🛡️ mid-run to survive one crash.
- **Seed combos, slow-motion close calls**, and music that builds as you speed up.
- **Installable PWA** that works offline.

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
  data/content.js    story, runners, allies, missions
  data/regions.js    the journey: every region's look, wildlife, hazards, music
  game/patterns.js   obstacle pattern generator (pure, unit-tested)
  game/regionModels.js  flora, fauna and hazards beyond the Serengeti
  data/save.js       local progress, missions, daily reward
  ui/ui.js           all screens (title, intro, HUD, game over, shop…)
  ui/share.js        share-card renderer + Web Share
api/leaderboard.js   serverless leaderboard (Supabase)
tests/               vitest suites
static/              PWA manifest, service worker, icons, fonts, og image
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # fairness, data and API tests (vitest)
npm run build    # outputs dist/
```

`tests/patterns.test.js` generates thousands of obstacle chunks for every region and fails if any of them blocks all three lanes. CI (`.github/workflows/ci.yml`) runs the tests and the build on every pull request.

## Leaderboard setup (optional)

`api/leaderboard.js` is a Vercel function that sits in front of Supabase, checks submitted scores for plausibility and rate-limits submissions. Until it's configured, the game shows "coming soon".

1. In Supabase, create the table. Anyone can read scores, and only the server function can write:

   ```sql
   create table if not exists safari_leaderboard (
     id bigint generated always as identity primary key,
     player_name text not null check (char_length(player_name) between 2 and 16),
     score integer not null check (score >= 0),
     distance integer not null default 0,
     coins integer not null default 0,
     character_id text,
     created_at timestamptz not null default now()
   );
   create index if not exists safari_leaderboard_score on safari_leaderboard (score desc);
   alter table safari_leaderboard enable row level security;
   create policy "read scores" on safari_leaderboard for select using (true);
   -- no insert policy: writes go through api/leaderboard.js with the service-role key
   ```

2. In Vercel → Project → Settings → Environment Variables, add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (keep it server-only and never prefix it with `VITE_`), then redeploy.

## Analytics

Vercel Web Analytics is wired into `index.html`. Turn it on in the Vercel dashboard (Project → Analytics) to start collecting page views.

## Deploy to Vercel

The repo includes `vercel.json` (Vite framework, `dist` output, long-lived caching for hashed assets).
Import the repository in Vercel, or run `npx vercel --prod`. The game needs no environment variables; the leaderboard is optional (see above).

> The `src/` and `public/` folders hold the previous React prototype and its ~580 MB of unused
> assets. The new game doesn't use them (`publicDir` is `static/`), so they can be deleted.
