import fs from "node:fs";
import cp from "node:child_process";
import process from "node:process";
function run(b, ...a) {
  cp.execFileSync(b, ["--config", "/tmp/wick-audio.json", ...a.map(String)], {
    stdio: "pipe",
  });
}
const names = [
  "hit",
  "kill",
  "gem",
  "hurt",
  "level-up",
  "choose",
  "chest",
  "evolve",
  "pickup",
  "fallen",
  "dawn",
  "menu-move",
  "menu-confirm",
  "hum",
];
for (let i = 0; i < names.length; i++) {
  let name = names[i],
    dur =
      name === "hum"
        ? 2400
        : ["fallen", "dawn", "evolve"].includes(name)
          ? 1700
          : 80 + i * 15;
  fs.writeFileSync(
    "/tmp/wick-audio.json",
    JSON.stringify({
      sample_rate: 22050,
      channels: "mono",
      max_duration_ms: 4000,
      seed: 42,
      actions: "/tmp/wick-sfx.json",
      preview: "/tmp/wick-sfx.png",
      wav: `${process.cwd()}/assets/audio/${name}.wav`,
    }),
  );
  fs.mkdirSync("assets/audio", { recursive: true });
  run("sfx-synth", "init");
  run(
    "sfx-synth",
    "add-voice",
    "--name",
    "body",
    "--wave",
    name === "hurt" ? "saw" : "triangle",
    "--freq",
    name === "hum" ? 110 : 180 + i * 73,
    "--gain",
    name === "hum" ? -32 : -24,
    "--dur",
    dur,
  );
  run(
    "sfx-synth",
    "set-envelope",
    "--voice",
    "body",
    "--env",
    name === "hum" ? "gate" : "pluck",
  );
  if (i > 3 && i < 11) {
    run(
      "sfx-synth",
      "add-voice",
      "--name",
      "bell",
      "--wave",
      "sine",
      "--freq",
      name === "fallen" ? 110 : 660 + i * 31,
      "--gain",
      -28,
      "--start",
      70,
      "--dur",
      dur,
    );
    run("sfx-synth", "set-envelope", "--voice", "bell", "--env", "swell");
  }
  run("sfx-synth", "render");
}
fs.writeFileSync(
  "/tmp/wick-audio.json",
  JSON.stringify({
    sample_rate: 22050,
    channels: "mono",
    max_duration_ms: 34000,
    seed: 42,
    instrument_bank: "cinematic",
    actions: "/tmp/wick-music.json",
    preview: "/tmp/wick-music.png",
    wav: `${process.cwd()}/assets/audio/music.wav`,
    mid: `${process.cwd()}/assets/audio/music.mid`,
  }),
);
run("music", "init");
run("music", "set-tempo", "--bpm", 120);
for (const [name, instrument, gain] of [
  ["lantern", "triangle", -25],
  ["night", "sine", -28],
]) {
  run("music", "define-track", "--name", name, "--instrument", instrument);
  run(
    "music",
    "set-track-fx",
    "--track",
    name,
    "--gain",
    gain,
    "--env",
    name === "night" ? "swell" : "pluck",
  );
}
const notes = [62, 69, 65, 72, 69, 64, 65, 60];
for (let i = 0; i < 64; i++) {
  run(
    "music",
    "add-note",
    "--track",
    "lantern",
    "--pitch",
    notes[i % 8] + (i % 16 > 7 ? 12 : 0),
    "--t",
    i,
    "--dur",
    0.7,
    "--velocity",
    50 + (i % 3) * 10,
  );
  if (i % 8 === 0)
    for (const n of [38, 45, 53])
      run(
        "music",
        "add-note",
        "--track",
        "night",
        "--pitch",
        n - (i % 16 === 8 ? 2 : 0),
        "--t",
        i,
        "--dur",
        8,
        "--velocity",
        65,
      );
}
run("music", "render");
