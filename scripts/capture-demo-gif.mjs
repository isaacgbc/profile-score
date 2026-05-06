/**
 * Capture the LiveDemo animation as a high-quality GIF using Puppeteer + gif-encoder-2
 *
 * Usage: node scripts/capture-demo-gif.mjs
 *
 * Requires the standalone HTML to be served (python3 -m http.server 3334)
 * or it will launch its own server.
 */

import puppeteer from "puppeteer";
import GIFEncoder from "gif-encoder-2";
import { createWriteStream, readFileSync } from "fs";
import { createServer } from "http";
import { resolve, extname, dirname } from "path";
import { fileURLToPath } from "url";
import { PNG } from "pngjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ──────────────────────────────────────────────────────────────
const WIDTH = 640;          // viewport px
const HEIGHT = 640;         // viewport px (tall enough for all stages)
const STAGE_DURATION = 3500; // ms per stage (matches animation)
const NUM_STAGES = 4;
const FPS = 12;             // frames per second in GIF
const QUALITY = 10;         // GIF quality (1=best, 20=worst)
const FRAME_INTERVAL = Math.round(1000 / FPS); // ~83 ms

const HTML_PATH = resolve(__dirname, "demo-animation.html");
const OUTPUT_PATH = resolve(__dirname, "..", "demo-animation.gif");

// ── Tiny static server (so Puppeteer can load the HTML over HTTP) ─────
function startServer(port) {
  return new Promise((ok) => {
    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
    };
    const srv = createServer((req, res) => {
      const filePath = resolve(__dirname, req.url === "/" ? "demo-animation.html" : req.url.slice(1));
      try {
        const data = readFileSync(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    srv.listen(port, () => ok(srv));
  });
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  console.log("🎬 Starting GIF capture of LiveDemo animation…");

  // Launch a local server
  const PORT = 4444;
  const server = await startServer(PORT);
  console.log(`  Server listening on http://localhost:${PORT}`);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${WIDTH},${HEIGHT}`,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",        // smoother text
      "--disable-lcd-text",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 }); // 2× for retina quality

  console.log("  Loading animation page…");
  await page.goto(`http://localhost:${PORT}/demo-animation.html`, { waitUntil: "networkidle0" });

  // Wait a beat for fonts to load
  await page.waitForFunction(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1000));

  // Reset animation to stage 0 by calling global reset function
  await page.evaluate(() => {
    if (typeof window.resetAnimation === "function") window.resetAnimation();
  });
  await new Promise((r) => setTimeout(r, 300));

  // ── Capture frames ──────────────────────────────────────────────────
  const totalDuration = STAGE_DURATION * NUM_STAGES; // one full cycle
  const totalFrames = Math.ceil(totalDuration / FRAME_INTERVAL);

  console.log(`  Capturing ${totalFrames} frames at ${FPS} fps (${(totalDuration / 1000).toFixed(1)}s cycle)…`);

  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    const buf = await page.screenshot({ type: "png", fullPage: false });
    frames.push(buf);

    if (i < totalFrames - 1) {
      await new Promise((r) => setTimeout(r, FRAME_INTERVAL));
    }

    // Progress indicator
    if ((i + 1) % FPS === 0 || i === totalFrames - 1) {
      const pct = Math.round(((i + 1) / totalFrames) * 100);
      process.stdout.write(`\r  Captured ${i + 1}/${totalFrames} frames (${pct}%)`);
    }
  }
  console.log("");

  await browser.close();
  server.close();

  // ── Encode GIF ──────────────────────────────────────────────────────
  console.log("  Encoding GIF…");

  // Decode first PNG to get actual pixel dimensions (may be 2× due to deviceScaleFactor)
  const firstPng = PNG.sync.read(frames[0]);
  const gifW = firstPng.width;
  const gifH = firstPng.height;

  console.log(`  GIF dimensions: ${gifW}×${gifH}`);

  const encoder = new GIFEncoder(gifW, gifH, "neuquant", true); // useOptimiser = true
  encoder.setDelay(FRAME_INTERVAL);
  encoder.setQuality(QUALITY);
  encoder.setRepeat(0); // loop forever

  const outStream = createWriteStream(OUTPUT_PATH);
  encoder.createReadStream().pipe(outStream);

  encoder.start();

  for (let i = 0; i < frames.length; i++) {
    const png = PNG.sync.read(frames[i]);
    // GIFEncoder expects raw RGBA pixel data
    encoder.addFrame(png.data);

    if ((i + 1) % FPS === 0 || i === frames.length - 1) {
      const pct = Math.round(((i + 1) / frames.length) * 100);
      process.stdout.write(`\r  Encoding frame ${i + 1}/${frames.length} (${pct}%)`);
    }
  }

  encoder.finish();
  console.log("");

  // Wait for stream to finish writing
  await new Promise((ok) => outStream.on("finish", ok));

  const { statSync } = await import("fs");
  const stat = statSync(OUTPUT_PATH);
  const sizeMB = (stat.size / (1024 * 1024)).toFixed(1);

  console.log(`\n✅ GIF saved to: ${OUTPUT_PATH}`);
  console.log(`   Size: ${sizeMB} MB | Dimensions: ${gifW}×${gifH} | Frames: ${frames.length}`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
