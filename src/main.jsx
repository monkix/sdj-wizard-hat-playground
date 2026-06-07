import React, { useContext, useDeferredValue, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Award,
  BookOpen,
  ChevronRight,
  CircleDot,
  ExternalLink,
  FlaskConical,
  Gamepad2,
  GalleryHorizontalEnd,
  Layers3,
  MessageCircle,
  MousePointer2,
  Puzzle,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";
import { awardLanes, coreMechanicFilters, games, tasteMechanicFilters, years } from "./data/games";
import "./styles.css";

const defaultGameId = "sky-team-2024";

// ---- BGG image fetching ----

const BGGContext = React.createContext({});
// v3: batch-fetch strategy (pre-populated BGG IDs → single request)
const BGG_CACHE_KEY = "bgg-thumbnails-v3";

// BGG XML API2 lacks CORS headers; route through a public proxy.
const BGG_PROXY = "https://api.allorigins.win/raw?url=";

function bggFetch(url) {
  return fetch(BGG_PROXY + encodeURIComponent(url)).then((r) => {
    if (!r.ok) throw new Error(`proxy ${r.status}`);
    return r.text();
  });
}

// Parse every <item> in a BGG thing response → { bggId: thumbnailUrl }
function parseBGGThingXml(xml) {
  const result = {};
  const itemRe = /<item[^>]+id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const bggId = m[1];
    const thumbM = m[2].match(/<thumbnail>([\s\S]*?)<\/thumbnail>/);
    if (thumbM) {
      const u = thumbM[1].trim();
      result[bggId] = u.startsWith("//") ? `https:${u}` : u;
    }
  }
  return result;
}

// Fetch thumbnails for a list of known BGG IDs in one request.
async function batchFetchByBggIds(idPairs) {
  // idPairs: [{ gameId, bggId }]
  const ids = idPairs.map((p) => p.bggId).join(",");
  const url = `https://boardgamegeek.com/xmlapi2/thing?id=${ids}&type=boardgame`;
  let xml = await bggFetch(url);

  // BGG sometimes queues the request; retry once after a short wait
  if (!xml.includes("<thumbnail>")) {
    await new Promise((r) => setTimeout(r, 3500));
    xml = await bggFetch(url);
  }

  const byBggId = parseBGGThingXml(xml);
  const result = {};
  for (const { gameId, bggId } of idPairs) {
    result[gameId] = byBggId[bggId] || "";
  }
  return result;
}

// Search BGG by title, then fetch thumbnail from the best-matching result.
async function searchAndFetch(game) {
  const q = encodeURIComponent((game.bggQuery || game.title).replace(/ \/ /g, " "));
  const searchXml = await bggFetch(`https://boardgamegeek.com/xmlapi2/search?query=${q}&type=boardgame`);

  const itemRe = /<item[^>]+id="(\d+)"[^>]*>([\s\S]*?)<\/item>/g;
  const candidates = [];
  let m;
  while ((m = itemRe.exec(searchXml)) !== null) {
    const yearM = m[2].match(/yearpublished[^>]+value="(\d+)"/);
    candidates.push({ id: m[1], yearPub: yearM ? parseInt(yearM[1]) : 0 });
  }
  if (!candidates.length) return "";

  const best = candidates.find((c) => c.yearPub === game.year) || candidates[0];

  await new Promise((r) => setTimeout(r, 800));

  let thingXml = await bggFetch(`https://boardgamegeek.com/xmlapi2/thing?id=${best.id}&type=boardgame`);
  if (!thingXml.includes("<thumbnail>")) {
    await new Promise((r) => setTimeout(r, 3000));
    thingXml = await bggFetch(`https://boardgamegeek.com/xmlapi2/thing?id=${best.id}&type=boardgame`);
  }

  const byId = parseBGGThingXml(thingXml);
  return byId[best.id] || "";
}

function useBGGThumbnails(games) {
  const [thumbnails, setThumbnails] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(BGG_CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (fetchingRef.current) return;
    const missing = games.filter((g) => !(g.id in thumbnails));
    if (!missing.length) return;

    fetchingRef.current = true;
    let cancelled = false;

    (async () => {
      // Phase 1: batch-fetch all games with pre-populated BGG IDs (1 request)
      const withId = missing.filter((g) => g.bggId).map((g) => ({ gameId: g.id, bggId: g.bggId }));
      if (withId.length && !cancelled) {
        try {
          const batch = await batchFetchByBggIds(withId);
          if (!cancelled) {
            setThumbnails((prev) => {
              const next = { ...prev, ...batch };
              try { localStorage.setItem(BGG_CACHE_KEY, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        } catch {
          // mark as empty so they don't retry on next render
          if (!cancelled) {
            setThumbnails((prev) => {
              const next = { ...prev };
              for (const { gameId } of withId) next[gameId] = "";
              return next;
            });
          }
        }
      }

      // Phase 2: search for remaining games (no pre-populated ID), 2 at a time
      const withoutId = missing.filter((g) => !g.bggId);
      for (let i = 0; i < withoutId.length && !cancelled; i += 2) {
        const slice = withoutId.slice(i, i + 2);
        await Promise.all(
          slice.map(async (game) => {
            try {
              const thumb = await searchAndFetch(game);
              if (!cancelled) {
                setThumbnails((prev) => {
                  const next = { ...prev, [game.id]: thumb };
                  try { localStorage.setItem(BGG_CACHE_KEY, JSON.stringify(next)); } catch {}
                  return next;
                });
              }
            } catch {
              if (!cancelled) setThumbnails((prev) => ({ ...prev, [game.id]: "" }));
            }
          })
        );
        if (!cancelled && i + 2 < withoutId.length) await new Promise((r) => setTimeout(r, 1000));
      }

      fetchingRef.current = false;
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return thumbnails;
}
const wizardHatUrl = "https://wizardsoflearning.com/wizards-hat-board-game-design-tools/";
const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const modules = [
  { id: "explore", title: "Award Explorer", shortTitle: "Explore", status: "Active", icon: Award, text: "Timeline, award lanes, and game analysis." },
  { id: "gallery", title: "Game Box Gallery", shortTitle: "Gallery", status: "New", icon: GalleryHorizontalEnd, text: "All winners as a visual cover wall." },
  { id: "lab", title: "Wizard Hat Lab", shortTitle: "Lab", status: "Beta", icon: FlaskConical, text: "Sort CORE/TASTE cards by real award patterns." },
  { id: "challenge", title: "Design Challenge", shortTitle: "Challenge", status: "Next", icon: Gamepad2, text: "Turn a winner pattern into a new design prompt." },
];

function App() {
  const bggThumbnails = useBGGThumbnails(games);
  const [activeModule, setActiveModule] = useState("explore");
  const [selectedGameId, setSelectedGameId] = useState(defaultGameId);
  const [selectedLane, setSelectedLane] = useState("all");
  const [selectedMechanic, setSelectedMechanic] = useState("all");
  const [mechanicSort, setMechanicSort] = useState("frequent");
  const [selectedYear, setSelectedYear] = useState("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const allMechanicFilters = [...coreMechanicFilters, ...tasteMechanicFilters];

  const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0];
  const visibleGames = games.filter((game) => {
    const matchesLane = selectedLane === "all" || game.lane === selectedLane;
    const matchesYear = selectedYear === "all" || game.year === Number(selectedYear);
    const selectedMechanicCard = allMechanicFilters.find((filter) => filter.id === selectedMechanic);
    const matchesMechanic = selectedMechanic === "all" || gameMatchesMechanic(game, selectedMechanicCard);
    const searchText = [
      game.title,
      game.year,
      game.verb,
      game.tableMoment,
      game.core.conflict,
      game.core.order,
      game.core.win,
      game.core.end,
      game.taste.map((taste) => taste.name).join(" "),
    ].join(" ").toLowerCase();
    const matchesQuery = searchText.includes(deferredQuery.trim().toLowerCase());
    return matchesLane && matchesYear && matchesMechanic && matchesQuery;
  });

  const selectedFilter = allMechanicFilters.find((filter) => filter.id === selectedMechanic);
  const countedCoreFilters = sortMechanics(coreMechanicFilters.map((filter) => ({ ...filter, count: countMechanicMatches(filter) })), mechanicSort);
  const countedTasteFilters = sortMechanics(tasteMechanicFilters.map((filter) => ({ ...filter, count: countMechanicMatches(filter) })), mechanicSort);

  function countMechanicMatches(filter) {
    return games.filter((game) => gameMatchesMechanic(game, filter)).length;
  }

  function resetView() {
    setSelectedMechanic("all");
    setSelectedLane("all");
    setSelectedYear("all");
    setQuery("");
  }

  function selectGame(gameId, nextModule = activeModule) {
    setSelectedGameId(gameId);
    setActiveModule(nextModule);
  }

  return (
    <BGGContext.Provider value={bggThumbnails}>
    <div className="app-shell">
      <main className="workspace">
        <SiteHeader activeModule={activeModule} onModuleChange={setActiveModule} />
        <Hero
          query={query}
          selectedYear={selectedYear}
          onQueryChange={setQuery}
          onYearChange={setSelectedYear}
          onModuleChange={setActiveModule}
        />

        <ModuleStrip activeModule={activeModule} onModuleChange={setActiveModule} />
        <FilterBar
          selectedLane={selectedLane}
          selectedFilter={selectedFilter}
          visibleCount={visibleGames.length}
          onLaneChange={setSelectedLane}
        />

        {activeModule === "explore" && (
          <ExplorerView
            visibleGames={visibleGames}
            selectedGame={selectedGame}
            selectedGameId={selectedGameId}
            onSelectGame={(gameId) => selectGame(gameId, "explore")}
            onReset={resetView}
          />
        )}

        {activeModule === "gallery" && (
          <GalleryView
            visibleGames={visibleGames}
            selectedGame={selectedGame}
            selectedGameId={selectedGameId}
            onSelectGame={(gameId) => selectGame(gameId, "gallery")}
            onReset={resetView}
          />
        )}

        {activeModule === "lab" && (
          <LabView
            selectedMechanic={selectedMechanic}
            mechanicSort={mechanicSort}
            countedCoreFilters={countedCoreFilters}
            countedTasteFilters={countedTasteFilters}
            onSelectMechanic={setSelectedMechanic}
            onSortChange={setMechanicSort}
          />
        )}

        {activeModule === "challenge" && <ChallengeView game={selectedGame} onModuleChange={setActiveModule} />}

        {activeModule !== "lab" && (
          <PatternPreview
            selectedMechanic={selectedMechanic}
            mechanicSort={mechanicSort}
            countedCoreFilters={countedCoreFilters}
            countedTasteFilters={countedTasteFilters}
            onSelectMechanic={setSelectedMechanic}
            onSortChange={setMechanicSort}
            onOpenLab={() => setActiveModule("lab")}
          />
        )}

        <SourceFooter />
      </main>
    </div>
    </BGGContext.Provider>
  );
}

function SiteHeader({ activeModule, onModuleChange }) {
  return (
    <nav className="site-header" aria-label="Playground navigation">
      <button className="site-brand" type="button" onClick={() => onModuleChange("explore")}>
        <img src={assetPath("brand/wol-logo.png")} alt="Wizards of Learning" />
        <div>
          <span>Wizards of Learning</span>
          <strong>Game Design Lab</strong>
        </div>
      </button>
      <div className="site-links">
        {modules.map((module) => (
          <button key={module.id} className={activeModule === module.id ? "active" : ""} type="button" onClick={() => onModuleChange(module.id)}>
            {module.shortTitle}
          </button>
        ))}
        <a href={wizardHatUrl} target="_blank" rel="noreferrer">
          Wizard Hat <ExternalLink size={14} />
        </a>
      </div>
    </nav>
  );
}

function Hero({ query, selectedYear, onQueryChange, onYearChange, onModuleChange }) {
  return (
    <header className="hero-section">
      <div className="hero-copy">
        <span className="hero-mark">Spiel des Jahres x Wizard Hat</span>
        <h1>อ่านเกมรางวัลโลก แล้วต่อยอดเป็นไอเดียเกมของเรา</h1>
        <p>
          Interactive explorer สำหรับดู pattern ของเกมที่ชนะ Spiel, Kenner และ Kinder ผ่าน MAGIC Star, CORE/TASTE และการ์ด Wizard Hat.
        </p>
        <div className="hero-actions">
          <button type="button" onClick={() => onModuleChange("gallery")}>
            ดูกล่องเกมทั้งหมด
          </button>
          <a href={wizardHatUrl} target="_blank" rel="noreferrer">
            ไปหน้า Wizard Hat <ExternalLink size={16} />
          </a>
        </div>
      </div>
      <HeroVisual />
      <div className="topbar-actions">
        <div className="search-box">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search game, mechanic, moment"
            aria-label="Search games"
          />
        </div>
        <select value={selectedYear} onChange={(event) => onYearChange(event.target.value)} aria-label="Filter by year">
          <option value="all">All years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hero-card hero-card-left">
        <img src={assetPath("wizard-cards/card-027.png")} alt="" />
      </div>
      <div className="hero-card hero-card-main">
        <img src={assetPath("wizard-cards/card-087.png")} alt="" />
      </div>
      <div className="hero-card hero-card-right">
        <img src={assetPath("wizard-cards/card-041.png")} alt="" />
      </div>
      <span className="hero-token core-token">CORE</span>
      <span className="hero-token taste-token">TASTE</span>
    </div>
  );
}

function ModuleStrip({ activeModule, onModuleChange }) {
  return (
    <section className="mode-strip" aria-label="Playground modules">
      {modules.map((module) => (
        <ModeCard key={module.id} module={module} active={activeModule === module.id} onClick={() => onModuleChange(module.id)} />
      ))}
    </section>
  );
}

function ModeCard({ module, active, onClick }) {
  const Icon = module.icon;
  return (
    <button className={`mode-card ${active ? "active" : ""}`} type="button" onClick={onClick}>
      <div className="mode-icon">
        <Icon size={20} />
      </div>
      <div>
        <div className="mode-title">
          <h3>{module.title}</h3>
          <span>{module.status}</span>
        </div>
        <p>{module.text}</p>
      </div>
    </button>
  );
}

function FilterBar({ selectedLane, selectedFilter, visibleCount, onLaneChange }) {
  return (
    <section className="control-band">
      <div className="segment-group" aria-label="Award category">
        <button className={selectedLane === "all" ? "selected" : ""} type="button" onClick={() => onLaneChange("all")}>
          All awards
        </button>
        {awardLanes.map((lane) => (
          <button key={lane.id} className={selectedLane === lane.id ? "selected" : ""} type="button" onClick={() => onLaneChange(lane.id)}>
            {lane.label}
          </button>
        ))}
      </div>
      <div className="result-meter">
        <Sparkles size={16} />
        <span>{visibleCount} games in view</span>
        {selectedFilter && <strong>{selectedFilter.label}</strong>}
      </div>
    </section>
  );
}

function ExplorerView({ visibleGames, selectedGame, selectedGameId, onSelectGame, onReset }) {
  return (
    <div className="main-grid" id="explore">
      <section className="explorer-panel" aria-label="Award timeline">
        <div className="section-heading">
          <div>
            <h2>2015-2025 Winner Timeline</h2>
            <p>Three award lanes, one shared mechanic vocabulary.</p>
          </div>
          <button className="ghost-button" type="button" onClick={onReset}>
            Reset view
          </button>
        </div>
        <div className="timeline-frame">
          <Timeline visibleGames={visibleGames} selectedGameId={selectedGameId} onSelectGame={onSelectGame} />
        </div>
      </section>
      <GameDetail game={selectedGame} />
    </div>
  );
}

function Timeline({ visibleGames, selectedGameId, onSelectGame }) {
  return (
    <div className="timeline">
      <div className="year-row" aria-hidden="true">
        <span />
        {years.map((year) => (
          <strong key={year}>{year}</strong>
        ))}
      </div>
      {awardLanes.map((lane) => (
        <div key={lane.id} className="lane-row">
          <div className={`lane-label ${lane.tone}`}>
            <span>{lane.label}</span>
            <small>{lane.fullName}</small>
          </div>
          {years.map((year) => {
            const game = visibleGames.find((item) => item.year === year && item.lane === lane.id);
            return game ? (
              <button
                key={game.id}
                className={`game-tile ${lane.tone} ${selectedGameId === game.id ? "selected" : ""}`}
                type="button"
                onClick={() => onSelectGame(game.id)}
              >
                <GameBoxArt game={game} compact />
                <span>{game.title}</span>
                <em>{game.verb}</em>
              </button>
            ) : (
              <div key={`${lane.id}-${year}`} className="empty-tile" />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function GalleryView({ visibleGames, selectedGame, selectedGameId, onSelectGame, onReset }) {
  return (
    <div className="gallery-layout" id="gallery">
      <section className="gallery-panel" aria-label="Award game box gallery">
        <div className="section-heading">
          <div>
            <h2>Game Box Gallery</h2>
            <p>หน้ารวมกล่องเกมรางวัลทุกเกม ใช้ดูภาพรวมก่อนเข้า pattern analysis.</p>
          </div>
          <button className="ghost-button" type="button" onClick={onReset}>
            Reset view
          </button>
        </div>
        <div className="box-gallery-grid">
          {visibleGames.map((game) => (
            <button
              key={game.id}
              className={`box-gallery-card ${selectedGameId === game.id ? "selected" : ""}`}
              type="button"
              onClick={() => onSelectGame(game.id)}
            >
              <AwardBadge game={game} />
              <GameBoxArt game={game} />
              <div className="box-gallery-copy">
                <span>{game.year}</span>
                <strong>{game.title}</strong>
                <em>{game.tableMoment}</em>
              </div>
              <CoverStatus game={game} />
            </button>
          ))}
        </div>
      </section>
      <GameDetail game={selectedGame} />
    </div>
  );
}

function GameBoxArt({ game, compact = false }) {
  const thumbnails = useContext(BGGContext);
  const coverImage = game.coverImage || thumbnails[game.id] || "";
  const isLoading = !(game.id in thumbnails) && !game.coverImage;

  if (coverImage) {
    return (
      <div className={`game-box-art ${compact ? "compact" : ""}`}>
        <img src={coverImage} alt={`${game.title} box cover`} loading="lazy" />
      </div>
    );
  }

  const Icon = getVerbIcon(game);
  return (
    <div className={`game-box-art pending ${isLoading ? "loading" : ""} ${compact ? "compact" : ""} lane-${game.lane}`}>
      <Icon size={compact ? 17 : 32} />
      {!compact && (
        <>
          <strong>{game.title}</strong>
          <span>{isLoading ? "กำลังโหลดรูป…" : "ไม่พบรูป"}</span>
        </>
      )}
    </div>
  );
}

function AwardBadge({ game }) {
  const lane = awardLanes.find((item) => item.id === game.lane);
  return (
    <span className={`award-badge ${lane?.tone ?? ""}`}>
      {lane?.label} {game.year}
    </span>
  );
}

function CoverStatus({ game }) {
  const thumbnails = useContext(BGGContext);
  const hasCover = game.coverImage || thumbnails[game.id];
  const isLoading = !(game.id in thumbnails) && !game.coverImage;
  if (isLoading) return <span className="cover-status loading">โหลดรูป…</span>;
  return (
    <span className={`cover-status ${hasCover ? "verified" : "review"}`}>
      {hasCover ? "BGG cover" : "ไม่พบรูป"}
    </span>
  );
}

function getVerbIcon(game) {
  if (["clue", "sound", "represent"].includes(game.verb)) return MessageCircle;
  if (["solve", "deduce", "investigate"].includes(game.verb)) return Puzzle;
  if (["survive", "mitigate"].includes(game.verb)) return ShieldCheck;
  if (["risk", "predict"].includes(game.verb)) return CircleDot;
  if (["flick", "roll", "move", "guide", "stack"].includes(game.verb)) return MousePointer2;
  return Sparkles;
}

function GameDetail({ game }) {
  const lane = awardLanes.find((item) => item.id === game.lane);

  return (
    <aside className="detail-panel" aria-label={`${game.title} detail`}>
      <div className={`detail-ribbon ${lane?.tone ?? "teal"}`}>
        <span>{game.year}</span>
        <strong>{lane?.fullName}</strong>
      </div>
      <GameBoxArt game={game} />
      <div className="detail-title">
        <div>
          <h2>{game.title}</h2>
          <p>{game.lesson}</p>
        </div>
        <ChevronRight size={20} />
      </div>

      <InfoBlock icon={<Sparkles size={18} />} title="Why people want to play">
        <p>
          Players repeat the verb <strong>{game.verb}</strong> because the table moment is <strong>{game.tableMoment}</strong>.
        </p>
      </InfoBlock>

      <InfoBlock icon={<Layers3 size={18} />} title="MAGIC Star">
        <div className="magic-grid">
          <MagicFacet label="Mood" value={game.magic.mood} />
          <MagicFacet label="Action" value={game.magic.action} />
          <MagicFacet label="Goal" value={game.magic.goal} />
          <MagicFacet label="Impediment" value={game.magic.impediment} />
          <MagicFacet label="Character" value={game.magic.character} />
        </div>
      </InfoBlock>

      <InfoBlock icon={<Trophy size={18} />} title="Wizard Hat CORE">
        <div className="core-grid">
          <CoreChip label="Conflict" value={game.core.conflict} />
          <CoreChip label="Order" value={game.core.order} />
          <CoreChip label="Win" value={game.core.win} />
          <CoreChip label="End" value={game.core.end} />
        </div>
      </InfoBlock>

      <InfoBlock icon={<Sparkles size={18} />} title="TASTE">
        <div className="taste-list">
          {game.taste.map((taste) => (
            <span key={`${game.id}-${taste.name}`}>
              {taste.name} <em>({taste.category})</em>
            </span>
          ))}
        </div>
      </InfoBlock>

      <div className="moment-card">
        <span>Table Moment</span>
        <strong>{game.tableMoment}</strong>
        <p>{game.replayEngine}</p>
      </div>

      <div className="source-card">
        <span>Cover source</span>
        {game.coverSourceUrl ? (
          <a href={game.coverSourceUrl} target="_blank" rel="noreferrer">
            {game.coverCredit ?? "Source pending review"} <ExternalLink size={14} />
          </a>
        ) : (
          <p>ยังไม่มีแหล่งรูปที่ตรวจสอบได้</p>
        )}
        <CoverStatus game={game} />
      </div>
    </aside>
  );
}

function InfoBlock({ icon, title, children }) {
  return (
    <section className="info-block">
      <div className="info-title">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function MagicFacet({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function CoreChip({ label, value }) {
  return (
    <div className="core-chip">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LabView({ selectedMechanic, mechanicSort, countedCoreFilters, countedTasteFilters, onSelectMechanic, onSortChange }) {
  return (
    <section className="mechanic-map full-map" id="lab" aria-label="Wizard Hat mechanic filters">
      <MechanicMapHeader mechanicSort={mechanicSort} onSortChange={onSortChange} />
      <button className={`all-patterns ${selectedMechanic === "all" ? "active" : ""}`} type="button" onClick={() => onSelectMechanic("all")}>
        <Sparkles size={18} />
        <span>All patterns</span>
        <strong>{games.length}</strong>
      </button>
      <MechanicSection title="CORE" description="Conflict, Order, Win Condition, and End Trigger" filters={countedCoreFilters} selectedMechanic={selectedMechanic} onSelect={onSelectMechanic} />
      <MechanicSection title="TASTE" description="Mechanic flavors that shape the feel of play" filters={countedTasteFilters} selectedMechanic={selectedMechanic} onSelect={onSelectMechanic} />
    </section>
  );
}

function PatternPreview({ selectedMechanic, mechanicSort, countedCoreFilters, countedTasteFilters, onSelectMechanic, onSortChange, onOpenLab }) {
  return (
    <section className="mechanic-map pattern-preview" aria-label="Wizard Hat mechanic preview">
      <MechanicMapHeader mechanicSort={mechanicSort} onSortChange={onSortChange} compact />
      <button className="ghost-button open-lab" type="button" onClick={onOpenLab}>
        Open full Wizard Hat Lab
      </button>
      <MechanicSection title="CORE" description="Most common CORE cards in award winners" filters={countedCoreFilters.slice(0, 6)} selectedMechanic={selectedMechanic} onSelect={onSelectMechanic} />
      <MechanicSection title="TASTE" description="Most common TASTE cards in award winners" filters={countedTasteFilters.slice(0, 6)} selectedMechanic={selectedMechanic} onSelect={onSelectMechanic} />
    </section>
  );
}

function MechanicMapHeader({ mechanicSort, onSortChange, compact = false }) {
  return (
    <div className={`section-heading ${compact ? "compact" : ""}`}>
      <div>
        <h2>Wizard Hat Pattern Map</h2>
        <p>ใช้ภาพการ์ด Wizard Hat เป็น filter และเรียงจาก pattern ที่พบบ่อยในเกมรางวัล.</p>
      </div>
      <div className="sort-control">
        <span>Sort</span>
        <select value={mechanicSort} onChange={(event) => onSortChange(event.target.value)} aria-label="Sort mechanics">
          <option value="frequent">Most frequent</option>
          <option value="name">A-Z</option>
        </select>
      </div>
    </div>
  );
}

function MechanicSection({ title, description, filters, selectedMechanic, onSelect }) {
  return (
    <section className="mechanic-section">
      <div className="mechanic-section-title">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="filter-grid card-image-grid">
        {filters.map((filter) => (
          <button
            key={filter.id}
            className={`mechanic-image-card ${filter.color} ${selectedMechanic === filter.id ? "active" : ""}`}
            type="button"
            onClick={() => onSelect(filter.id)}
          >
            <div className="card-thumb">
              <img src={assetPath(`wizard-cards/${filter.card}`)} alt="" loading="lazy" />
            </div>
            <div className="mechanic-card-copy">
              <span>{filter.shortLabel ?? filter.label}</span>
              <em>{filter.category}</em>
            </div>
            <strong>{filter.count}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function ChallengeView({ game, onModuleChange }) {
  return (
    <section className="challenge-panel" id="challenge">
      <div className="challenge-copy">
        <span>Design Challenge</span>
        <h2>ลองออกแบบเกมใหม่จาก pattern ของ {game.title}</h2>
        <p>
          ใช้เกมรางวัลเป็น benchmark: เริ่มจาก “ทำไมคนถึงอยากเล่น” แล้วแยก MAGIC Star ออกจาก Wizard Hat CORE/TASTE.
        </p>
      </div>
      <div className="challenge-steps">
        <ChallengeStep number="1" title="Pick the promise" text={`Table Moment: ${game.tableMoment}. ผู้เล่นอยากกลับมาเพราะจังหวะนี้เกิดซ้ำได้.`} />
        <ChallengeStep number="2" title="Keep one CORE spine" text={`${game.core.conflict} / ${game.core.order} / ${game.core.win} / ${game.core.end}`} />
        <ChallengeStep number="3" title="Change one TASTE" text={`ลองเปลี่ยน ${game.taste[0]?.name ?? "main taste"} แล้วดูว่า MAGIC Star ยังสอดคล้องอยู่ไหม.`} />
      </div>
      <button type="button" onClick={() => onModuleChange("lab")}>
        เปิด Wizard Hat Lab เพื่อเลือก card
      </button>
    </section>
  );
}

function ChallengeStep({ number, title, text }) {
  return (
    <article>
      <span>{number}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function SourceFooter() {
  return (
    <footer className="source-footer">
      <div>
        <BookOpen size={18} />
        <p>
          Game analysis is a WoL learning resource. Cover slots keep source status visible; BGG links are used as review references where available.
        </p>
      </div>
      <a href={wizardHatUrl} target="_blank" rel="noreferrer">
        Continue with Wizard Hat <ExternalLink size={14} />
      </a>
    </footer>
  );
}

function gameMatchesMechanic(game, filter) {
  if (!filter) return true;
  if (filter.coreField) {
    return String(game.core[filter.coreField] ?? "").includes(filter.match);
  }
  if (filter.tasteName) {
    return game.taste.some((taste) => taste.name === filter.tasteName || taste.name.includes(filter.tasteName));
  }
  return game.tags.includes(filter.id);
}

function sortMechanics(filters, sortMode) {
  return [...filters].sort((a, b) => {
    if (sortMode === "name") return (a.shortLabel ?? a.label).localeCompare(b.shortLabel ?? b.label);
    return b.count - a.count || (a.shortLabel ?? a.label).localeCompare(b.shortLabel ?? b.label);
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
