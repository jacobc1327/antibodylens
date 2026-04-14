import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCellMap } from "../utils/api";

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

/* ----- Noise texture via canvas ----- */
function NoiseOverlay() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    c.width = 200; c.height = 200;
    const d = ctx.createImageData(200, 200);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v;
      d.data[i + 3] = 6;
    }
    ctx.putImageData(d, 0, 0);
  }, []);
  return (
    <canvas ref={ref} className="cv-noise"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
        opacity: 0.4, pointerEvents: "none", zIndex: 1, mixBlendMode: "overlay",
        imageRendering: "pixelated" }} />
  );
}

/* ----- Organelle line art (SVG overlay) ----- */
function Organelles() {
  return (
    <svg viewBox="0 0 960 580" className="cv-organelles"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 2 }}>
      {/* ER */}
      <g opacity="0.25" stroke="#34d399" fill="none" strokeWidth="1.8" strokeLinecap="round">
        <path d="M455,235 Q482,218 508,235 Q534,252 560,235 Q586,218 610,237" />
        <path d="M460,252 Q488,237 512,252 Q537,268 562,252 Q586,237 612,254" />
        <path d="M460,348 Q488,334 514,348 Q540,362 565,348" />
      </g>
      {/* Mitochondria */}
      <g opacity="0.22" fill="none" stroke="#fb923c" strokeWidth="1.3">
        <ellipse cx="695" cy="215" rx="22" ry="9" transform="rotate(-22,695,215)" />
        <ellipse cx="695" cy="215" rx="13" ry="5" transform="rotate(-22,695,215)" />
        <ellipse cx="735" cy="398" rx="18" ry="7.5" transform="rotate(16,735,398)" />
        <ellipse cx="735" cy="398" rx="10" ry="4" transform="rotate(16,735,398)" />
        <ellipse cx="295" cy="362" rx="20" ry="8" transform="rotate(-10,295,362)" />
        <ellipse cx="295" cy="362" rx="12" ry="4.5" transform="rotate(-10,295,362)" />
      </g>
      {/* Golgi */}
      <g opacity="0.18" fill="none" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round">
        <path d="M598,308 Q618,296 638,308" />
        <path d="M595,318 Q618,306 641,318" />
        <path d="M592,328 Q618,316 644,328" />
      </g>
      {/* Ribosomes */}
      <g opacity="0.08" fill="#94a3b8">
        {[[515,288],[535,308],[555,290],[528,342],[548,328],
          [615,258],[630,278],[645,253],[615,338],[635,358],
          [505,368],[525,383],[548,368],[485,343]
        ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.3" />)}
      </g>
    </svg>
  );
}


export default function CellVisualization() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [hov, setHov] = useState(null);
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setTargets((await getCellMap()).data.targets || []); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // Pre-compute particles
  const particles = useMemo(() =>
    Array.from({ length: 45 }, (_, i) => ({
      id: i,
      left: 8 + Math.random() * 84,
      top: 4 + Math.random() * 92,
      size: 1 + Math.random() * 2,
      dur: 14 + Math.random() * 22,
      del: -Math.random() * 25,
      dx: -12 + Math.random() * 24,
      dy: -(8 + Math.random() * 20),
    })), []);

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

  if (loading) return (
    <div className="cell-loading"><div className="cell-loading-dot" />Initializing cell...</div>
  );

  return (
    <div className="cell-viz-wrapper">
      {/* Filters */}
      <div className="cell-filters">
        <button className={`cell-filter-pill ${!app ? "active" : ""}`}
          onClick={() => setApp(null)}>All</button>
        {APPS.map((a) => (
          <button key={a}
            className={`cell-filter-pill ${app === a ? "active" : ""}`}
            style={app === a ? { background: APP_HEX[a], borderColor: APP_HEX[a] } : {}}
            onClick={() => setApp(app === a ? null : a)}>{a}</button>
        ))}
      </div>

      {/* Legend */}
      <div className="cell-legend">
        {!app ? Object.entries(LOC_HEX).map(([l, c]) => (
          <span key={l} className="legend-item">
            <span className="legend-dot" style={{ background: c, boxShadow: `0 0 6px 2px ${c}55` }} />{l}
          </span>
        )) : (
          <span className="legend-item">
            <span className="legend-dot" style={{ background: APP_HEX[app], boxShadow: `0 0 6px 2px ${APP_HEX[app]}55` }} />
            Validated for {app}
            <span className="legend-dot dim" />No data
          </span>
        )}
      </div>

      {/* ===== THE CELL ===== */}
      <div className="cv-frame">
        <div className="cv-viewport">
          {/* Background */}
          <div className="cv-bg" />

          {/* Noise texture */}
          <NoiseOverlay />

          {/* Vignette */}
          <div className="cv-vignette" />

          {/* Particles */}
          {particles.map((pt) => (
            <span key={pt.id} className="cv-particle" style={{
              left: `${pt.left}%`, top: `${pt.top}%`,
              width: pt.size, height: pt.size,
              animationDuration: `${pt.dur}s`,
              animationDelay: `${pt.del}s`,
              "--dx": `${pt.dx}px`, "--dy": `${pt.dy}px`,
            }} />
          ))}

          {/* Cell membrane */}
          <div className="cv-membrane" />

          {/* Organelle SVG overlay */}
          <Organelles />

          {/* Nucleus */}
          <div className="cv-nucleus">
            <div className="cv-nucleolus" />
          </div>

          {/* Protein nodes */}
          {targets.map((t, i) => {
            const p = POS[t.gene_name] || { l: 50, t: 50, loc: "cytoplasm" };
            const c = getColor(t);
            const v = isVis(t);
            const sz = nodeSize(t.validation_count);
            const h = hov?.id === t.id;

            return (
              <div
                key={t.id}
                className={`cv-protein ${h ? "cv-hovered" : ""} ${!v ? "cv-dim" : ""}`}
                style={{
                  left: `${p.l}%`,
                  top: `${p.t}%`,
                  width: sz, height: sz,
                  background: c,
                  boxShadow: h ? glowHover(c) : glow(c, v ? 1 : 0.15),
                  animationDelay: `${i * 0.28}s`,
                  opacity: v ? 1 : 0.12,
                }}
                onClick={() => navigate(`/target/${t.id}`)}
                onMouseEnter={() => setHov(t)}
                onMouseLeave={() => setHov(null)}
              >
                <span className="cv-protein-center" />
                <span className="cv-protein-label" style={{ opacity: h ? 1 : 0.6 }}>
                  {t.gene_name}
                </span>
              </div>
            );
          })}

          {/* Tooltip */}
          {hov && (() => {
            const p = POS[hov.gene_name] || { l: 50, t: 50 };
            const lc = LOC_HEX[hov.subcellular_location] || "#34d399";
            const flipX = p.l > 65;
            const flipY = p.t < 22;
            return (
              <div className={`cv-tooltip ${flipX ? "fx" : ""} ${flipY ? "fy" : ""}`}
                style={{ left: `${p.l}%`, top: `${p.t}%` }}>
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
                  <div className="cv-tip-cta">Click to explore \u2192</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}