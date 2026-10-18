/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { loadImage } from "@napi-rs/canvas";
import * as C from "./constants";
const bytes = (path: string) => readFile(`assets/${path}`);
describe("committed production assets", () => {
  it("ships every PNG on its exact required canvas", async () => {
    const items: [string, number, number][] = [
      [C.LAMPLIGHTER_IDLE_PATH, 24, 32],
      [C.GROUND_TILE_PATH, 64, 64],
      ...Object.values(C.ICON_PATHS).map(
        (p) => [p, 24, 24] as [string, number, number],
      ),
      ...C.GEM_TIERS.map(
        (id) =>
          [C.GEM_PATHS[id], C.GEM_SPRITE_SIZES[id], C.GEM_SPRITE_SIZES[id]] as [
            string,
            number,
            number,
          ],
      ),
      ...Object.values(C.PICKUP_PATHS).map(
        (p) => [p, 24, 24] as [string, number, number],
      ),
    ];
    for (const id of C.ENEMY_IDS)
      for (let i = 0; i < C.ENEMY_FRAMES; i++)
        items.push([
          `${C.ENEMY_SHEET_DIR}/${id}/${i}.png`,
          C.ENEMIES[id].radius * 2,
          C.ENEMIES[id].radius * 2,
        ]);
    for (const a of Object.values(C.EFFECT_SPRITES))
      for (let i = 0; i < a.frames; i++)
        items.push([
          a.frames === 1 ? a.path : `${a.path}/${i}.png`,
          a.width,
          a.height,
        ]);
    for (let i = 0; i < C.LAMPLIGHTER_WALK_SHEET.frames; i++)
      items.push([`${C.LAMPLIGHTER_WALK_SHEET.dir}/${i}.png`, 24, 32]);
    for (let i = 0; i < C.PUFF_SHEET.frames; i++)
      items.push([`${C.PUFF_SHEET.dir}/${i}.png`, 24, 24]);
    await Promise.all(
      items.map(async ([path, w, h]) => {
        const a = await loadImage(await bytes(path));
        expect([a.width, a.height], path).toEqual([w, h]);
      }),
    );
  });
  it("gives every animation distinct frames", async () => {
    const sheets = [
      C.LAMPLIGHTER_WALK_SHEET,
      C.PUFF_SHEET,
      ...C.ENEMY_IDS.map((id) => ({
        dir: `${C.ENEMY_SHEET_DIR}/${id}`,
        frames: C.ENEMY_FRAMES,
      })),
      ...Object.values(C.EFFECT_SPRITES)
        .filter((a) => a.frames > 1)
        .map((a) => ({ dir: a.path, frames: a.frames })),
    ];
    for (const sheet of sheets) {
      const files = await Promise.all(
        Array.from({ length: sheet.frames }, (_, i) =>
          bytes(`${sheet.dir}/${i}.png`),
        ),
      );
      expect(
        new Set(files.map((b) => b.toString("base64"))).size,
        sheet.dir,
      ).toBe(sheet.frames);
    }
  });
  it("ships distinct, audible PCM cues, seamless loop endpoints, and the music score", async () => {
    const files = await Promise.all(Object.values(C.CUE_PATHS).map(bytes));
    expect(new Set(files.map((f) => f.toString("base64"))).size).toBe(
      files.length,
    );
    for (let i = 0; i < files.length; i++) {
      const data = files[i],
        name = Object.keys(C.CUE_PATHS)[i];
      expect(data.toString("ascii", 0, 4), name).toBe("RIFF");
      let offset = 12,
        samples: Buffer | undefined,
        rate = 0,
        channels = 0,
        bits = 0;
      while (offset + 8 < data.length) {
        const length = data.readUInt32LE(offset + 4),
          id = data.toString("ascii", offset, offset + 4);
        if (id === "fmt ") {
          channels = data.readUInt16LE(offset + 10);
          rate = data.readUInt32LE(offset + 12);
          bits = data.readUInt16LE(offset + 22);
        }
        if (id === "data")
          samples = data.subarray(offset + 8, offset + 8 + length);
        offset += 8 + length + (length % 2);
      }
      expect(samples).toBeDefined();
      expect(bits).toBe(16);
      let peak = 0;
      for (let j = 0; j < samples!.length; j += 2)
        peak = Math.max(peak, Math.abs(samples!.readInt16LE(j)));
      expect(peak, name).toBeGreaterThan(30);
      if (name === "music" || name === "hum") {
        expect(samples!.length / 2 / channels / rate).toBeGreaterThanOrEqual(
          name === "music" ? C.MUSIC_MIN_SECONDS : C.HUM_MIN_SECONDS,
        );
        for (let c = 0; c < channels; c++)
          expect(
            Math.abs(
              samples!.readInt16LE(c * 2) -
                samples!.readInt16LE(samples!.length - channels * 2 + c * 2),
            ) / 32768,
          ).toBeLessThanOrEqual(C.LOOP_SEAM_TOLERANCE);
      }
    }
    expect((await bytes(C.MUSIC_SCORE_PATH)).toString("ascii", 0, 4)).toBe(
      "MThd",
    );
  });
});
