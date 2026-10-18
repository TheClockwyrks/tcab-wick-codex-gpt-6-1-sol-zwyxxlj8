// Authored pixel silhouettes and animation poses, rendered once with draw tools.
import fs from "node:fs";
import cp from "node:child_process";
let ops = [],
  scale = 1;
const R = (x, y, w, h, c) =>
  ops.push({
    op: "fill_rect",
    x: Math.round(x * scale),
    y: Math.round(y * scale),
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    color: c,
  });
const L = (x, y, xx, yy, c) =>
  ops.push({
    op: "line",
    x0: Math.round(x * scale),
    y0: Math.round(y * scale),
    x1: Math.round(xx * scale),
    y1: Math.round(yy * scale),
    color: c,
  });
function P(points, c) {
  for (
    let y = Math.min(...points.map((p) => p[1]));
    y <= Math.max(...points.map((p) => p[1]));
    y++
  ) {
    const edges = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
        edges.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    edges.sort((a, b) => a - b);
    for (let j = 0; j + 1 < edges.length; j += 2)
      R(edges[j], y, Math.max(0.5, edges[j + 1] - edges[j]), 1, c);
  }
}
function E(x, y, rx, ry, c) {
  for (let yy = -ry; yy <= ry; yy++) {
    const w = rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / ry / ry));
    R(x - w, y + yy, 2 * w + 1, 1, c);
  }
}
function save(file, w, h) {
  fs.mkdirSync("assets/" + file.substring(0, file.lastIndexOf("/")), {
    recursive: true,
  });
  fs.writeFileSync("/tmp/wick-polish.json", JSON.stringify(ops));
  cp.execFileSync(
    /enemies|walk|effects\/(sconce|flare|spark)/.test(file)
      ? "draw-sheet"
      : "draw",
    [
      "render",
      "--actions",
      "/tmp/wick-polish.json",
      "--out",
      "assets/" + file,
      "--width",
      String(w),
      "--height",
      String(h),
      "--no-layers",
    ],
    { stdio: "pipe" },
  );
  ops = [];
  scale = 1;
}
const dark = "#101a21",
  edge = "#263a43",
  mid = "#4d7078",
  light = "#8ca7a3",
  gold = "#d7ad68",
  bone = "#e8d7a4",
  red = "#d98165";
function lamp(f) {
  let bob = f < 0 ? 0 : [0, -1, 0, 1, 1, 0][f],
    step = f < 0 ? 0 : [0, 1, 2, 1, 0, -1][f];
  R(8 + step, 25, 4, 5, dark);
  R(14 - step, 25, 3, 5, dark);
  R(7 + step, 29, 6, 2, "#6c6252");
  R(13 - step, 29, 6, 2, "#6c6252");
  P(
    [
      [7, 13 + bob],
      [14, 11 + bob],
      [17, 15 + bob],
      [18, 27],
      [5, 27],
    ],
    dark,
  );
  P(
    [
      [8, 14 + bob],
      [13, 13 + bob],
      [15, 25],
      [7, 25],
    ],
    "#35525e",
  );
  L(8, 16 + bob, 7, 24, mid);
  R(13, 16 + bob, 1, 9, "#5c7976");
  R(11, 18 + bob, 1, 1, gold);
  R(11, 22 + bob, 1, 1, gold);
  R(9, 10 + bob, 8, 4, "#963f36");
  R(7, 12 + bob, 4, 3, "#b57553");
  R(12, 5 + bob, 6, 6, "#be9168");
  R(16, 6 + bob, 3, 4, "#ddbb85");
  R(17, 7 + bob, 1, 1, dark);
  R(13, 9 + bob, 3, 2, "#776758");
  R(9, 2 + bob, 8, 5, dark);
  R(10, 2 + bob, 6, 1, "#49626a");
  R(9, 5 + bob, 8, 1, "#805e3d");
  R(6, 6 + bob, 15, 2, dark);
  R(7, 6 + bob, 12, 1, "#455a5c");
  L(15, 15 + bob, 19, 17 + bob, "#6c8580");
  R(18, 16 + bob, 3, 2, gold);
  L(21, 13 + bob, 21, 17 + bob, gold);
  R(18, 17 + bob, 6, 8, dark);
  R(19, 18 + bob, 4, 6, "#ac813e");
  R(20, 18 + bob, 2, 5, bone);
  R(20, 20 + bob, 1, 2, "#fff5d6");
  L(18, 24 + bob, 23, 24 + bob, gold);
}
lamp(-1);
save("sprites/lamplighter/idle.png", 24, 32);
for (let f = 0; f < 6; f++) {
  lamp(f);
  save(`sprites/lamplighter/walk/${f}.png`, 24, 32);
}
const sizes = {
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
for (const [id, size] of Object.entries(sizes))
  for (let f = 0; f < 4; f++) {
    scale = size / 24;
    const wing = [0, 3, 1, -2][f],
      step = [0, 2, 1, -2][f],
      bob = [0, 1, -1, 0][f];
    if (id === "moth" || id === "mothwing") {
      const big = id === "mothwing";
      for (let s of [-1, 1]) {
        const pts = [
          [12, 11],
          [12 + s * 5, 3 + wing],
          [12 + s * 10, 4 + wing],
          [12 + s * 9, 14],
          [12 + s * 5, 19 - wing],
          [12 + s * 2, 16],
        ];
        P(pts, dark);
        P(
          [
            [12 + s * 2, 11],
            [12 + s * 5, 5 + wing],
            [12 + s * 8, 5 + wing],
            [12 + s * 7, 13],
            [12 + s * 4, 16 - wing],
          ],
          big ? "#a7a39b" : "#bdb49a",
        );
        L(12 + s * 2, 11, 12 + s * 7, 7 + wing, gold);
        L(12 + s * 2, 12, 12 + s * 5, 15, big ? red : mid);
        E(12 + s * 5, 10 + wing / 2, 1.5, 2, dark);
        R(12 + s * 5, 9 + wing / 2, 1, 1, gold);
      }
      E(12, 12, 1, 6, dark);
      R(12, 9, 1, 6, gold);
      L(11, 7, 9, 3, bone);
      L(13, 7, 15, 3, bone);
      if (big) {
        L(12, 16, 9, 23, gold);
        L(13, 16, 16, 23, gold);
      }
    }
    if (id === "bat") {
      for (let s of [-1, 1]) {
        P(
          [
            [12, 12],
            [12 + s * 4, 5 + wing],
            [12 + s * 11, 3 + wing],
            [12 + s * 9, 10 + wing],
            [12 + s * 10, 15],
            [12 + s * 5, 13],
            [12 + s * 3, 17],
          ],
          dark,
        );
        P(
          [
            [12 + s * 2, 12],
            [12 + s * 5, 7 + wing],
            [12 + s * 9, 5 + wing],
            [12 + s * 7, 11],
            [12 + s * 4, 12],
          ],
          "#637085",
        );
        L(12 + s * 3, 12, 12 + s * 9, 5 + wing, light);
      }
      P(
        [
          [9, 7],
          [10, 3],
          [12, 6],
          [14, 3],
          [15, 8],
          [14, 17],
          [11, 20],
          [9, 16],
        ],
        edge,
      );
      R(10, 8, 1, 1, red);
      R(14, 8, 1, 1, red);
    }
    if (id === "gnat") {
      L(11, 11, 3, 5 + wing, light);
      L(12, 11, 21, 6 + wing, light);
      L(11, 12, 5, 18 - wing, mid);
      L(12, 12, 20, 17 - wing, mid);
      R(10, 8 + bob, 3, 8, dark);
      R(11, 10 + bob, 1, 3, gold);
      L(11, 8, 8, 4, gold);
      L(12, 8, 15, 4, gold);
    }
    if (id === "rat" || id === "hound") {
      const h = id === "hound";
      L(5, 15, 1, 20 + step, h ? mid : "#957b69");
      E(10, 14 + bob, 7, 4, h ? edge : "#686a64");
      P(
        [
          [14, 13 + bob],
          [15, 7 + bob],
          [19, 8 + bob],
          [23, 12 + bob],
          [22, 15 + bob],
          [17, 16 + bob],
        ],
        h ? mid : "#8a8170",
      );
      P(
        [
          [15, 9 + bob],
          [15, 5 + bob],
          [18, 8 + bob],
        ],
        dark,
      );
      if (h) {
        P(
          [
            [18, 9 + bob],
            [20, 5 + bob],
            [21, 10 + bob],
          ],
          mid,
        );
        L(4, 12 + bob, 11, 10 + bob, light);
        L(5, 13 + bob, 9, 13 + bob, mid);
      }
      R(19, 10 + bob, 1, 1, h ? red : bone);
      R(22, 12 + bob, 1, 2, dark);
      R(5 + step, 17, 2, 4, dark);
      R(13 - step, 17, 2, 4, dark);
      R(18 + step / 2, 16, 2, 4, edge);
      if (h) R(20, 14 + bob, 1, 2, bone);
    }
    if (id === "beetle") {
      for (let s of [-1, 1])
        for (let j = 0; j < 3; j++) {
          L(12 + s * 5, 10 + j * 4, 12 + s * 9, 8 + j * 5 + step / 2, mid);
          L(12 + s * 9, 8 + j * 5 + step / 2, 12 + s * 10, 11 + j * 5, light);
        }
      E(12, 13, 6, 8, dark);
      E(12, 13, 5, 7, "#3a6967");
      L(12, 7, 12, 20, gold);
      L(9, 8, 7, 13, light);
      L(15, 8, 17, 13, mid);
      E(12, 5 + bob, 3, 2, edge);
      R(10, 4 + bob, 1, 1, red);
      R(14, 4 + bob, 1, 1, red);
      L(10, 3, 8, 1, mid);
      L(14, 3, 16, 1, mid);
    }
    if (id === "spider") {
      for (let s of [-1, 1])
        for (let j = 0; j < 4; j++) {
          const yy = 5 + j * 4;
          L(
            12 + s * 4,
            11 + j / 2,
            12 + s * 9,
            yy + (step * (j % 2 ? 1 : -1)) / 2,
            mid,
          );
          L(
            12 + s * 9,
            yy + (step * (j % 2 ? 1 : -1)) / 2,
            12 + s * 11,
            yy + 4,
            light,
          );
        }
      E(12, 15 + bob, 5, 6, dark);
      E(12, 14 + bob, 3, 4, "#67566a");
      L(11, 12 + bob, 11, 17 + bob, light);
      E(12, 8, 3, 3, edge);
      for (let j = 0; j < 3; j++) R(10 + j * 2, 7, 1, 1, red);
      L(10, 10, 9, 12, bone);
      L(14, 10, 15, 12, bone);
    }
    if (id === "crow") {
      P(
        [
          [7, 14],
          [2, 5 + wing],
          [9, 9],
          [14, 6],
          [17, 7],
          [20, 11],
          [23, 12],
          [18, 13],
          [15, 18],
          [7, 20],
          [10, 15],
        ],
        dark,
      );
      P(
        [
          [7, 13],
          [3, 7 + wing],
          [10, 11],
          [14, 10],
          [13, 15],
        ],
        "#586a7a",
      );
      L(4, 8 + wing, 10, 14, light);
      P(
        [
          [9, 18],
          [3, 23],
          [10, 21],
          [13, 18],
        ],
        edge,
      );
      R(17, 9, 1, 1, bone);
      L(13, 17, 13 + step, 22, gold);
    }
    if (id === "wisp") {
      for (let j = 0; j < 8; j++)
        R(8 + Math.sin(j * 0.7 + f) * 2, 18 - j, 3, 1, "#6eaaa775");
      E(12 + Math.sin(f) * 2, 9 + bob, 5, 6, "#407c7e55");
      E(12, 9 + bob, 3, 4, "#76c9b7");
      P(
        [
          [9, 9 + bob],
          [12, 3 + bob],
          [14, 10 + bob],
          [12, 14 + bob],
        ],
        "#d0e4c3",
      );
      R(11, 8 + bob, 1, 2, dark);
      R(14, 8 + bob, 1, 2, dark);
    }
    if (id === "shade") {
      P(
        [
          [4, 22],
          [6, 9 + bob],
          [9, 3 + bob],
          [15, 2 + bob],
          [19, 8 + bob],
          [21, 22],
          [17, 20 - step / 2],
          [14, 23],
          [11, 20 + step / 2],
          [7, 23],
        ],
        dark,
      );
      P(
        [
          [7, 20],
          [8, 9 + bob],
          [11, 5 + bob],
          [15, 4 + bob],
          [18, 10 + bob],
          [17, 19],
        ],
        edge,
      );
      P(
        [
          [9, 9 + bob],
          [12, 5 + bob],
          [15, 9 + bob],
          [15, 13 + bob],
          [10, 13 + bob],
        ],
        "#0b141c",
      );
      R(10, 10 + bob, 2, 1, "#a2c4bc");
      R(14, 10 + bob, 1, 1, "#a2c4bc");
      L(9, 15, 7, 20, mid);
      L(16, 14, 17, 19, mid);
    }
    if (id === "owl") {
      P(
        [
          [4, 4 + bob],
          [9, 7 + bob],
          [15, 7 + bob],
          [20, 4 + bob],
          [20, 16],
          [17, 22],
          [7, 22],
          [4, 16],
        ],
        dark,
      );
      E(12, 15 + bob, 7, 7, "#a99e82");
      for (let side of [-1, 1]) {
        P(
          [
            [12 + side * 6, 11],
            [12 + side * 10, 10 + wing],
            [12 + side * 9, 19],
            [12 + side * 6, 22],
          ],
          "#746f64",
        );
        E(12 + side * 3.5, 10 + bob, 3, 4, bone);
        E(12 + side * 3.5, 10 + bob, 1, 2, dark);
      }
      P(
        [
          [11, 12 + bob],
          [14, 12 + bob],
          [12, 15 + bob],
        ],
        gold,
      );
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++)
          L(8 + j * 3, 16 + k * 2, 9 + j * 3, 17 + k * 2, mid);
      R(8 + step / 2, 22, 3, 1, gold);
      R(15 - step / 2, 22, 3, 1, gold);
    }
    if (id === "dark") {
      P(
        [
          [1, 23],
          [4, 11],
          [8, 7 + bob],
          [9, 2 + bob],
          [15, 1 + bob],
          [18, 6 + bob],
          [20, 12],
          [23, 23],
          [18, 21],
          [15, 24],
          [11, 22],
          [7, 24],
        ],
        "#0b131d",
      );
      P(
        [
          [4, 21],
          [7, 12],
          [10, 8 + bob],
          [14, 7 + bob],
          [18, 13],
          [20, 21],
          [14, 20 - step / 2],
          [10, 23],
        ],
        "#233442",
      );
      L(7, 12, 5, 18, mid);
      L(17, 14, 20, 22, mid);
      P(
        [
          [8, 7 + bob],
          [10, 3 + bob],
          [15, 3 + bob],
          [17, 7 + bob],
          [15, 12 + bob],
          [11, 12 + bob],
        ],
        dark,
      );
      R(10, 7 + bob, 2, 1, red);
      R(14, 7 + bob, 2, 1, red);
      L(12, 10 + bob, 14, 10 + bob, "#786654");
      L(3, 15, 1, 20, light);
      L(21, 14, 23, 19, light);
    }
    save(`sprites/enemies/${id}/${f}.png`, size, size);
  }
// Give every spinning/flash frame an individual pose, with crisp rotational rays.
for (const [id, n, frames] of [
  ["sconce", 24, 4],
  ["flare", 128, 6],
  ["spark", 80, 4],
])
  for (let f = 0; f < frames; f++) {
    const c = n / 2;
    scale = 1;
    for (let j = 0; j < (id === "sconce" ? 4 : 12); j++) {
      const a = (j / (id === "sconce" ? 4 : 12)) * Math.PI * 2 + f * 0.25,
        rad = id === "sconce" ? 8 : n * 0.45;
      const x = c + Math.cos(a) * rad,
        y = c + Math.sin(a) * rad;
      L(
        c + Math.cos(a) * rad * 0.2,
        c + Math.sin(a) * rad * 0.2,
        x,
        y,
        j % 2 ? gold : bone,
      );
      R(x, y, 2, 2, bone);
    }
    if (id === "sconce") {
      E(c, c, 4, 4, dark);
      R(c - 1, c - 2, 2, 5, gold);
    } else if (id === "spark")
      P(
        [
          [c - 2, 2],
          [c + 7, c - 7],
          [c + 1, c - 5],
          [c + 5, n - 3],
          [c - 9, c],
          [c - 1, c + 1],
        ],
        bone,
      );
    save(`sprites/effects/${id}/${f}.png`, n, n);
  }
// Inventory emblems: one individually drawn object for every slot and offer.
const baseIds = [
  "taper",
  "ember",
  "pin",
  "lantern",
  "halo",
  "oil-splash",
  "spark",
  "shard",
  "sconce",
  "flare",
];
const evos = {
  pyre: "taper",
  beacon: "ember",
  hail: "pin",
  chandelier: "lantern",
  corona: "halo",
  blaze: "oil-splash",
};
const passiveIds = [
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
for (const id of [...baseIds, ...Object.keys(evos), ...passiveIds]) {
  const base = evos[id] ?? id,
    co = id in evos ? "#99d1bc" : gold;
  if (base === "taper") {
    P(
      [
        [4, 17],
        [6, 12],
        [18, 3],
        [21, 3],
        [21, 6],
        [10, 16],
        [6, 18],
      ],
      co,
    );
    L(7, 14, 17, 5, bone);
    L(3, 19, 9, 13, mid);
    R(2, 20, 3, 2, edge);
  }
  if (base === "ember") {
    P(
      [
        [7, 21],
        [4, 16],
        [7, 9],
        [8, 14],
        [14, 2],
        [15, 10],
        [19, 7],
        [21, 15],
        [18, 21],
      ],
      "#985b3e",
    );
    P(
      [
        [8, 20],
        [7, 15],
        [13, 7],
        [12, 14],
        [17, 11],
        [18, 17],
        [15, 21],
      ],
      co,
    );
    P(
      [
        [10, 20],
        [11, 15],
        [14, 13],
        [15, 19],
      ],
      bone,
    );
  }
  if (base === "pin") {
    for (let j = 0; j < 3; j++) {
      L(4 + j * 3, 20, 10 + j * 4, 4, co);
      P(
        [
          [8 + j * 4, 6],
          [10 + j * 4, 2],
          [12 + j * 4, 5],
        ],
        bone,
      );
      R(3 + j * 3, 18, 3, 2, mid);
    }
  }
  if (base === "lantern") {
    L(8, 6, 8, 3, co);
    L(8, 3, 16, 3, co);
    L(16, 3, 16, 6, co);
    R(6, 6, 12, 2, mid);
    P(
      [
        [7, 8],
        [17, 8],
        [19, 20],
        [5, 20],
      ],
      dark,
    );
    R(8, 9, 8, 10, co);
    L(12, 8, 12, 19, bone);
    R(5, 20, 14, 2, mid);
  }
  if (base === "halo") {
    E(12, 12, 9, 9, co);
    E(12, 12, 7, 7, dark);
    E(12, 12, 4, 4, co);
    E(12, 12, 2, 2, dark);
    R(11, 1, 2, 4, bone);
    R(11, 20, 2, 3, bone);
    R(1, 11, 4, 2, bone);
    R(20, 11, 3, 2, bone);
  }
  if (base === "oil-splash") {
    P(
      [
        [4, 13],
        [9, 11],
        [7, 6],
        [13, 4],
        [16, 7],
        [13, 12],
        [20, 15],
        [18, 20],
        [6, 21],
        [2, 18],
      ],
      "#45675e",
    );
    L(5, 18, 16, 18, co);
    L(9, 15, 18, 17, co);
    R(13, 2, 3, 6, co);
    R(8, 6, 8, 2, mid);
  }
  if (base === "spark") {
    P(
      [
        [12, 1],
        [6, 12],
        [12, 12],
        [9, 23],
        [19, 9],
        [13, 10],
        [18, 1],
      ],
      co,
    );
    L(2, 6, 5, 8, bone);
    L(19, 17, 22, 20, bone);
  }
  if (base === "shard") {
    P(
      [
        [6, 4],
        [17, 2],
        [20, 14],
        [9, 22],
        [3, 17],
      ],
      mid,
    );
    P(
      [
        [7, 5],
        [16, 4],
        [11, 18],
      ],
      co,
    );
    L(16, 4, 18, 13, bone);
    L(5, 17, 9, 20, light);
  }
  if (base === "sconce") {
    P(
      [
        [2, 5],
        [11, 9],
        [21, 5],
        [18, 11],
        [12, 15],
        [5, 11],
      ],
      co,
    );
    P(
      [
        [4, 7],
        [11, 11],
        [19, 7],
        [15, 12],
        [12, 13],
        [7, 10],
      ],
      mid,
    );
    E(12, 12, 3, 3, dark);
    R(11, 11, 2, 3, bone);
    L(4, 18, 8, 21, light);
  }
  if (base === "flare") {
    for (let j = 0; j < 8; j++) {
      const a = (j * Math.PI) / 4;
      L(
        12 + Math.cos(a) * 5,
        12 + Math.sin(a) * 5,
        12 + Math.cos(a) * 11,
        12 + Math.sin(a) * 11,
        co,
      );
    }
    E(12, 12, 5, 5, co);
    E(12, 12, 2, 3, bone);
  }
  if (base === "wick") {
    R(6, 7, 12, 12, "#876a4d");
    L(7, 9, 16, 9, co);
    L(7, 12, 16, 12, bone);
    L(7, 15, 16, 15, co);
    L(7, 18, 16, 18, co);
    L(11, 7, 13, 4, bone);
    L(13, 4, 11, 1, co);
  }
  if (base === "oil" || base === "lamp-oil") {
    R(9, 2, 6, 3, mid);
    R(10, 5, 4, 3, bone);
    P(
      [
        [9, 8],
        [15, 8],
        [18, 12],
        [18, 22],
        [6, 22],
        [6, 12],
      ],
      mid,
    );
    R(7, 14, 10, 7, co);
    P(
      [
        [11, 12],
        [9, 17],
        [12, 20],
        [15, 17],
      ],
      bone,
    );
    if (base === "lamp-oil") {
      L(5, 4, 2, 1, co);
      L(20, 4, 23, 1, co);
      R(11, 17, 2, 3, red);
    }
  }
  if (base === "glass") {
    P(
      [
        [7, 2],
        [17, 2],
        [20, 10],
        [16, 21],
        [8, 21],
        [4, 10],
      ],
      mid,
    );
    P(
      [
        [8, 3],
        [16, 3],
        [18, 10],
        [15, 19],
        [9, 19],
        [6, 10],
      ],
      "#a8c7b6",
    );
    L(9, 5, 7, 10, bone);
    L(7, 11, 10, 17, bone);
    L(14, 4, 16, 11, tealColor());
  }
  if (base === "brass") {
    P(
      [
        [3, 4],
        [12, 2],
        [21, 4],
        [20, 15],
        [12, 23],
        [4, 15],
      ],
      gold,
    );
    P(
      [
        [6, 6],
        [12, 5],
        [18, 6],
        [17, 14],
        [12, 19],
        [7, 14],
      ],
      edge,
    );
    L(12, 6, 12, 18, bone);
    L(7, 10, 17, 10, co);
  }
  if (base === "mirror") {
    E(12, 9, 7, 8, gold);
    E(12, 9, 5, 6, mid);
    L(9, 11, 14, 5, bone);
    L(11, 13, 15, 8, light);
    R(10, 17, 4, 6, gold);
    R(11, 18, 2, 4, edge);
  }
  if (base === "bellows") {
    P(
      [
        [2, 5],
        [12, 3],
        [21, 11],
        [13, 21],
        [3, 19],
        [8, 12],
      ],
      "#825b45",
    );
    L(4, 6, 14, 19, co);
    L(7, 5, 17, 16, co);
    L(10, 4, 20, 13, co);
    L(4, 18, 12, 20, bone);
    P(
      [
        [19, 9],
        [23, 10],
        [23, 12],
        [19, 12],
      ],
      mid,
    );
  }
  if (base === "tallow") {
    R(7, 8, 10, 14, bone);
    R(6, 20, 12, 2, mid);
    R(8, 10, 2, 8, "#b6ac8b");
    R(13, 9, 2, 11, "#d5c6a2");
    L(12, 8, 12, 5, dark);
    P(
      [
        [12, 0],
        [9, 4],
        [12, 7],
        [15, 4],
      ],
      gold,
    );
    R(11, 3, 2, 2, bone);
  }
  if (base === "tinder") {
    R(4, 7, 16, 14, "#936d49");
    R(6, 9, 12, 10, gold);
    L(7, 14, 17, 14, dark);
    R(9, 3, 12, 6, mid);
    L(11, 4, 19, 4, bone);
    P(
      [
        [11, 18],
        [12, 11],
        [16, 16],
        [15, 19],
      ],
      red,
    );
  }
  if (base === "soot") {
    P(
      [
        [2, 19],
        [5, 13],
        [8, 13],
        [10, 8],
        [14, 12],
        [18, 10],
        [22, 18],
        [18, 21],
        [7, 21],
      ],
      edge,
    );
    L(6, 15, 9, 15, mid);
    L(13, 14, 16, 17, mid);
    L(8, 20, 16, 20, light);
    R(7, 4, 2, 2, mid);
    R(16, 2, 2, 3, mid);
  }
  if (base === "lure") {
    L(12, 1, 12, 14, gold);
    L(12, 14, 8, 18, gold);
    L(8, 18, 4, 15, gold);
    L(4, 15, 4, 12, gold);
    P(
      [
        [12, 7],
        [18, 11],
        [16, 20],
        [12, 23],
        [9, 17],
      ],
      mid,
    );
    P(
      [
        [13, 9],
        [16, 12],
        [14, 19],
      ],
      bone,
    );
  }
  if (id in evos) {
    for (const [x, y] of [
      [2, 2],
      [20, 20],
      [2, 20],
      [20, 2],
    ]) {
      L(x, y - 1, x, y + 1, "#b5ead2");
      L(x - 1, y, x + 1, y, "#b5ead2");
    }
  }
  save(`icons/${id}.png`, 24, 24);
}
function tealColor() {
  return "#5b9c99";
}
// Gems have different cuts as well as sizes, so tiers remain readable in a crowd.
for (const [id, n] of [
  ["small", 8],
  ["medium", 12],
  ["large", 16],
]) {
  scale = 1;
  if (id === "small") {
    P(
      [
        [4, 0],
        [7, 4],
        [4, 8],
        [1, 4],
      ],
      dark,
    );
    P(
      [
        [4, 1],
        [6, 4],
        [4, 6],
        [2, 4],
      ],
      "#83b8a6",
    );
    L(4, 2, 4, 5, bone);
  } else if (id === "medium") {
    P(
      [
        [3, 1],
        [9, 1],
        [11, 5],
        [6, 12],
        [1, 5],
      ],
      dark,
    );
    P(
      [
        [3, 2],
        [8, 2],
        [10, 5],
        [6, 10],
        [2, 5],
      ],
      "#7bb4b7",
    );
    L(3, 3, 8, 3, bone);
    L(6, 4, 6, 9, "#c4e8cc");
    L(2, 5, 10, 5, "#447f88");
  } else {
    P(
      [
        [2, 6],
        [6, 7],
        [8, 0],
        [12, 4],
        [12, 7],
        [15, 5],
        [15, 11],
        [9, 16],
        [2, 13],
      ],
      dark,
    );
    P(
      [
        [8, 1],
        [11, 4],
        [10, 12],
        [8, 14],
        [5, 11],
      ],
      "#91ccd2",
    );
    P(
      [
        [3, 7],
        [6, 8],
        [7, 13],
        [3, 12],
      ],
      "#648fba",
    );
    P(
      [
        [12, 9],
        [14, 7],
        [14, 11],
        [10, 14],
      ],
      "#83b8a6",
    );
    L(8, 3, 8, 12, bone);
    L(4, 8, 5, 11, "#bce8d5");
    L(12, 10, 11, 12, bone);
  }
  save(`sprites/gems/${id}.png`, n, n);
}
// Slicks carry a broken, oily edge; they never read as a second aura ring.
for (const [id, size, evolved] of [
  ["oil-splash", 100, false],
  ["blaze", 100, true],
]) {
  scale = 1;
  E(50, 50, 48, 48, evolved ? "#5d503a88" : "#23484988");
  E(49, 52, 39, 36, evolved ? "#a46b3977" : "#39656677");
  for (let j = 0; j < 28; j++) {
    const a = (j * Math.PI) / 14,
      rad = 45 - (j % 4) * 2,
      x = 50 + Math.cos(a) * rad,
      y = 50 + Math.sin(a) * rad;
    P(
      [
        [x - 3, y + 3],
        [x - 2, y - 3 - (j % 4)],
        [x + 1, y],
        [x + 4, y + 2],
      ],
      evolved ? "#e7ad6a99" : "#8ca88c88",
    );
  }
  for (let j = 0; j < 11; j++) {
    const y = 22 + j * 5,
      w = Math.sqrt(Math.max(0, 1 - (y - 50) ** 2 / 1600)) * 32;
    L(50 - w, y, 50 + w, y, evolved ? "#d4a76255" : "#78a59a44");
  }
  save(`sprites/effects/${id}.png`, size, size);
}
