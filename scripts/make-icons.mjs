// One-off icon generator: renders the game-night mark (gold + teal tilted
// cards, "IYT" tag, suit dots) to the PNG sizes iOS and Android expect.
// "IYT" is drawn as strokes so rendering never depends on system fonts.
// Run: node scripts/make-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const icon = (pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#F7EEDB"/>
  <g transform="translate(512 512) scale(${1 - pad}) translate(-512 -512)">
    <rect x="250" y="190" width="400" height="400" rx="96" fill="#FFFDF6"
      stroke="#E2A93B" stroke-width="52" transform="rotate(-14 450 390)"/>
    <rect x="430" y="300" width="400" height="400" rx="96" fill="#FFFDF6"
      stroke="#1FA08C" stroke-width="52" transform="rotate(10 630 500)"/>
    <rect x="368" y="540" width="288" height="200" rx="52" fill="#FFFDF6"
      stroke="#E8DFC8" stroke-width="14"/>
    <g stroke="#1FA08C" stroke-width="22" stroke-linecap="round" fill="none">
      <path d="M 438 602 V 678"/>
      <path d="M 484 602 L 512 642 M 540 602 L 512 642 M 512 642 V 678"/>
      <path d="M 558 602 H 616 M 587 602 V 678"/>
    </g>
    <circle cx="422" cy="850" r="22" fill="#E2A93B"/>
    <circle cx="512" cy="850" r="22" fill="#1FA08C"/>
    <circle cx="602" cy="850" r="22" fill="#E2A93B"/>
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
