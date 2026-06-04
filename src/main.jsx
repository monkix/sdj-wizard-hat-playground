import React, { useDeferredValue, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Award,
  Beaker,
  BookOpen,
  Brain,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gamepad2,
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
const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

function App() {
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
    const searchText = `${game.title} ${game.year} ${game.verb} ${game.tableMoment} ${game.core.conflict} ${game.core.order} ${game.core.win} ${game.core.end} ${game.taste.map((taste) => taste.name).join(" ")}`.toLowerCase();
    const matchesQuery = searchText.includes(deferredQuery.trim().toLowerCase());
    return matchesLane && matchesYear && matchesMechanic && matchesQuery;
  });

  const selectedFilter = allMechanicFilters.find((filter) => filter.id === selectedMechanic);
  const filteredCount = visibleGames.length;
  const countedCoreFilters = sortMechanics(coreMechanicFilters.map((filter) => ({ ...filter, count: countMechanicMatches(filter) })), mechanicSort);
  const countedTasteFilters = sortMechanics(tasteMechanicFilters.map((filter) => ({ ...filter, count: countMechanicMatches(filter) })), mechanicSort);

  function countMechanicMatches(filter) {
    return games.filter((game) => gameMatchesMechanic(game, filter)).length;
  }

  return (
    <div className="app-shell">
      <main className="workspace">
        <SiteHeader />
        <header className="topbar">
          <div>
            <h1>Award Game Explorer</h1>
            <p>Explore Spiel des Jahres winners through MAGIC Star and Wizard Hat patterns.</p>
          </div>
          <HeroVisual />
          <div className="topbar-actions">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search game, mechanic, moment"
                aria-label="Search games"
              />
            </div>
            <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} aria-label="Filter by year">
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </header>

        <section className="mode-strip" aria-label="Playground modules">
          <ModeCard icon={<Award size={20} />} title="Explore" status="Active" text="Award timeline, game detail, and pattern map." active />
          <ModeCard icon={<FlaskConical size={20} />} title="Lab" status="Next" text="Mix Wizard Hat cards and see benchmark games." />
          <ModeCard icon={<Gamepad2 size={20} />} title="Challenge" status="Next" text="Practice reading mechanics from award games." />
        </section>

        <section className="control-band">
          <div className="segment-group" aria-label="Award category">
            <button className={selectedLane === "all" ? "selected" : ""} onClick={() => setSelectedLane("all")}>
              All awards
            </button>
            {awardLanes.map((lane) => (
              <button key={lane.id} className={selectedLane === lane.id ? "selected" : ""} onClick={() => setSelectedLane(lane.id)}>
                {lane.label}
              </button>
            ))}
          </div>
          <div className="result-meter">
            <Sparkles size={16} />
            <span>{filteredCount} games in view</span>
            {selectedFilter && <strong>{selectedFilter.label}</strong>}
          </div>
        </section>

        <div className="main-grid">
          <section className="explorer-panel" aria-label="Award timeline">
            <div className="section-heading">
              <div>
                <h2>2015-2025 Winner Timeline</h2>
                <p>Three award lanes, one shared mechanic vocabulary.</p>
              </div>
              <button className="ghost-button" onClick={() => {
                setSelectedMechanic("all");
                setSelectedLane("all");
                setSelectedYear("all");
                setQuery("");
              }}>
                Reset view
              </button>
            </div>

            <div className="timeline-frame">
              <Timeline
                visibleGames={visibleGames}
                selectedGameId={selectedGameId}
                onSelectGame={setSelectedGameId}
              />
            </div>
          </section>

          <GameDetail game={selectedGame} />
        </div>

        <section className="mechanic-map" aria-label="Wizard Hat mechanic filters">
          <div className="section-heading compact">
            <div>
              <h2>Wizard Hat Pattern Map</h2>
              <p>ใช้ภาพการ์ด Wizard Hat เป็น filter ตอนนี้ และจะต่อเป็น Lab cards ในเฟสถัดไป</p>
            </div>
            <div className="sort-control">
              <span>Sort</span>
              <select value={mechanicSort} onChange={(event) => setMechanicSort(event.target.value)} aria-label="Sort mechanics">
                <option value="frequent">Most frequent</option>
                <option value="name">A-Z</option>
              </select>
            </div>
          </div>
          <button className={`all-patterns ${selectedMechanic === "all" ? "active" : ""}`} onClick={() => setSelectedMechanic("all")}>
            <Sparkles size={18} />
            <span>All patterns</span>
            <strong>{games.length}</strong>
          </button>
          <MechanicSection title="CORE" description="Conflict, Order, Win Condition, and End Trigger" filters={countedCoreFilters} selectedMechanic={selectedMechanic} onSelect={setSelectedMechanic} />
          <MechanicSection title="TASTE" description="Mechanic flavors that shape the feel of play" filters={countedTasteFilters} selectedMechanic={selectedMechanic} onSelect={setSelectedMechanic} />
        </section>
      </main>
    </div>
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

function SiteHeader() {
  return (
    <nav className="site-header" aria-label="Playground navigation">
      <div className="site-brand">
        <img src={assetPath("brand/wol-logo.png")} alt="Wizards of Learning" />
        <div>
          <span>Wizards of Learning</span>
          <strong>Game Design Lab</strong>
        </div>
      </div>
      <div className="site-links">
        <a className="active" href="#explore">Award Explorer</a>
        <a href="#lab">Wizard Hat Lab</a>
        <a href="#challenge">Challenge</a>
        <a href="#library">Library</a>
      </div>
    </nav>
  );
}

function ModeCard({ icon, title, status, text, active = false }) {
  return (
    <article className={`mode-card ${active ? "active" : ""}`}>
      <div className="mode-icon">{icon}</div>
      <div>
        <div className="mode-title">
          <h3>{title}</h3>
          <span>{status}</span>
        </div>
        <p>{text}</p>
      </div>
    </article>
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

function GameBoxArt({ game, compact = false }) {
  if (game.coverImage) {
    return (
      <div className={`game-box-art ${compact ? "compact" : ""}`}>
        <img src={game.coverImage} alt={`${game.title} box cover`} loading="lazy" />
      </div>
    );
  }

  const Icon = getVerbIcon(game);
  return (
    <div className={`game-box-art pending ${compact ? "compact" : ""} lane-${game.lane}`}>
      <Icon size={compact ? 17 : 28} />
      {!compact && <span>Box cover</span>}
    </div>
  );
}

function GameTileArt({ game }) {
  const Icon = getVerbIcon(game);
  return (
    <div className={`tile-art moment-${slugify(game.tableMoment)}`}>
      <Icon size={20} />
    </div>
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
            onClick={() => onSelect(filter.id)}
          >
            <div className="card-thumb">
              <img src={assetPath(`wizard-cards/${filter.card}`)} alt="" />
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

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
