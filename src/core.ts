import * as C from "./constants";
import type { DeepReadonly, DeepWritable } from "ts-essentials";
import type {
  WickState,
  RunState,
  WeaponId,
  OfferId,
  EnemyId,
  ZoneState,
  ProjectileState,
} from "./types";
export type Draft = DeepWritable<WickState>;
export type RunDraft = DeepWritable<RunState>;
export const clone = (s: DeepReadonly<WickState>): Draft =>
  structuredClone(s) as Draft;
export const countdown = (v: number): number =>
  v - C.TICK_DT < C.TICK_DT / 2 ? 0 : v - C.TICK_DT;
export const unit = (x: number, y: number, fallback = 1) => {
  const n = Math.hypot(x, y);
  return n ? { x: x / n, y: y / n } : { x: fallback, y: 0 };
};
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export function initial(muted = false): WickState {
  return {
    screen: "title",
    menuIndex: 0,
    almanacTab: 0,
    almanacScroll: 0,
    accumulator: 0,
    simTime: 0,
    muted,
    spawning: true,
    events: true,
    despawning: true,
    enemyMotion: true,
    enemyContact: true,
    weaponFire: true,
    effectMotion: true,
    drops: true,
    progression: true,
    movingTicks: 0,
    moving: false,
    pointerArm: null,
    puffs: [],
    run: {
      tick: 0,
      level: 1,
      xp: 0,
      kills: 0,
      player: { x: 0, y: 0, facing: "right", hp: C.BASE_MAX_HP },
      hurtFlash: 0,
      weapons: [],
      passives: [],
      enemies: [],
      projectiles: [],
      zones: [],
      gems: [],
      pickups: [],
      offers: [],
      nextOffers: null,
      pendingLevelUps: 0,
      chestResult: null,
      spawnTimer: 0,
      firedEvents: [],
      nextId: 0,
      nextSpawnAngle: null,
      nextSwarmAngle: null,
      nextSpawnType: null,
      nextPuddleOffset: null,
      nextStrikeTarget: null,
      nextChestItem: null,
      nextDrop: null,
    },
  };
}
export function stats(r: DeepReadonly<RunState>) {
  const p = (id: C.PassiveId) =>
    r.passives.find((p) => p.id === id)?.level ?? 0;
  return {
    damageMul: 1 + C.WICK_DAMAGE_PER_LEVEL * p("wick"),
    cooldownMul: 1 - C.OIL_COOLDOWN_PER_LEVEL * p("oil"),
    areaMul: 1 + C.GLASS_AREA_PER_LEVEL * p("glass"),
    armor: C.BRASS_ARMOR_PER_LEVEL * p("brass"),
    amountBonus: C.MIRROR_AMOUNT_PER_LEVEL * p("mirror"),
    maxHp: C.BASE_MAX_HP + C.TALLOW_HP_PER_LEVEL * p("tallow"),
    moveSpeed: C.MOVE_SPEED * (1 + C.BELLOWS_SPEED_PER_LEVEL * p("bellows")),
    recovery: C.BASE_RECOVERY + C.TINDER_RECOVERY_PER_LEVEL * p("tinder"),
    xpMul: 1 + C.SOOT_XP_PER_LEVEL * p("soot"),
    pickupRadius: C.PICKUP_RADIUS * (1 + C.LURE_PICKUP_PER_LEVEL * p("lure")),
  };
}
export const xpToNext = (level: number) => C.XP_BASE + C.XP_STEP * (level - 1);
export const spawnWindow = (r: DeepReadonly<RunState>) =>
  Math.min(
    C.SPAWN_WINDOWS.length - 1,
    Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW),
  );
export const aliveCommons = (r: DeepReadonly<RunState>) =>
  r.enemies.filter(
    (e) => C.ENEMIES[e.type].rank === "common" && e.type !== "gnat",
  ).length;
export function pool(r: DeepReadonly<RunState>): OfferId[] {
  return [
    ...C.BASE_WEAPON_IDS.filter((id) => {
      const held = r.weapons.find((w) => w.id === id);
      const evo = C.EVOLUTION_IDS.find((e) => C.EVOLUTIONS[e].from === id);
      return held
        ? held.level < C.MAX_WEAPON_LEVEL
        : r.weapons.length < C.WEAPON_SLOTS &&
            !r.weapons.some((w) => w.id === evo);
    }),
    ...C.PASSIVE_IDS.filter((id) => {
      const held = r.passives.find((p) => p.id === id);
      return held
        ? held.level < C.PASSIVES[id].maxLevel
        : r.passives.length < C.PASSIVE_SLOTS;
    }),
  ];
}
export function openOffers(s: Draft) {
  const r = s.run,
    p = pool(r);
  const shuffled = [...p];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  r.offers =
    r.nextOffers && r.nextOffers.every((id) => p.includes(id))
      ? [...r.nextOffers]
      : shuffled.slice(0, C.OFFER_COUNT);
  if (!p.length) r.offers = [C.LAMP_OIL_ID];
  r.nextOffers = null;
  s.screen = "levelup";
  s.menuIndex = 0;
}
export const name = (id: string): string =>
  (C.WEAPON_NAMES as Record<string, string>)[id] ??
  (C.PASSIVES as Record<string, { name: string }>)[id]?.name ??
  (C.ENEMIES as Record<string, { name: string }>)[id]?.name ??
  (C.GEM_NAMES as Record<string, string>)[id] ??
  (C.PICKUP_NAMES as Record<string, string>)[id] ??
  C.LAMP_OIL_NAME;
export const description = (id: string): string =>
  (C.WEAPON_DESCRIPTIONS as Record<string, string>)[id] ??
  (C.PASSIVE_DESCRIPTIONS as Record<string, string>)[id] ??
  (C.ENEMY_DESCRIPTIONS as Record<string, string>)[id] ??
  (C.GEM_DESCRIPTIONS as Record<string, string>)[id] ??
  (C.PICKUP_DESCRIPTIONS as Record<string, string>)[id] ??
  C.LAMP_OIL_DESCRIPTION;
export function grant(r: RunDraft, id: OfferId) {
  if (id === C.LAMP_OIL_ID) {
    r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.LAMP_OIL_HEAL);
    return;
  }
  if (C.PASSIVE_IDS.includes(id as C.PassiveId)) {
    const p = r.passives.find((p) => p.id === id);
    if (p) p.level++;
    else r.passives.push({ id: id as C.PassiveId, level: 1 });
    if (id === "tallow") r.player.hp += C.TALLOW_HP_PER_LEVEL;
  } else {
    const w = r.weapons.find((w) => w.id === id);
    if (w) w.level++;
    else r.weapons.push({ id: id as WeaponId, level: 1, cooldown: 0 });
  }
}
export function choose(s: DeepReadonly<WickState>, i: number): WickState {
  if (!Number.isInteger(i) || !s.run.offers[i])
    throw Error("Invalid offer index");
  const n = clone(s);
  grant(n.run, n.run.offers[i]);
  n.run.pendingLevelUps = Math.max(0, n.run.pendingLevelUps - 1);
  n.run.offers = [];
  if (n.run.pendingLevelUps) openOffers(n);
  else {
    n.screen = "playing";
    n.menuIndex = 0;
  }
  return n;
}
export interface Row {
  damage: number;
  cooldown?: number;
  radius?: number;
  width?: number;
  height?: number;
  amount?: number;
  speed?: number;
  pierce?: number;
  duration?: number;
  orbit?: number;
  area?: number;
}
export function row(id: WeaponId, level = 1): Row {
  if (id in C.WEAPON_LEVELS)
    return (C.WEAPON_LEVELS as unknown as Record<string, readonly Row[]>)[id][
      level - 1
    ];
  return (
    {
      pyre: C.PYRE_STATS,
      beacon: C.BEACON_STATS,
      hail: C.HAIL_STATS,
      chandelier: C.CHANDELIER_STATS,
      corona: C.CORONA_STATS,
      blaze: C.BLAZE_STATS,
    } as Record<string, Row>
  )[id];
}
export function enemy(r: RunDraft, type: EnemyId, x: number, y: number) {
  const data = C.ENEMIES[type],
    hp =
      data.hp *
      (data.rank === "common"
        ? 1 + C.HP_SCALE_PER_MINUTE * Math.floor(r.tick / C.TICK_HZ / 60)
        : 1);
  r.enemies.push({
    id: r.nextId++,
    type,
    x,
    y,
    hp,
    maxHp: hp,
    heading: unit(
      r.player.x - x,
      r.player.y - y,
      r.player.facing === "right" ? 1 : -1,
    ),
    age: 0,
    contactCooldown: 0,
  });
}
export function projectile(
  r: RunDraft,
  weapon: WeaponId,
  x: number,
  y: number,
  vx: number,
  vy: number,
  pierce: number,
) {
  const a = row(weapon, r.weapons.find((w) => w.id === weapon)?.level),
    st = stats(r),
    u = unit(vx, vy);
  r.projectiles.push({
    id: r.nextId++,
    weapon,
    x,
    y,
    vx,
    vy,
    ax: weapon === "sconce" ? -u.x * C.SCONCE_DECEL : 0,
    ay: weapon === "sconce" ? -u.y * C.SCONCE_DECEL : 0,
    radius: a.radius! * st.areaMul,
    damage: a.damage * st.damageMul,
    ttl: a.duration!,
    pierce,
    hits: [],
    born: r.tick,
  });
}
export function zone(
  r: RunDraft,
  weapon: WeaponId,
  kind: ZoneState["kind"],
  x: number,
  y: number,
  over: Partial<DeepWritable<ZoneState>> = {},
) {
  const a = row(weapon, r.weapons.find((w) => w.id === weapon)?.level),
    st = stats(r);
  r.zones.push({
    id: r.nextId++,
    weapon,
    kind,
    x,
    y,
    radius: (a.radius ?? a.area ?? 0) * st.areaMul,
    damage: a.damage * st.damageMul,
    ttl: a.duration ?? null,
    hits: [],
    born: r.tick,
    pulse: 0,
    ...over,
  });
}
function chest(r: RunDraft) {
  const first = r.weapons.find(
    (w) =>
      w.level === C.MAX_WEAPON_LEVEL &&
      C.EVOLUTION_IDS.some(
        (id) =>
          C.EVOLUTIONS[id].from === w.id &&
          r.passives.some((p) => p.id === C.EVOLUTIONS[id].passive),
      ),
  );
  const evo = C.EVOLUTION_IDS.find((id) => C.EVOLUTIONS[id].from === first?.id);
  if (evo) {
    const w = r.weapons.find((w) => w.id === C.EVOLUTIONS[evo].from)!;
    w.id = evo;
    w.level = 1;
    w.cooldown = 0;
    r.chestResult = { kind: "evolve", weapon: evo };
  } else {
    const items = [
      ...r.weapons.filter(
        (w) =>
          C.BASE_WEAPON_IDS.includes(w.id as C.BaseWeaponId) &&
          w.level < C.MAX_WEAPON_LEVEL,
      ),
      ...r.passives.filter((p) => p.level < C.PASSIVES[p.id].maxLevel),
    ];
    const item =
      items.find((i) => i.id === r.nextChestItem) ??
      items[Math.floor(Math.random() * items.length)];
    if (item) {
      grant(r, item.id);
      r.chestResult = { kind: "level", item: item.id, level: item.level };
    } else {
      r.player.hp = Math.min(stats(r).maxHp, r.player.hp + C.CHEST_HEAL);
      r.chestResult = { kind: "heal" };
    }
  }
  r.nextChestItem = null;
}
export function rollDrop(
  r: DeepReadonly<RunState>,
): "bread" | "draft" | "none" {
  return (
    r.nextDrop ??
    (Math.random() < C.BREAD_CHANCE
      ? "bread"
      : Math.random() < C.DRAFT_CHANCE
        ? "draft"
        : "none")
  );
}
export function tick(
  s: Draft,
  mx: number,
  my: number,
  emit: (cue: C.CueName) => void,
) {
  const cues = new Set<C.CueName>();
  const play = (cue: C.CueName) => {
    cues.add(cue);
  };
  const r = s.run,
    st = stats(r),
    p = r.player;
  r.tick++;
  s.moving = !!(mx || my);
  if (s.moving) {
    const d = unit(mx, my);
    p.x += d.x * st.moveSpeed * C.TICK_DT;
    p.y += d.y * st.moveSpeed * C.TICK_DT;
    s.movingTicks++;
    if (mx) p.facing = mx < 0 ? "left" : "right";
  }
  p.hp = Math.min(st.maxHp, p.hp + st.recovery * C.TICK_DT);
  for (const e of r.enemies) {
    const data = C.ENEMIES[e.type],
      old = e.age;
    e.age += C.TICK_DT;
    if (!s.enemyMotion) continue;
    let x = e.x,
      y = e.y;
    if (data.behavior === "weave") {
      const off =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * old) / C.WISP_PERIOD);
      x += e.heading.y * off;
      y -= e.heading.x * off;
    }
    const d = distance({ x, y }, p);
    if (data.behavior !== "drift" && d) e.heading = unit(p.x - x, p.y - y);
    if (d || data.behavior === "drift") {
      x += e.heading.x * data.speed * C.TICK_DT;
      y += e.heading.y * data.speed * C.TICK_DT;
    }
    if (data.behavior === "weave") {
      const off =
        C.WISP_AMPLITUDE * Math.sin((2 * Math.PI * e.age) / C.WISP_PERIOD);
      x -= e.heading.y * off;
      y += e.heading.x * off;
    }
    e.x = x;
    e.y = y;
  }
  // Expire existing effects before firing. A newly fired shape stays at its launch position.
  r.projectiles = r.projectiles.filter((q) => (q.ttl = countdown(q.ttl)) > 0);
  r.zones = r.zones.filter(
    (z) => z.ttl === null || (z.ttl = countdown(z.ttl)) > 0,
  );
  for (const q of [...r.projectiles, ...r.zones])
    q.hits = q.hits
      .map((h) => ({ ...h, cooldown: countdown(h.cooldown) }))
      .filter((h) => h.cooldown > 0);
  const nearest = [...r.enemies].sort(
    (a, b) => distance(a, p) - distance(b, p) || a.id - b.id,
  );
  for (const w of r.weapons) {
    const a = row(w.id, w.level),
      amount = (a.amount ?? 1) + st.amountBonus,
      cd = Math.max(C.MIN_COOLDOWN, (a.cooldown ?? 1) * st.cooldownMul);
    if (!s.weaponFire || w.id === "chandelier") continue;
    w.cooldown = countdown(w.cooldown);
    if (w.cooldown) continue;
    w.cooldown = cd;
    if (["taper", "pyre"].includes(w.id)) {
      for (let i = 0; i < Math.min(C.TAPER_MAX_AMOUNT, amount); i++) {
        const sign = (p.facing === "right" ? 1 : -1) * (i ? -1 : 1),
          width = a.width! * st.areaMul;
        zone(r, w.id, "slash", p.x + (sign * width) / 2, p.y, {
          width,
          height: a.height! * st.areaMul,
          ttl: C.SLASH_FLASH,
        });
      }
    } else if (["halo", "corona"].includes(w.id)) {
      let z = r.zones.find((z) => z.weapon === w.id && z.kind === "aura");
      if (!z) {
        zone(r, w.id, "aura", p.x, p.y);
        z = r.zones[r.zones.length - 1];
      }
      z.pulse = r.tick;
    } else if (w.id === "flare")
      zone(r, w.id, "burst", p.x, p.y, { ttl: C.FLARE_FLASH });
    else if (["oil-splash", "blaze"].includes(w.id)) {
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2,
          rad = Math.sqrt(Math.random()) * C.OIL_SCATTER,
          off = r.nextPuddleOffset ?? {
            x: Math.cos(angle) * rad,
            y: Math.sin(angle) * rad,
          };
        zone(r, w.id, "puddle", p.x + off.x, p.y + off.y);
        r.nextPuddleOffset = null;
      }
    } else if (w.id === "spark") {
      let targets = nearest.filter((e) => distance(e, p) <= C.SPARK_RANGE);
      for (let i = 0; i < amount && targets.length; i++) {
        const e =
          targets.find((e) => e.id === r.nextStrikeTarget) ??
          targets[Math.floor(Math.random() * targets.length)];
        zone(r, w.id, "strike", e.x, e.y, { ttl: C.SPARK_FLASH });
        targets = targets.filter((t) => t !== e);
      }
      r.nextStrikeTarget = null;
    } else if (w.id === "lantern") {
      for (let i = 0; i < amount; i++)
        zone(
          r,
          w.id,
          "lantern",
          p.x + a.orbit! * st.areaMul * Math.cos((i * Math.PI * 2) / amount),
          p.y + a.orbit! * st.areaMul * Math.sin((i * Math.PI * 2) / amount),
          { angle: (i * Math.PI * 2) / amount, orbit: a.orbit! * st.areaMul },
        );
      w.cooldown = a.duration! + cd;
    } else {
      if (!nearest.length && !["pin", "hail", "shard"].includes(w.id)) continue;
      for (
        let i = 0;
        i <
        (["ember", "beacon"].includes(w.id)
          ? Math.min(amount, nearest.length)
          : amount);
        i++
      ) {
        if (["pin", "hail"].includes(w.id)) {
          projectile(
            r,
            w.id,
            p.x,
            p.y + (i - (amount - 1) / 2) * C.PIN_SPREAD,
            (p.facing === "right" ? 1 : -1) * a.speed!,
            0,
            a.pierce!,
          );
          continue;
        }
        const target =
          w.id === "ember" || w.id === "beacon" ? nearest[i] : nearest[0];
        const d = target
          ? unit(target.x - p.x, target.y - p.y, p.facing === "right" ? 1 : -1)
          : unit(p.facing === "right" ? 1 : -1, 0);
        const spread =
            w.id === "pin" || w.id === "hail"
              ? C.PIN_SPREAD
              : w.id === "shard"
                ? C.SHARD_SPREAD
                : w.id === "sconce"
                  ? C.SCONCE_SPREAD
                  : 0,
          ang =
            Math.atan2(d.y, d.x) +
            ((i - (amount - 1) / 2) * spread * Math.PI) / 180;
        projectile(
          r,
          w.id,
          p.x,
          p.y,
          Math.cos(ang) * a.speed!,
          Math.sin(ang) * a.speed!,
          a.pierce ?? C.INFINITE_PIERCE,
        );
      }
    }
  }
  // Permanent shapes follow the loadout, even while autonomous fire is held.
  r.zones = r.zones.filter(
    (z) =>
      !["aura", "lantern"].includes(z.kind) ||
      r.weapons.some((w) => w.id === z.weapon),
  );
  for (const w of r.weapons) {
    const a = row(w.id, w.level);
    if (
      ["halo", "corona"].includes(w.id) &&
      !r.zones.some((z) => z.weapon === w.id && z.kind === "aura")
    )
      zone(r, w.id, "aura", p.x, p.y);
    if (w.id === "chandelier") {
      w.cooldown = 0;
      const old = r.zones.filter((z) => z.weapon === w.id),
        amount = a.amount! + st.amountBonus;
      if (old.length !== amount) {
        const angle = old[0]?.angle ?? 0;
        r.zones = r.zones.filter(
          (z) => z.weapon !== w.id && z.weapon !== "lantern",
        );
        for (let i = 0; i < amount; i++)
          zone(r, w.id, "lantern", p.x, p.y, {
            angle: angle + (i * Math.PI * 2) / amount,
          });
      }
    }
  }
  for (const z of r.zones) {
    if (z.kind === "aura" || z.weapon === "chandelier") {
      const a = row(z.weapon, r.weapons.find((w) => w.id === z.weapon)?.level);
      z.radius = a.radius! * st.areaMul;
      z.damage = a.damage * st.damageMul;
    }
    if (z.kind === "aura") {
      z.x = p.x;
      z.y = p.y;
    }
    if (z.kind === "lantern") {
      const a = row(z.weapon, r.weapons.find((w) => w.id === z.weapon)?.level);
      if (s.effectMotion && z.born < r.tick)
        z.angle =
          (z.angle ?? 0) +
          ((C.LANTERN_ANGULAR_SPEED * Math.PI) / 180) * C.TICK_DT;
      const orbit =
        z.weapon === "chandelier" ? a.orbit! * st.areaMul : z.orbit!;
      z.x = p.x + Math.cos(z.angle ?? 0) * orbit;
      z.y = p.y + Math.sin(z.angle ?? 0) * orbit;
    }
  }
  for (const q of r.projectiles) {
    if (s.effectMotion && q.born < r.tick) {
      q.x += q.vx * C.TICK_DT;
      q.y += q.vy * C.TICK_DT;
      q.vx += q.ax * C.TICK_DT;
      q.vy += q.ay * C.TICK_DT;
      if (q.weapon === "shard") {
        if (q.x < p.x - C.STAGE_CX) {
          q.x = p.x - C.STAGE_CX;
          if (q.vx < 0) q.vx = -q.vx;
        }
        if (q.x > p.x + C.STAGE_CX) {
          q.x = p.x + C.STAGE_CX;
          if (q.vx > 0) q.vx = -q.vx;
        }
        if (q.y < p.y - C.STAGE_CY) {
          q.y = p.y - C.STAGE_CY;
          if (q.vy < 0) q.vy = -q.vy;
        }
        if (q.y > p.y + C.STAGE_CY) {
          q.y = p.y + C.STAGE_CY;
          if (q.vy > 0) q.vy = -q.vy;
        }
      }
    }
  }
  const deadProjectiles = new Set<number>();
  const damage = (
    shape: DeepWritable<ProjectileState | ZoneState>,
    interval: number,
  ) => {
    for (const e of r.enemies) {
      if (shape.hits.some((h) => h.enemy === e.id)) continue;
      const er = C.ENEMIES[e.type].radius;
      let hit = distance(shape, e) < shape.radius + er;
      if ("kind" in shape && shape.kind === "slash")
        hit =
          Math.hypot(
            Math.max(0, Math.abs(e.x - shape.x) - shape.width! / 2),
            Math.max(0, Math.abs(e.y - shape.y) - shape.height! / 2),
          ) < er;
      if ("kind" in shape && shape.kind === "burst")
        hit = distance(shape, e) <= shape.radius;
      if (shape.weapon === "flare" && C.FLARE_IMMUNE.includes(e.type))
        hit = false;
      if (!hit) continue;
      const before = e.hp;
      e.hp -= shape.damage;
      shape.hits.push({ enemy: e.id, cooldown: interval });
      play(C.CUES.hit);
      if (shape.weapon === "pyre")
        p.hp = Math.min(st.maxHp, p.hp + C.PYRE_HEAL);
      if (shape.weapon === "corona" && before > 0 && e.hp <= 0)
        p.hp = Math.min(st.maxHp, p.hp + C.CORONA_HEAL);
      if ("pierce" in shape && shape.pierce !== C.INFINITE_PIERCE) {
        if (shape.pierce === 0) {
          deadProjectiles.add(shape.id);
          break;
        }
        shape.pierce--;
      }
    }
  };
  for (const q of r.projectiles)
    damage(
      q,
      q.pierce === C.INFINITE_PIERCE
        ? q.weapon === "sconce"
          ? C.SCONCE_REHIT
          : C.SHARD_REHIT
        : q.ttl,
    );
  for (const z of r.zones) {
    let hit = true;
    if (["slash", "strike", "burst"].includes(z.kind)) hit = z.born === r.tick;
    if (z.kind === "aura") hit = z.pulse === r.tick;
    if (z.kind === "puddle") {
      z.pulse = countdown(z.pulse ?? 0);
      hit = z.pulse === 0;
      if (hit) z.pulse = z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE;
    }
    if (hit)
      damage(
        z,
        z.kind === "lantern"
          ? C.LANTERN_REHIT
          : z.kind === "puddle"
            ? z.weapon === "blaze"
              ? C.BLAZE_PULSE
              : C.OIL_PULSE
            : z.kind === "aura"
              ? Math.max(
                  C.MIN_COOLDOWN,
                  row(z.weapon, r.weapons.find((w) => w.id === z.weapon)?.level)
                    .cooldown! * st.cooldownMul,
                )
              : (z.ttl ?? C.TICK_DT),
      );
  }
  r.projectiles = r.projectiles.filter((q) => !deadProjectiles.has(q.id));
  for (const e of r.enemies.filter((e) => e.hp <= 0)) {
    r.kills++;
    play(C.CUES.kill);
    s.puffs.push({ x: e.x, y: e.y, born: r.tick });
    if (s.drops) {
      const data = C.ENEMIES[e.type];
      if (data.rank === "common") {
        r.gems.push({
          id: r.nextId++,
          tier: data.drop as C.GemTier,
          x: e.x,
          y: e.y,
          attracted: false,
          born: r.tick,
        });
        const drop = rollDrop(r);
        r.nextDrop = null;
        if (drop !== "none")
          r.pickups.push({ id: r.nextId++, kind: drop, x: e.x, y: e.y });
      } else if (data.rank === "elite")
        r.pickups.push({ id: r.nextId++, kind: "chest", x: e.x, y: e.y });
    }
  }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
  r.hurtFlash = countdown(r.hurtFlash);
  for (const e of r.enemies) {
    e.contactCooldown = countdown(e.contactCooldown);
    if (
      s.enemyContact &&
      !e.contactCooldown &&
      distance(e, p) < C.ENEMIES[e.type].radius + C.PLAYER_RADIUS
    ) {
      p.hp -= Math.max(C.MIN_DAMAGE_TAKEN, C.ENEMIES[e.type].damage - st.armor);
      e.contactCooldown = C.CONTACT_COOLDOWN;
      r.hurtFlash = C.HURT_FLASH;
      play(C.CUES.hurt);
    }
  }
  let gotChest = false;
  r.pickups = r.pickups.filter((q) => {
    if (
      distance(q, p) >= C.PICKUP_ITEM_RADIUS + C.PLAYER_RADIUS ||
      (q.kind === "chest" && gotChest)
    )
      return true;
    if (q.kind === "bread") {
      p.hp = Math.min(stats(r).maxHp, p.hp + C.BREAD_HEAL);
      play(C.CUES.pickup);
    }
    if (q.kind === "draft") {
      r.gems.forEach((g) => (g.attracted = true));
      play(C.CUES.pickup);
    }
    if (q.kind === "chest") {
      chest(r);
      gotChest = true;
      if (r.chestResult?.kind === "evolve") play(C.CUES.evolve);
    }
    return false;
  });
  const gemStats = stats(r);
  r.gems = r.gems.filter((g) => {
    if (distance(g, p) <= gemStats.pickupRadius) g.attracted = true;
    if (g.attracted && g.born < r.tick) {
      const d = distance(g, p),
        u = unit(p.x - g.x, p.y - g.y),
        step = Math.min(d, C.GEM_SPEED * C.TICK_DT);
      g.x += u.x * step;
      g.y += u.y * step;
    }
    if (distance(g, p) > C.COLLECT_RADIUS) return true;
    r.xp += C.GEM_VALUES[g.tier] * gemStats.xpMul;
    play(C.CUES.gem);
    if (s.progression)
      while (r.xp >= xpToNext(r.level)) {
        r.xp -= xpToNext(r.level);
        r.level++;
        r.pendingLevelUps++;
      }
    return false;
  });
  if (s.despawning)
    r.enemies = r.enemies.filter(
      (e) =>
        C.ENEMIES[e.type].rank !== "common" ||
        distance(e, p) <= C.DESPAWN_DISTANCE,
    );
  const ring = (type: EnemyId) => {
    const a = ((r.nextSpawnAngle ?? Math.random() * 360) * Math.PI) / 180;
    r.nextSpawnAngle = null;
    enemy(
      r,
      type,
      p.x + Math.cos(a) * C.SPAWN_DISTANCE,
      p.y + Math.sin(a) * C.SPAWN_DISTANCE,
    );
  };
  if (s.events)
    for (const ev of C.EVENTS)
      if (
        r.tick === Math.round(ev.time * C.TICK_HZ) &&
        !r.firedEvents.includes(ev.time)
      ) {
        r.firedEvents.push(ev.time);
        if (ev.kind === "spawn") ring(ev.type);
        else {
          const a = ((r.nextSwarmAngle ?? Math.random() * 360) * Math.PI) / 180;
          r.nextSwarmAngle = null;
          for (let i = 0; i < C.SWARM_SIZE; i++) {
            const off = (i / (C.SWARM_SIZE - 1) - 0.5) * C.SWARM_LINE;
            enemy(
              r,
              ev.type,
              p.x - Math.cos(a) * C.SPAWN_DISTANCE - Math.sin(a) * off,
              p.y - Math.sin(a) * C.SPAWN_DISTANCE + Math.cos(a) * off,
            );
            r.enemies[r.enemies.length - 1].heading = {
              x: Math.cos(a),
              y: Math.sin(a),
            };
          }
        }
      }
  if (s.spawning) {
    if (
      Math.floor(r.tick / C.TICK_HZ / C.SPAWN_WINDOW) !==
      Math.floor((r.tick - 1) / C.TICK_HZ / C.SPAWN_WINDOW)
    )
      r.spawnTimer = 0;
    r.spawnTimer = countdown(r.spawnTimer);
    if (!r.spawnTimer) {
      const window = C.SPAWN_WINDOWS[spawnWindow(r)];
      if (aliveCommons(r) < window.cap) {
        const type =
          r.nextSpawnType && window.types.includes(r.nextSpawnType)
            ? r.nextSpawnType
            : window.types[Math.floor(Math.random() * window.types.length)];
        r.nextSpawnType = null;
        ring(type);
        r.spawnTimer = window.interval;
      }
    }
  }
  const live = new Set(r.enemies.map((e) => e.id));
  for (const q of [...r.projectiles, ...r.zones])
    q.hits = q.hits.filter((h) => live.has(h.enemy));
  s.puffs = s.puffs.filter((q) => (r.tick - q.born) * C.TICK_DT < C.PUFF_TIME);
  if (r.tick >= C.DAWN_TIME * C.TICK_HZ) {
    s.screen = "dawn";
    s.menuIndex = 0;
    play(C.CUES.dawn);
  } else if (p.hp <= 0) {
    s.screen = "fallen";
    s.menuIndex = 0;
    play(C.CUES.fallen);
  } else if (gotChest) {
    s.screen = "chest";
    s.menuIndex = 0;
    play(C.CUES.chest);
  } else if (r.pendingLevelUps) {
    openOffers(s);
    play(C.CUES.levelUp);
  }
  for (const cue of cues) emit(cue);
}
