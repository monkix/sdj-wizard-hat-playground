/**
 * Downloads BGG thumbnail images to public/covers/{gameId}.jpg
 * Run automatically by GitHub Actions before the Vite build.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "covers");

const GAME_BGG_IDS = {
  "colt-express-2015":          "141534",
  "broom-service-2015":         "161082",
  "codenames-2016":             "178900",
  "isle-of-skye-2016":          "176494",
  "stone-age-junior-2016":      "171586",
  "kingdomino-2017":            "204583",
  "exit-das-spiel-2017":        "203416",
  "icecool-2017":               "212473",
  "azul-2018":                  "230802",
  "quacks-of-quedlinburg-2018": "244521",
  "just-one-2019":              "254640",
  "wingspan-2019":              "266192",
  "pictures-2020":              "284435",
  "die-crew-2020":              "284083",
  "micromacro-crime-city-2021": "318977",
  "paleo-2021":                 "300531",
  "cascadia-2022":              "295947",
  "living-forest-2022":         "330591",
  "dorfromantik-2023":          "370591",
  "challengers-2023":           "359970",
  "sky-team-2024":              "397291",
};

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(
      url,
      { headers: { "User-Agent": "sdj-wizard-hat-playground/1.0 (build)" } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      }
    );
    req.setTimeout(20000, () => { req.destroy(new Error("timeout")); });
    req.on("error", reject);
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function parseThumbnails(xml) {
  const result = {};
  const re = /<item[^>]+id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const tM = m[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/);
    if (tM) {
      const u = tM[1].trim();
      result[m[1]] = u.startsWith("//") ? `https:${u}` : u;
    }
  }
  return result;
}

// Fetch BGG thing XML for a comma-separated list of IDs, retrying until thumbnails appear.
async function fetchBGGThing(idsStr, label = idsStr) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${idsStr}&type=boardgame`;
  const waits = [5, 8, 12, 18, 25, 35]; // seconds between attempts

  for (let i = 0; i <= waits.length; i++) {
    const { body } = await get(url);
    const xml = body.toString("utf8");

    const thumbs = parseThumbnails(xml);
    if (Object.keys(thumbs).length > 0) return thumbs;

    if (i === 0) {
      // Log the raw response on first empty reply to help debug
      console.log(`    [debug] response preview: ${xml.substring(0, 200).replace(/\n/g, " ")}`);
    }

    if (i < waits.length) {
      console.log(`    attempt ${i + 1}: no thumbnails for ${label} — waiting ${waits[i]}s…`);
      await sleep(waits[i] * 1000);
    }
  }
  return {};
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const entries = Object.entries(GAME_BGG_IDS);
  const allBggIds = entries.map(([, id]) => id);

  console.log(`\nStep 1: batch-fetch all ${entries.length} games…`);
  let thumbByBggId = await fetchBGGThing(allBggIds.join(","), "batch");
  console.log(`  found ${Object.keys(thumbByBggId).length} thumbnails in batch response`);

  // For games not found in batch, try individual requests
  const missing = entries.filter(([, bggId]) => !thumbByBggId[bggId]);
  if (missing.length > 0) {
    console.log(`\nStep 2: individual requests for ${missing.length} missing games…`);
    for (const [gameId, bggId] of missing) {
      process.stdout.write(`  ${gameId}… `);
      const single = await fetchBGGThing(bggId, gameId);
      if (single[bggId]) {
        thumbByBggId[bggId] = single[bggId];
        console.log("found");
      } else {
        console.log("still empty");
      }
      await sleep(1500);
    }
  }

  console.log(`\nStep 3: downloading images…`);
  let ok = 0;
  let fail = 0;

  for (const [gameId, bggId] of entries) {
    const thumbUrl = thumbByBggId[bggId];
    if (!thumbUrl) {
      console.log(`  ⚠  ${gameId}: no thumbnail`);
      fail++;
      continue;
    }

    const dest = path.join(OUT_DIR, `${gameId}.jpg`);
    try {
      const { status, body } = await get(thumbUrl);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      await fs.writeFile(dest, body);
      console.log(`  ✓  ${gameId}  (${(body.length / 1024).toFixed(1)} KB)`);
      ok++;
    } catch (err) {
      console.log(`  ✗  ${gameId}: ${err.message}`);
      fail++;
    }
    await sleep(200);
  }

  console.log(`\nResult: ${ok} downloaded, ${fail} skipped/failed out of ${entries.length}`);
  if (ok === 0) {
    console.error("WARNING: No images were downloaded. Pages will show placeholders.");
    // Don't hard-fail the build — the site works without images (just shows placeholders)
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
