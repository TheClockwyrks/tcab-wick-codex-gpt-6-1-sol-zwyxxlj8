# Wick

One lamplighter against a city full of things drawn to the light. Walk, gather the gems left by the dark, and build a collection of tools that fire themselves. Survive ten minutes to reach dawn.

Wick includes ten tools, six evolutions, ten trinkets, thirteen creatures, an illustrated almanac, original pixel animations, sound effects, and a looping nocturne. It runs entirely in the browser, with no accounts, backend, or external requests.

## Run

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Build

```sh
npm run build
npm run preview
```

Deploy the contents of `dist/` to any static server. URLs are relative, so the game also works under a directory such as `/games/wick/`.

All production art and audio are committed in `assets/`. `public/assets` links that directory into Vite's static file copy. The build never generates assets or needs the authoring tools. The optional scripts in `tools/` document the one-time drawing, sound, and showcase work; they are not needed to install, build, or play.

## Controls

| Action | Keys |
| --- | --- |
| Walk / browse | Arrow keys or WASD |
| Confirm | Enter or Space |
| Back / pause | Escape |
| Pause / resume | P |
| Mute | M |
| Diagnostics | Backtick |

Every menu also supports mouse, pen, and touch. Use the almanac's tabs or Left/Right to change chapters; wheel travel scrolls its list. Touch movement uses the engine's directional controls.

The lamplighter only walks. Tools fire automatically. Collect gems to level up and choose a tool or trinket. You can carry six of each. A chest evolves a level-eight tool when its paired trinket is held. Consult the almanac to learn the creatures, tools, and pickups.

## Verify

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the real Simple 2D engine over a canvas with a counted clock, pose scenarios through its debug surface, and verify simulation and asset contracts. The game's state is immutable between frames; simulation advances at 60 ticks per second. Rendering and browser frame rate do not decide combat outcomes.

`showcase/` contains captured screenshots and a four-second engine recording of live combat. Its description and carousel are in `showcase.md` and `showcase.toml`.
