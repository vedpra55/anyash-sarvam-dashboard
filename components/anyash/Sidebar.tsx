"use client";

import React from "react";
import { Users, Phone } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  activeTab?: "parents" | "calls";
  userName?: string;
  userEmail?: string;
}

export function Sidebar({
  activeTab,
  userName = "Ved Pratap",
  userEmail = "ved@gmail.com",
}: SidebarProps) {
  const pathname = usePathname();
  const currentTab = activeTab || (pathname?.startsWith("/calls") ? "calls" : "parents");
  const initial = userName ? userName.charAt(0).toUpperCase() : "V";

  return (
    <aside className="w-[240px] shrink-0 h-screen bg-[#0C0D0E] border-r border-[#1C1F24] flex flex-col justify-between p-4 select-none">
      {/* Top Branding & Navigation */}
      <div className="space-y-6">
        {/* Brand */}
        <div className="px-3 pt-2">
          <Link href="/">
            <h1 className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity">
              Anyash
            </h1>
          </Link>
        </div>

        {/* Nav Links: Only Parents and Calls */}
        <nav className="space-y-1.5">
          <Link
            href="/"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentTab === "parents"
                ? "bg-[#181A1D] text-white shadow-sm"
                : "text-[#8E929A] hover:text-white hover:bg-[#141619]"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Parents</span>
          </Link>

          <Link
            href="/calls"
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentTab === "calls"
                ? "bg-[#181A1D] text-white shadow-sm"
                : "text-[#8E929A] hover:text-white hover:bg-[#141619]"
            }`}
          >
            <Phone className="w-4 h-4 shrink-0" />
            <span>Calls</span>
          </Link>
        </nav>
      </div>

      {/* Bottom User Profile */}
      <div className="pt-4 border-t border-[#1C1F24]/80 flex items-center gap-3 px-2">
        <div className="w-9 h-9 rounded-full bg-[#202329] border border-[#2D3139] flex items-center justify-center text-sm font-semibold text-white shrink-0">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate leading-tight">
            {userName}
          </div>
          <div className="text-xs text-[#717680] truncate leading-tight mt-0.5">
            {userEmail}
          </div>
        </div>
      </div>
    </aside>
  );
}
