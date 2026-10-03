"use client";

import React from "react";
import { Clock, Languages, Link2Off, Phone, RotateCw, ShieldCheck, WifiOff } from "lucide-react";
import { Logo, PrimaryButton, SecondaryButton, clock12 } from "./ui";

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/** Phone-width column with safe-area padding. */
export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="min-h-[100dvh] bg-ob-bg text-ob-ink">
      <div className={`mx-auto w-full max-w-[520px] px-5 ${className}`} style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        {children}
      </div>
    </main>
  );
}

/** Fixed action area at the bottom, above the home indicator. */
export function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-ob-bg from-70% to-ob-bg/0 pt-8">
      <div className="mx-auto w-full max-w-[520px] px-5" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
        {children}
      </div>
    </div>
  );
}

/** Soft painted circle behind a picture, like the washes on anyash.vercel.app. */
function Wash({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={`absolute inset-0 w-full h-full ${className}`} aria-hidden>
      <defs>
        <filter id="wash-f" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter="url(#wash-f)">
        <circle cx="100" cy="104" r="86" fill="#E3EEEA" />
        <circle cx="122" cy="84" r="50" fill="#CFE2DA" opacity="0.55" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

export function LoadingScreen() {
  return (
    <Page>
      <Logo className="h-8" />
      <div className="mt-12 space-y-4 animate-pulse motion-reduce:animate-none" role="status" aria-label="Opening the form">
        <div className="mx-auto h-44 w-44 rounded-full bg-ob-mint" />
        <div className="h-8 w-4/5 rounded-xl bg-ob-line" />
        <div className="h-4 w-full rounded-lg bg-ob-line/70" />
        <div className="h-4 w-2/3 rounded-lg bg-ob-line/70" />
        <div className="pt-4 h-14 rounded-full bg-ob-line/60" />
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Welcome                                                             */
/* ------------------------------------------------------------------ */

const POINTS = [
  { icon: Phone, text: "A short, warm call every day" },
  { icon: Languages, text: "In Hindi, Tamil, Bengali and 10 more" },
  { icon: ShieldCheck, text: "Private. Used only for their calls" },
];

export function WelcomeScreen({ friendName, resumed, onStart }: { friendName: string | null; resumed: boolean; onStart: () => void }) {
  const first = friendName?.split(" ")[0];
  return (
    <Page className="pb-44">
      <Logo className="h-8" />

      <div className="relative mt-6 mx-auto w-full max-w-[340px] aspect-[720/591] animate-ob-in motion-reduce:animate-none">
        <Wash className="scale-110" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/onboard/with-parent.webp"
          alt="A mother smiling while talking on her phone"
          width={720}
          height={591}
          className="relative w-full h-full object-contain rounded-[28px] [mask-image:radial-gradient(ellipse_at_center,black_62%,transparent_76%)]"
        />
      </div>

      <div className="mt-4 animate-ob-in [animation-delay:80ms] motion-reduce:animate-none">
        {first && <p className="font-script text-[30px] leading-none text-ob-brand">Hi {first},</p>}
        <p className={`${first ? "mt-3" : ""} text-[12px] font-bold uppercase tracking-[0.14em] text-ob-brand`}>The daily health call for parents</p>
        <h1 className="mt-2 text-[32px] leading-[1.12] font-extrabold tracking-tight text-ob-ink [text-wrap:balance]">
          Someone to check on your mom or dad, every day.
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ob-muted">
          <strong className="font-semibold text-ob-ink">Anyash</strong> calls your parent, chats in their language, and asks how
          they&apos;re doing, so you worry a little less.
        </p>
        <ul className="mt-6 space-y-3">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[16px] text-ob-body">
              <span className="w-9 h-9 rounded-full bg-ob-mint text-ob-brand flex items-center justify-center shrink-0">
                <Icon className="w-[18px] h-[18px]" aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <BottomBar>
        <PrimaryButton type="button" onClick={onStart}>
          {resumed ? "Continue where you left off" : "Get started"}
        </PrimaryButton>
        <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[13px] text-ob-muted">
          <Clock className="w-3.5 h-3.5" aria-hidden />
          Takes about 2 minutes
        </p>
      </BottomBar>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/* Checkpoint after the required questions                             */
/* ------------------------------------------------------------------ */

export function GateView({
  childName,
  who,
  onMore,
  onFinish,
  headingRef,
}: {
  childName: string;
  who: string;
  onMore: () => void;
  onFinish: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const first = childName.split(" ")[0];
  return (
    <div className="text-center">
      <div className="relative mx-auto w-40 h-40 animate-ob-pop motion-reduce:animate-none">
        <Wash />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/onboard/check.webp" alt="" width={360} height={360} className="relative w-full h-full object-contain p-4" />
      </div>
      {first && <p className="mt-4 font-script text-[30px] leading-none text-ob-brand">Well done, {first}!</p>}
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-[28px] leading-[1.15] font-extrabold tracking-tight text-ob-ink outline-none [text-wrap:balance]">
        That&apos;s all we need to start.
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ob-muted [text-wrap:balance]">
        Want to tell us a little more about {who}? It helps Anyash make every call feel personal. About 1 minute.
      </p>
      <div className="mt-8 space-y-3">
        <PrimaryButton type="button" onClick={onMore}>
          Add a few more details
        </PrimaryButton>
        <SecondaryButton type="button" onClick={onFinish}>
          Finish now
        </SecondaryButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thank you                                                           */
/* ------------------------------------------------------------------ */

export interface DoneSummary {
  childName: string;
  /** "your mom" / "your dad" */
  parent: string;
  /** What the child calls them, e.g. "Mummy". */
  who: string;
  /** "her" / "him" */
  her: string;
  callTime: string;
  language: string;
  hadWorry: boolean;
}

const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const dist = 90 + (i % 3) * 28;
  return {
    dx: `${Math.round(Math.cos(angle) * dist)}px`,
    dy: `${Math.round(Math.sin(angle) * dist - 20)}px`,
    rot: `${(i % 2 ? 1 : -1) * (120 + i * 20)}deg`,
    color: ["#174A40", "#8FB5A6", "#F1D37A", "#2C6B5C", "#E7A595"][i % 5],
    delay: `${(i % 4) * 40}ms`,
    round: i % 3 === 0,
  };
});

export function ThankYouScreen({ done, headingRef }: { done: DoneSummary; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const first = done.childName.split(" ")[0];
  const when = done.callTime ? `around ${clock12(done.callTime)}` : "at a time that suits them";
  const steps = [
    { title: `Anyash will call ${done.who}`, text: `Usually ${when}, in ${done.language || "their language"}.` },
    { title: "The first call is a gentle hello", text: `Anyash introduces itself and gets to know ${done.her} slowly.` },
    done.hadWorry
      ? { title: "Your worry stays private", text: `Anyash will never mention it to ${done.her}.` }
      : { title: "Your answers stay private", text: "Used only to make the calls feel personal." },
  ];

  return (
    <Page className="pb-14">
      <Logo className="h-8" />
      <div className="mt-8 flex flex-col items-center text-center">
        <div className="relative w-44 h-44">
          <Wash />
          <div className="absolute inset-0 pointer-events-none motion-reduce:hidden" aria-hidden>
            {CONFETTI.map((c, i) => (
              <span
                key={i}
                className={`absolute left-1/2 top-1/2 -ml-1 -mt-1 w-2 h-2.5 animate-ob-confetti ${c.round ? "rounded-full" : "rounded-[2px]"}`}
                style={{ background: c.color, animationDelay: c.delay, ["--dx" as string]: c.dx, ["--dy" as string]: c.dy, ["--rot" as string]: c.rot } as React.CSSProperties}
              />
            ))}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/onboard/check.webp" alt="" width={360} height={360} className="relative w-full h-full object-contain p-5 animate-ob-pop motion-reduce:animate-none" />
        </div>
        {first && <p className="mt-2 font-script text-[34px] leading-none text-ob-brand animate-ob-in [animation-delay:200ms] motion-reduce:animate-none">Thank you, {first}!</p>}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-[28px] leading-[1.15] font-extrabold tracking-tight text-ob-ink outline-none [text-wrap:balance] animate-ob-in [animation-delay:260ms] motion-reduce:animate-none"
        >
          {done.who}&apos;s details are saved.
        </h1>
      </div>

      <section className="mt-8 rounded-[24px] border border-ob-line bg-ob-card p-5 shadow-[0_1px_2px_rgba(32,39,36,0.04)] animate-ob-in [animation-delay:360ms] motion-reduce:animate-none">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ob-brand">What happens next</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3.5">
              <span className="w-8 h-8 rounded-full bg-ob-brand text-white text-[14px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span>
                <span className="block text-[16px] font-semibold text-ob-ink leading-6">{s.title}</span>
                <span className="block text-[15px] text-ob-muted leading-6">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-3 rounded-[24px] bg-ob-mint p-4 text-[15px] leading-6 text-ob-ink animate-ob-in [animation-delay:440ms] motion-reduce:animate-none">
        <span className="font-semibold text-ob-brand">Tip:</span> Tell {done.who} that Anyash will be calling, so {done.her === "him" ? "he picks" : done.her === "her" ? "she picks" : "they pick"} up.
      </div>

      <p className="mt-8 text-center text-[14px] leading-6 text-ob-muted">
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

export function ProblemScreen({ kind, message, onRetry }: { kind: ProblemKind; message: string; onRetry?: () => void }) {
  const Icon = kind === "offline" ? WifiOff : kind === "used" ? ShieldCheck : Link2Off;
  return (
    <Page className="pb-14">
      <Logo className="h-8" />
      <div className="mt-16 animate-ob-in motion-reduce:animate-none">
        <span className={`w-16 h-16 rounded-full flex items-center justify-center ${kind === "used" ? "bg-ob-mint text-ob-brand" : "bg-ob-soft text-ob-muted"}`}>
          <Icon className="w-7 h-7" aria-hidden />
        </span>
        <h1 className="mt-6 text-[28px] leading-[1.15] font-extrabold tracking-tight text-ob-ink">{PROBLEM_TITLES[kind]}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ob-muted">{message}</p>
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
