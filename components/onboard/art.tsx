"use client";

import React, { useId } from "react";

/**
 * Small illustrations in the anyash.vercel.app style: soft green watercolour
 * washes (an SVG displacement filter gives the uneven, painted edges) with
 * dark green linework. All inline, so nothing extra to download.
 */

export type ArtName =
  | "mom"
  | "dad"
  | "name"
  | "phone"
  | "language"
  | "clock"
  | "moon"
  | "home"
  | "health"
  | "pills"
  | "chat"
  | "quiet"
  | "lock";

const INK = "#174A40";
const MID = "#2C6B5C";
const SAGE = "#8FB5A6";
const MINT = "#CFE2DA";
const WASH = "#E3EEEA";
const SKIN = "#EECFB3";
const SKIN_SHADE = "#DDB394";
const CHEEK = "#E7A595";

export function Art({ name, className = "", title }: { name: ArtName; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const paint = `url(#p-${id})`;
  const soft = `url(#s-${id})`;
  return (
    <svg viewBox="0 0 160 160" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        {/* Painted edges for fills */}
        <filter id={`p-${id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* A looser wash for the background blob */}
        <filter id={`s-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      <g filter={soft}>
        <circle cx="80" cy="84" r="64" fill={WASH} />
        <circle cx="96" cy="70" r="40" fill={MINT} opacity="0.55" />
      </g>
      {ART[name](paint)}
    </svg>
  );
}

const line = { fill: "none", stroke: INK, strokeWidth: 2.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ART: Record<ArtName, (paint: string) => React.ReactNode> = {
  mom: (paint) => (
    <g>
      <g filter={paint}>
        {/* Saree */}
        <path d="M26 160 C28 128 50 112 80 112 C110 112 132 128 134 160 Z" fill={MID} />
        <path d="M58 116 C78 126 96 140 108 160 L130 160 C124 134 110 118 92 113 Z" fill={INK} opacity="0.55" />
        <path d="M70 102 h20 v14 c-6 5 -14 5 -20 0 Z" fill={SKIN_SHADE} />
        {/* Hair and bun */}
        <circle cx="106" cy="50" r="12" fill="#55605B" />
        <ellipse cx="80" cy="68" rx="31" ry="34" fill="#55605B" />
        {/* Face */}
        <ellipse cx="80" cy="72" rx="24" ry="28" fill={SKIN} />
        <path d="M55 68 C55 46 68 39 80 39 C93 39 106 46 106 68 C99 55 90 50 80 51 C70 50 61 55 55 68 Z" fill="#55605B" />
        <path d="M62 52 C68 46 74 44 80 44" stroke="#A9B3AE" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="66" cy="81" r="4.5" fill={CHEEK} opacity="0.45" />
        <circle cx="94" cy="81" r="4.5" fill={CHEEK} opacity="0.45" />
      </g>
      <circle cx="80" cy="59" r="2.2" fill="#9E3B3B" />
      <path d="M67 72 q4.5 -3.5 9 0" {...line} />
      <path d="M84 72 q4.5 -3.5 9 0" {...line} />
      <path d="M72 85 q8 6 16 0" {...line} />
      <circle cx="56.5" cy="80" r="1.8" fill="#C9A24A" />
      <circle cx="103.5" cy="80" r="1.8" fill="#C9A24A" />
    </g>
  ),
  dad: (paint) => (
    <g>
      <g filter={paint}>
        {/* Kurta */}
        <path d="M26 160 C28 128 50 112 80 112 C110 112 132 128 134 160 Z" fill={MID} />
        <path d="M80 114 v46" stroke={INK} strokeWidth="2" opacity="0.6" />
        <path d="M70 102 h20 v12 c-6 5 -14 5 -20 0 Z" fill={SKIN_SHADE} />
        {/* Ears and face */}
        <ellipse cx="55" cy="74" rx="5" ry="7" fill={SKIN_SHADE} />
        <ellipse cx="105" cy="74" rx="5" ry="7" fill={SKIN_SHADE} />
        <ellipse cx="80" cy="72" rx="25" ry="29" fill={SKIN} />
        {/* Short grey hair */}
        <path d="M55 66 C54 45 67 37 80 37 C94 37 106 45 105 66 C101 54 92 49 80 49 C68 49 59 54 55 66 Z" fill="#A4ADA9" />
        <circle cx="66" cy="83" r="4.5" fill={CHEEK} opacity="0.4" />
        <circle cx="94" cy="83" r="4.5" fill={CHEEK} opacity="0.4" />
        {/* Moustache */}
        <path d="M69 84 q11 -7 22 0 q-11 5 -22 0 Z" fill="#7F8884" />
      </g>
      {/* Glasses */}
      <circle cx="70" cy="71" r="8" {...line} strokeWidth={2} />
      <circle cx="90" cy="71" r="8" {...line} strokeWidth={2} />
      <path d="M78 70 h4" {...line} strokeWidth={2} />
      <path d="M66.5 72 q3.5 -2.5 7 0" {...line} strokeWidth={2} />
      <path d="M86.5 72 q3.5 -2.5 7 0" {...line} strokeWidth={2} />
      <path d="M73 91 q7 4.5 14 0" {...line} />
    </g>
  ),
  name: (paint) => (
    <g>
      <g filter={paint}>
        <rect x="32" y="52" width="96" height="66" rx="14" fill="#fff" />
        <rect x="32" y="52" width="96" height="24" rx="12" fill={MID} />
        <rect x="32" y="66" width="96" height="10" fill={MID} />
        <rect x="46" y="88" width="68" height="14" rx="7" fill={MINT} />
      </g>
      <rect x="32" y="52" width="96" height="66" rx="14" {...line} />
      <text x="80" y="69" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="var(--font-jakarta), sans-serif">
        HELLO
      </text>
      <path d="M52 96 q14 -8 28 0 t26 -2" {...line} strokeWidth={2} />
      <path d="M70 52 v-10 h20 v10" {...line} strokeWidth={2} />
    </g>
  ),
  phone: (paint) => (
    <g>
      <g filter={paint}>
        <rect x="56" y="34" width="50" height="92" rx="11" fill={MID} transform="rotate(-12 81 80)" />
        <rect x="61" y="44" width="40" height="70" rx="6" fill="#fff" transform="rotate(-12 81 80)" />
        <path d="M76 82 c-6 -6 -10 -14 -3 -16 c4 -1 6 3 8 3 s4 -4 8 -3 c7 2 3 10 -3 16 l-5 4 z" fill={CHEEK} transform="rotate(-12 81 80)" />
      </g>
      <path d="M116 48 q9 9 0 20" {...line} />
      <path d="M124 40 q16 17 0 36" {...line} opacity="0.6" />
      <path d="M44 100 q-9 -9 0 -20" {...line} />
      <path d="M36 108 q-16 -17 0 -36" {...line} opacity="0.6" />
    </g>
  ),
  language: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M22 44 h70 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-46 l-12 10 v-10 h-12 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 z" fill="#fff" />
        <path d="M66 92 h64 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-10 v10 l-12 -10 h-42 a10 10 0 0 1 -10 -10 v-20 a10 10 0 0 1 10 -10 z" fill={MID} />
      </g>
      <path d="M22 44 h70 a10 10 0 0 1 10 10 v22 a10 10 0 0 1 -10 10 h-46 l-12 10 v-10 h-12 a10 10 0 0 1 -10 -10 v-22 a10 10 0 0 1 10 -10 z" {...line} strokeWidth={2} />
      <text x="57" y="71" textAnchor="middle" fontSize="15" fontWeight="700" fill={INK}>नमस्ते</text>
      <text x="98" y="118" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">வணக்கம்</text>
      <circle cx="122" cy="40" r="5" fill={SAGE} />
      <circle cx="134" cy="56" r="3" fill={SAGE} />
    </g>
  ),
  clock: (paint) => (
    <g>
      <g filter={paint}>
        <circle cx="80" cy="84" r="44" fill="#fff" />
        <path d="M80 40 a44 44 0 0 1 0 88 z" fill={MINT} />
      </g>
      <circle cx="80" cy="84" r="44" {...line} />
      {[0, 90, 180, 270].map((a) => (
        <path key={a} d="M80 46 v6" {...line} strokeWidth={2} transform={`rotate(${a} 80 84)`} />
      ))}
      <path d="M80 84 V62" {...line} strokeWidth={3} />
      <path d="M80 84 L96 92" {...line} strokeWidth={3} />
      <circle cx="80" cy="84" r="3.5" fill={INK} />
      <g filter={paint}>
        <circle cx="126" cy="44" r="12" fill="#F1D37A" />
      </g>
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M126 26 v-5" stroke="#D9B44A" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${a} 126 44)`} />
      ))}
    </g>
  ),
  moon: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M98 34 a48 48 0 1 0 30 76 a40 40 0 1 1 -30 -76 z" fill={MID} />
      </g>
      <path d="M68 92 q4 -3 8 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M68 106 q8 6 16 0" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {[
        [120, 46, 4],
        [134, 70, 3],
        [112, 68, 2.4],
      ].map(([x, y, r]) => (
        <path key={x} d={`M${x} ${y - r * 2} L${x + r * 0.6} ${y - r * 0.6} L${x + r * 2} ${y} L${x + r * 0.6} ${y + r * 0.6} L${x} ${y + r * 2} L${x - r * 0.6} ${y + r * 0.6} L${x - r * 2} ${y} L${x - r * 0.6} ${y - r * 0.6} Z`} fill={SAGE} />
      ))}
    </g>
  ),
  home: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M40 80 L80 46 L120 80 V126 H40 Z" fill="#fff" />
        <path d="M32 84 L80 42 L128 84" fill="none" stroke={MID} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="70" y="96" width="20" height="30" rx="4" fill={MID} />
        <path d="M53 92 c-3 -4 -6 -9 -1 -11 c3 -1 4 2 5 2 s2 -3 5 -2 c5 2 2 7 -1 11 l-4 3 z" fill={CHEEK} />
      </g>
      <path d="M40 84 V126 H120 V84" {...line} />
      <path d="M24 126 H136" {...line} />
      <path d="M108 62 V46 h10 v24" {...line} strokeWidth={2} />
    </g>
  ),
  health: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M80 128 C46 106 30 88 30 66 C30 50 42 40 56 40 C67 40 75 46 80 56 C85 46 93 40 104 40 C118 40 130 50 130 66 C130 88 114 106 80 128 Z" fill={MINT} />
      </g>
      <path d="M80 128 C46 106 30 88 30 66 C30 50 42 40 56 40 C67 40 75 46 80 56 C85 46 93 40 104 40 C118 40 130 50 130 66 C130 88 114 106 80 128 Z" {...line} />
      <path d="M38 80 H62 L70 64 L82 98 L92 74 L98 80 H122" {...line} strokeWidth={3} />
    </g>
  ),
  pills: (paint) => (
    <g>
      <g filter={paint}>
        <rect x="30" y="62" width="100" height="56" rx="12" fill="#fff" />
        <rect x="30" y="62" width="100" height="14" rx="7" fill={MID} />
      </g>
      <rect x="30" y="62" width="100" height="56" rx="12" {...line} strokeWidth={2} />
      {["M", "T", "W", "T", "F"].map((d, i) => (
        <g key={i}>
          <text x={44 + i * 18} y="73" textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{d}</text>
          <circle cx={44 + i * 18} cy="96" r="6.5" fill={i < 3 ? MINT : SAGE} stroke={INK} strokeWidth="1.5" />
        </g>
      ))}
      <g filter={paint} transform="rotate(-30 118 44)">
        <rect x="100" y="36" width="36" height="16" rx="8" fill={MID} />
        <rect x="118" y="36" width="18" height="16" rx="8" fill={MINT} />
      </g>
    </g>
  ),
  chat: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M26 46 h72 a12 12 0 0 1 12 12 v24 a12 12 0 0 1 -12 12 h-44 l-14 12 v-12 h-14 a12 12 0 0 1 -12 -12 v-24 a12 12 0 0 1 12 -12 z" fill={MID} />
        <path d="M72 96 h50 a12 12 0 0 1 12 12 v14 a12 12 0 0 1 -12 12 h-6 v10 l-12 -10 h-32 a12 12 0 0 1 -12 -12 v-14 a12 12 0 0 1 12 -12 z" fill="#fff" />
      </g>
      <path d="M58 79 c-8 -7 -13 -14 -5 -17 c4 -1 6 2 7 3 c1 -1 3 -4 7 -3 c8 3 3 10 -5 17 l-2 2 z" fill="#fff" />
      <path d="M72 96 h50 a12 12 0 0 1 12 12 v14 a12 12 0 0 1 -12 12 h-6 v10 l-12 -10 h-32 a12 12 0 0 1 -12 -12 v-14 a12 12 0 0 1 12 -12 z" {...line} strokeWidth={2} />
      <path d="M92 124 v-14 l14 -3 v14" {...line} strokeWidth={2} />
      <circle cx="89" cy="124" r="3.5" fill={INK} />
      <circle cx="103" cy="121" r="3.5" fill={INK} />
    </g>
  ),
  quiet: (paint) => (
    <g>
      <g filter={paint}>
        <path d="M30 50 h100 a12 12 0 0 1 12 12 v30 a12 12 0 0 1 -12 12 h-62 l-16 14 v-14 h-22 a12 12 0 0 1 -12 -12 v-30 a12 12 0 0 1 12 -12 z" fill="#fff" />
      </g>
      <path d="M30 50 h100 a12 12 0 0 1 12 12 v30 a12 12 0 0 1 -12 12 h-62 l-16 14 v-14 h-22 a12 12 0 0 1 -12 -12 v-30 a12 12 0 0 1 12 -12 z" {...line} strokeWidth={2} />
      <circle cx="60" cy="77" r="5" fill={SAGE} />
      <circle cx="80" cy="77" r="5" fill={SAGE} />
      <circle cx="100" cy="77" r="5" fill={SAGE} />
      <g filter={paint}>
        <path d="M118 128 c-2 -14 8 -24 22 -24 c0 14 -8 24 -22 24 z" fill={MID} />
      </g>
      <path d="M118 128 l14 -16" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ),
  lock: (paint) => (
    <g>
      <path d="M58 76 V60 a22 22 0 0 1 44 0 v16" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <g filter={paint}>
        <rect x="42" y="74" width="76" height="58" rx="14" fill={MID} />
      </g>
      <path d="M80 112 c-8 -7 -13 -13 -6 -17 c3 -1 5 1 6 3 c1 -2 3 -4 6 -3 c7 4 2 10 -6 17 z" fill="#fff" />
    </g>
  ),
};
