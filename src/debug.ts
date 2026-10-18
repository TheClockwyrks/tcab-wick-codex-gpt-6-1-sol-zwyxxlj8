import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { WickState, WickDebugApi, WickSnapshot, WickRect } from "./types";
import {
  clone,
  initial,
  stats,
  xpToNext,
  spawnWindow,
  aliveCommons,
  pool,
  choose,
  enemy,
  projectile,
  zone,
  unit,
  rollDrop,
} from "./core";
export const entries = (s: DeepReadonly<WickState>): readonly string[] =>
  [
    [...C.BASE_WEAPON_IDS, ...C.EVOLUTION_IDS],
    C.PASSIVE_IDS,
    C.ENEMY_IDS,
    [...C.GEM_TIERS, ...C.PICKUP_KINDS],
  ][s.almanacTab];
export function menuRects(s: DeepReadonly<WickState>): WickRect[] {
  if (s.screen === "playing") return [];
  if (s.screen === "almanac")
    return entries(s)
      .slice(s.almanacScroll, s.almanacScroll + C.ALMANAC_ROWS)
      .map((_, i) => ({ x: 78, y: 194 + i * 42, width: 345, height: 38 }));
  if (["howto", "chest"].includes(s.screen))
    return [{ x: 470, y: 600, width: 340, height: 52 }];
  const n =
    s.screen === "title"
      ? C.TITLE_ITEMS.length
      : s.screen === "levelup"
        ? s.run.offers.length
        : 2;
  return Array.from({ length: n }, (_, i) => ({
    x: s.screen === "title" ? 130 : 390,
    y:
      (s.screen === "title" ? 360 : s.screen === "levelup" ? 265 : 390) +
      i * (s.screen === "levelup" ? 80 : 62),
    width: s.screen === "title" ? 365 : 500,
    height: s.screen === "levelup" ? 70 : 52,
  }));
}
export const tabRects = (s: DeepReadonly<WickState>): WickRect[] =>
  s.screen === "almanac"
    ? C.ALMANAC_TABS.map((_, i) => ({
        x: 78 + i * 285,
        y: 115,
        width: 270,
        height: 48,
      }))
    : [];
export function snapshot(s: DeepReadonly<WickState>): WickSnapshot {
  const {
    movingTicks: _m,
    moving: _v,
    pointerArm: _p,
    puffs: _f,
    ...base
  } = clone(s);
  const st = stats(s.run);
  return {
    ...base,
    version: C.WICK_DEBUG_VERSION,
    run: {
      ...base.run,
      projectiles: base.run.projectiles.map(
        ({ born: _born, angle: _angle, orbit: _orbit, pulse: _pulse, ...q }) =>
          q,
      ),
      zones: base.run.zones.map(
        ({ born: _born, angle: _angle, orbit: _orbit, pulse: _pulse, ...q }) =>
          q,
      ),
      gems: base.run.gems.map(({ born: _born, ...g }) => g),
      time: s.run.tick / C.TICK_HZ,
      xpToNext: xpToNext(s.run.level),
      maxHp: st.maxHp,
      armor: st.armor,
      moveSpeed: st.moveSpeed,
      pickupRadius: st.pickupRadius,
      spawnWindow: spawnWindow(s.run),
      aliveCommons: aliveCommons(s.run),
      pool: s.screen === "levelup" ? pool(s.run) : [],
    },
  };
}
function assert(ok: unknown): asserts ok {
  if (!ok) throw Error("Invalid Wick debug argument");
}
const finite = (...ns: number[]) => ns.every(Number.isFinite);
export const debug: WickDebugApi = {
  version: C.WICK_DEBUG_VERSION,
  reset: (s) => initial(s.muted),
  snapshot,
  reconcile: (s) => clone(s),
  menuRects,
  tabRects,
  choose,
  setScreen(s, screen) {
    assert(
      [
        "title",
        "howto",
        "almanac",
        "playing",
        "levelup",
        "chest",
        "paused",
        "fallen",
        "dawn",
      ].includes(screen),
    );
    return {
      ...s,
      screen,
      menuIndex: 0,
      almanacTab: 0,
      almanacScroll: 0,
      accumulator: screen === "playing" ? s.accumulator : 0,
    };
  },
  setPlayerPosition(s, x, y) {
    assert(finite(x, y));
    const n = clone(s);
    n.run.player.x = x;
    n.run.player.y = y;
    return n;
  },
  setFacing(s, facing) {
    assert(["left", "right"].includes(facing));
    return { ...s, run: { ...s.run, player: { ...s.run.player, facing } } };
  },
  setNextPuddleOffset(s, x, y) {
    assert(finite(x, y) && Math.hypot(x, y) <= C.OIL_SCATTER);
    return { ...s, run: { ...s.run, nextPuddleOffset: { x, y } } };
  },
  setNextOffers(s, ids) {
    assert(
      ids.length > 0 &&
        ids.length <= C.OFFER_COUNT &&
        new Set(ids).size === ids.length &&
        ids.every((id) => id in C.ICON_PATHS),
    );
    return { ...s, run: { ...s.run, nextOffers: [...ids] } };
  },
  setWeapon(s, slot, id, level) {
    assert(
      Number.isInteger(slot) &&
        slot >= 0 &&
        slot <= s.run.weapons.length &&
        slot < C.WEAPON_SLOTS &&
        id in C.WEAPON_NAMES &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <=
          (C.BASE_WEAPON_IDS.includes(id as C.BaseWeaponId)
            ? C.MAX_WEAPON_LEVEL
            : 1),
    );
    assert(
      !s.run.weapons.some(
        (w, i) =>
          i !== slot &&
          (w.id === id ||
            C.EVOLUTION_IDS.some((e) => {
              const b = C.EVOLUTIONS[e].from;
              return (w.id === b && id === e) || (w.id === e && id === b);
            })),
      ),
    );
    const n = clone(s);
    n.run.weapons[slot] = {
      id,
      level,
      cooldown:
        n.run.weapons[slot]?.id === id ? n.run.weapons[slot].cooldown : 0,
    };
    return n;
  },
  setWeaponCooldown(s, slot, seconds) {
    assert(
      Number.isInteger(slot) &&
        s.run.weapons[slot] &&
        finite(seconds) &&
        seconds >= 0,
    );
    const n = clone(s);
    n.run.weapons[slot].cooldown = seconds;
    return n;
  },
  removeWeapon(s, slot) {
    assert(Number.isInteger(slot) && s.run.weapons[slot]);
    const n = clone(s);
    n.run.weapons.splice(slot, 1);
    return n;
  },
  setPassive(s, slot, id, level) {
    assert(
      Number.isInteger(slot) &&
        slot >= 0 &&
        slot <= s.run.passives.length &&
        slot < C.PASSIVE_SLOTS &&
        id in C.PASSIVES &&
        Number.isInteger(level) &&
        level >= 1 &&
        level <= C.PASSIVES[id].maxLevel &&
        !s.run.passives.some((p, i) => i !== slot && p.id === id),
    );
    const n = clone(s);
    n.run.passives[slot] = { id, level };
    return n;
  },
  removePassive(s, slot) {
    assert(Number.isInteger(slot) && s.run.passives[slot]);
    const n = clone(s);
    n.run.passives.splice(slot, 1);
    return n;
  },
  spawnEnemy(s, type, x, y) {
    assert(type in C.ENEMIES && finite(x, y));
    const n = clone(s);
    enemy(n.run, type, x, y);
    return n;
  },
  setEnemyPosition(s, id, x, y) {
    assert(finite(x, y));
    const n = clone(s),
      e = n.run.enemies.find((e) => e.id === id);
    assert(e);
    e.x = x;
    e.y = y;
    return n;
  },
  setEnemyHeading(s, id, hx, hy) {
    assert(finite(hx, hy) && Math.hypot(hx, hy) > 0);
    const n = clone(s),
      e = n.run.enemies.find((e) => e.id === id);
    assert(e);
    e.heading = unit(hx, hy);
    return n;
  },
  removeEnemy(s, id) {
    assert(s.run.enemies.some((e) => e.id === id));
    const n = clone(s);
    n.run.enemies = n.run.enemies.filter((e) => e.id !== id);
    for (const q of [...n.run.projectiles, ...n.run.zones])
      q.hits = q.hits.filter((h) => h.enemy !== id);
    return n;
  },
  clearEnemies(s) {
    const n = clone(s);
    n.run.enemies = [];
    for (const q of [...n.run.projectiles, ...n.run.zones]) q.hits = [];
    return n;
  },
  spawnProjectile(s, weapon, x, y, vx, vy, pierce) {
    assert(
      ["ember", "pin", "shard", "sconce", "beacon", "hail"].includes(weapon) &&
        finite(x, y, vx, vy) &&
        Number.isInteger(pierce) &&
        pierce >= C.INFINITE_PIERCE &&
        (weapon !== "sconce" || Math.hypot(vx, vy) > 0),
    );
    const n = clone(s);
    projectile(n.run, weapon, x, y, vx, vy, pierce);
    return n;
  },
  spawnPuddle(s, weapon, x, y) {
    assert(["oil-splash", "blaze"].includes(weapon) && finite(x, y));
    const n = clone(s);
    zone(n.run, weapon, "puddle", x, y);
    return n;
  },
  spawnGem(s, tier, x, y) {
    assert(C.GEM_TIERS.includes(tier) && finite(x, y));
    const n = clone(s);
    n.run.gems.push({
      id: n.run.nextId++,
      tier,
      x,
      y,
      attracted: false,
      born: n.run.tick,
    });
    return n;
  },
  setGemAttracted(s, id, attracted) {
    assert(typeof attracted === "boolean");
    const n = clone(s),
      g = n.run.gems.find((g) => g.id === id);
    assert(g);
    g.attracted = attracted;
    return n;
  },
  spawnPickup(s, kind, x, y) {
    assert(C.PICKUP_KINDS.includes(kind) && finite(x, y));
    const n = clone(s);
    n.run.pickups.push({ id: n.run.nextId++, kind, x, y });
    return n;
  },
  rollDrop: (s) => rollDrop(s.run),
  setSpawning(s, on) {
    assert(typeof on === "boolean");
    return { ...s, spawning: on };
  },
  setEvents(s, on) {
    assert(typeof on === "boolean");
    return { ...s, events: on };
  },
  setDespawning(s, on) {
    assert(typeof on === "boolean");
    return { ...s, despawning: on };
  },
  setEnemyMotion(s, on) {
    assert(typeof on === "boolean");
    return { ...s, enemyMotion: on };
  },
  setEnemyContact(s, on) {
    assert(typeof on === "boolean");
    return { ...s, enemyContact: on };
  },
  setWeaponFire(s, on) {
    assert(typeof on === "boolean");
    return { ...s, weaponFire: on };
  },
  setEffectMotion(s, on) {
    assert(typeof on === "boolean");
    return { ...s, effectMotion: on };
  },
  setDrops(s, on) {
    assert(typeof on === "boolean");
    return { ...s, drops: on };
  },
  setProgression(s, on) {
    assert(typeof on === "boolean");
    return { ...s, progression: on };
  },
  setTick(s, v) {
    assert(Number.isInteger(v) && v >= 0 && v < C.DAWN_TIME * C.TICK_HZ);
    return { ...s, run: { ...s.run, tick: v } };
  },
  setSpawnTimer(s, v) {
    assert(finite(v) && v >= 0);
    return { ...s, run: { ...s.run, spawnTimer: v } };
  },
  setLevel(s, v) {
    assert(Number.isInteger(v) && v >= 1);
    return { ...s, run: { ...s.run, level: v } };
  },
  setXp(s, v) {
    assert(finite(v) && v >= 0);
    return { ...s, run: { ...s.run, xp: v } };
  },
  setKills(s, v) {
    assert(Number.isInteger(v) && v >= 0);
    return { ...s, run: { ...s.run, kills: v } };
  },
  setPendingLevelUps(s, v) {
    assert(Number.isInteger(v) && v >= 0);
    return { ...s, run: { ...s.run, pendingLevelUps: v } };
  },
  setNextSpawnAngle(s, v) {
    assert(finite(v) && v >= 0 && v < 360);
    return { ...s, run: { ...s.run, nextSpawnAngle: v } };
  },
  setNextSwarmAngle(s, v) {
    assert(finite(v) && v >= 0 && v < 360);
    return { ...s, run: { ...s.run, nextSwarmAngle: v } };
  },
  setNextSpawnType(s, v) {
    assert(v in C.ENEMIES);
    return { ...s, run: { ...s.run, nextSpawnType: v } };
  },
  setNextStrikeTarget(s, v) {
    assert(s.run.enemies.some((e) => e.id === v));
    return { ...s, run: { ...s.run, nextStrikeTarget: v } };
  },
  setNextChestItem(s, v) {
    assert(
      C.BASE_WEAPON_IDS.includes(v as C.BaseWeaponId) ||
        C.PASSIVE_IDS.includes(v as C.PassiveId),
    );
    return { ...s, run: { ...s.run, nextChestItem: v } };
  },
  setNextDrop(s, v) {
    assert(["bread", "draft", "none"].includes(v));
    return { ...s, run: { ...s.run, nextDrop: v } };
  },
  setHp(s, hp) {
    assert(finite(hp));
    return { ...s, run: { ...s.run, player: { ...s.run.player, hp } } };
  },
  setEnemyHp(s, id, v) {
    assert(finite(v) && v > 0);
    const n = clone(s),
      e = n.run.enemies.find((e) => e.id === id);
    assert(e);
    e.hp = v;
    return n;
  },
  setEnemyAge(s, id, v) {
    assert(finite(v) && v >= 0);
    const n = clone(s),
      e = n.run.enemies.find((e) => e.id === id);
    assert(e);
    e.age = v;
    return n;
  },
  setEnemyContactCooldown(s, id, v) {
    assert(finite(v) && v >= 0);
    const n = clone(s),
      e = n.run.enemies.find((e) => e.id === id);
    assert(e);
    e.contactCooldown = v;
    return n;
  },
  clearProjectiles(s) {
    return { ...s, run: { ...s.run, projectiles: [] } };
  },
  clearZones(s) {
    return { ...s, run: { ...s.run, zones: [] } };
  },
  clearGems(s) {
    return { ...s, run: { ...s.run, gems: [] } };
  },
  clearPickups(s) {
    return { ...s, run: { ...s.run, pickups: [] } };
  },
};
