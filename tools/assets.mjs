// One-time asset production. The application build never executes this file.
import fs from "node:fs";
import cp from "node:child_process";
import path from "node:path";
const root = path.resolve("assets");
fs.mkdirSync(root, { recursive: true });
function run(bin, args) {
  cp.execFileSync(bin, args.map(String), { stdio: "pipe" });
}
let ops = [];
const rect = (x, y, w, h, c) =>
  ops.push({
    op: "fill_rect",
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
    color: c,
  });
const line = (x1, y1, x2, y2, c) =>
  ops.push({
    op: "line",
    x0: Math.round(x1),
    y0: Math.round(y1),
    x1: Math.round(x2),
    y1: Math.round(y2),
    color: c,
  });
const circle = (cx, cy, r, c, stroke = false) =>
  ops.push({
    op: stroke ? "stroke_circle" : "fill_circle",
    cx: Math.round(cx),
    cy: Math.round(cy),
    r: Math.round(r),
    color: c,
  });
function save(file, w, h, sheet = false) {
  const out = path.join(root, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync("/tmp/wick-ops.json", JSON.stringify(ops));
  run(sheet ? "draw-sheet" : "draw", [
    "render",
    "--actions",
    "/tmp/wick-ops.json",
    "--out",
    out,
    "--width",
    w,
    "--height",
    h,
    "--no-layers",
  ]);
  ops = [];
}
const ink = "#111c22",
  gold = "#d8ad64",
  cream = "#fff1bc",
  teal = "#62968f",
  deep = "#344b50";
function lamp(f) {
  const bob = f < 0 ? 0 : f % 3 === 1 ? -1 : 0;
  rect(7, 24, 4, 6, ink);
  rect(13, 24, 4, 6, ink);
  rect(7 + (f % 2 ? 1 : 0), 29, 5, 2, gold);
  rect(13 - (f % 2 ? 1 : 0), 29, 5, 2, gold);
  rect(6, 12 + bob, 11, 14, ink);
  rect(7, 13 + bob, 8, 11, deep);
  rect(8, 14 + bob, 3, 9, teal);
  rect(11, 5 + bob, 7, 8, gold);
  rect(12, 6 + bob, 5, 6, "#bb9065");
  rect(9, 3 + bob, 8, 3, ink);
  rect(7, 6 + bob, 14, 2, ink);
  rect(16, 10 + bob, 2, 2, cream);
  line(15, 15 + bob, 20, 17 + bob, gold);
  line(21, 12 + bob, 21, 24 + bob, gold);
  rect(18, 17 + bob, 6, 7, ink);
  rect(19, 18 + bob, 4, 5, gold);
  rect(20, 19 + bob, 2, 3, cream);
}
lamp(-1);
save("sprites/lamplighter/idle.png", 24, 32);
for (let f = 0; f < 6; f++) {
  lamp(f);
  save(`sprites/lamplighter/walk/${f}.png`, 24, 32, true);
}
const enemies = {
  moth: 20,
  bat: 20,
  rat: 24,
  gnat: 16,
  beetle: 28,
  wisp: 20,
  spider: 28,
  crow: 24,
  shade: 32,
  hound: 36,
  mothwing: 56,
  owl: 72,
  dark: 80,
};
for (const [id, n] of Object.entries(enemies))
  for (let f = 0; f < 4; f++) {
    let c = n / 2,
      r = n * 0.23,
      b = (f % 2) * 2;
    let col = ["moth", "mothwing", "owl"].includes(id)
      ? "#b8b099"
      : id === "wisp"
        ? "#7ec5b3"
        : "#657884";
    if (["moth", "mothwing", "bat", "crow", "gnat"].includes(id)) {
      for (let side of [-1, 1]) {
        for (let k = 0; k < 6; k++) {
          rect(
            c + side * (r + k * 1.2) - (side < 0 ? k : 0),
            c - r + b + k * 1.2,
            k + 2,
            r * 1.5 - k * 0.5,
            col,
          );
        }
        line(c, c - r, c + side * n * 0.42, c - r + b, gold);
      }
      rect(c - 2, c - r, 5, r * 2, ink);
      rect(c - 1, c - r + 2, 2, r * 1.5, gold);
    } else if (id === "spider") {
      for (let side of [-1, 1])
        for (let j = 0; j < 4; j++) {
          line(
            c,
            c - 4 + j * 3,
            c + side * (r + 4),
            c - r + j * r * 0.6 + b,
            col,
          );
          line(
            c + side * (r + 4),
            c - r + j * r * 0.6 + b,
            c + side * (r + 7),
            c - r + j * r * 0.6 + 5 + b,
            col,
          );
        }
      circle(c, c, r, ink);
      circle(c, c, r - 3, col);
    } else if (id === "rat" || id === "hound") {
      circle(c - 3, c, r, col);
      circle(c + r, c - 3, r * 0.65, col);
      rect(c - r, c + r - 1, 4, 5 - b, ink);
      rect(c + r - 2, c + r - 1, 4, 3 + b, ink);
      line(c - r, c, c - n * 0.46, c + r, gold);
      rect(c + r, c - r, 4, 4, ink);
    } else if (id === "beetle") {
      circle(c, c, r + 3, ink);
      circle(c, c, r, col);
      line(c, c - r, c, c + r, gold);
      for (let j = -1; j < 2; j++)
        for (let s of [-1, 1])
          line(c + s * r, c + j * 5, c + s * (r + 5), c + j * 6 + b, col);
    } else if (id === "owl") {
      circle(c, c, r * 1.7, ink);
      circle(c, c, r * 1.4, col);
      for (let s of [-1, 1]) {
        circle(c + s * r * 0.65, c - r * 0.3, r * 0.65, gold);
        circle(c + s * r * 0.65, c - r * 0.3, r * 0.4, ink);
      }
      rect(c - 3, c, 6, 7, gold);
      for (let j = 0; j < 6; j++)
        line(c - r + j * 4, c + r, c - r + j * 4, c + r + 7 + b, deep);
    } else {
      for (let j = 0; j < n * 0.7; j++) {
        let width =
          id === "wisp" ? Math.sin((j / n) * 5) * r : r * (0.6 + j / n);
        rect(c - width, c - r + j, width * 2, 1, col);
      }
      for (let j = 0; j < 4; j++)
        rect(c - r + j * r * 0.6, c + r - 2, r * 0.3, 5 + ((j + f) % 3), deep);
    }
    rect(c - 4, c - r * 0.4, 2, 2, cream);
    rect(c + 3, c - r * 0.4, 2, 2, id === "dark" ? "#ff7766" : cream);
    save(`sprites/enemies/${id}/${f}.png`, n, n, true);
  }
for (let f = 0; f < 4; f++) {
  for (let j = 0; j < 8; j++) {
    let a = (j * Math.PI) / 4;
    circle(
      12 + Math.cos(a) * (f * 2 + 2),
      12 + Math.sin(a) * (f * 2 + 2),
      Math.max(1, 4 - f),
      "#9bb4a388",
    );
  }
  save(`sprites/puff/${f}.png`, 24, 24, true);
}
for (const [i, t] of ["small", "medium", "large"].entries()) {
  let n = 8 + i * 4;
  for (let y = 1; y < n - 1; y++) {
    let w = Math.max(1, (1 - Math.abs(y - n / 2) / (n / 2)) * n * 0.38);
    rect(n / 2 - w, y, w * 2, 1, ink);
    rect(n / 2 - w + 1, y, w * 2 - 2, 1, teal);
  }
  line(n / 2, 2, n / 2, n - 3, cream);
  save(`sprites/gems/${t}.png`, n, n);
}
for (const id of ["chest", "bread", "draft"]) {
  if (id === "chest") {
    rect(2, 7, 20, 14, ink);
    rect(3, 8, 18, 11, "#93623e");
    rect(3, 11, 18, 2, gold);
    rect(6, 6, 2, 14, gold);
    rect(17, 6, 2, 14, gold);
    rect(10, 12, 4, 5, cream);
  }
  if (id === "bread") {
    circle(12, 12, 9, ink);
    circle(12, 11, 8, "#ac734b");
    circle(12, 9, 6, gold);
    for (let x = 7; x < 18; x += 4) line(x, 7, x - 2, 12, cream);
  }
  if (id === "draft") {
    for (let j = 0; j < 3; j++) {
      line(3, 6 + j * 5, 18, 6 + j * 5, teal);
      circle(18, 4 + j * 5, 2, cream, true);
    }
  }
  save(`sprites/pickups/${id}.png`, 24, 24);
}
rect(0, 0, 64, 64, "#18272b");
for (let y = 0; y < 64; y += 16)
  for (let x = -16; x < 64; x += 32) {
    let xx = x + (y % 32 ? 16 : 0);
    rect(xx, y, 31, 15, "#1b2c30");
    line(xx + 2, y + 1, xx + 29, y + 1, "#223439");
    line(xx + 30, y + 2, xx + 30, y + 13, "#142226");
  }
for (let i = 0; i < 23; i++) {
  let x = (i * 37) % 64,
    y = (i * 17) % 64;
  rect(x, y, 1, 1, i % 3 ? "#293c3d" : "#44534a");
}
save("sprites/ground.png", 64, 64);
const effects = {
  taper: [120, 40, 1],
  ember: [16, 16, 1],
  pin: [12, 12, 1],
  lantern: [28, 28, 1],
  halo: [160, 160, 1],
  "oil-splash": [100, 100, 1],
  spark: [80, 80, 4],
  shard: [16, 16, 1],
  sconce: [24, 24, 4],
  flare: [128, 128, 6],
  pyre: [120, 40, 1],
  beacon: [16, 16, 1],
  hail: [12, 12, 1],
  chandelier: [28, 28, 1],
  corona: [160, 160, 1],
  blaze: [100, 100, 1],
};
for (const [id, [w, h, frames]] of Object.entries(effects))
  for (let f = 0; f < frames; f++) {
    let evolved = [
        "pyre",
        "beacon",
        "hail",
        "chandelier",
        "corona",
        "blaze",
      ].includes(id),
      co = evolved ? "#a7dfce" : gold;
    if (id === "taper" || id === "pyre") {
      for (let x = 0; x < w; x++) {
        let y = h / 2 + Math.sin((x / w) * Math.PI) * h * 0.33;
        rect(x, y, 1, Math.max(1, (1 - x / w) * 6), co);
        if (evolved) rect(x, h - y, 1, 2, cream);
      }
    } else if (
      ["halo", "corona", "oil-splash", "blaze", "flare"].includes(id)
    ) {
      let r = w / 2 - 2;
      circle(w / 2, h / 2, r, co + "20");
      circle(w / 2, h / 2, r, co + "aa", true);
      circle(w / 2, h / 2, r - 3, co + "55", true);
      for (let j = 0; j < 24; j++) {
        let a = (j * Math.PI) / 12 + 0.1 * f,
          rr = r * (0.7 + Math.sin(j * 7 + f) * 0.2);
        rect(
          w / 2 + Math.cos(a) * rr,
          h / 2 + Math.sin(a) * rr,
          2 + ((j + f) % 3),
          2,
          co + "99",
        );
      }
    } else if (id === "spark") {
      for (let j = 0; j < 5; j++)
        line(
          w / 2 + (j % 2 ? 8 : -8),
          f * 4 + j * 12,
          w / 2 + (j % 2 ? -8 : 8),
          f * 4 + (j + 1) * 12,
          cream,
        );
      circle(w / 2, h / 2, 20 + f * 5, gold + "55", true);
    } else if (["lantern", "chandelier"].includes(id)) {
      circle(w / 2, h / 2, 12, co + "22");
      rect(8, 7, 12, 15, ink);
      rect(10, 9, 8, 11, co);
      rect(13, 10, 2, 9, cream);
      line(9, 5, 19, 5, co);
      if (evolved) line(4, 13, 24, 13, cream);
    } else {
      let c = w / 2;
      for (let j = 0; j < w - 3; j++) {
        let wid = Math.max(1, Math.min(j, w - j) * 0.4);
        rect(c - wid, j, wid * 2, 1, co);
      }
      line(c, 3, c, h - 3, cream);
      if (frames > 1) circle(c, c, 7 + (f % 2), co, true);
    }
    save(
      `sprites/effects/${id}${frames > 1 ? "/" + f : ""}.png`,
      w,
      h,
      frames > 1,
    );
  }
const pass = [
  "wick",
  "oil",
  "glass",
  "brass",
  "mirror",
  "bellows",
  "tallow",
  "tinder",
  "soot",
  "lure",
  "lamp-oil",
];
for (const [i, id] of [...Object.keys(effects), ...pass].entries()) {
  let co = i < 10 ? gold : i < 16 ? "#a7dfce" : teal;
  circle(12, 12, 10, ink);
  if (i < 16) {
    if (i % 5 === 0) {
      line(5, 18, 19, 5, co);
      line(7, 19, 20, 7, cream);
    } else if (i % 5 === 1) {
      for (let j = 0; j < 15; j++)
        rect(12 - j * 0.25, 4 + j, j * 0.5 + 1, 1, co);
      rect(11, 10, 2, 8, cream);
    } else if (i % 5 === 2) {
      for (let j = -1; j <= 1; j++) line(12, 19, 12 + j * 6, 4, co);
    } else if (i % 5 === 3) {
      rect(6, 7, 12, 13, co);
      rect(8, 9, 8, 8, ink);
      rect(11, 10, 3, 6, cream);
    } else {
      circle(12, 12, 8, co, true);
      circle(12, 12, 5, cream, true);
    }
  } else {
    let k = i - 16;
    if (k === 0 || k === 6) {
      rect(8, 5, 8, 15, co);
      rect(10, 2, 4, 5, gold);
      line(9, 9, 13, 9, cream);
    } else if (k === 1 || k === 10) {
      rect(7, 7, 10, 14, co);
      rect(10, 3, 4, 5, gold);
      rect(10, 11, 4, 7, cream);
    } else if (k === 2 || k === 4) {
      circle(12, 12, 8, gold);
      circle(12, 12, 6, co);
      line(8, 15, 14, 7, cream);
    } else if (k === 3) {
      rect(5, 5, 14, 13, gold);
      rect(8, 8, 8, 8, co);
      rect(9, 17, 6, 4, gold);
    } else if (k === 5) {
      for (let j = 0; j < 5; j++) line(5 + j * 2, 5, 5 + j * 2, 19, co);
      line(4, 5, 19, 12, gold);
    } else if (k === 7) {
      circle(12, 12, 7, gold);
      line(8, 15, 15, 8, cream);
    } else if (k === 8) {
      for (let j = 0; j < 7; j++) circle(6 + j * 2, 15 - (j % 3) * 3, 3, co);
    } else {
      line(12, 3, 12, 16, gold);
      circle(12, 16, 5, co, true);
    }
  }
  save(`icons/${id}.png`, 24, 24);
}
