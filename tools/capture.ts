// Development-only showcase director. Not imported by the application bundle.
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game, BACKGROUND } from "../src/game";
import * as C from "../src/constants";
export async function capture() {
  const canvas = document.querySelector("canvas")!;
  const engine = createEngine({
    canvas,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    background: BACKGROUND,
    clock: new ConstantClock(1000 / 30),
  });
  await engine.initialize();
  await engine.advance(1);
  const title = canvas.toDataURL("image/png");
  const d = engine.debug;
  engine.apply((s) => d.setScreen(s, "playing"));
  engine.apply((s) => d.setTick(s, 7 * 60 * C.TICK_HZ));
  engine.apply((s) => d.setLevel(s, 24));
  engine.apply((s) => d.setKills(s, 782));
  for (const [i, id] of (
    ["pyre", "beacon", "lantern", "halo", "pin", "oil-splash"] as const
  ).entries())
    engine.apply((s) =>
      d.setWeapon(s, i, id, id === "pyre" || id === "beacon" ? 1 : 6),
    );
  for (const [i, id] of (
    ["wick", "oil", "glass", "mirror", "tallow", "lure"] as const
  ).entries())
    engine.apply((s) => d.setPassive(s, i, id, 2));
  engine.apply((s) => d.setHp(s, 120));
  engine.apply((s) => d.setSpawning(s, false));
  engine.apply((s) => d.setEvents(s, false));
  engine.apply((s) => d.setEnemyContact(s, false));
  engine.apply((s) => d.setProgression(s, false));
  for (let i = 0; i < 100; i++) {
    const a = i * 2.3999632297,
      rad = 110 + Math.sqrt(i / 100) * 560;
    engine.apply((s) =>
      d.spawnEnemy(
        s,
        C.ENEMY_IDS[i % 10],
        Math.cos(a) * rad,
        Math.sin(a) * rad * 0.68,
      ),
    );
  }
  engine.apply((s) => d.spawnEnemy(s, "mothwing", -230, -160));
  engine.apply((s) => d.spawnEnemy(s, "owl", 285, -150));
  for (let i = 0; i < 55; i++) {
    const a = i * 2.3999632297,
      rad = 75 + (i % 13) * 25;
    engine.apply((s) =>
      d.spawnGem(
        s,
        C.GEM_TIERS[i % 3],
        Math.cos(a) * rad,
        Math.sin(a) * rad * 0.65,
      ),
    );
  }
  engine.apply((s) => d.spawnPickup(s, "chest", -120, 105));
  await engine.advance(5);
  const night = canvas.toDataURL("image/png");
  engine.startRecording();
  await engine.advance(120);
  const recording = engine.stopRecording();
  engine.apply((s) => d.reset(s));
  engine.apply((s) => d.setScreen(s, "almanac"));
  await engine.advance(1);
  const almanac = canvas.toDataURL("image/png");
  engine.destroy();
  return { title, night, almanac, recording };
}
