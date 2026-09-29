"use client";

import { useEffect } from "react";
import { Button } from "@/components/anyash/primitives";

/** Shown in place of a page if it crashes; the sidebar stays usable. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[880px] mx-auto px-5 sm:px-10 py-12">
        <h1 className="text-[20px] font-semibold text-white tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-[14px] text-zinc-400">This page hit an error. Your data is safe.</p>
        <div className="mt-5">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
