"use client";

import React, { useState } from "react";
import { Sun, Users, Phone, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgentSettingsModal } from "./AgentSettingsModal";

const NAV = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/parents", label: "Parents", icon: Users },
  { href: "/calls", label: "Calls", icon: Phone },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Left navigation on desktop, a top bar on small screens. Wraps every page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full overflow-hidden bg-ay-canvas text-zinc-300">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-[216px] shrink-0 flex-col border-r border-ay-line px-3 py-5">
        <Link href="/" className="px-3 text-[17px] font-semibold text-white tracking-tight">
          Anyash
        </Link>
        <nav className="mt-7 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] transition-colors ${
                  active ? "bg-white/[0.06] text-white" : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => setSettingsOpen(true)}
          className="mt-auto flex items-center gap-3 h-9 px-3 rounded-lg text-[13.5px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.03] transition-colors"
        >
          <Settings className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          Settings
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden shrink-0 flex items-center gap-1 h-12 px-3 border-b border-ay-line">
        <Link href="/" className="px-1 mr-2 text-[15px] font-semibold text-white">
          Anyash
        </Link>
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`h-8 px-2.5 inline-flex items-center rounded-md text-[13px] ${
              isActive(pathname, href) ? "bg-white/[0.07] text-white" : "text-zinc-500"
            }`}
          >
            {label}
          </Link>
        ))}
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="ml-auto w-8 h-8 inline-flex items-center justify-center text-zinc-500"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      <main className="flex-1 min-w-0 min-h-0 flex">{children}</main>

      <AgentSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
