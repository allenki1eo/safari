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
  data/content.js    story, chapters, runners, allies, missions
  data/save.js       local progress, missions, daily reward
  ui/ui.js           all screens (title, intro, HUD, game over, shop…)
  ui/share.js        share-card renderer + Web Share
static/              PWA manifest, service worker, icons, fonts, og image
```

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

## Deploy to Vercel

The repo includes `vercel.json` (Vite framework, `dist` output, long-lived caching for hashed assets).
Import the repository in Vercel, or run `npx vercel --prod`. No environment variables are needed.

> The `src/` and `public/` folders hold the previous React prototype and its ~580 MB of unused
> assets. The new game doesn't use them (`publicDir` is `static/`), so they can be deleted.
