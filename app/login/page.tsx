"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Unlock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from");
  const returnTo = rawFrom && rawFrom.startsWith("/") ? rawFrom : "/";

  const [digits, setDigits] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Auto-focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const submitPasscode = async (codeToSubmit: string) => {
    if (codeToSubmit.length !== 5 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: codeToSubmit }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Incorrect passcode");
        triggerShake();
        setDigits(["", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      setUnlocked(true);
      // Small pause for unlocked animation then redirect
      setTimeout(() => {
        router.push(returnTo);
        router.refresh();
      }, 400);
    } catch {
      setError("Unable to connect to server. Please try again.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index: number, val: string) => {
    setError(null);
    if (!val) {
      const copy = [...digits];
      copy[index] = "";
      setDigits(copy);
      return;
    }

    // Take only the last character entered
    const char = val.slice(-1);
    const copy = [...digits];
    copy[index] = char;
    setDigits(copy);

    // Auto-advance
    if (index < 4) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // Completed 5 characters - auto submit
      const fullCode = copy.join("");
      if (fullCode.length === 5) {
        submitPasscode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        e.preventDefault();
        const copy = [...digits];
        copy[index - 1] = "";
        setDigits(copy);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 4) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      const fullCode = digits.join("");
      if (fullCode.length === 5) {
        submitPasscode(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (!pasted) return;

    const chars = pasted.slice(0, 5).split("");
    const newDigits = ["", "", "", "", ""];
    for (let i = 0; i < 5; i++) {
      newDigits[i] = chars[i] || "";
    }
    setDigits(newDigits);

    if (chars.length === 5) {
      inputRefs.current[4]?.focus();
      submitPasscode(newDigits.join(""));
    } else {
      const nextIdx = Math.min(chars.length, 4);
      inputRefs.current[nextIdx]?.focus();
    }
  };

  const fullCode = digits.join("");
  const isComplete = fullCode.length === 5;

  return (
    <div className="relative w-full max-w-[420px] px-4">
      {/* Subtle background glow */}
      <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500/10 via-amber-200/5 to-transparent rounded-3xl blur-xl opacity-70 pointer-events-none" />

      <div
        className={`relative bg-ay-surface border border-ay-line rounded-2xl p-7 sm:p-8 shadow-2xl transition-transform duration-200 ${
          shake ? "animate-[shake_0.4s_ease-in-out]" : ""
        }`}
      >
        {/* Header Icon */}
        <div className="flex justify-center mb-6">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              unlocked
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-white/[0.04] text-ay-accent border border-white/[0.08]"
            }`}
          >
            {unlocked ? (
              <Unlock className="w-6 h-6 animate-pulse" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-7">
          <h1 className="text-[20px] font-semibold text-white tracking-tight">
            Anyash Operator Access
          </h1>
          <p className="text-[13px] text-zinc-400 mt-1.5">
            Enter your 5-character passcode to unlock the console
          </p>
        </div>

        {/* 5-Slot Passcode Input */}
        <div className="flex justify-center gap-2.5 sm:gap-3 mb-6" onPaste={handlePaste}>
          {digits.map((digit, index) => {
            const hasVal = Boolean(digit);
            return (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={2}
                value={digit}
                disabled={loading || unlocked}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-11 sm:w-12 h-14 sm:h-14 text-center text-[22px] font-mono font-semibold rounded-xl bg-ay-raised text-white transition-all outline-none border ${
                  error
                    ? "border-rose-500/60 bg-rose-500/[0.04] text-rose-200"
                    : hasVal
                    ? "border-ay-accent/60 ring-1 ring-ay-accent/30"
                    : "border-white/[0.08] focus:border-ay-accent focus:ring-1 focus:ring-ay-accent/30 hover:border-white/[0.15]"
                }`}
              />
            );
          })}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="flex items-center justify-center gap-2 mb-5 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Button */}
        <button
          type="button"
          onClick={() => submitPasscode(fullCode)}
          disabled={!isComplete || loading || unlocked}
          className={`w-full h-11 rounded-xl text-[13.5px] font-medium flex items-center justify-center gap-2 transition-all ${
            unlocked
              ? "bg-emerald-500 text-black font-semibold"
              : isComplete
              ? "bg-ay-accent hover:bg-ay-accent-hover text-black cursor-pointer shadow-lg shadow-amber-500/10"
              : "bg-white/[0.05] text-zinc-500 cursor-not-allowed"
          }`}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : unlocked ? (
            <>
              <ShieldCheck className="w-4 h-4" />
              <span>Unlocked</span>
            </>
          ) : (
            <>
              <span>Unlock Console</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Footnote reassurance */}
        <p className="mt-6 text-center text-[12px] text-zinc-500 leading-relaxed border-t border-ay-line pt-4">
          Public parent onboarding links (<code className="text-zinc-400">/onboard/*</code>) remain active and do not require this passcode.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-ay-canvas text-zinc-300 py-12">
      <Suspense
        fallback={
          <div className="w-10 h-10 border-2 border-zinc-700 border-t-ay-accent rounded-full animate-spin" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
