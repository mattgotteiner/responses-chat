/**
 * Generates all PWA/favicon icon files for the app.
 * Run with: node scripts/generate-icons.mjs
 *
 * Outputs:
 *   public/apple-touch-icon.png  (180x180, RGB)
 *   public/icon-192.png          (192x192, RGB)
 *   public/icon-512.png          (512x512, RGB)
 *   public/favicon.ico           (16x16 + 32x32 + 48x48, RGB PNGs in ICO)
 */

import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const BG_COLOR = '#0066cc';

/**
 * Draw a chat bubble icon on a canvas of given size.
 * The design: rounded-rectangle speech bubble with a small tail at bottom-left,
 * and three horizontal "dots" (message lines) inside.
 */
function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const pad = size * 0.1;
  const bubbleW = size - pad * 2;
  const bubbleH = size * 0.65;
  const bubbleX = pad;
  const bubbleY = pad * 0.8;
  const radius = size * 0.14;
  const tailSize = size * 0.16;

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Speech bubble body (rounded rectangle)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(bubbleX + radius, bubbleY);
  ctx.lineTo(bubbleX + bubbleW - radius, bubbleY);
  ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY, bubbleX + bubbleW, bubbleY + radius);
  ctx.lineTo(bubbleX + bubbleW, bubbleY + bubbleH - radius);
  ctx.quadraticCurveTo(bubbleX + bubbleW, bubbleY + bubbleH, bubbleX + bubbleW - radius, bubbleY + bubbleH);
  // Tail: notch at bottom-left going down; left base snapped to corner start to avoid gap
  ctx.lineTo(bubbleX + tailSize * 2, bubbleY + bubbleH);
  ctx.lineTo(bubbleX + tailSize * 0.5, bubbleY + bubbleH + tailSize);
  ctx.lineTo(bubbleX + radius, bubbleY + bubbleH);
  ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleH, bubbleX, bubbleY + bubbleH - radius);
  ctx.lineTo(bubbleX, bubbleY + radius);
  ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
  ctx.closePath();
  ctx.fill();

  // Three message lines inside the bubble
  if (size >= 32) {
    const lineColor = BG_COLOR;
    const lineH = Math.max(2, size * 0.055);
    const lineRadius = lineH / 2;
    const lineX = bubbleX + size * 0.12;
    const lineMaxW = bubbleW - size * 0.24;
    const lineY1 = bubbleY + bubbleH * 0.22;
    const lineY2 = bubbleY + bubbleH * 0.46;
    const lineY3 = bubbleY + bubbleH * 0.70;

    ctx.fillStyle = lineColor;

    // Line 1 (full width)
    roundRect(ctx, lineX, lineY1, lineMaxW, lineH, lineRadius);
    ctx.fill();

    // Line 2 (full width)
    roundRect(ctx, lineX, lineY2, lineMaxW, lineH, lineRadius);
    ctx.fill();

    // Line 3 (shorter)
    roundRect(ctx, lineX, lineY3, lineMaxW * 0.6, lineH, lineRadius);
    ctx.fill();
  }

  return canvas;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ------------------------------------------------------------
// CRC32 for PNG chunks
// ------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

/**
 * Convert a canvas to a solid RGB PNG Buffer (no alpha channel).
 * Reads BGRA raw pixels from canvas, converts to RGB filter-0 rows, deflates, packs as PNG.
 */
function toRgbPng(sourceCanvas) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  // node-canvas raw format is BGRA
  const bgra = sourceCanvas.toBuffer('raw');

  // Build filter-0 rows: [0x00, R, G, B, R, G, B, ...]
  const rowSize = 1 + w * 3;
  const rowData = Buffer.alloc(h * rowSize);
  for (let y = 0; y < h; y++) {
    rowData[y * rowSize] = 0; // filter type None
    for (let x = 0; x < w; x++) {
      const srcOff = (y * w + x) * 4; // BGRA
      const dstOff = y * rowSize + 1 + x * 3;
      rowData[dstOff + 0] = bgra[srcOff + 2]; // R (from B G R A -> R G B)
      rowData[dstOff + 1] = bgra[srcOff + 1]; // G
      rowData[dstOff + 2] = bgra[srcOff + 0]; // B
    }
  }

  const idatData = deflateSync(rowData, { level: 9 });

  // IHDR: width(4) height(4) bitDepth(1) colorType(1=grayscale,2=RGB,3=indexed,4=GA,6=RGBA)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idatData),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Generate PNG icons
const sizes = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

for (const { file, size } of sizes) {
  const canvas = drawIcon(size);
  const buf = toRgbPng(canvas);
  const outPath = join(publicDir, file);
  writeFileSync(outPath, buf);
  console.log(`✓ ${file} (${buf.length} bytes)`);
}

// Generate favicon.ico (16, 32, 48 px images packed into ICO)
const icoSizes = [16, 32, 48];
const pngBuffers = icoSizes.map(size => toRgbPng(drawIcon(size)));

// Build ICO file format
// Header: 6 bytes
// Directory entries: count * 16 bytes
// Image data: sum of all PNG buffers

const HEADER_SIZE = 6;
const DIR_ENTRY_SIZE = 16;
const dirOffset = HEADER_SIZE + icoSizes.length * DIR_ENTRY_SIZE;

let dataOffset = dirOffset;
const dirEntries = pngBuffers.map((buf, i) => {
  const size = icoSizes[i];
  const entry = { size, buf, offset: dataOffset };
  dataOffset += buf.length;
  return entry;
});

const totalSize = dataOffset;
const ico = Buffer.alloc(totalSize);

// ICO header
ico.writeUInt16LE(0, 0);        // reserved
ico.writeUInt16LE(1, 2);        // type = ICO
ico.writeUInt16LE(icoSizes.length, 4); // image count

// Directory entries
dirEntries.forEach(({ size, buf, offset }, i) => {
  const base = HEADER_SIZE + i * DIR_ENTRY_SIZE;
  ico[base + 0] = size === 256 ? 0 : size; // width (0 = 256)
  ico[base + 1] = size === 256 ? 0 : size; // height
  ico[base + 2] = 0;   // color count
  ico[base + 3] = 0;   // reserved
  ico.writeUInt16LE(1, base + 4);            // planes
  ico.writeUInt16LE(32, base + 6);           // bits per pixel
  ico.writeUInt32LE(buf.length, base + 8);   // data size
  ico.writeUInt32LE(offset, base + 12);      // data offset
});

// Image data
dirEntries.forEach(({ buf, offset }) => {
  buf.copy(ico, offset);
});

const icoPath = join(publicDir, 'favicon.ico');
writeFileSync(icoPath, ico);
console.log(`✓ favicon.ico (${ico.length} bytes, ${icoSizes.join('+')}px)`);
