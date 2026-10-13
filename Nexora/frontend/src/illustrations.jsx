// Original clay-style vector illustrations (no external images, so they load offline).
// Every shape is built from the same recipe: a 3-stop colour gradient, a soft top highlight,
// a darker belly, a thin rim light and a blurred drop shadow, so it all reads as one lump of clay.

const COLORS = {
  indigo: ["#a4aeff", "#6272f8", "#4350d9"],
  coral: ["#ffd0c4", "#ff8a7a", "#e9705f"],
  mint: ["#b9f5de", "#5ee0b4", "#2fb98e"],
  butter: ["#fff0c0", "#ffd36c", "#f0a82c"],
  pink: ["#ffd2e8", "#ff8fc2", "#e8559c"],
  sky: ["#c9f1ff", "#5fc4f0", "#2a9fd6"],
  violet: ["#dcc9ff", "#a98aff", "#7a55e8"],
  paper: ["#ffffff", "#f1f1ff", "#dcdffb"],
};
const INK = "#1b1f4b";

function Defs({ id }) {
  return (
    <defs>
      {Object.entries(COLORS).map(([k, [a, b, c]]) => (
        <linearGradient key={k} id={`${id}-${k}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.5" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
      ))}
      <radialGradient id={`${id}-hl`} cx="0.25" cy="0.15" r="0.8">
        <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
        <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-bot`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.6" stopColor="#2a34b8" stopOpacity="0" />
        <stop offset="1" stopColor="#2a34b8" stopOpacity="0.3" />
      </linearGradient>
      <filter id={`${id}-sh`} x="-30%" y="-30%" width="170%" height="190%">
        <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#3a44a8" floodOpacity="0.34" />
      </filter>
      <filter id={`${id}-sh2`} x="-30%" y="-30%" width="170%" height="190%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#3a44a8" floodOpacity="0.3" />
      </filter>
      <filter id={`${id}-bl`}><feGaussianBlur stdDeviation="3" /></filter>
    </defs>
  );
}

const box = (id, x, y, w, h, r, color, key, small) => (
  <g key={key}>
    <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-${color})`} filter={`url(#${id}-${small ? "sh2" : "sh"})`} />
    <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-bot)`} />
    <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id}-hl)`} />
    <rect x={x + 0.8} y={y + 0.8} width={w - 1.6} height={h - 1.6} rx={r - 0.8} fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" />
  </g>
);
const ball = (id, cx, cy, r, color, key, small) => (
  <g key={key}>
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-${color})`} filter={`url(#${id}-${small ? "sh2" : "sh"})`} />
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id}-bot)`} />
    <ellipse cx={cx - r * 0.32} cy={cy - r * 0.42} rx={r * 0.38} ry={r * 0.24} fill="#fff" opacity="0.7" />
  </g>
);
const well = (x, y, w, h, key, fill = "#dfe2fb") => <rect key={key} x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} />;

/** One profile: stacked clay cards, an avatar ball, skill pills. */
export function ProfileArt() {
  const id = "pf";
  const pills = [[70, 150, 70, "mint"], [148, 150, 58, "indigo"], [214, 150, 80, "violet"], [70, 180, 62, "butter"], [140, 180, 86, "sky"], [234, 180, 50, "pink"]];
  return (
    <svg viewBox="0 0 440 300" className="art" role="img" aria-label="Stacked profile cards with an avatar and skill tags">
      <Defs id={id} />
      <g transform="rotate(-5 220 125)">{box(id, 74, 30, 296, 190, 26, "violet", "b1", true)}</g>
      <g transform="rotate(3 212 143)">{box(id, 62, 44, 300, 196, 26, "sky", "b2", true)}</g>
      {box(id, 48, 58, 330, 208, 30, "paper", "front")}
      {ball(id, 100, 108, 28, "indigo", "av")}
      <circle cx="100" cy="102" r="8.5" fill="#fff" />
      <path d="M84 126c3-11 29-11 32 0" fill="#fff" />
      {well(142, 92, 140, 12, "l1", "#c9cef6")}
      {well(142, 114, 96, 10, "l2")}
      {pills.map(([x, y, w, c], i) => (
        <g key={i}>{box(id, x, y, w, 24, 12, c, `p${i}`, true)}<circle cx={x + 13} cy={y + 12} r="3.6" fill="#fff" opacity="0.95" /></g>
      ))}
      {well(70, 224, 210, 9, "l3")}
      {ball(id, 352, 82, 20, "mint", "ok")}
      <path d="M343 82l6 6 11-12" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Gap analysis: a grid of clay skill tiles with one missing piece under a glass magnifier. */
export function GapsArt() {
  const id = "gp";
  const tiles = [[56, 40], [158, 40], [260, 40], [56, 134], [158, 134]];
  return (
    <svg viewBox="0 0 440 300" className="art" role="img" aria-label="A grid of skill tiles with one missing tile highlighted by a magnifying glass">
      <Defs id={id} />
      {tiles.map(([x, y], i) => (
        <g key={i}>
          {box(id, x, y, 90, 80, 24, i === 3 ? "butter" : "paper", `t${i}`, true)}
          {well(x + 16, y + 20, 50, 9, `a${i}`, i === 3 ? "#f0b43a" : "#cfd4f6")}
          {well(x + 16, y + 38, 34, 8, `b${i}`, i === 3 ? "#f6c960" : "#dfe2fb")}
          {i !== 3 && <g>{ball(id, x + 66, y + 58, 11, "mint", `m${i}`, true)}<path d={`M${x + 61} ${y + 58}l4 4 7-8`} fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></g>}
        </g>
      ))}
      <rect x="260" y="134" width="90" height="80" rx="24" fill="#fff" fillOpacity="0.4" stroke="#e0475b" strokeWidth="2.6" strokeDasharray="7 7" />
      <path d="M305 158v32M289 174h32" stroke="#e0475b" strokeWidth="4" strokeLinecap="round" />
      <path d="M368 232l32 32" stroke={`url(#${id}-indigo)`} strokeWidth="15" strokeLinecap="round" filter={`url(#${id}-sh2)`} />
      <circle cx="338" cy="204" r="38" fill="#fff" fillOpacity="0.5" stroke={`url(#${id}-sky)`} strokeWidth="9" filter={`url(#${id}-sh)`} />
      <path d="M312 190a30 30 0 0 1 18-14" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

/** Roadmap: a clay tube path with checkpoints and a flag. */
export function RoadmapArt() {
  const id = "rm";
  const d = "M50 250C130 250 130 190 210 190S290 120 230 100 280 40 370 52";
  return (
    <svg viewBox="0 0 440 300" className="art" role="img" aria-label="A winding path with checkpoints leading to a flag">
      <Defs id={id} />
      <path d={d} fill="none" stroke="#c7cbf3" strokeWidth="22" strokeLinecap="round" filter={`url(#${id}-sh2)`} />
      <path d={d} fill="none" stroke="#e6e8ff" strokeWidth="17" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 14" opacity="0.9" />
      {[[50, 250, true], [150, 214, true], [226, 168, false]].map(([x, y, done], i) => (
        <g key={i}>
          {ball(id, x, y, 21, done ? "mint" : "sky", `c${i}`)}
          {done ? <path d={`M${x - 9} ${y}l6 6 12-13`} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /> : <circle cx={x} cy={y} r="6.5" fill="#fff" />}
        </g>
      ))}
      {ball(id, 262, 86, 19, "paper", "c3", true)}
      <path d="M370 52V8" stroke="#aab2ec" strokeWidth="5" strokeLinecap="round" />
      <path d="M373 10h46q-6 14 0 28h-46z" fill={`url(#${id}-coral)`} filter={`url(#${id}-sh2)`} />
      <path d="M373 10h46q-6 14 0 28h-46z" fill={`url(#${id}-hl)`} />
      {box(id, 42, 18, 112, 14, 7, "paper", "r1", true)}
      {box(id, 42, 40, 72, 12, 6, "paper", "r2", true)}
    </svg>
  );
}

/** Stack of clay slabs with floating cards: used on the sign-in panel and the dashboard banner. */
export function IsoArt() {
  const id = "iso";
  return (
    <svg viewBox="0 0 360 260" className="art" role="img" aria-label="Stacked clay blocks with a code card and a check mark">
      <Defs id={id} />
      <ellipse cx="180" cy="232" rx="132" ry="16" fill="#1c2490" opacity="0.28" filter={`url(#${id}-bl)`} />
      {box(id, 52, 164, 256, 62, 31, "violet", "s1")}
      {box(id, 82, 118, 196, 62, 31, "indigo", "s2")}
      {box(id, 112, 72, 136, 62, 31, "sky", "s3")}
      {box(id, 22, 24, 98, 62, 20, "paper", "w1", true)}
      {well(36, 40, 46, 9, "w1a", "#6272f8")}
      {well(36, 56, 66, 7, "w1b")}
      {well(36, 69, 36, 7, "w1c")}
      {box(id, 244, 40, 88, 60, 20, "paper", "w2", true)}
      <path d="M268 60l-10 10 10 10M296 60l10 10-10 10M284 55l-6 30" fill="none" stroke="#6272f8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {ball(id, 192, 52, 26, "mint", "ok")}
      <path d="M181 52l8 8 14-16" fill="none" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" />
      {ball(id, 54, 140, 13, "coral", "b1", true)}
      {ball(id, 318, 150, 10, "butter", "b2", true)}
    </svg>
  );
}
