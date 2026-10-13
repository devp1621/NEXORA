import { useId } from "react";

/** Nexora mark, sculpted in clay: a puffy indigo tile, a soft "N" pressed into it and a cyan clay ball for the next frontier. */
export function Logo({ size = 32, title }) {
  const uid = "nx" + useId().replace(/[^a-z0-9]/gi, "");
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className="logo"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`${uid}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a4aeff" />
          <stop offset="0.5" stopColor="#6272f8" />
          <stop offset="1" stopColor="#4350d9" />
        </linearGradient>
        <radialGradient id={`${uid}h`} cx="0.28" cy="0.18" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.8" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#1c2490" stopOpacity="0" />
          <stop offset="1" stopColor="#1c2490" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={`${uid}n`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6dbff" />
        </linearGradient>
        <radialGradient id={`${uid}c`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#c9f7ff" />
          <stop offset="0.55" stopColor="#4fd8ee" />
          <stop offset="1" stopColor="#12a5c8" />
        </radialGradient>
        <filter id={`${uid}d`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="2.6" floodColor="#2a34b8" floodOpacity="0.45" />
        </filter>
        <filter id={`${uid}e`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.1" floodColor="#1c2490" floodOpacity="0.5" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="19" fill={`url(#${uid}t)`} filter={`url(#${uid}d)`} />
      <rect width="64" height="64" rx="19" fill={`url(#${uid}h)`} />
      <rect width="64" height="64" rx="19" fill={`url(#${uid}s)`} />
      <rect x="1.2" y="1.2" width="61.6" height="61.6" rx="17.8" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.4" />
      <path d="M20 47V19l24 28V21" fill="none" stroke={`url(#${uid}n)`} strokeWidth="6.6" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${uid}e)`} />
      <circle cx="45" cy="14.5" r="6.4" fill={`url(#${uid}c)`} filter={`url(#${uid}e)`} />
      <ellipse cx="43.2" cy="12.4" rx="2.2" ry="1.4" fill="#fff" opacity="0.8" />
    </svg>
  );
}
