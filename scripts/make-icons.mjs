// One-off icon generator: renders the app glyph (paper field, ink turn-ring,
// clay dot) to the PNG sizes iOS and Android expect. Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const icon = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#F4F1EA"/>
  <g transform="translate(512 512) scale(${1 - pad}) translate(-512 -512)">
    <circle cx="512" cy="512" r="272" fill="none" stroke="#3A352E" stroke-width="56"
      stroke-dasharray="1280 432" stroke-linecap="round" transform="rotate(-60 512 512)"/>
    <circle cx="512" cy="512" r="88" fill="#BC6C4A"/>
  </g>
</svg>`;

mkdirSync("public", { recursive: true });

const out = [
  ["public/apple-touch-icon.png", 180, 0],
  ["public/icon-192.png", 192, 0],
  ["public/icon-512.png", 512, 0],
  ["public/icon-512-maskable.png", 512, 0.18], // shrink into the maskable safe zone
];

for (const [file, size, pad] of out) {
  await sharp(Buffer.from(icon(pad))).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
