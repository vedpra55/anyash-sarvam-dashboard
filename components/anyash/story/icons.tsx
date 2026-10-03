"use client";

import React from "react";
import type { Area, Mark } from "@/lib/story";

/**
 * Small custom icons for the Summary and Report tabs. 24px line art like the
 * lucide icons used elsewhere, plus one filled accent detail each. `live`
 * turns on a gentle loop (steam, flicker, ripple) used in Present mode.
 */

export const AREA_ACCENT: Record<Area, string> = {
  food: "#F5B86B",
  sleep: "#A5B4FC",
  medicine: "#6EE7B7",
  body: "#FDA4AF",
  mood: "#FEE5A5",
};

export const AREA_LABEL: Record<Area, string> = {
  food: "Food",
  sleep: "Sleep",
  medicine: "Medicine",
  body: "Body",
  mood: "Mood",
};

type IconProps = { className?: string; live?: boolean; color?: string };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Svg({ className = "w-5 h-5", children, label }: { className?: string; children: React.ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  );
}

export function FoodIcon({ className, live, color = AREA_ACCENT.food }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z" fill={color} fillOpacity={0.22} />
      <path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z" {...stroke} />
      <path d="M9 19.8h6" {...stroke} />
      <g className={live ? "ay-steam" : undefined} stroke={color} strokeWidth={1.75} fill="none" strokeLinecap="round">
        <path d="M9.5 9c-.8-1 .8-1.8 0-3" />
        <path d="M14.5 9c-.8-1 .8-1.8 0-3" />
      </g>
    </Svg>
  );
}

export function SleepIcon({ className, live, color = AREA_ACCENT.sleep }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15.5 4.2A7.8 7.8 0 1 0 19.8 15 6.6 6.6 0 0 1 15.5 4.2z" fill={color} fillOpacity={0.22} />
      <path d="M15.5 4.2A7.8 7.8 0 1 0 19.8 15 6.6 6.6 0 0 1 15.5 4.2z" {...stroke} />
      <g className={live ? "ay-float" : undefined}>
        <path d="M17 3.5h3l-3 3.5h3" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

export function MedicineIcon({ className, live, color = AREA_ACCENT.medicine }: IconProps) {
  return (
    <Svg className={className}>
      <g transform="rotate(-40 12 12)" className={live ? "ay-wiggle" : undefined}>
        <path d="M12 6.5h3.5a5.5 5.5 0 0 1 0 11H12z" fill={color} fillOpacity={0.55} />
        <rect x="3" y="6.5" width="18" height="11" rx="5.5" {...stroke} />
        <path d="M12 6.5v11" {...stroke} />
      </g>
    </Svg>
  );
}

export function BodyIcon({ className, live, color = AREA_ACCENT.body }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="13" cy="4.5" r="1.9" {...stroke} />
      <path d="M12.5 7.8 10 12.5l3 2.5-1 5" {...stroke} />
      <path d="M10 12.5 7 20" {...stroke} />
      <path d="M12.5 7.8l3.5 3 2.5-.5" {...stroke} />
      <path d="M11.3 10 8 11.5" {...stroke} />
      <circle cx="13" cy="15" r="1.7" fill={color} className={live ? "ay-pulse" : undefined} />
    </Svg>
  );
}

/** A sun face whose mouth follows the mood mark. */
export function MoodIcon({ className, live, color = AREA_ACCENT.mood, mark = "g" }: IconProps & { mark?: Mark }) {
  const mouth = mark === "w" || mark === "a" ? "M9.3 15.3c1.6-1.2 3.8-1.2 5.4 0" : mark === "o" ? "M9.3 14.5h5.4" : "M9.3 13.8c1.6 1.5 3.8 1.5 5.4 0";
  return (
    <Svg className={className}>
      <g className={live ? "ay-spin-slow" : undefined} style={{ transformOrigin: "12px 12px" }}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M12 1.6v1.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" transform={`rotate(${a} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="6.4" fill={color} fillOpacity={0.22} />
      <circle cx="12" cy="12" r="6.4" {...stroke} />
      <circle cx="9.8" cy="10.6" r=".9" fill="currentColor" />
      <circle cx="14.2" cy="10.6" r=".9" fill="currentColor" />
      <path d={mouth} {...stroke} strokeWidth={1.5} />
    </Svg>
  );
}

export function AreaIcon({ area, ...p }: IconProps & { area: Area; mark?: Mark }) {
  if (area === "food") return <FoodIcon {...p} />;
  if (area === "sleep") return <SleepIcon {...p} />;
  if (area === "medicine") return <MedicineIcon {...p} />;
  if (area === "body") return <BodyIcon {...p} />;
  return <MoodIcon {...p} />;
}

export function CallIcon({ className, live, color = "#6EE7B7" }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" fill={color} fillOpacity={0.18} />
      <path d="M5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" {...stroke} />
      <g stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" className={live ? "ay-ripple" : undefined}>
        <path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5" />
        <path d="M15 6.6A2.4 2.4 0 0 1 17.4 9" />
      </g>
    </Svg>
  );
}

export function MissedCallIcon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M5 4h3l1.5 4-2 1.3a10 10 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" {...stroke} />
      <path d="M15 4l5 5M20 4l-5 5" stroke="#FDA4AF" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** A pin with a trailing thread: something Anyash is following. */
export function PinIcon({ className, color = "#FEE5A5" }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5z" fill={color} fillOpacity={0.22} />
      <path d="M12 3a5 5 0 0 1 5 5c0 3.5-5 8-5 8s-5-4.5-5-8a5 5 0 0 1 5-5z" {...stroke} />
      <circle cx="12" cy="8" r="1.6" fill={color} />
      <path d="M12 16c0 2.5 3 2 4 3.5s-1 2-2.5 1.5" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeDasharray="2 2" />
    </Svg>
  );
}

/** A speech bubble with a small Devanagari "अ": the parent's own words. */
export function WordsIcon({ className, color = "#FEE5A5" }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M4 5h16v11H11l-4 3.5V16H4z" fill={color} fillOpacity={0.18} />
      <path d="M4 5h16v11H11l-4 3.5V16H4z" {...stroke} />
      <text x="12" y="13.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={color} fontFamily="system-ui, sans-serif">अ</text>
    </Svg>
  );
}

export function SparkIcon({ className, color = "#FEE5A5" }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" fill={color} />
    </Svg>
  );
}

export function StarIcon({ className, color = "#FEE5A5" }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill={color} />
    </Svg>
  );
}

/**
 * The streak lamp. Unlit with no streak; the flame grows at 3 and 7 days and
 * glows from 7. `ghost` draws a faint outline (the best streak).
 */
export function Diya({ days, className = "w-8 h-8", live, ghost }: { days: number; className?: string; live?: boolean; ghost?: boolean }) {
  const level = days <= 0 ? 0 : days < 3 ? 1 : days < 7 ? 2 : 3;
  const flame = [null, "M12 11.2c-1.4-1.6-.6-3.4 0-4.6.6 1.2 1.4 3 0 4.6z", "M12 11.2c-2-1.9-1-4.6 0-6.4 1 1.8 2 4.5 0 6.4z", "M12 11.4c-2.6-2.2-1.4-5.8 0-8.2 1.4 2.4 2.6 6 0 8.2z"][level];
  const op = ghost ? 0.28 : 1;
  return (
    <Svg className={className} label={ghost ? undefined : days > 0 ? `${days} day streak` : "No streak right now"}>
      {level === 3 && !ghost && <circle cx="12" cy="8" r="6.5" fill="#FEE5A5" opacity={0.16} className={live ? "ay-glow" : undefined} />}
      <path d="M3.5 13.2c2.2 0 3.4.6 8.5.6s6.3-.6 8.5-.6c-.6 4-4.4 6.6-8.5 6.6s-7.9-2.6-8.5-6.6z" fill="#E7A059" opacity={op * 0.9} />
      <path d="M3.5 13.2c2.2 0 3.4.6 8.5.6s6.3-.6 8.5-.6" stroke="#F5C68B" strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={op} />
      <path d="M8 16.6h8" stroke="#B66A2C" strokeWidth={1} strokeLinecap="round" opacity={op * 0.6} />
      <path d="M12 13.4v-1.8" stroke={level ? "#71553A" : "#52525B"} strokeWidth={1.2} strokeLinecap="round" opacity={op} />
      {flame && (
        <g className={live && !ghost ? "ay-flicker" : undefined} style={{ transformOrigin: "12px 12px" }} opacity={op}>
          <path d={flame} fill="#FDBA4D" />
          <path d={flame} fill="#FEF3C7" transform="translate(12 11) scale(.5) translate(-12 -11)" />
        </g>
      )}
    </Svg>
  );
}
