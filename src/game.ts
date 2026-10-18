import type { Game } from "@clockwyrks/simple-2d";
import * as C from "./constants";
import type { WickState, WickDebugApi } from "./types";
import { initial, clone, tick, choose, stats, xpToNext } from "./core";
import { debug, menuRects, tabRects, entries } from "./debug";
import { loadArt, render } from "./view";
export * from "./types";
export const BACKGROUND = "#111d22";
export const game: Game<WickState, WickDebugApi> = {
  async initialize(api) {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    await Promise.all([
      loadArt(api),
      ...Object.values(C.CUES).map((cue) =>
        api.audio.load(cue, C.CUE_PATHS[cue]),
      ),
    ]);
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("time", (s) =>
      (s.run.tick / C.TICK_HZ).toFixed(2),
    );
    api.diagnostics.register(
      "level / xp",
      (s) =>
        `${s.run.level} / ${s.run.xp.toFixed(1)} / ${xpToNext(s.run.level)}`,
    );
    api.diagnostics.register(
      "health",
      (s) => `${s.run.player.hp.toFixed(1)} / ${stats(s.run).maxHp}`,
    );
    api.diagnostics.register("kills", (s) => s.run.kills);
    api.diagnostics.register(
      "position",
      (s) =>
        `${s.run.player.x.toFixed(1)}, ${s.run.player.y.toFixed(1)} ${s.run.player.facing}`,
    );
    for (const key of [
      "enemies",
      "projectiles",
      "zones",
      "gems",
      "pendingLevelUps",
      "weapons",
      "passives",
    ] as const)
      api.diagnostics.register(key, (s) =>
        typeof s.run[key] === "number"
          ? s.run[key]
          : JSON.stringify(s.run[key]).slice(0, 110),
      );
    for (const key of [
      "spawning",
      "events",
      "despawning",
      "enemyMotion",
      "enemyContact",
      "weaponFire",
      "effectMotion",
      "drops",
      "progression",
    ] as const)
      api.diagnostics.register(key, (s) => s[key]);
    return [initial(), debug];
  },
  update(state, api, dt) {
    let s = clone(state);
    s.simTime += dt;
    const edges = Object.fromEntries(
      C.ACTIONS.map((a) => [a, api.input.pressed(a)]),
    );
    if (edges.mute) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    const screen = s.screen;
    let confirm = edges.confirm;
    let pointerExit = false;
    if (screen === "almanac") {
      const tabMove = Number(edges.right) - Number(edges.left);
      if (tabMove) {
        s.almanacTab =
          (s.almanacTab + tabMove + C.ALMANAC_TABS.length) %
          C.ALMANAC_TABS.length;
        s.menuIndex = 0;
        s.almanacScroll = 0;
        api.audio.play(C.CUES.menuMove);
      }
      const wheel = api.input.wheel();
      const count = entries(s).length;
      const move = Number(edges.down) - Number(edges.up);
      if (move) {
        s.menuIndex = (s.menuIndex + move + count) % count;
        api.audio.play(C.CUES.menuMove);
      }
      if (move || tabMove)
        s.almanacScroll = Math.max(
          0,
          Math.min(
            count - C.ALMANAC_ROWS,
            Math.max(
              Math.min(s.almanacScroll, s.menuIndex),
              s.menuIndex - C.ALMANAC_ROWS + 1,
            ),
          ),
        );
      s.almanacScroll = Math.max(
        0,
        Math.min(
          Math.max(0, count - C.ALMANAC_ROWS),
          s.almanacScroll + Math.trunc(wheel.y / C.WHEEL_ROW),
        ),
      );
    } else if (
      menuRects(s).length > 1 &&
      (edges.up || edges.down) &&
      !["howto", "chest"].includes(screen)
    ) {
      const index =
        (s.menuIndex +
          Number(edges.down) -
          Number(edges.up) +
          menuRects(s).length) %
        menuRects(s).length;
      if (index !== s.menuIndex) {
        s.menuIndex = index;
        api.audio.play(C.CUES.menuMove);
      }
    }
    const rects = menuRects(s),
      tabs = tabRects(s);
    // Process the ordered samples, so a down and up in the same engine frame
    // still retain their own positions. No held or released contact hovers.
    for (const sample of api.input.pointerSamples().filter((p) => p.primary)) {
      const inside = (rect: {
        x: number;
        y: number;
        width: number;
        height: number;
      }) =>
        sample.x >= rect.x &&
        sample.x < rect.x + rect.width &&
        sample.y >= rect.y &&
        sample.y < rect.y + rect.height;
      const hover = rects.findIndex(inside);
      const select = () => {
        const index = hover + (screen === "almanac" ? s.almanacScroll : 0);
        if (hover >= 0 && s.menuIndex !== index) {
          s.menuIndex = index;
          api.audio.play(C.CUES.menuMove);
        }
      };
      if (
        sample.type === "move" &&
        sample.device !== "touch" &&
        !sample.buttons.includes("primary")
      )
        select();
      if (sample.type === "down" && sample.button === "primary") {
        select();
        const tab = tabs.findIndex(inside);
        s.pointerArm = hover >= 0 ? hover : tab >= 0 ? 100 + tab : null;
      }
      if (sample.type === "up" && sample.button === "primary") {
        if (s.pointerArm !== null && s.pointerArm >= 100) {
          const tab = s.pointerArm - 100;
          if (tabs[tab] && inside(tabs[tab]) && tab !== s.almanacTab) {
            s.almanacTab = tab;
            s.menuIndex = 0;
            s.almanacScroll = 0;
            api.audio.play(C.CUES.menuMove);
          }
        } else if (s.pointerArm === hover && hover >= 0) {
          confirm = true;
          pointerExit = true;
        }
        s.pointerArm = null;
      }
    }
    const fresh = () => {
      s.run = clone(initial()).run;
      s.run.weapons = [{ id: "taper", level: 1, cooldown: 0 }];
      s.screen = "playing";
      s.menuIndex = 0;
      s.accumulator = 0;
      s.movingTicks = 0;
      s.puffs = [];
    };
    const title = (index = 0) => {
      s.run = clone(initial()).run;
      s.screen = "title";
      s.menuIndex = index;
      s.almanacTab = 0;
      s.almanacScroll = 0;
      s.puffs = [];
    };
    if (confirm) {
      if (screen === "title") {
        api.audio.play(C.CUES.menuConfirm);
        if (s.menuIndex === 0) fresh();
        else {
          s.screen = s.menuIndex === 1 ? "almanac" : "howto";
          s.menuIndex = 0;
        }
      } else if (screen === "levelup") {
        s = clone(choose(s, s.menuIndex));
        api.audio.play(C.CUES.choose);
        if (s.screen === "levelup") api.audio.play(C.CUES.levelUp);
      } else if (screen === "chest") {
        s.screen = "playing";
        s.run.chestResult = null;
      } else if (screen === "paused") {
        if (s.menuIndex === 0) {
          s.screen = "playing";
          s.menuIndex = 0;
        } else title();
        api.audio.play(C.CUES.menuConfirm);
      } else if (screen === "fallen" || screen === "dawn") {
        if (s.menuIndex === 0) fresh();
        else title();
        api.audio.play(C.CUES.menuConfirm);
      } else if (screen === "howto" && pointerExit) {
        title(2);
      }
    }
    if (edges.back) {
      if (screen === "playing") {
        s.screen = "paused";
        s.menuIndex = 0;
      } else if (screen === "paused") {
        s.screen = "playing";
        s.menuIndex = 0;
      } else if (screen === "howto") title(2);
      else if (screen === "almanac") title(1);
      else if (["fallen", "dawn"].includes(screen)) title();
    }
    if (edges.pause && (screen === "playing" || screen === "paused")) {
      s.screen = screen === "playing" ? "paused" : "playing";
      s.menuIndex = 0;
    }
    if (s.screen === "playing") {
      s.accumulator += dt;
      const mx = api.input.value("right") - api.input.value("left"),
        my = api.input.value("down") - api.input.value("up");
      while (
        s.accumulator >= C.TICK_DT - C.TICK_EPSILON &&
        s.screen === "playing"
      ) {
        s.accumulator -= C.TICK_DT;
        tick(s, mx, my, (c) => api.audio.play(c));
      }
      if (Math.abs(s.accumulator) < C.TICK_EPSILON) s.accumulator = 0;
    }
    if (s.screen !== screen) s.pointerArm = null;
    if (s.screen !== "playing") s.accumulator = 0;
    const live = ["playing", "paused", "chest", "levelup"].includes(s.screen);
    if (live) api.audio.loop(C.CUES.music);
    else api.audio.stop(C.CUES.music);
    if (
      s.screen === "playing" &&
      s.run.weapons.some((w) => w.id === "halo" || w.id === "corona")
    )
      api.audio.loop(C.CUES.hum);
    else api.audio.stop(C.CUES.hum);
    return s;
  },
  render,
};
