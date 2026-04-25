import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useLayoutEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { getAntibodies, getCellMap } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------------------------------------------------------
   Positions as % of container (960×580 base)
   --------------------------------------------------------------- */
const POS = {
  TP53:    { l: 38.5, t: 46.6, loc: "nucleus" },
  BRCA1:   { l: 43.8, t: 54.3, loc: "nucleus" },
  MYC:     { l: 35.4, t: 54.8, loc: "nucleus" },
  EGFR:    { l: 86.5, t: 44.8, loc: "membrane" },
  HER2:    { l: 70.8, t: 18.6, loc: "membrane" },
  CD8A:    { l: 26.0, t: 19.8, loc: "membrane" },
  "PD-L1": { l: 16.7, t: 66.4, loc: "membrane" },
  KRAS:    { l: 82.3, t: 70.7, loc: "membrane" },
  GAPDH:   { l: 59.4, t: 38.8, loc: "cytoplasm" },
  ACTB:    { l: 64.6, t: 64.7, loc: "cytoplasm" },
  AKT1:    { l: 55.2, t: 68.1, loc: "cytoplasm" },
  MTOR:    { l: 70.8, t: 52.6, loc: "cytoplasm" },
  VEGFA:   { l: 9.9,  t: 28.4, loc: "extracellular" },
  TNF:     { l: 91.7, t: 19.8, loc: "extracellular" },
  IL6:     { l: 12.0, t: 81.9, loc: "extracellular" },
};

const LOC_HEX = {
  nucleus:       "#c084fc",
  membrane:      "#22d3ee",
  cytoplasm:     "#34d399",
  extracellular: "#fbbf24",
};

const APP_HEX = {
  WB: "#22d3ee", IHC: "#a78bfa", IF: "#34d399", FC: "#f472b6",
  ChIP: "#fbbf24", ELISA: "#fb923c", IP: "#60a5fa",
};
const APPS = ["WB", "IHC", "IF", "FC", "ChIP", "ELISA", "IP"];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function hex2rgb(h) {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function glow(hex, s = 1) {
  const [r, g, b] = hex2rgb(hex);
  const a = (a_) => `rgba(${r},${g},${b},${a_})`;
  return [
    `0 0 ${2 * s}px ${1 * s}px ${a(0.9)}`,
    `0 0 ${6 * s}px ${2 * s}px ${a(0.5)}`,
    `0 0 ${16 * s}px ${6 * s}px ${a(0.22)}`,
    `0 0 ${40 * s}px ${16 * s}px ${a(0.08)}`,
    `0 0 ${70 * s}px ${28 * s}px ${a(0.03)}`,
  ].join(", ");
}

function glowHover(hex) {
  const [r, g, b] = hex2rgb(hex);
  const a = (a_) => `rgba(${r},${g},${b},${a_})`;
  return [
    `0 0 4px 2px ${a(1)}`,
    `0 0 10px 4px ${a(0.6)}`,
    `0 0 25px 10px ${a(0.3)}`,
    `0 0 55px 22px ${a(0.12)}`,
    `0 0 90px 36px ${a(0.05)}`,
  ].join(", ");
}

function nodeSize(count) {
  return Math.min(Math.max(Math.sqrt(count || 1) * 1.4, 5), 14);
}

/* Cell body geometry (viewBox units) — matches CSS membrane ellipse ~77%×78% of 960×580 */
const CELL_CX = 480;
const CELL_CY = 290;
const CELL_RX = 368;
const CELL_RY = 226;
const CELL_CLIP_ID = "cvCellInteriorClip";

/* ----- Static diagram: one membrane-bound interior (clip) + organelle sprites ----- */
function CellDiagram() {
  return (
    <svg
      viewBox="0 0 960 580"
      className="cv-cell-diagram"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={CELL_CLIP_ID}>
          <ellipse cx={CELL_CX} cy={CELL_CY} rx={CELL_RX - 6} ry={CELL_RY - 6} />
        </clipPath>
        <radialGradient id="cvCytosol" cx="42%" cy="46%" r="68%">
          <stop offset="0%" stopColor="#3d5a8c" stopOpacity="0.55" />
          <stop offset="38%" stopColor="#243a62" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#0e182c" stopOpacity="0.35" />
        </radialGradient>
        <radialGradient id="cvPerinuclear" cx="38%" cy="50%" r="35%">
          <stop offset="0%" stopColor="#6b4c86" stopOpacity="0.5" />
          <stop offset="70%" stopColor="#3d2a50" stopOpacity="0.15" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="cvERGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a07090" />
          <stop offset="100%" stopColor="#4f3558" />
        </linearGradient>
        <linearGradient id="cvMitoBody" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffc48a" />
          <stop offset="100%" stopColor="#c44f1e" />
        </linearGradient>
        <linearGradient id="cvGolgiGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#e892b0" />
          <stop offset="100%" stopColor="#6e3050" />
        </linearGradient>
      </defs>

      {/* Plasma membrane — double line reads as a boundary, not a floating ring */}
      <ellipse
        cx={CELL_CX}
        cy={CELL_CY}
        rx={CELL_RX}
        ry={CELL_RY}
        fill="none"
        stroke="rgba(56, 189, 248, 0.12)"
        strokeWidth="10"
      />
      <ellipse
        cx={CELL_CX}
        cy={CELL_CY}
        rx={CELL_RX}
        ry={CELL_RY}
        fill="none"
        stroke="rgba(125, 211, 252, 0.35)"
        strokeWidth="2.2"
      />
      <ellipse
        cx={CELL_CX}
        cy={CELL_CY}
        rx={CELL_RX - 5}
        ry={CELL_RY - 5}
        fill="none"
        stroke="rgba(15, 40, 72, 0.55)"
        strokeWidth="1.5"
      />

      {/* Everything below reads as *inside* the cell */}
      <g clipPath={`url(#${CELL_CLIP_ID})`}>
        <ellipse cx={CELL_CX} cy={CELL_CY} rx={CELL_RX} ry={CELL_RY} fill="url(#cvCytosol)" />
        <ellipse cx={CELL_CX} cy={CELL_CY} rx={CELL_RX} ry={CELL_RY} fill="url(#cvPerinuclear)" />

        {/* Nuclear envelope hint (does not duplicate the CSS nucleus hub) */}
        <ellipse
          cx="385"
          cy="290"
          rx="118"
          ry="148"
          fill="none"
          stroke="rgba(167, 139, 250, 0.12)"
          strokeWidth="2"
        />
        <ellipse
          cx="382"
          cy="288"
          rx="102"
          ry="128"
          fill="rgba(30, 18, 48, 0.18)"
          stroke="rgba(139, 92, 246, 0.1)"
          strokeWidth="1"
        />

        {/* Rough ER — single continuous ribbon hugging the nuclear zone */}
        <path
          fill="url(#cvERGrad)"
          fillOpacity="0.48"
          d="M 285 175 C 360 145 455 155 520 198 C 575 235 595 295 565 355 C 530 415 445 430 365 405 C 285 380 235 320 245 255 C 252 210 265 188 285 175 Z"
        />
        <path
          fill="#4a3558"
          fillOpacity="0.32"
          d="M 305 200 C 375 178 465 188 515 228 C 548 268 535 325 495 360 C 445 398 375 392 330 360 C 285 325 275 255 305 200 Z"
        />

        {/* Cortical ER / cytosol shading (right periphery) */}
        <path
          fill="#2f4a78"
          fillOpacity="0.35"
          d="M 620 215 C 705 195 765 235 775 295 C 782 350 745 405 685 418 C 625 428 575 395 565 340 C 558 285 585 235 620 215 Z"
        />

        {/* Mitochondria — inside membrane; clustered like textbook layout */}
        <g opacity="0.96">
          <g transform="rotate(-22 712 212)">
            <ellipse cx="712" cy="212" rx="34" ry="14" fill="url(#cvMitoBody)" />
            <path
              d="M 686 210 Q 712 204 738 210 M 688 216 Q 712 222 736 216"
              stroke="#5c2408"
              strokeWidth="1.25"
              fill="none"
              strokeLinecap="round"
              opacity="0.55"
            />
          </g>
          <g transform="rotate(12 732 398)">
            <ellipse cx="732" cy="398" rx="28" ry="11" fill="url(#cvMitoBody)" />
            <path
              d="M 712 396 Q 732 391 752 396 M 714 401 Q 732 406 750 401"
              stroke="#5c2408"
              strokeWidth="1.1"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>
          <g transform="rotate(-6 312 372)">
            <ellipse cx="312" cy="372" rx="30" ry="12" fill="url(#cvMitoBody)" />
            <path
              d="M 290 370 Q 312 365 334 370 M 292 375 Q 312 380 332 375"
              stroke="#5c2408"
              strokeWidth="1.1"
              fill="none"
              strokeLinecap="round"
              opacity="0.5"
            />
          </g>
        </g>

        {/* Golgi — stacked sacs, medial region */}
        <g opacity="0.68">
          <ellipse cx="608" cy="292" rx="44" ry="10" fill="url(#cvGolgiGrad)" />
          <ellipse cx="610" cy="304" rx="46" ry="9.5" fill="#9d3f62" />
          <ellipse cx="612" cy="316" rx="42" ry="8.5" fill="#7a3352" />
          <ellipse cx="614" cy="327" rx="36" ry="7.5" fill="#5c2842" />
        </g>

        {/* Vesicles + ribosomes — sparse, inside cell only */}
        <g fill="#6a8cc8" fillOpacity="0.38">
          <circle cx="528" cy="248" r="4.5" />
          <circle cx="552" cy="272" r="3.8" />
          <circle cx="498" cy="328" r="4" />
          <circle cx="668" cy="262" r="3.2" />
          <circle cx="398" cy="322" r="3.2" />
          <circle cx="442" cy="348" r="3.6" />
        </g>
        <g fill="#a8b8d8" fillOpacity="0.22">
          {[
            [522, 288], [546, 302], [566, 282], [534, 332], [558, 318],
            [628, 248], [648, 268], [512, 366], [492, 322], [578, 348],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="1.35" />
          ))}
        </g>
      </g>
    </svg>
  );
}


export default function CellVisualization() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [hov, setHov] = useState(null);
  const [app, setApp] = useState(null);
  const [filterMode, setFilterMode] = useState("dim"); // "dim" | "hide"
  const [loading, setLoading] = useState(true);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [tipFixed, setTipFixed] = useState(null);
  const anchorRefs = useRef({});
  const tipRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [panelAbs, setPanelAbs] = useState([]);
  const [panelLoading, setPanelLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try { setTargets((await getCellMap()).data.targets || []); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const openPanel = useCallback(async (t) => {
    setSelected(t);
    setPanelLoading(true);
    try {
      const { data } = await getAntibodies(t.id, { sort: "score", per_page: 5, page: 1 });
      setPanelAbs(data.antibodies || []);
    } catch (e) {
      console.error(e);
      setPanelAbs([]);
    } finally {
      setPanelLoading(false);
    }
  }, []);

  const closePanel = useCallback(() => {
    setSelected(null);
    setPanelAbs([]);
    setPanelLoading(false);
  }, []);

  const layoutTooltip = useCallback(() => {
    if (!hov) {
      setTipFixed(null);
      return;
    }
    const anchor = anchorRefs.current[hov.id];
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const tip = tipRef.current;
    const margin = 12;
    const ew = Math.min(300, Math.max(200, tip?.offsetWidth || 260));
    const eh = Math.min(400, Math.max(120, tip?.offsetHeight || 200));
    const cx = a.left + a.width / 2;
    const cy = a.top + a.height / 2;
    let left = cx - ew / 2;
    let top = cy - eh - 16;
    if (top < margin) top = cy + Math.max(a.height, 12) / 2 + 14;
    if (top + eh > window.innerHeight - margin) {
      top = window.innerHeight - eh - margin;
    }
    left = clamp(left, margin, window.innerWidth - ew - margin);
    top = clamp(top, margin, window.innerHeight - eh - margin);
    setTipFixed({ left, top });
  }, [hov]);

  useLayoutEffect(() => {
    if (!hov) {
      setTipFixed(null);
      return;
    }
    layoutTooltip();
    const id = requestAnimationFrame(() => {
      layoutTooltip();
      requestAnimationFrame(layoutTooltip);
    });
    window.addEventListener("resize", layoutTooltip);
    window.addEventListener("scroll", layoutTooltip, true);
    let ro = null;
    if (tipRef.current) {
      ro = new ResizeObserver(() => layoutTooltip());
      ro.observe(tipRef.current);
    }
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", layoutTooltip);
      window.removeEventListener("scroll", layoutTooltip, true);
      ro?.disconnect();
    };
  }, [hov, layoutTooltip]);

  const getColor = useCallback((t) => {
    if (app) {
      return (t.by_application?.[app] || 0) > 0
        ? (APP_HEX[app] || "#22d3ee") : "#1a2744";
    }
    return LOC_HEX[t.subcellular_location] || "#34d399";
  }, [app]);

  const isVis = useCallback(
    (t) => !app || (t.by_application?.[app] || 0) > 0,
    [app]
  );

  const filterMatchCount = useMemo(() => {
    if (!app || !targets.length) return null;
    return targets.filter((t) => (t.by_application?.[app] || 0) > 0).length;
  }, [app, targets]);

  if (loading) return (
    <div className="cell-loading"><div className="cell-loading-dot" />Initializing cell...</div>
  );

  return (
    <div className="cell-viz-wrapper">
      {/* Filters */}
      <div className="cell-filters">
        <button
          type="button"
          className={`cell-filter-pill ${!app ? "active" : ""}`}
          title="Show every target (color by subcellular location)"
          onClick={() => setApp(null)}
        >
          All
        </button>
        {APPS.map((a) => (
          <button
            key={a}
            type="button"
            className={`cell-filter-pill ${app === a ? "active" : ""}`}
            style={app === a ? { background: APP_HEX[a], borderColor: APP_HEX[a] } : {}}
            title={
              app === a
                ? "Clear filter"
                : `Show only targets with ${a} validation records (others hidden)`
            }
            onClick={() => setApp(app === a ? null : a)}
          >
            {a}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="cell-legend">
        {!app ? Object.entries(LOC_HEX).map(([l, c]) => (
          <span key={l} className="legend-item">
            <span className="legend-dot" style={{ background: c, boxShadow: `0 0 6px 2px ${c}55` }} />{l}
          </span>
        )) : (
          <span className="legend-item cell-legend-filter">
            <span className="legend-dot" style={{ background: APP_HEX[app], boxShadow: `0 0 6px 2px ${APP_HEX[app]}55` }} />
            <span>
              <strong>Assay filter:</strong> only targets with ≥1 <strong>{app}</strong> validation stay visible
              ({filterMatchCount ?? "—"} of {targets.length}).
            </span>
          </span>
        )}

        {app && (
          <span className="legend-item cell-filter-mode">
            <span className="cell-filter-mode-label">Others:</span>
            <button
              type="button"
              className={`cell-filter-mode-btn ${filterMode === "dim" ? "active" : ""}`}
              onClick={() => setFilterMode("dim")}
              title="Keep context: non-matching targets are dimmed"
            >
              Dim
            </button>
            <button
              type="button"
              className={`cell-filter-mode-btn ${filterMode === "hide" ? "active" : ""}`}
              onClick={() => setFilterMode("hide")}
              title="Focus: non-matching targets are hidden"
            >
              Hide
            </button>
          </span>
        )}
      </div>

      {app && targets.length > 0 && filterMatchCount !== null && (
        <div
          className={
            filterMatchCount === targets.length
              ? "cell-filter-status cell-filter-status--warn"
              : filterMatchCount === 0
                ? "cell-filter-status cell-filter-status--warn"
                : "cell-filter-status"
          }
        >
          {filterMatchCount === targets.length ? (
            <>
              Every target still has <strong>{app}</strong> data — usually from <strong>stacked seeds</strong>{" "}
              (old runs appended antibodies). Pull the latest code and run{" "}
              <code className="cell-filter-code">docker compose exec backend python seed.py</code>
              {" "}
              once (it now clears antibodies first), then refresh this page.
            </>
          ) : filterMatchCount === 0 ? (
            <>No targets have {app} validations in this database. Try another assay or All.</>
          ) : (
            <>
              {filterMatchCount} target{filterMatchCount === 1 ? "" : "s"} match; the rest are hidden until you
              choose <strong>All</strong>.
            </>
          )}
        </div>
      )}

      {/* ===== THE CELL ===== */}
      <div className="cv-frame">
        <div
          className="cv-viewport"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width;
            const y = (e.clientY - r.top) / r.height;
            setMouse({ x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
          }}
        >
          <div className="cv-bg" />
          <CellDiagram />
          <div className="cv-vignette" />

          {/* Nucleus */}
          <div className="cv-nucleus">
            <div className="cv-nucleolus" />
          </div>

          {/* Protein nodes — wrapper keeps translate(-50%,-50%); motion only animates inner */}
          {targets.map((t, i) => {
            const p = POS[t.gene_name] || { l: 50, t: 50, loc: "cytoplasm" };
            const c = getColor(t);
            const v = isVis(t);
            const sz = nodeSize(t.validation_count);
            const h = hov?.id === t.id;
            const dx = (mouse.x - 0.5) * 10;
            const dy = (mouse.y - 0.5) * 10;
            const show = !app || v || filterMode === "dim";

            return (
              <div
                key={t.id}
                ref={(el) => {
                  if (el) anchorRefs.current[t.id] = el;
                  else delete anchorRefs.current[t.id];
                }}
                className="cv-protein-anchor"
                style={{
                  left: `${p.l}%`,
                  top: `${p.t}%`,
                  visibility: show ? "visible" : "hidden",
                  pointerEvents: v ? "auto" : "none",
                }}
                aria-hidden={!show}
              >
                <motion.div
                  className={`cv-protein ${h ? "cv-hovered" : ""} ${!v ? "cv-dim" : ""}`}
                  style={{
                    width: sz,
                    height: sz,
                    background: c,
                    boxShadow: h ? glowHover(c) : glow(c, v ? 1 : 0.15),
                    animationDelay: `${i * 0.28}s`,
                  }}
                  initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                  animate={{
                    opacity: v ? 1 : (show ? 0.18 : 0),
                    scale: h ? 1.55 : 1,
                    x: v ? dx * (0.12 + (i % 7) * 0.01) : 0,
                    y: v ? dy * (0.12 + (i % 5) * 0.015) : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 28,
                    mass: 0.6,
                  }}
                  onClick={() => v && openPanel(t)}
                  onMouseEnter={() => v && setHov(t)}
                  onMouseLeave={() => setHov(null)}
                >
                  <span className="cv-protein-center" />
                  <span className="cv-protein-label" style={{ opacity: h ? 1 : 0.6 }}>
                    {t.gene_name}
                  </span>
                </motion.div>
              </div>
            );
          })}

          {/* Tooltip */}
          {targets.length === 0 && (
            <div className="cv-empty-overlay" role="status">
              <p>No protein data loaded.</p>
              <p className="cv-empty-hint">
                Start the backend, seed the database, then refresh:{" "}
                <code>docker-compose exec backend python seed.py</code>
              </p>
            </div>
          )}

          <AnimatePresence>
            {hov && (() => {
              const lc = LOC_HEX[hov.subcellular_location] || "#34d399";
              return (
                <motion.div
                  key={hov.id}
                  ref={tipRef}
                  className="cv-tooltip cv-tooltip--fixed"
                  style={
                    tipFixed
                      ? {
                          position: "fixed",
                          left: tipFixed.left,
                          top: tipFixed.top,
                          transform: "none",
                        }
                      : {
                          position: "fixed",
                          left: 0,
                          top: 0,
                          width: 1,
                          height: 1,
                          overflow: "hidden",
                          opacity: 0,
                          visibility: "hidden",
                          pointerEvents: "none",
                        }
                  }
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: tipFixed ? 1 : 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.99 }}
                  transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.65 }}
                >
                  <div className="cv-tip-inner">
                    <div className="cv-tip-head">
                      <span className="cv-tip-gene">{hov.gene_name}</span>
                      <span className="cv-tip-loc" style={{ color: lc, borderColor: `${lc}88` }}>
                        {hov.subcellular_location}
                      </span>
                    </div>
                    <div className="cv-tip-name">{hov.protein_name}</div>
                    <div className="cv-tip-div" />
                    <div className="cv-tip-stats">
                      <div><strong>{hov.antibody_count}</strong><small>antibodies</small></div>
                      <div><strong>{hov.validation_count}</strong><small>validations</small></div>
                      {hov.top_score && <div><strong>{hov.top_score}</strong><small>top score</small></div>}
                    </div>
                    {hov.by_application && Object.keys(hov.by_application).length > 0 && (
                      <div className="cv-tip-apps">
                        {Object.entries(hov.by_application).sort((a, b) => b[1] - a[1])
                          .map(([ap, ct]) => (
                            <span key={ap} style={{ borderColor: `${APP_HEX[ap]}88`, color: APP_HEX[ap] }}>
                              {ap} {ct}
                            </span>
                          ))}
                      </div>
                    )}
                    <div className="cv-tip-cta">Click to explore →</div>
                  </div>
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.aside
            key="cell-panel"
            className="cell-side-panel"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
          >
            <div className="cell-panel-head">
              <div>
                <div className="cell-panel-title">{selected.gene_name}</div>
                <div className="cell-panel-sub">{selected.protein_name}</div>
              </div>
              <button type="button" className="cell-panel-close" onClick={closePanel} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="cell-panel-meta">
              <span className="cell-panel-pill">{selected.subcellular_location}</span>
              <span className="cell-panel-stat"><strong>{selected.antibody_count}</strong> antibodies</span>
              <span className="cell-panel-stat"><strong>{selected.validation_count}</strong> validations</span>
              {selected.top_score && (
                <span className="cell-panel-stat"><strong>{selected.top_score}</strong> top score</span>
              )}
            </div>

            <div className="cell-panel-actions">
              <button type="button" className="cell-panel-btn" onClick={() => navigate(`/target/${selected.id}`)}>
                Open target page →
              </button>
            </div>

            <div className="cell-panel-section">
              <div className="cell-panel-section-title">Top antibodies</div>
              {panelLoading ? (
                <div className="cell-panel-muted">Loading…</div>
              ) : panelAbs.length === 0 ? (
                <div className="cell-panel-muted">No antibodies found.</div>
              ) : (
                <ul className="cell-panel-list">
                  {panelAbs.map((ab) => (
                    <li key={ab.id}>
                      <button
                        type="button"
                        className="cell-panel-row"
                        onClick={() => navigate(`/antibody/${ab.id}`)}
                        title="Open antibody detail"
                      >
                        <span className="cell-panel-row-main">
                          <span className="cell-panel-vendor">{ab.vendor}</span>
                          <span className="cell-panel-clone"> — {ab.clone_name || ab.catalog_number}</span>
                        </span>
                        <span className="cell-panel-score">
                          {ab.overall_score ? Number(ab.overall_score).toFixed(1) : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}