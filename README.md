# Beasthaven

A 3D monster-collecting, breeding and battling game for the browser, built for
CrazyGames. Hatch and raise original monsters on floating sky islands, grow
food, build habitats, breed new hybrids and fight turn-based 3v3 battles across
eight campaign worlds.

Everything in the game (monsters, buildings, islands, icons, music and sound)
is generated procedurally in code: there are no external art or audio assets
besides the SIL OFL fonts in `src/assets/fonts`.

## Run and build

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm test         # headless logic tests (economy, battles, save, campaign balance)
node tools/pacing.mjs 120 3   # simulate a 2-hour session (seed 3) and print its pacing
```

Upload the contents of `dist/` to CrazyGames. All paths are relative, so the
build also runs from any sub-folder or static host.

Useful URL flags during development:

| Flag | Effect |
| --- | --- |
| `?nosdk` | skip loading the CrazyGames SDK |
| `?devads` | simulate rewarded ads locally |
| `?dev` | expose `window.__bh` debug hooks for the test scripts |
| `?dev&timeskip=18000` | pretend 5 hours passed (offline earnings) |

## Project layout

```
src/
  core/      save system, audio synthesizer, CrazyGames SDK wrapper, rng, noise
  data/      monsters, abilities, elements, buildings, crops, campaign, quests,
             events, rewards (all gameplay content is data-driven)
  systems/   pure game logic: economy, buildings, monsters, breeding, hatchery,
             battle engine, campaign, quests, rewards, offline earnings
  render/    three.js engine, island world, monster builder/rig/animator,
             building models, battle arena, campaign map, hatch showcase
  ui/        HUD, world markers, screens and the storybook UI style sheets
  game/      game controller, campaign/battle mode, tutorial
tests/       node logic tests
tools/       Playwright scenario scripts used for visual/regression testing,
             and a pacing bot that plays a fresh save with the real systems
```

## CrazyGames integration

`src/core/sdk.js` wraps the v3 SDK and degrades to no-ops when it is not
available. The game reports loading and gameplay start/stop, pauses audio and
gameplay during ads, mirrors saves to the SDK data module for logged-in
players, and follows the platform mute setting. Rewarded videos are always
player-initiated; midgame ads only run at natural breaks (leaving a battle or
the map), never during battles, hatch reveals, the tutorial or reward screens,
and never in the first ten minutes of a session.
