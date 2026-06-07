/**
 * Fetches board game thumbnail URLs from BoardGameGeek XML API2
 * and outputs a mapping to be pasted into games.js
 *
 * Usage: node scripts/fetch-bgg-images.mjs
 */

import https from "node:https";

const GAMES = [
  { id: "colt-express-2015", title: "Colt Express", year: 2015 },
  { id: "broom-service-2015", title: "Broom Service", year: 2015 },
  { id: "spinderella-2015", title: "Spinderella", year: 2015 },
  { id: "codenames-2016", title: "Codenames", year: 2016 },
  { id: "isle-of-skye-2016", title: "Isle of Skye", year: 2016 },
  { id: "stone-age-junior-2016", title: "Stone Age Junior", year: 2016 },
  { id: "kingdomino-2017", title: "Kingdomino", year: 2017 },
  { id: "exit-das-spiel-2017", title: "EXIT: Das Spiel", year: 2017 },
  { id: "icecool-2017", title: "ICECOOL", year: 2017 },
  { id: "azul-2018", title: "Azul", year: 2018 },
  { id: "quacks-of-quedlinburg-2018", title: "The Quacks of Quedlinburg", year: 2018 },
  { id: "funkelschatz-2018", title: "Funkelschatz", year: 2018 },
  { id: "just-one-2019", title: "Just One", year: 2019 },
  { id: "wingspan-2019", title: "Wingspan", year: 2019 },
  { id: "tal-der-wikinger-2019", title: "Tal der Wikinger", year: 2019 },
  { id: "pictures-2020", title: "Pictures", year: 2020 },
  { id: "die-crew-2020", title: "The Crew", year: 2020 },
  { id: "speedy-roll-2020", title: "Speedy Roll", year: 2020 },
  { id: "micromacro-crime-city-2021", title: "MicroMacro: Crime City", year: 2021 },
  { id: "paleo-2021", title: "Paleo", year: 2021 },
  { id: "dragomino-2021", title: "Dragomino", year: 2021 },
  { id: "cascadia-2022", title: "Cascadia", year: 2022 },
  { id: "living-forest-2022", title: "Living Forest", year: 2022 },
  { id: "zauberberg-2022", title: "Zauberberg", year: 2022 },
  { id: "dorfromantik-2023", title: "Dorfromantik", year: 2023 },
  { id: "challengers-2023", title: "Challengers!", year: 2023 },
  { id: "mysterium-kids-2023", title: "Mysterium Kids: Poirot´s Apprentice", year: 2023 },
  { id: "sky-team-2024", title: "Sky Team", year: 2024 },
  { id: "e-mission-daybreak-2024", title: "Daybreak", year: 2024 },
  { id: "die-magischen-schlussel-2024", title: "Die magischen Schlüssel", year: 2024 },
  { id: "bomb-busters-2025", title: "Bomb Busters", year: 2025 },
  { id: "endeavor-deep-sea-2025", title: "Endeavor: Deep Sea", year: 2025 },
  { id: "topp-die-torte-2025", title: "Topp die Torte", year: 2025 },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "Accept-Encoding": "identity" } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return fetchUrl(res.headers.location).then(resolve).catch(reject);
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

async function searchBGG(title, year) {
  const query = encodeURIComponent(title);
  const url = `https://boardgamegeek.com/xmlapi2/search?query=${query}&type=boardgame`;
  const xml = await fetchUrl(url);

  // Find items — pick the one matching year if available
  const itemRe = /<item[^>]+id="(\d+)"[\s\S]*?<\/item>/gi;
  let match;
  const candidates = [];
  while ((match = itemRe.exec(xml)) !== null) {
    const bggId = match[1];
    const block = match[0];
    const yearPub = extractAttr(block, "yearpublished", "value");
    const name = extractAttr(block, "name", "value") || extractTag(block, "name");
    candidates.push({ bggId, yearPub, name });
  }

  if (candidates.length === 0) return null;

  // Prefer exact year match
  const byYear = candidates.find((c) => c.yearPub === String(year));
  return byYear ? byYear.bggId : candidates[0].bggId;
}

async function getGameDetails(bggId) {
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${bggId}&type=boardgame`;
  const xml = await fetchUrl(url);

  // BGG sometimes returns 202 Accepted with empty body — retry once
  if (!xml.includes("<thumbnail>") && !xml.includes("<image>")) {
    await sleep(3000);
    const xml2 = await fetchUrl(url);
    return {
      thumbnail: extractTag(xml2, "thumbnail"),
      image: extractTag(xml2, "image"),
    };
  }

  return {
    thumbnail: extractTag(xml, "thumbnail"),
    image: extractTag(xml, "image"),
  };
}

async function main() {
  const results = [];

  for (const game of GAMES) {
    try {
      process.stdout.write(`Searching: ${game.title} (${game.year})... `);
      const bggId = await searchBGG(game.title, game.year);
      if (!bggId) {
        console.log("NOT FOUND");
        results.push({ ...game, bggId: null, thumbnail: null, image: null });
        continue;
      }
      console.log(`BGG ID: ${bggId}`);

      await sleep(1200); // be polite to BGG API
      const details = await getGameDetails(bggId);
      console.log(`  thumbnail: ${details.thumbnail}`);

      results.push({
        ...game,
        bggId,
        thumbnail: details.thumbnail ? `https:${details.thumbnail}` : null,
        image: details.image ? `https:${details.image}` : null,
      });

      await sleep(1200);
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({ ...game, bggId: null, thumbnail: null, image: null });
    }
  }

  console.log("\n\n=== RESULTS (copy into games.js) ===\n");
  console.log("const bggImageMap = {");
  for (const r of results) {
    if (r.thumbnail) {
      console.log(`  "${r.id}": { bggId: "${r.bggId}", thumbnail: "${r.thumbnail}", image: "${r.image}" },`);
    } else {
      console.log(`  "${r.id}": null, // not found`);
    }
  }
  console.log("};");
}

main().catch(console.error);
