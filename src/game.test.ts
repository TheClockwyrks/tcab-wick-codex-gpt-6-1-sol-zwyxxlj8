/// <reference types="node" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { game } from "./game";
import type { WickState, WickDebugApi } from "./types";
import type { Engine } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import { initial, pool, stats } from "./core";
import { debug } from "./debug";

// Only the host's browser decoders are replaced. The real engine owns input,
// asset resolution, cue emission, state replacement, clocks, and rendering.
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (path: string) => new Response(await readFile(path)),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  class AudioContextStub {
    state = "running";
    currentTime = 0;
    destination = {};
    decodeAudioData() {
      return Promise.resolve({ duration: 1 });
    }
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
    createBufferSource() {
      return {
        buffer: null,
        loop: false,
        connect() {},
        start() {},
        stop() {},
        disconnect() {},
      };
    }
  }
  vi.stubGlobal("AudioContext", AudioContextStub);
});
const engines: Engine<WickState, WickDebugApi>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function fixture(step = C.TICK_DT) {
  const target = new EventTarget(),
    canvas = createCanvas(C.STAGE_W, C.STAGE_H);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    clock: new ConstantClock(step * 1000),
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  const cues: string[] = [];
  engine.events.on("cue:played", (e) => cues.push(e.cue));
  await engine.initialize();
  const key = (code: string, type = "keydown") => {
    const ev = new Event(type);
    Object.defineProperties(ev, {
      code: { value: code },
      repeat: { value: false },
    });
    target.dispatchEvent(ev);
  };
  const tap = async (code: string) => {
    key(code);
    await engine.advance(1);
    key(code, "keyup");
    await engine.advance(1);
  };
  const pose = (f: Parameters<typeof engine.apply>[0]) => engine.apply(f);
  const quiet = () => {
    pose((s) => debug.setSpawning(s, false));
    pose((s) => debug.setEvents(s, false));
    pose((s) => debug.setEnemyMotion(s, false));
    pose((s) => debug.setEnemyContact(s, false));
  };
  const start = () => {
    quiet();
    pose((s) => debug.setScreen(s, "playing"));
  };
  return { engine, pose, key, tap, cues, start, quiet, canvas, target };
}
describe("engine, state, input and fixed ticks", () => {
  it("loads the complete asset set and begins with an inert title", async () => {
    const { engine } = await fixture();
    expect(engine.state).toEqual(initial());
    await engine.advance(3);
    expect(engine.state.run.tick).toBe(0);
    expect(engine.state.simTime).toBeCloseTo(3 * C.TICK_DT);
    expect(engine.diagnostics().every((d) => !d.error)).toBe(true);
  });
  it("starts on the confirm frame and preserves the previous state by value", async () => {
    const { engine, key } = await fixture();
    const previous = engine.state;
    key("Enter");
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.run.weapons[0].id).toBe("taper");
    expect(previous).toEqual(initial());
  });
  it("normalizes diagonal movement and retains facing on vertical motion", async () => {
    const { engine, start, key } = await fixture();
    start();
    key("KeyA");
    key("KeyW");
    await engine.advance(60);
    expect(
      Math.hypot(engine.state.run.player.x, engine.state.run.player.y),
    ).toBeCloseTo(C.MOVE_SPEED);
    expect(engine.state.run.player.facing).toBe("left");
    key("KeyA", "keyup");
    await engine.advance(1);
    expect(engine.state.run.player.facing).toBe("left");
  });
  it("consumes thirty ticks from half a second and preserves a half-tick remainder", async () => {
    const { engine, start } = await fixture(0.5);
    start();
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    expect(engine.state.accumulator).toBe(0);
    engine.setClock(new ConstantClock(C.TICK_DT * 500));
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(30);
    expect(engine.state.accumulator).toBeCloseTo(C.TICK_DT / 2);
    await engine.advance(1);
    expect(engine.state.run.tick).toBe(31);
  });
  it("freezes the world on pause and resumes by either pause binding", async () => {
    const { engine, start, key, tap } = await fixture();
    start();
    await engine.advance(1);
    const tick = engine.state.run.tick;
    key("KeyP");
    await engine.advance(1);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.accumulator).toBe(0);
    await engine.advance(6);
    expect(engine.state.run.tick).toBe(tick);
    key("KeyP", "keyup");
    await tap("Escape");
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(tick + 2);
  });
  it("navigates the almanac with keyboard and returns to its title entry", async () => {
    const { engine, tap } = await fixture();
    await tap("ArrowDown");
    await tap("Enter");
    expect(engine.state.screen).toBe("almanac");
    await tap("ArrowRight");
    expect(engine.state.almanacTab).toBe(1);
    await tap("ArrowUp");
    expect(engine.state.menuIndex).toBe(C.PASSIVE_IDS.length - 1);
    await tap("Escape");
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("mutes and resets all drivers without changing the bus mute preference", async () => {
    const { engine, pose, tap } = await fixture();
    await tap("KeyM");
    expect(engine.state.muted).toBe(true);
    pose((s) => debug.setDrops(s, false));
    pose((s) => debug.reset(s));
    expect(engine.state).toEqual(initial(true));
  });
});
describe("combat, weapons and contact", () => {
  it("applies Taper only on its creation tick, then leaves a visible flash", async () => {
    const { engine, pose, start, cues } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "taper", 1));
    pose((s) => debug.spawnEnemy(s, "hound", 50, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(110);
    expect(engine.state.run.zones[0].width).toBe(C.TAPER_LEVELS[0].width);
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(110);
    expect(cues).toContain("hit");
  });
  it("fires Ember at distinct nearest enemies, with no redundant bolts", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "ember", 6));
    pose((s) => debug.spawnEnemy(s, "hound", 100, 0));
    pose((s) => debug.spawnEnemy(s, "hound", 0, 150));
    await engine.advance(1);
    expect(engine.state.run.projectiles).toHaveLength(2);
    const bolts = engine.state.run.projectiles;
    expect(bolts[0].vx).toBeCloseTo(400);
    expect(bolts[0].vy).toBeCloseTo(0);
    expect(bolts[1].vx).toBeCloseTo(0);
    expect(bolts[1].vy).toBeCloseTo(400);
    expect(
      engine.state.run.projectiles.every((q) => q.x === 0 && q.y === 0),
    ).toBe(true);
  });
  it("fires Pin horizontally, spreading launch positions rather than angles", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setFacing(s, "left"));
    pose((s) => debug.setWeapon(s, 0, "pin", 4));
    pose((s) => debug.spawnEnemy(s, "hound", 0, 100));
    await engine.advance(1);
    const q = engine.state.run.projectiles;
    expect(q.map((q) => q.y)).toEqual([-10, 0, 10]);
    expect(q.every((q) => q.vx === -600 && q.vy === 0)).toBe(true);
  });
  it("spends finite pierce in enemy id order and never re-hits", async () => {
    const { engine, pose, start } = await fixture();
    start();
    for (let i = 0; i < 3; i++)
      pose((s) => debug.spawnEnemy(s, "hound", 100, 0));
    pose((s) => debug.spawnProjectile(s, "pin", 100, 0, 0, 0, 1));
    await engine.advance(1);
    expect(engine.state.run.enemies.map((e) => e.hp)).toEqual([114, 114, 120]);
    expect(engine.state.run.projectiles).toHaveLength(0);
  });
  it("retains infinite pierce and observes the half-second re-hit timer", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.spawnEnemy(s, "hound", 100, 0));
    pose((s) => debug.spawnProjectile(s, "shard", 100, 0, 0, 0, -1));
    await engine.advance(30);
    expect(engine.state.run.enemies[0].hp).toBe(112);
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(104);
  });
  it("integrates Sconce position before acceleration", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.spawnProjectile(s, "sconce", 0, 0, 600, 0, -1));
    await engine.advance(1);
    expect(engine.state.run.projectiles[0]).toMatchObject({
      x: 10,
      vx: 590,
      ax: -600,
    });
  });
  it("bounces Shard at camera edges and leaves inward velocities inward", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.spawnProjectile(s, "shard", 639, 0, 600, 0, -1));
    await engine.advance(1);
    expect(engine.state.run.projectiles[0]).toMatchObject({ x: 640, vx: -600 });
  });
  it("pulses Halo against overlapping enemy circles and follows player movement", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "halo", 1));
    pose((s) => debug.spawnEnemy(s, "hound", 90, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(117);
    pose((s) => debug.setPlayerPosition(s, 30, 40));
    pose((s) => debug.setWeaponFire(s, false));
    await engine.advance(1);
    expect(engine.state.run.zones[0]).toMatchObject({ x: 30, y: 40 });
  });
  it("creates permanent Chandelier even when fire is held and removes it with the slot", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "chandelier", 1));
    pose((s) => debug.setWeaponFire(s, false));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(C.CHANDELIER_STATS.amount);
    expect(engine.state.run.zones.every((z) => z.ttl === null)).toBe(true);
    pose((s) => debug.removeWeapon(s, 0));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(0);
  });
  it("pulses Oil Splash at its posed offset and its fixed interval", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "oil-splash", 1));
    pose((s) => debug.setNextPuddleOffset(s, 100, 0));
    pose((s) => debug.spawnEnemy(s, "hound", 100, 0));
    await engine.advance(18);
    expect(engine.state.run.enemies[0].hp).toBe(116);
    await engine.advance(1);
    expect(engine.state.run.enemies[0].hp).toBe(112);
    expect(engine.state.run.nextPuddleOffset).toBeNull();
  });
  it("targets Spark once per eligible enemy and exempts the Dark from Flare", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "spark", 1));
    pose((s) => debug.spawnEnemy(s, "hound", 100, 0));
    pose((s) => debug.spawnEnemy(s, "dark", 200, 0));
    pose((s) => debug.setNextStrikeTarget(s, 1));
    await engine.advance(1);
    expect(engine.state.run.enemies[1].hp).toBe(
      10000 - C.SPARK_LEVELS[0].damage,
    );
    pose((s) => debug.setWeapon(s, 0, "flare", 1));
    await engine.advance(1);
    expect(engine.state.run.enemies[1].hp).toBe(
      10000 - C.SPARK_LEVELS[0].damage,
    );
    expect(engine.state.run.enemies[0].hp).toBe(20);
  });
  it("contact timers are per enemy and armor has a one-point floor", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setEnemyContact(s, true));
    pose((s) => debug.setPassive(s, 0, "brass", 3));
    pose((s) => debug.spawnEnemy(s, "gnat", 0, 0));
    pose((s) => debug.spawnEnemy(s, "gnat", 0, 0));
    await engine.advance(30);
    expect(engine.state.run.player.hp).toBe(98);
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(96);
    expect(engine.state.run.hurtFlash).toBe(C.HURT_FLASH);
  });
});
describe("growth, chests, drops and endings", () => {
  it("collects gems, queues overflow levels and accepts posed offers", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setXp(s, 19));
    pose((s) => debug.setNextOffers(s, ["ember", "wick"]));
    pose((s) => debug.spawnGem(s, "small", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run).toMatchObject({
      level: 3,
      xp: 0,
      pendingLevelUps: 2,
      offers: ["ember", "wick"],
    });
    pose((s) => debug.choose(s, 0));
    expect(engine.state.screen).toBe("levelup");
    expect(engine.state.run.weapons[0].id).toBe("ember");
    expect(engine.state.run.pendingLevelUps).toBe(1);
  });
  it("holds experience without progression and does not derive levels merely by posing xp", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setXp(s, 100));
    await engine.advance(1);
    expect(engine.state.run.level).toBe(1);
    pose((s) => debug.setProgression(s, false));
    pose((s) => debug.spawnGem(s, "large", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.xp).toBe(110);
    expect(engine.state.screen).toBe("playing");
  });
  it("a new death gem is attracted immediately but first flies on the next tick", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "taper", 1));
    pose((s) => debug.spawnEnemy(s, "moth", 40, 0));
    pose((s) => debug.setNextDrop(s, "bread"));
    await engine.advance(1);
    expect(engine.state.run.gems[0]).toMatchObject({ x: 40, attracted: true });
    expect(engine.state.run.pickups[0].kind).toBe("bread");
    await engine.advance(1);
    expect(engine.state.run.gems[0].x).toBe(30);
  });
  it("collects draft and bread through their real paths", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setHp(s, 20));
    pose((s) => debug.spawnGem(s, "large", 500, 0));
    pose((s) => debug.spawnPickup(s, "bread", 0, 0));
    pose((s) => debug.spawnPickup(s, "draft", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.player.hp).toBe(50);
    expect(engine.state.run.gems[0].attracted).toBe(true);
    expect(engine.state.run.pickups).toHaveLength(0);
  });
  it("evolves the first eligible slot, regardless of recipe order", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "halo", 8));
    pose((s) => debug.setWeapon(s, 1, "taper", 8));
    pose((s) => debug.setPassive(s, 0, "tinder", 1));
    pose((s) => debug.setPassive(s, 1, "wick", 1));
    pose((s) => debug.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("chest");
    expect(engine.state.run.chestResult).toEqual({
      kind: "evolve",
      weapon: "corona",
    });
    expect(engine.state.run.weapons.map((w) => w.id)).toEqual([
      "corona",
      "taper",
    ]);
  });
  it("chests level a posed held item and Tallow raises current health", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setPassive(s, 0, "tallow", 1));
    pose((s) => debug.setNextChestItem(s, "tallow"));
    pose((s) => debug.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.run.chestResult).toEqual({
      kind: "level",
      item: "tallow",
      level: 2,
    });
    expect(engine.state.run.player.hp).toBe(115);
    expect(stats(engine.state.run).maxHp).toBe(130);
  });
  it("an empty loadout chest heals and chest overlays have priority over queued levels", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setHp(s, 20));
    pose((s) => debug.setPendingLevelUps(s, 1));
    pose((s) => debug.spawnPickup(s, "chest", 0, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("chest");
    expect(engine.state.run.chestResult).toEqual({ kind: "heal" });
    expect(engine.state.run.player.hp).toBe(50);
  });
  it("dawn takes precedence over fallen and leaves the terminal tick frozen", async () => {
    const { engine, pose, start, cues } = await fixture();
    start();
    pose((s) => debug.setTick(s, C.DAWN_TIME * C.TICK_HZ - 1));
    pose((s) => debug.setHp(s, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("dawn");
    await engine.advance(2);
    expect(engine.state.run.tick).toBe(36000);
    expect(cues).toContain("dawn");
  });
  it("runs the real fallen path and discards unconsumed frame time", async () => {
    const { engine, pose, start } = await fixture(0.5);
    start();
    pose((s) => debug.setHp(s, 0));
    await engine.advance(1);
    expect(engine.state.screen).toBe("fallen");
    expect(engine.state.run.tick).toBe(1);
    expect(engine.state.accumulator).toBe(0);
  });
});
describe("director and debug contract", () => {
  it("scales commons by clock, respects a posed spawn angle and consumes outcomes", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setTick(s, 60 * C.TICK_HZ));
    pose((s) => debug.setSpawning(s, true));
    pose((s) => debug.setNextSpawnAngle(s, 90));
    pose((s) => debug.setNextSpawnType(s, "rat"));
    await engine.advance(1);
    const e = engine.state.run.enemies[0];
    expect(e.type).toBe("rat");
    expect(e.x).toBeCloseTo(0);
    expect(e.y).toBe(760);
    expect(e.maxHp).toBe(15 * 1.15);
    expect(engine.state.run.nextSpawnAngle).toBeNull();
  });
  it("fires a swarm on its exact tick and never catches up a skipped event", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setTick(s, 3599));
    pose((s) => debug.setEvents(s, true));
    pose((s) => debug.setNextSwarmAngle(s, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(C.SWARM_SIZE);
    expect(
      engine.state.run.enemies.every(
        (e) => e.type === "gnat" && e.heading.x === 1,
      ),
    ).toBe(true);
    expect(engine.state.run.firedEvents).toEqual([60]);
  });
  it("moves drift along fixed headings and weaves from an anchor", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.spawnEnemy(s, "gnat", 100, 0));
    pose((s) => debug.setEnemyHeading(s, 0, 0, 1));
    pose((s) => debug.spawnEnemy(s, "wisp", 100, 0));
    pose((s) => debug.setEnemyMotion(s, true));
    await engine.advance(1);
    expect(engine.state.run.enemies[0].x).toBe(100);
    expect(engine.state.run.enemies[0].y).toBeCloseTo(160 * C.TICK_DT);
    expect(engine.state.run.enemies[1].y).not.toBe(0);
  });
  it("despawns commons but keeps elites outside the view", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.spawnEnemy(s, "moth", 1300, 0));
    pose((s) => debug.spawnEnemy(s, "owl", 1300, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies.map((e) => e.type)).toEqual(["owl"]);
  });
  it("reconciles derived values without advancing or changing the source", async () => {
    const { engine, pose } = await fixture();
    pose((s) => debug.setPassive(s, 0, "tallow", 3));
    pose((s) => debug.setHp(s, 999));
    const before = engine.state;
    const reconciled = debug.reconcile(before);
    expect(reconciled).toEqual(before);
    expect(debug.snapshot(reconciled).run.maxHp).toBe(145);
    expect(reconciled.run.player.hp).toBe(999);
    expect(pool(before.run)).toContain("tallow");
  });
  it("rejects invalid domain values and leaves the original state untouched", () => {
    const s = initial();
    expect(() => debug.setTick(s, 36000)).toThrow();
    expect(() => debug.setWeapon(s, 1, "taper", 1)).toThrow();
    expect(() => debug.setNextPuddleOffset(s, 401, 0)).toThrow();
    expect(() => debug.setNextOffers(s, ["wick", "wick"])).toThrow();
    expect(() => debug.setEnemyHp(s, 999, 2)).toThrow();
    expect(() => debug.choose(s, 0)).toThrow();
    expect(s).toEqual(initial());
  });
  it("returns a plain detached snapshot without animation bookkeeping", async () => {
    const { engine, pose } = await fixture();
    pose((s) => debug.spawnProjectile(s, "ember", 0, 0, 20, 0, 1));
    pose((s) => debug.spawnGem(s, "small", 4, 5));
    const snap = debug.snapshot(engine.state);
    expect(snap.run.projectiles[0]).not.toHaveProperty("born");
    expect(snap.run.gems[0]).not.toHaveProperty("born");
    expect(snap).not.toHaveProperty("puffs");
    expect(snap.version).toBe(1);
  });
});

describe("pointer menus and remaining simulation contracts", () => {
  const sendPointer = (
    target: EventTarget,
    type: string,
    x: number,
    y: number,
    device = "mouse",
  ) => {
    const event = new Event(type);
    Object.assign(event, {
      clientX: x,
      clientY: y,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerId: 1,
      pointerType: device,
      isPrimary: true,
    });
    target.dispatchEvent(event);
  };
  it("accepts a complete mouse click arriving within one frame", async () => {
    const { engine, target } = await fixture();
    const rect = debug.menuRects(engine.state)[0];
    sendPointer(target, "pointerdown", rect.x + 20, rect.y + 20);
    sendPointer(target, "pointerup", rect.x + 20, rect.y + 20);
    await engine.advance(1);
    expect(engine.state.screen).toBe("playing");
    expect(engine.state.run.tick).toBe(1);
  });
  it("a touch dragged away does not accept or change the pressed selection", async () => {
    const { engine, target } = await fixture();
    const rect = debug.menuRects(engine.state)[1];
    sendPointer(target, "pointerdown", rect.x + 20, rect.y + 20, "touch");
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(1);
    sendPointer(target, "pointermove", 800, 600, "touch");
    sendPointer(target, "pointerup", 800, 600, "touch");
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(1);
  });
  it("scrolls the almanac without moving its highlight and selects tabs by touch", async () => {
    const { engine, pose, target } = await fixture();
    pose((s) => debug.setScreen(s, "almanac"));
    const event = new Event("wheel");
    Object.assign(event, { deltaX: 0, deltaY: 300, deltaMode: 0 });
    target.dispatchEvent(event);
    await engine.advance(1);
    expect(engine.state.menuIndex).toBe(0);
    expect(engine.state.almanacScroll).toBe(3);
    const tab = debug.tabRects(engine.state)[2];
    sendPointer(target, "pointerdown", tab.x + 10, tab.y + 10, "touch");
    sendPointer(target, "pointerup", tab.x + 10, tab.y + 10, "touch");
    await engine.advance(1);
    expect(engine.state.almanacTab).toBe(2);
    expect(engine.state.almanacScroll).toBe(0);
  });
  it("shows instructions, ignores confirm there, and returns by its pointer exit", async () => {
    const { engine, pose, target, tap } = await fixture();
    pose((s) => debug.setScreen(s, "howto"));
    await tap("Enter");
    expect(engine.state.screen).toBe("howto");
    const rect = debug.menuRects(engine.state)[0];
    sendPointer(target, "pointerdown", rect.x + 10, rect.y + 10);
    sendPointer(target, "pointerup", rect.x + 10, rect.y + 10);
    await engine.advance(1);
    expect(engine.state.screen).toBe("title");
    expect(engine.state.menuIndex).toBe(2);
  });
  it("replaces Chandelier lanterns when Mirror changes, retaining the leading angle", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "chandelier", 1));
    await engine.advance(2);
    const previous = engine.state.run.zones[0];
    pose((s) => debug.setPassive(s, 0, "mirror", 1));
    await engine.advance(1);
    expect(engine.state.run.zones).toHaveLength(5);
    expect(engine.state.run.zones[0].id).toBeGreaterThan(previous.id);
    expect(engine.state.run.zones[0].angle).toBeCloseTo(previous.angle!);
    expect(engine.state.run.zones.every((z) => !z.hits.length)).toBe(true);
  });
  it("holds a base Lantern orbit fixed after a Glass level and spins it only while motion is on", async () => {
    const { engine, pose, start } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "lantern", 1));
    await engine.advance(1);
    pose((s) => debug.setPassive(s, 0, "glass", 3));
    pose((s) => debug.setEffectMotion(s, false));
    await engine.advance(1);
    expect(engine.state.run.zones[0].x).toBe(C.LANTERN_LEVELS[0].orbit);
    expect(engine.state.run.zones[0].radius).toBe(C.LANTERN_LEVELS[0].radius);
  });
  it("emits hit and kill once per tick even when multiple enemies die", async () => {
    const { engine, pose, start, cues } = await fixture();
    start();
    pose((s) => debug.setWeapon(s, 0, "taper", 1));
    pose((s) => debug.spawnEnemy(s, "moth", 30, 0));
    pose((s) => debug.spawnEnemy(s, "moth", 50, 0));
    await engine.advance(1);
    expect(cues.filter((c) => c === "hit")).toHaveLength(1);
    expect(cues.filter((c) => c === "kill")).toHaveLength(1);
    expect(engine.state.run.kills).toBe(2);
  });
  it("holds a capped director timer due, and starts a new window immediately", async () => {
    const { engine, pose, start } = await fixture();
    start();
    for (let i = 0; i < C.SPAWN_WINDOWS[0].cap; i++)
      pose((s) => debug.spawnEnemy(s, "moth", 400, 0));
    pose((s) => debug.setSpawning(s, true));
    await engine.advance(1);
    expect(engine.state.run.spawnTimer).toBe(0);
    pose((s) => debug.removeEnemy(s, 0));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(20);
    pose((s) => debug.setTick(s, 1799));
    pose((s) => debug.setSpawnTimer(s, 10));
    await engine.advance(1);
    expect(engine.state.run.enemies).toHaveLength(21);
    expect(engine.state.run.spawnTimer).toBe(C.SPAWN_WINDOWS[1].interval);
  });
  it("selects fallback Lamp Oil only with a full and maxed loadout", async () => {
    const { engine, pose, start } = await fixture();
    start();
    for (const [i, id] of (
      ["spark", "shard", "sconce", "flare", "pyre", "corona"] as const
    ).entries())
      pose((s) =>
        debug.setWeapon(s, i, id, id === "pyre" || id === "corona" ? 1 : 8),
      );
    for (const [i, id] of C.PASSIVE_IDS.slice(0, 6).entries())
      pose((s) => debug.setPassive(s, i, id, C.PASSIVES[id].maxLevel));
    expect(pool(engine.state.run)).toEqual([]);
    pose((s) => debug.setPendingLevelUps(s, 1));
    pose((s) => debug.setHp(s, 30));
    await engine.advance(1);
    expect(engine.state.run.offers).toEqual(["lamp-oil"]);
    pose((s) => debug.choose(s, 0));
    expect(engine.state.run.player.hp).toBe(60);
  });
});

it("uses a chest-upgraded Soot multiplier for gems collected later in that tick", async () => {
  const { engine, pose, start } = await fixture();
  start();
  pose((s) => debug.setProgression(s, false));
  pose((s) => debug.setPassive(s, 0, "soot", 1));
  pose((s) => debug.setNextChestItem(s, "soot"));
  pose((s) => debug.spawnPickup(s, "chest", 0, 0));
  pose((s) => debug.spawnGem(s, "large", 0, 0));
  await engine.advance(1);
  expect(engine.state.run.xp).toBe(12);
  expect(engine.state.run.chestResult).toEqual({
    kind: "level",
    item: "soot",
    level: 2,
  });
});
