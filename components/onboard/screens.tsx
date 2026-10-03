"use client";

import React from "react";
import { Clock, HeartHandshake, Languages, Link2Off, Lock, Phone, RotateCw, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { Logo, PrimaryButton, clock12 } from "./ui";

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/** Centered, phone-width column with safe-area padding. */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="min-h-[100dvh] bg-ob-bg text-ob-ink">
      <div
        className={`mx-auto w-full max-w-[520px] px-5 ${className}`}
        style={{ paddingTop: "max(env(safe-area-inset-top), 20px)" }}
      >
        {children}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export function LoadingScreen() {
  return (
    <Page>
      <Logo />
      <div className="mt-14 space-y-4 animate-pulse motion-reduce:animate-none" aria-label="Opening the form" role="status">
        <div className="h-8 w-3/4 rounded-xl bg-ob-line" />
        <div className="h-4 w-full rounded-lg bg-ob-line/70" />
        <div className="h-4 w-5/6 rounded-lg bg-ob-line/70" />
        <div className="pt-6 space-y-3">
          <div className="h-16 rounded-2xl bg-ob-line/60" />
          <div className="h-16 rounded-2xl bg-ob-line/60" />
          <div className="h-16 rounded-2xl bg-ob-line/60" />
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome                                                             */
/* ------------------------------------------------------------------ */

const POINTS = [
  { icon: Phone, title: "A friendly call every day", text: "A short, warm chat to ask how they're doing." },
  { icon: Languages, title: "In their own language", text: "Hindi, Tamil, Bengali, Marathi and more." },
  { icon: ShieldCheck, title: "Private and safe", text: "Details are used only to make their calls personal." },
];

export function WelcomeScreen({
  friendName,
  resumed,
  onStart,
}: {
  friendName: string | null;
  resumed: boolean;
  onStart: () => void;
}) {
  const first = friendName?.split(" ")[0];
  return (
    <Page className="pb-40">
      <Logo />
      <div className="mt-10 animate-ob-in motion-reduce:animate-none">
        <p className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-ob-accent/70 text-[13px] font-medium text-ob-ink">
          <Sparkles className="w-3.5 h-3.5" aria-hidden />
          {first ? `Hi ${first}, you've been invited` : "You've been invited"}
        </p>
        <h1 className="mt-4 text-[32px] leading-[38px] font-semibold tracking-tight text-ob-ink">
          A daily check-in call for your mom or dad
        </h1>
        <p className="mt-3 text-[16px] leading-[26px] text-ob-body">
          Anyash is a caring voice companion. It calls your parent every day, chats in their language, and asks how
          they're doing, so you worry a little less.
        </p>

        <ul className="mt-8 space-y-3">
          {POINTS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5 p-4 rounded-3xl bg-ob-card ring-1 ring-ob-line shadow-[0_1px_2px_rgba(28,26,23,0.04)]">
              <span className="w-10 h-10 rounded-2xl bg-ob-soft text-ob-ink flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ob-ink leading-6">{title}</span>
                <span className="block text-[14px] text-ob-muted leading-5">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BottomBar>
        <PrimaryButton type="button" onClick={onStart}>
          {resumed ? "Continue where you left off" : "Let's start"}
        </PrimaryButton>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[13px] text-ob-muted">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          Takes about 2 minutes · 6 short steps
        </p>
      </BottomBar>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom bar                                                          */
/* ------------------------------------------------------------------ */

/** Fixed action area at the bottom, above the home indicator. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ob-bg via-ob-bg to-ob-bg/0 pt-6">
      <div className="mx-auto w-full max-w-[520px] px-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thank you                                                           */
/* ------------------------------------------------------------------ */

export interface DoneSummary {
  childName: string;
  who: string;
  parentName: string;
  callTime: string;
  language: string;
  hadWorry: boolean;
}

export function ThankYouScreen({ done, headingRef }: { done: DoneSummary; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const first = done.childName.split(" ")[0];
  const parentFirst = done.parentName.split(" ")[0] || done.who;
  const when = done.callTime ? `around ${clock12(done.callTime)}` : "at a time that suits them";
  const steps = [
    {
      icon: Phone,
      title: `Anyash will call ${parentFirst}`,
      text: `Usually ${when}, in ${done.language || "their language"}.`,
    },
    {
      icon: HeartHandshake,
      title: "The first call is a gentle hello",
      text: "Anyash introduces itself and gets to know them slowly. No long questions.",
    },
    done.hadWorry
      ? { icon: Lock, title: "What worries you stays private", text: "Anyash never mentions it to them." }
      : { icon: ShieldCheck, title: "Your answers stay private", text: "They're used only to make the calls feel personal." },
  ];

  return (
    <Page className="pb-16">
      <Logo />
      <div className="mt-12 flex flex-col items-center text-center">
        <div className="relative animate-ob-pop motion-reduce:animate-none">
          <span className="absolute inset-0 rounded-full bg-ob-good/15 scale-[1.45]" aria-hidden />
          <span className="relative w-20 h-20 rounded-full bg-ob-good flex items-center justify-center shadow-[0_10px_30px_-8px_rgba(47,125,91,0.6)]">
            <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" aria-hidden>
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="48"
                className="animate-ob-draw motion-reduce:animate-none"
              />
            </svg>
          </span>
        </div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-8 text-[30px] leading-[36px] font-semibold tracking-tight text-ob-ink outline-none animate-ob-in motion-reduce:animate-none"
        >
          {first ? `Thank you, ${first}!` : "Thank you!"}
        </h1>
        <p className="mt-2 text-[16px] leading-[26px] text-ob-body animate-ob-in motion-reduce:animate-none">
          {done.who}'s details are saved.
        </p>
      </div>

      <section className="mt-10 rounded-3xl bg-ob-card p-5 ring-1 ring-ob-line shadow-[0_1px_2px_rgba(28,26,23,0.04)] animate-ob-in [animation-delay:120ms] motion-reduce:animate-none">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ob-muted">What happens next</h2>
        <ol className="mt-4 space-y-5">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="relative w-10 h-10 rounded-2xl bg-ob-soft text-ob-ink flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" aria-hidden />
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-ob-ink text-white text-[11px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-ob-ink leading-6">{title}</span>
                <span className="block text-[14px] text-ob-muted leading-5">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-3 rounded-3xl bg-ob-accent/50 p-4 text-[14.5px] leading-6 text-ob-ink animate-ob-in [animation-delay:200ms] motion-reduce:animate-none">
        <span className="font-semibold">Tip:</span> Let {done.who} know Anyash will be calling, so they pick up.
      </div>

      <p className="mt-8 text-center text-[13.5px] leading-5 text-ob-muted">
        You can close this page now.
        <br />
        Need to change something? Tell the person who sent you this link.
      </p>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Link problems                                                       */
/* ------------------------------------------------------------------ */

export type ProblemKind = "used" | "expired" | "revoked" | "unknown" | "offline";

const PROBLEM_TITLES: Record<ProblemKind, string> = {
  used: "These details are already saved",
  expired: "This link has expired",
  revoked: "This link was turned off",
  unknown: "We couldn't find this link",
  offline: "Can't connect right now",
};

export function ProblemScreen({
  kind,
  message,
  onRetry,
}: {
  kind: ProblemKind;
  message: string;
  onRetry?: () => void;
}) {
  const Icon = kind === "offline" ? WifiOff : kind === "used" ? ShieldCheck : Link2Off;
  return (
    <Page className="pb-16">
      <Logo />
      <div className="mt-16 animate-ob-in motion-reduce:animate-none">
        <span
          className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            kind === "used" ? "bg-ob-good/10 text-ob-good" : "bg-ob-soft text-ob-muted"
          }`}
        >
          <Icon className="w-6 h-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-[26px] leading-[32px] font-semibold tracking-tight text-ob-ink">{PROBLEM_TITLES[kind]}</h1>
        <p className="mt-2 text-[16px] leading-[26px] text-ob-body">{message}</p>
        {onRetry && (
          <PrimaryButton type="button" onClick={onRetry} className="mt-8">
            <RotateCw className="w-4 h-4" aria-hidden />
            Try again
          </PrimaryButton>
        )}
      </div>
    </Page>
  );
}
