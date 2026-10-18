import type { InitApi, RenderApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import type { WickState } from "./types";
import * as C from "./constants";
import { name, description, stats, xpToNext, row } from "./core";
import { entries, menuRects, tabRects } from "./debug";
const art: Record<string, ImageBitmap> = {};
export async function loadArt(api: InitApi<WickState>) {
  const paths = [
    C.GROUND_TILE_PATH,
    C.LAMPLIGHTER_IDLE_PATH,
    ...Array.from(
      { length: C.LAMPLIGHTER_WALK_SHEET.frames },
      (_, i) => `${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`,
    ),
    ...C.ENEMY_IDS.flatMap((id) =>
      Array.from(
        { length: C.ENEMY_FRAMES },
        (_, i) => `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
      ),
    ),
    ...Array.from(
      { length: C.PUFF_SHEET.frames },
      (_, i) => `${C.PUFF_SHEET.dir}/${i}.png`,
    ),
    ...Object.values(C.GEM_PATHS),
    ...Object.values(C.PICKUP_PATHS),
    ...Object.values(C.ICON_PATHS),
    ...Object.values(C.EFFECT_SPRITES).flatMap((a) =>
      a.frames === 1
        ? [a.path]
        : Array.from({ length: a.frames }, (_, i) => `${a.path}/${i}.png`),
    ),
  ];
  await Promise.all(
    paths.map(async (path) => {
      art[path] = await api.assets.loadImage(path);
    }),
  );
}
const palette = {
  ink: "#111d22",
  panel: "#142429",
  edge: "#43504b",
  gold: "#d8ad64",
  paper: "#e4dfc7",
  muted: "#80918a",
  teal: "#7aafa0",
};
export function render(s: DeepReadonly<WickState>, api: RenderApi) {
  const ctx = api.ctx,
    r = s.run,
    st = stats(r);
  ctx.imageSmoothingEnabled = false;
  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  const text = (
    v: string,
    x: number,
    y: number,
    size = 16,
    color = palette.paper,
    font = "monospace",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.font = `${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(v, x, y);
  };
  const stroke = (
    x: number,
    y: number,
    w: number,
    h: number,
    color = palette.edge,
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  };
  const image = (
    path: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    flip = false,
  ) => {
    const a = art[path];
    if (!a) return;
    const width = w ?? a.width,
      height = h ?? a.height;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(a, -width / 2, -height / 2, width, height);
    ctx.restore();
  };
  const icon = (id: string, x: number, y: number, size = 32) =>
    image(`icons/${id}.png`, x, y, size, size);
  const line = (x: number, y: number, w: number, color = palette.edge) =>
    fill(x, y, w, 1, color);
  const center = (
    v: string,
    y: number,
    size = 20,
    color = palette.paper,
    font = "monospace",
  ) => text(v, C.STAGE_CX, y, size, color, font, "center");
  const clock = () =>
    `${Math.floor(r.tick / C.TICK_HZ / 60)
      .toString()
      .padStart(2, "0")}:${Math.floor((r.tick / C.TICK_HZ) % 60)
      .toString()
      .padStart(2, "0")}`;
  const world = () => {
    const ox = C.STAGE_CX - r.player.x,
      oy = C.STAGE_CY - r.player.y;
    for (
      let y = Math.floor(-oy / C.GROUND_TILE_SIZE) * C.GROUND_TILE_SIZE;
      y < C.STAGE_H - oy;
      y += C.GROUND_TILE_SIZE
    )
      for (
        let x = Math.floor(-ox / C.GROUND_TILE_SIZE) * C.GROUND_TILE_SIZE;
        x < C.STAGE_W - ox;
        x += C.GROUND_TILE_SIZE
      )
        image(C.GROUND_TILE_PATH, x + ox + 32, y + oy + 32);
    const glow = ctx.createRadialGradient(
      C.STAGE_CX,
      C.STAGE_CY,
      20,
      C.STAGE_CX,
      C.STAGE_CY,
      520,
    );
    glow.addColorStop(0, "#d6b06416");
    glow.addColorStop(0.35, "#192c2900");
    glow.addColorStop(1, "#061119c9");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, C.STAGE_W, C.STAGE_H);
    for (const g of r.gems) image(C.GEM_PATHS[g.tier], g.x + ox, g.y + oy);
    for (const p of r.pickups)
      image(C.PICKUP_PATHS[p.kind], p.x + ox, p.y + oy);
    for (const z of r.zones) {
      const a = C.EFFECT_SPRITES[z.weapon],
        t = (r.tick - z.born) * C.TICK_DT,
        f =
          z.kind === "strike"
            ? Math.min(a.frames - 1, Math.floor((t / C.SPARK_FLASH) * a.frames))
            : z.kind === "burst"
              ? Math.min(
                  a.frames - 1,
                  Math.floor((t / C.FLARE_FLASH) * a.frames),
                )
              : Math.floor(t / C.WALK_FRAME_TIME) % a.frames;
      ctx.globalAlpha =
        z.kind === "puddle"
          ? (z.pulse ?? 0) >=
            (z.weapon === "blaze" ? C.BLAZE_PULSE : C.OIL_PULSE) - C.TICK_DT / 2
            ? 1
            : 0.6
          : z.kind === "aura"
            ? z.pulse === r.tick
              ? 0.9
              : 0.45
            : 1;
      image(
        a.frames === 1 ? a.path : `${a.path}/${f}.png`,
        z.x + ox,
        z.y + oy,
        z.width ?? z.radius * 2,
        z.height ?? z.radius * 2,
      );
    }
    ctx.globalAlpha = 1;
    for (const e of r.enemies) {
      image(
        `${C.ENEMY_SHEET_DIR}/${e.type}/${Math.floor(e.age / C.WALK_FRAME_TIME) % C.ENEMY_FRAMES}.png`,
        e.x + ox,
        e.y + oy,
        undefined,
        undefined,
        e.heading.x < 0,
      );
      if (C.ENEMIES[e.type].rank !== "common") {
        fill(
          e.x + ox - 30,
          e.y + oy - C.ENEMIES[e.type].radius - 10,
          60,
          4,
          palette.ink,
        );
        fill(
          e.x + ox - 30,
          e.y + oy - C.ENEMIES[e.type].radius - 10,
          60 * Math.max(0, e.hp / e.maxHp),
          3,
          palette.gold,
        );
      }
    }
    for (const q of r.projectiles) {
      const a = C.EFFECT_SPRITES[q.weapon];
      image(
        a.frames === 1
          ? a.path
          : `${a.path}/${Math.floor(((r.tick - q.born) * C.TICK_DT) / C.WALK_FRAME_TIME) % a.frames}.png`,
        q.x + ox,
        q.y + oy,
        q.radius * 2,
        q.radius * 2,
      );
    }
    for (const q of s.puffs) {
      const frame = Math.min(
        3,
        Math.floor(((r.tick - q.born) * C.TICK_DT) / (C.PUFF_TIME / 4)),
      );
      image(`${C.PUFF_SHEET.dir}/${frame}.png`, q.x + ox, q.y + oy);
    }
    if (!["title", "howto", "almanac"].includes(s.screen)) {
      ctx.globalAlpha =
        r.hurtFlash > 0
          ? 0.45 + 0.55 * Math.abs(Math.sin(r.hurtFlash * 40))
          : 1;
      image(
        s.moving
          ? `${C.LAMPLIGHTER_WALK_SHEET.dir}/${Math.floor((s.movingTicks * C.TICK_DT) / C.WALK_FRAME_TIME) % C.LAMPLIGHTER_WALK_SHEET.frames}.png`
          : C.LAMPLIGHTER_IDLE_PATH,
        C.STAGE_CX,
        C.STAGE_CY,
        undefined,
        undefined,
        r.player.facing === "left",
      );
      ctx.globalAlpha = 1;
    }
  };
  const hud = () => {
    fill(24, 22, 344, 80, "#101d22ee");
    stroke(24, 22, 344, 80);
    text("THE LAMPLIGHTER", 40, 46, 12, palette.gold);
    text(
      `${Math.max(0, Math.ceil(r.player.hp))} / ${st.maxHp}`,
      350,
      46,
      12,
      palette.paper,
      "monospace",
      "right",
    );
    fill(40, 57, 310, 8, "#2c3939");
    fill(40, 57, 310 * Math.max(0, r.player.hp / st.maxHp), 8, "#ba715a");
    text(`${C.LEVEL_LABEL} ${r.level}`, 40, 86, 11, palette.teal);
    fill(126, 77, 224, 6, "#2c3939");
    fill(126, 77, (224 * r.xp) / xpToNext(r.level), 6, palette.teal);
    fill(555, 20, 170, 72, "#101d22ee");
    stroke(555, 20, 170, 72);
    center(clock(), 61, 30, palette.paper);
    center("UNTIL DAWN  10:00", 82, 9, palette.muted);
    text(
      `${r.kills}  VANQUISHED`,
      1235,
      45,
      13,
      palette.gold,
      "monospace",
      "right",
    );
    text(
      "P  PAUSE    M  " + (s.muted ? "UNMUTE" : "SOUND"),
      1235,
      69,
      11,
      palette.muted,
      "monospace",
      "right",
    );
    for (let group = 0; group < 2; group++) {
      const slots = group ? r.passives : r.weapons;
      const start = group ? 864 : 32;
      for (let i = 0; i < 6; i++) {
        const x = start + i * 62;
        fill(x, 630, 54, 65, "#101d22ed");
        stroke(x, 630, 54, 65);
        const item = slots[i];
        if (item) {
          icon(item.id, x + 27, 653, 30);
          for (let k = 0; k < item.level; k++)
            fill(x + 5 + k * 5, 680, 3, 3, palette.gold);
          if ("cooldown" in item) {
            const cd = Math.max(
              C.MIN_COOLDOWN,
              (row(item.id, item.level).cooldown ?? 1) * st.cooldownMul,
            );
            fill(
              x + 3,
              690,
              48 * (1 - Math.min(1, item.cooldown / cd)),
              2,
              palette.teal,
            );
          }
        } else text("·", x + 27, 663, 22, "#43504b", "monospace", "center");
      }
      text(group ? "TRINKETS" : "TOOLS", start, 619, 10, palette.muted);
    }
    center("WASD / ARROWS  ·  KEEP MOVING", 689, 10, palette.muted);
  };
  const button = (label: string, index: number, sub?: string) => {
    const rect = menuRects(s)[index];
    if (!rect) return;
    const active = s.menuIndex === index;
    fill(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      active ? "#b99a5a18" : "#132329a8",
    );
    stroke(
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      active ? palette.gold : "#344441",
    );
    if (active) {
      fill(rect.x, rect.y, 3, rect.height, palette.gold);
      text("›", rect.x + 18, rect.y + rect.height / 2 + 6, 25, palette.gold);
    }
    text(
      label,
      rect.x + (s.screen === "levelup" ? 74 : 46),
      rect.y + rect.height / 2 + 6,
      16,
      active ? palette.paper : palette.muted,
    );
    if (sub)
      text(
        sub,
        rect.x + rect.width - 18,
        rect.y + rect.height / 2 + 5,
        11,
        palette.gold,
        "monospace",
        "right",
      );
  };
  const footer = (label = "↑ ↓  SELECT     ENTER  CONFIRM     ESC  BACK") => {
    line(78, 665, 1124);
    text(label, 78, 691, 11, palette.muted);
    text(
      "WICK   /   A NIGHT TO ENDURE",
      1202,
      691,
      10,
      palette.gold,
      "monospace",
      "right",
    );
  };
  if (
    ["playing", "levelup", "chest", "paused", "fallen", "dawn"].includes(
      s.screen,
    )
  ) {
    world();
    hud();
    if (s.screen === "playing") return;
    fill(0, 0, C.STAGE_W, C.STAGE_H, "#091319d9");
  } else {
    world();
    fill(0, 0, C.STAGE_W, C.STAGE_H, "#0a171cba");
  }
  if (s.screen === "title") {
    // A lantern-lit field guide cover: generous negative space and a framed nocturnal specimen.
    text("A SURVIVAL NOCTURNE", 132, 107, 11, palette.teal);
    line(132, 125, 362);
    text(C.TITLE_TEXT, 120, 270, 138, palette.paper, "Georgia");
    text(C.TAGLINE_TEXT, 134, 306, 18, palette.gold);
    C.TITLE_ITEMS.forEach((v, i) => button(v, i));
    text(
      "One lamp. Ten minutes. Everything is listening.",
      132,
      594,
      12,
      palette.muted,
    );
    text("WASD / ARROWS TO WALK", 132, 642, 10, palette.teal);
    const x = 895,
      y = 329;
    ctx.strokeStyle = "#6c73533b";
    ctx.lineWidth = 1;
    for (const rr of [165, 190, 230]) {
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    line(620, y, 550, "#68725844");
    fill(x, 91, 1, 474, "#68725844");
    const halo = ctx.createRadialGradient(x, y, 10, x, y, 200);
    halo.addColorStop(0, "#dda74d25");
    halo.addColorStop(1, "#dda74d00");
    ctx.fillStyle = halo;
    ctx.fillRect(640, 80, 510, 510);
    image(C.LAMPLIGHTER_IDLE_PATH, x, y, 144, 192);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.2,
        rr = 155 + (i % 2) * 32;
      image(
        `${C.ENEMY_SHEET_DIR}/moth/${i % 4}.png`,
        x + Math.cos(a) * rr,
        y + Math.sin(a) * rr,
        40,
        40,
        i % 2 === 0,
      );
    }
    text(
      "I.  THE LAMPLIGHTER",
      x,
      605,
      12,
      palette.gold,
      "monospace",
      "center",
    );
    text(
      "Everything in the dark is drawn to the light.",
      x,
      630,
      11,
      palette.muted,
      "monospace",
      "center",
    );
    footer("ENTER  LIGHT THE LAMP      M  " + (s.muted ? "UNMUTE" : "SOUND"));
  } else if (s.screen === "howto") {
    text("FIELD NOTES  /  01", 78, 64, 11, palette.teal);
    text("HOW TO KEEP THE LIGHT", 78, 114, 38, palette.paper, "Georgia");
    line(78, 142, 1124);
    const notes = [
      [
        "01",
        "WALK. YOUR TOOLS DO THE REST.",
        "Arrows or WASD to move. Every tool fires on its own rhythm.",
      ],
      [
        "02",
        "THE NIGHT COMES CLOSER.",
        "Everything seeks your light and hurts on touch. Keep moving.",
      ],
      [
        "03",
        "GATHER WHAT THE DARK LEAVES.",
        "Collect gems, gain levels, and choose one of three gifts.",
      ],
      [
        "04",
        "BUILD YOUR OWN LAMP.",
        "Carry six tools and six trinkets. A chest transforms a max-level tool with its paired trinket.",
      ],
      [
        "05",
        "ENDURE UNTIL DAWN.",
        "The big ones carry chests. Outrun the Dark. Reach 10:00 to win.",
      ],
    ];
    notes.forEach(([n, h, b], i) => {
      const y = 194 + i * 75;
      text(n, 80, y, 13, palette.gold);
      text(h, 130, y, 15);
      text(b, 130, y + 25, 12, palette.muted);
    });
    text(
      "The Almanac describes every tool, trinket, creature, and pickup.",
      130,
      568,
      12,
      palette.teal,
    );
    button("BACK TO THE LAMP", 0);
    footer(
      "ENTER / SPACE  CONFIRM   ·   ESC / P  PAUSE   ·   M  MUTE   ·   MOUSE & TOUCH MENUS",
    );
  } else if (s.screen === "almanac") {
    text("A FIELD GUIDE TO THE NIGHT", 78, 49, 10, palette.teal);
    text(C.ALMANAC_TEXT, 78, 91, 35, palette.paper, "Georgia");
    const tabs = tabRects(s);
    tabs.forEach((v, i) => {
      fill(
        v.x,
        v.y,
        v.width,
        v.height,
        s.almanacTab === i ? "#32433a" : "#142429",
      );
      stroke(
        v.x,
        v.y,
        v.width,
        v.height,
        s.almanacTab === i ? palette.gold : palette.edge,
      );
      text(
        C.ALMANAC_TABS[i],
        v.x + 20,
        v.y + 30,
        13,
        s.almanacTab === i ? palette.gold : palette.muted,
      );
    });
    const list = entries(s);
    menuRects(s).forEach((v, i) => {
      const index = i + s.almanacScroll;
      fill(
        v.x,
        v.y,
        v.width,
        v.height,
        index === s.menuIndex ? "#b99a5a18" : "#14242988",
      );
      if (index === s.menuIndex)
        stroke(v.x, v.y, v.width, v.height, palette.gold);
      text(
        name(list[index]),
        v.x + 18,
        v.y + 25,
        14,
        index === s.menuIndex ? palette.paper : palette.muted,
      );
    });
    const id = list[s.menuIndex],
      x = 830,
      y = 323;
    text(
      `${String(s.menuIndex + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}`,
      1200,
      205,
      11,
      palette.gold,
      "monospace",
      "right",
    );
    if (s.almanacTab === 2) {
      const eid = id as C.EnemyId;
      image(
        `${C.ENEMY_SHEET_DIR}/${id}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % 4}.png`,
        x,
        y,
        C.ENEMIES[eid].radius * 5,
        C.ENEMIES[eid].radius * 5,
      );
      const a = C.ENEMIES[eid];
      text(
        `HEALTH ${a.hp}     SPEED ${a.speed}     DAMAGE ${a.damage}`,
        510,
        490,
        13,
        palette.teal,
      );
    } else if (s.almanacTab === 3) {
      const path =
        (C.GEM_PATHS as Record<string, string>)[id] ??
        (C.PICKUP_PATHS as Record<string, string>)[id];
      image(path, x, y, 96, 96);
      if (id in C.GEM_VALUES)
        text(
          `EXPERIENCE  ${C.GEM_VALUES[id as C.GemTier]}`,
          510,
          490,
          13,
          palette.teal,
        );
      else if (id === "bread")
        text(`HEALS  ${C.BREAD_HEAL}`, 510, 490, 13, palette.teal);
    } else {
      icon(id, x, y, 96);
      if (s.almanacTab === 0) {
        const a = row(id as C.WeaponId);
        const effect = C.EFFECT_SPRITES[id as C.WeaponId];
        image(
          effect.frames > 1
            ? `${effect.path}/${Math.floor(s.simTime / C.WALK_FRAME_TIME) % effect.frames}.png`
            : effect.path,
          x + 170,
          y,
          80,
          80,
        );
        text(
          `DAMAGE ${a.damage}${a.cooldown ? `     COOLDOWN ${a.cooldown}s` : ""}`,
          510,
          490,
          13,
          palette.teal,
        );
      } else
        text(
          `MAX LEVEL ${C.PASSIVES[id as C.PassiveId].maxLevel}`,
          510,
          490,
          13,
          palette.teal,
        );
    }
    text(name(id), 510, 438, 35, palette.paper, "Georgia");
    line(510, 459, 690);
    text(description(id), 510, 540, 11, palette.muted);
    text(
      "← →  CHANGE CHAPTER     ↑ ↓  BROWSE     SCROLL TO EXPLORE",
      510,
      607,
      10,
      palette.gold,
    );
    footer();
  } else if (s.screen === "levelup") {
    center("A LITTLE MORE LIGHT IN THE DARK", 153, 11, palette.teal);
    center(C.LEVEL_UP_TEXT, 215, 35, palette.paper, "Georgia");
    r.offers.forEach((id, i) => {
      const held = [...r.weapons, ...r.passives].find((w) => w.id === id);
      button(
        name(id),
        i,
        held ? `${C.LEVEL_LABEL} ${held.level + 1}` : C.OFFER_NEW_TEXT,
      );
      const rect = menuRects(s)[i];
      icon(id, rect.x + 47, rect.y + 35, 36);
    });
    center(description(r.offers[s.menuIndex]), 565, 13, palette.muted);
    footer("↑ ↓  CHOOSE YOUR GIFT     ENTER  ACCEPT");
  } else if (s.screen === "chest") {
    center(C.CHEST_TEXT, 230, 38, palette.paper, "Georgia");
    const result = r.chestResult;
    if (result?.kind === "evolve") {
      icon(result.weapon, 640, 345, 96);
      center(name(result.weapon), 450, 32, palette.gold, "Georgia");
      center("TRANSFORMED", 488, 12, palette.teal);
    } else if (result?.kind === "level") {
      icon(result.item, 640, 345, 72);
      center(
        `${name(result.item)}  ·  ${C.LEVEL_LABEL} ${result.level}`,
        450,
        28,
        palette.gold,
      );
    } else {
      image(C.PICKUP_PATHS.chest, 640, 345, 96, 96);
      center(
        `The lamp recovers ${C.CHEST_HEAL} health.`,
        450,
        22,
        palette.gold,
      );
    }
    button("KEEP THE LIGHT", 0);
    footer();
  } else if (s.screen === "paused") {
    center(PAUSE_QUOTE, 205, 11, palette.teal);
    center(C.PAUSED_TEXT, 287, 60, palette.paper, "Georgia");
    C.PAUSE_ITEMS.forEach((v, i) => button(v, i));
    footer();
  } else {
    const dawn = s.screen === "dawn";
    center(
      dawn
        ? "THE NIGHT RELEASES ITS HOLD"
        : "ONE MORE LIGHT, LOST TO THE NIGHT",
      185,
      12,
      palette.teal,
    );
    center(
      dawn ? C.DAWN_TEXT : C.FALLEN_TEXT,
      270,
      dawn ? 72 : 48,
      palette.paper,
      "Georgia",
    );
    center(
      `${clock()}   ·   ${r.kills} VANQUISHED   ·   ${C.LEVEL_LABEL} ${r.level}`,
      327,
      14,
      palette.gold,
    );
    C.END_ITEMS.forEach((v, i) => button(v, i));
    r.weapons.forEach((w, i) => icon(w.id, 510 + i * 50, 576, 36));
    footer();
  }
}
const PAUSE_QUOTE = "LET THE NIGHT WAIT";
