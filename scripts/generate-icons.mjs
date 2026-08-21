// Generates the Zaper app icons (brand-colored PNGs with a "Z" glyph) without
// any external dependencies. Run once after checkout: `node scripts/generate-icons.mjs`.
//
// Output: src-tauri/icons/{32x32,128x128,128x128@2x,icon}.png

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "src-tauri", "icons");

// Brand colors (indigo-600 background, white glyph).
const BG = [79, 70, 229];
const FG = [255, 255, 255];

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function pixel(x, y, size) {
  const px = x / size;
  const py = y / size;
  const top = py > 0.18 && py < 0.32 && px > 0.22 && px < 0.78;
  const bottom = py > 0.68 && py < 0.82 && px > 0.22 && px < 0.78;
  const diagonal = Math.abs(px + py - 1.0) < 0.1;
  return top || bottom || diagonal ? FG : BG;
}

function makePng(size) {
  // One byte filter (0 = none) per scanline, then RGBA pixels.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y, size);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SIZES = [
  [32, "32x32.png"],
  [128, "128x128.png"],
  [256, "128x128@2x.png"],
  [512, "icon.png"],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [size, name] of SIZES) {
  const file = join(OUT_DIR, name);
  writeFileSync(file, makePng(size));
  console.log(`wrote ${file} (${size}x${size})`);
}
