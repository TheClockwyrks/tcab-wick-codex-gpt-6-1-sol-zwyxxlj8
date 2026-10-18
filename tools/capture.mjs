import { Buffer } from "node:buffer";
// Run with the Vite development server running on :5173.
import { chromium } from "playwright";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.route("http://localhost:5173/capture", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#111d22"><canvas style="width:1280px;height:720px"></canvas></body></html>',
  }),
);
page.on("pageerror", (e) => {
  throw e;
});
await page.goto("http://localhost:5173/capture");
const result = await page.evaluate(async () => {
  const { capture } = await import("/tools/capture.ts");
  return capture();
});
fs.mkdirSync("showcase", { recursive: true });
for (const id of ["title", "night", "almanac"])
  fs.writeFileSync(
    `showcase/${id}.png`,
    Buffer.from(result[id].split(",")[1], "base64"),
  );
fs.writeFileSync(
  "showcase/night.json.gz",
  gzipSync(JSON.stringify(result.recording)),
);
await browser.close();
