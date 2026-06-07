/**
 * Downloads BGG thumbnail images to public/covers/{gameId}.jpg
 * Run automatically by GitHub Actions before the Vite build.
 *
 * Uses only Node.js built-ins — no npm install needed.
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
    mod
      .get(url, { headers: { "User-Agent": "sdj-wizard-hat-playground/1.0 (build script)" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const ids = Object.values(GAME_BGG_IDS).join(",");
  console.log(`Fetching BGG data for ${Object.keys(GAME_BGG_IDS).length} games (batch)…`);

  let { body: xmlBuf } = await get(
    `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&type=boardgame`
  );
  let xml = xmlBuf.toString("utf8");

  if (!xml.includes("<thumbnail>")) {
    console.log("BGG queued the request — waiting 5 s then retrying…");
    await sleep(5000);
    ({ body: xmlBuf } = await get(
      `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&type=boardgame`
    ));
    xml = xmlBuf.toString("utf8");
  }

  // Parse bggId → thumbnail URL
  const thumbByBggId = {};
  const itemRe = /<item[^>]+id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const bggId = m[1];
    const tM = m[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/);
    if (tM) {
      const u = tM[1].trim();
      thumbByBggId[bggId] = u.startsWith("//") ? `https:${u}` : u;
    }
  }

  console.log(`Found thumbnails for ${Object.keys(thumbByBggId).length} of ${Object.keys(GAME_BGG_IDS).length} games\n`);

  let ok = 0;
  let fail = 0;

  for (const [gameId, bggId] of Object.entries(GAME_BGG_IDS)) {
    const thumbUrl = thumbByBggId[bggId];
    if (!thumbUrl) {
      console.log(`  ⚠  ${gameId}: no thumbnail in response`);
      fail++;
      continue;
    }

    const dest = path.join(OUT_DIR, `${gameId}.jpg`);
    try {
      const { status, body } = await get(thumbUrl);
      if (status !== 200) throw new Error(`HTTP ${status}`);
      await fs.writeFile(dest, body);
      const kb = (body.length / 1024).toFixed(1);
      console.log(`  ✓  ${gameId}  (${kb} KB)`);
      ok++;
    } catch (err) {
      console.log(`  ✗  ${gameId}: ${err.message}`);
      fail++;
    }

    await sleep(250); // be polite to BGG CDN
  }

  console.log(`\nDone: ${ok} downloaded, ${fail} skipped/failed`);

  if (ok === 0) {
    console.error("No images downloaded — build will continue with placeholders.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
