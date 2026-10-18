import console from "node:console";
import { URL } from "node:url";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const server = createServer(async (req, res) => {
  try {
    let name = new URL(req.url, "http://localhost").pathname;
    if (name.startsWith("/games/wick/"))
      name = name.slice("/games/wick".length);
    if (name.endsWith("/")) name += "index.html";
    const resolved = path.resolve("dist", "." + name);
    assert(resolved.startsWith(path.resolve("dist") + path.sep));
    const file = await readFile(resolved);
    const mime =
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".png": "image/png",
        ".wav": "audio/wav",
      }[path.extname(name)] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    res.end(file);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(4178, r));
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  for (const prefix of ["/", "/games/wick/"]) {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      }),
      errors = [],
      loaded = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
      if (r.url().endsWith(".png")) loaded.push(r.url());
    });
    await page.goto(`http://localhost:4178${prefix}`);
    await page.waitForTimeout(700);
    assert(loaded.length > 100, "all production sprites load");
    const title = await page.screenshot();
    await page.keyboard.press("Enter");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(1600);
    await page.keyboard.up("KeyD");
    const playing = await page.screenshot();
    assert(!title.equals(playing), "confirm starts the game");
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(120);
    const paused = await page.screenshot();
    await page.waitForTimeout(150);
    assert(paused.equals(await page.screenshot()), "pause freezes the screen");
    await page.keyboard.press("Escape");
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(100);
    assert.deepEqual(errors, []);
    console.log(
      `PASS ${prefix} — ${loaded.length} images, movement, pause, resume, mute; no browser or asset errors`,
    );
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await page.goto("http://localhost:4178/games/wick/");
  await page.waitForTimeout(600);
  const title = await page.screenshot();
  const scale = 390 / 1280,
    offset = (844 - 720 * scale) / 2;
  await page.touchscreen.tap(250 * scale, offset + 385 * scale);
  await page.waitForTimeout(400);
  assert(!title.equals(await page.screenshot()));
  console.log("PASS mobile — letterboxed stage and touch menu activation");
  await page.close();
} finally {
  await browser.close();
  server.close();
}
