"use client";

import React from "react";

/** A placeholder bar. Pulses unless the user prefers reduced motion. */
export function Bone({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={style}
      className={`block rounded-md bg-white/[0.05] motion-safe:animate-pulse ${className}`}
    />
  );
}

function Busy({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function RowLines({ rows, withAction = false }: { rows: number; withAction?: boolean }) {
  return (
    <ul className="divide-y divide-ay-line border-t border-ay-line">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="py-4 flex items-center gap-6">
          <div className="flex-1 space-y-2">
            <Bone className="h-3.5 w-48" />
            <Bone className="h-3 w-[70%]" />
          </div>
          {withAction && <Bone className="h-8 w-16 rounded-full" />}
        </li>
      ))}
    </ul>
  );
}

export function TodaySkeleton() {
  return (
    <Busy label="Loading today">
      <Bone className="mt-4 h-3.5 w-72" />
      <div className="mt-10">
        <Bone className="h-3 w-28 mb-3" />
        <RowLines rows={2} withAction />
      </div>
      <div className="mt-12">
        <Bone className="h-3 w-28 mb-3" />
        <RowLines rows={4} />
      </div>
    </Busy>
  );
}

export function ParentListSkeleton() {
  return (
    <Busy label="Loading parents">
      <ul className="px-2 space-y-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="px-3 py-3 space-y-2">
            <div className="flex items-center gap-2.5">
              <Bone className="h-1.5 w-1.5 rounded-full" />
              <Bone className="h-3.5 w-28" />
              <Bone className="ml-auto h-3 w-12" />
            </div>
            <Bone className="ml-4 h-3 w-[75%]" />
          </li>
        ))}
      </ul>
    </Busy>
  );
}

export function ParentDetailSkeleton() {
  return (
    <Busy label="Loading parent">
      <div className="px-5 sm:px-10 pt-6 sm:pt-8 max-w-[860px]">
        <div className="flex items-start justify-between">
          <div className="space-y-2.5">
            <Bone className="h-6 w-40" />
            <Bone className="h-3 w-64" />
          </div>
          <Bone className="h-9 w-32 rounded-full" />
        </div>
        <div className="mt-8 flex gap-6 border-b border-ay-line pb-3">
          {[64, 44, 56, 48].map((w) => (
            <Bone key={w} className="h-3" style={{ width: w }} />
          ))}
        </div>
        <div className="pt-8 space-y-3">
          <Bone className="h-4 w-36" />
          <Bone className="h-3.5 w-[80%]" />
        </div>
        <div className="pt-10 space-y-3">
          <Bone className="h-3 w-28" />
          <Bone className="h-4 w-[90%]" />
          <Bone className="h-4 w-[60%]" />
        </div>
        <div className="pt-10 space-y-2">
          <Bone className="h-3 w-24 mb-3" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Bone key={i} className="h-5 w-[440px] max-w-full" />
          ))}
        </div>
      </div>
    </Busy>
  );
}

export function CallsSkeleton() {
  return (
    <Busy label="Loading calls">
      {[3, 2].map((rows, g) => (
        <section key={g} className="pt-6">
          <Bone className="h-3 w-24 mb-3" />
          <ul className="divide-y divide-ay-line border-t border-ay-line">
            {Array.from({ length: rows }).map((_, i) => (
              <li key={i} className="py-4 grid grid-cols-[56px_1fr] md:grid-cols-[64px_180px_1fr_64px_150px] gap-4 items-center">
                <Bone className="h-3 w-12" />
                <Bone className="h-3.5 w-28" />
                <Bone className="hidden md:block h-3 w-[80%]" />
                <Bone className="hidden md:block h-3 w-10 ml-auto" />
                <Bone className="hidden md:block h-3 w-24" />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Busy>
  );
}

/** Lines of text-shaped placeholders, for drawer and memory panels. */
export function TextSkeleton({ lines = 4, label = "Loading" }: { lines?: number; label?: string }) {
  const widths = ["92%", "78%", "85%", "60%", "70%", "88%"];
  return (
    <Busy label={label}>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Bone key={i} className="h-3.5" style={{ width: widths[i % widths.length] }} />
        ))}
      </div>
    </Busy>
  );
}
