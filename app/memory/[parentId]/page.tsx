"use client";

import React, { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProgressiveMemory } from "@/components/anyash/ProgressiveMemory";

export default function MemoryPage({ params }: { params: Promise<{ parentId: string }> }) {
  const { parentId } = use(params);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1080px] mx-auto px-5 sm:px-10 py-8 sm:py-12">
        <Link href="/parents" className="inline-flex items-center gap-1.5 text-[12.5px] text-zinc-500 hover:text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Parents
        </Link>
        <h1 className="mt-4 mb-2 text-[26px] font-semibold text-white tracking-tight">Memory</h1>
        <ProgressiveMemory parentId={parentId} />
      </div>
    </div>
  );
}
