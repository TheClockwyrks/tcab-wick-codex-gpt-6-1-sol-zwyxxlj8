import { Buffer } from "node:buffer";
// Circular crossfade of the produced PCM: tails meet the next phrase without
// a click or silent padding. This is an authoring step, never a build step.
import fs from "node:fs";
for (const name of ["hum", "music"]) {
  const path = `assets/audio/${name}.wav`,
    file = fs.readFileSync(path);
  let offset = 12,
    rate = 22050,
    channels = 1;
  while (file.toString("ascii", offset, offset + 4) !== "data") {
    if (file.toString("ascii", offset, offset + 4) === "fmt ") {
      channels = file.readUInt16LE(offset + 10);
      rate = file.readUInt32LE(offset + 12);
    }
    offset += 8 + file.readUInt32LE(offset + 4);
  }
  const raw = file.subarray(offset + 8),
    frames = raw.length / (2 * channels),
    overlap = Math.round(rate * (name === "hum" ? 0.1 : 0.25)),
    newFrames = frames - overlap,
    out = Buffer.alloc(newFrames * channels * 2);
  for (let i = 0; i < newFrames; i++)
    for (let c = 0; c < channels; c++) {
      const src = i + overlap;
      let value = raw.readInt16LE((src * channels + c) * 2);
      if (i >= newFrames - overlap) {
        const t = (i - (newFrames - overlap)) / overlap,
          head = raw.readInt16LE(
            ((i - (newFrames - overlap)) * channels + c) * 2,
          );
        value = value * (1 - t) + head * t;
      }
      out.writeInt16LE(Math.round(value), (i * channels + c) * 2);
    }
  const head = Buffer.from(file.subarray(0, offset + 8));
  head.writeUInt32LE(out.length, offset + 4);
  head.writeUInt32LE(head.length + out.length - 8, 4);
  fs.writeFileSync(path, Buffer.concat([head, out]));
}
