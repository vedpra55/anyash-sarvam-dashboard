"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { OnboardingErrors, OnboardingInput, onboardingErrors } from "@/lib/onboarding";
import {
  EXTRA_STEPS,
  OPTIONAL_STEPS,
  REQUIRED_STEPS,
  STEP_FIELDS,
  StepKey,
  cap,
  hasAnswer,
  reviewRows,
  stepErrors,
  stepView,
  wordsFor,
} from "@/components/onboard/steps";
import {
  BottomBar,
  DoneSummary,
  GateView,
  LoadingScreen,
  Page,
  ProblemKind,
  ProblemScreen,
  ThankYouScreen,
  WelcomeScreen,
} from "@/components/onboard/screens";
import { Logo, PrimaryButton } from "@/components/onboard/ui";

/**
 * Public page a friend opens from a single-use invite link, usually on their
 * phone, to add one parent: Mom or Dad. One question per screen; tap answers
 * move on by themselves. Answers are kept on the phone until they're saved.
 */

const EMPTY: OnboardingInput = {
  parent_name: "",
  honorific: "",
  language: "",
  phone_number: "",
  child_name: "",
  parent_role: "",
  relationship: "",
  living_situation: "",
  household_help: "",
  wake_time: "",
  sleep_time: "",
  preferred_call_time: "",
  conditions: [],
  medicines: [],
  enjoys: "",
  avoid_topics: "",
  child_worry: "",
};

type Screen = "welcome" | StepKey | "gate" | "review";
const SEQ: Screen[] = ["welcome", ...REQUIRED_STEPS, "gate", ...EXTRA_STEPS, "review"];
const ALL_STEPS: StepKey[] = [...REQUIRED_STEPS, ...EXTRA_STEPS];
const isStep = (s: Screen): s is StepKey => s !== "welcome" && s !== "gate" && s !== "review";
const isScreen = (s: unknown): s is Screen => typeof s === "string" && (SEQ as string[]).includes(s);

/** Pause after a one-tap answer, so the choice is seen before moving on. */
const TAP_DELAY = 280;

type Phase =
  | { kind: "checking" }
  | { kind: "form" }
  | { kind: "done"; summary: DoneSummary }
  | { kind: "problem"; problem: ProblemKind; message: string };

/** The server's errors that belong to a step's fields. */
function serverErrorsFor(errors: OnboardingErrors, step: Screen): OnboardingErrors {
  if (!isStep(step)) return {};
  const out: OnboardingErrors = {};
  for (const f of STEP_FIELDS[step]) if (errors[f]) out[f] = errors[f];
  return out;
}

/* ------------------------------------------------------------------ */
/* Answers kept on this phone                                          */
/* ------------------------------------------------------------------ */

const draftKey = (token: string) => `anyash:onboard:v2:${token.slice(0, 20)}`;
const doneKey = (token: string) => `anyash:onboard-done:v2:${token.slice(0, 20)}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: the form still works, it just isn't kept.
  }
}
function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

interface Draft {
  v: 2;
  form: OnboardingInput;
  screen: Screen;
}

/** A stored draft, checked field by field so an old or edited copy can't break the form. */
function readDraft(token: string): Draft | null {
  const d = readJson<Draft>(draftKey(token));
  if (!d || d.v !== 2 || typeof d.form !== "object" || !d.form) return null;
  const form = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof OnboardingInput)[]) {
    const v = (d.form as any)[k];
    if (Array.isArray(EMPTY[k])) (form as any)[k] = Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : [];
    else if (typeof v === "string") (form as any)[k] = v;
  }
  if (form.parent_role !== "mother" && form.parent_role !== "father") form.parent_role = "";
  return { v: 2, form, screen: isScreen(d.screen) ? d.screen : "welcome" };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [checkKey, setCheckKey] = useState(0);
  const [friendName, setFriendName] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardingInput>(EMPTY);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [dir, setDir] = useState<"next" | "prev">("next");
  /** Where a returning person stopped ("welcome" when starting fresh). */
  const [resumeAt, setResumeAt] = useState<Screen>("welcome");
  /** Steps where Continue was pressed: their errors show, and update while typing. */
  const [attempted, setAttempted] = useState<Set<StepKey>>(() => new Set());
  /** Errors the server sent back for a field (e.g. a phone number already on file). */
  const [serverErrors, setServerErrors] = useState<OnboardingErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Set when a step was opened from the review: moving on goes back there. */
  const [returnToReview, setReturnToReview] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Latest values for timers and history events.
  const formRef = useRef(form);
  const screenRef = useRef(screen);
  const phaseRef = useRef(phase.kind);
  const returnRef = useRef(returnToReview);
  const serverErrorsRef = useRef(serverErrors);
  useEffect(() => {
    formRef.current = form;
    screenRef.current = screen;
    phaseRef.current = phase.kind;
    returnRef.current = returnToReview;
    serverErrorsRef.current = serverErrors;
  });
  const depthRef = useRef(0);
  const advancingRef = useRef(false);

  /* ---------- Check the link ---------- */
  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "checking" });
    fetch(`/api/onboarding/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          const label: string | null = typeof data.label === "string" ? data.label : null;
          setFriendName(label);
          const draft = readDraft(token);
          if (draft) {
            setForm(draft.form);
            setResumeAt(draft.screen);
          } else if (label) {
            setForm({ ...EMPTY, child_name: label.split(" ")[0] });
          }
          setScreen("welcome");
          setPhase({ kind: "form" });
          return;
        }
        const state = (data.state as ProblemKind) || "unknown";
        // Opened again after finishing on this phone: show the thank-you again.
        const done = state === "used" ? readJson<DoneSummary>(doneKey(token)) : null;
        if (done && typeof done.who === "string") setPhase({ kind: "done", summary: done });
        else setPhase({ kind: "problem", problem: state, message: data.error || "This link can't be used." });
      })
      .catch(() => {
        if (cancelled) return;
        setPhase({ kind: "problem", problem: "offline", message: "Please check your internet connection and try again. Nothing you've typed will be lost." });
      });
    return () => {
      cancelled = true;
    };
  }, [token, checkKey]);

  /* ---------- Keep answers on this phone ---------- */
  useEffect(() => {
    if (phase.kind !== "form") return;
    // On the welcome screen, keep the place they stopped at.
    writeJson(draftKey(token), { v: 2, form, screen: screen === "welcome" ? resumeAt : screen } satisfies Draft);
  }, [form, screen, resumeAt, phase.kind, token]);

  /* ---------- Moving between screens, and the phone's back button ---------- */
  useEffect(() => {
    if (phase.kind !== "form") return;
    window.history.replaceState({ ...(window.history.state || {}), anyashScreen: "welcome", depth: 0 }, "");
    depthRef.current = 0;
    const onPop = (e: PopStateEvent) => {
      if (phaseRef.current !== "form") return;
      const s = e.state?.anyashScreen;
      if (!isScreen(s)) return;
      depthRef.current = e.state?.depth ?? 0;
      setDir(SEQ.indexOf(s) < SEQ.indexOf(screenRef.current) ? "prev" : "next");
      setReturnToReview(false);
      setScreen(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [phase.kind]);

  const goTo = useCallback((next: Screen) => {
    depthRef.current += 1;
    window.history.pushState({ ...(window.history.state || {}), anyashScreen: next, depth: depthRef.current }, "");
    setDir(SEQ.indexOf(next) < SEQ.indexOf(screenRef.current) ? "prev" : "next");
    screenRef.current = next;
    setScreen(next);
  }, []);

  const goBack = () => {
    setReturnToReview(false);
    if (depthRef.current > 0) return window.history.back(); // popstate sets the screen
    // Resumed mid-way with no history: step back through the order.
    let prev = SEQ[Math.max(0, SEQ.indexOf(screen) - 1)];
    if (screen === "review" && !EXTRA_STEPS.some((s) => hasAnswer(s, form))) prev = "gate";
    window.history.replaceState({ ...(window.history.state || {}), anyashScreen: prev, depth: 0 }, "");
    setDir("prev");
    setScreen(prev);
  };

  // New screen: start at the top and move focus to its heading (no keyboard pop-up).
  useEffect(() => {
    if (phase.kind === "checking") return;
    window.scrollTo({ top: 0 });
    if (phase.kind === "done" || screen !== "welcome") headingRef.current?.focus({ preventScroll: true });
  }, [screen, phase.kind]);

  /* ---------- Answers ---------- */
  const set = useCallback(<K extends keyof OnboardingInput>(key: K, v: OnboardingInput[K]) => {
    setForm((f) => ({ ...f, [key]: v }));
    setServerErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setSubmitError("");
  }, []);

  /** Validates a step against the given answers and moves on when it's fine. */
  const advanceFrom = useCallback(
    (s: Screen, f: OnboardingInput) => {
      if (!isStep(s)) return;
      const errs = { ...stepErrors(s, f, onboardingErrors(f)), ...serverErrorsFor(serverErrorsRef.current, s) };
      if (Object.keys(errs).length) {
        setAttempted((a) => new Set(a).add(s));
        return;
      }
      if (returnRef.current) {
        setReturnToReview(false);
        returnRef.current = false;
        return goTo("review");
      }
      goTo(SEQ[Math.min(SEQ.indexOf(s) + 1, SEQ.length - 1)]);
    },
    [goTo],
  );

  /** One-tap answers: set, show the choice for a moment, then move on. */
  const pick = useCallback(
    (patch: Partial<OnboardingInput>) => {
      const f = { ...formRef.current, ...patch };
      formRef.current = f;
      setForm(f);
      setServerErrors((e) => {
        const next = { ...e };
        for (const k of Object.keys(patch) as (keyof OnboardingInput)[]) delete next[k];
        serverErrorsRef.current = next;
        return next;
      });
      setSubmitError("");
      if (advancingRef.current) return;
      advancingRef.current = true;
      const from = screenRef.current;
      window.setTimeout(() => {
        advancingRef.current = false;
        // Only if they're still on the same question.
        if (screenRef.current === from) advanceFrom(from, formRef.current);
      }, TAP_DELAY);
    },
    [advanceFrom],
  );

  const onContinue = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (screen === "review") return submit();
    advanceFrom(screen, form);
  };

  const start = () => {
    const at = resumeAt !== "welcome" ? resumeAt : REQUIRED_STEPS[0];
    setResumeAt("welcome");
    goTo(at);
  };

  const editStep = (s: StepKey) => {
    setReturnToReview(true);
    returnRef.current = true;
    goTo(s);
  };

  /* ---------- Submit ---------- */
  const allErrors = onboardingErrors(form);

  const submit = async () => {
    if (saving) return;
    const merged = { ...allErrors, ...serverErrors };
    const bad = ALL_STEPS.find((s) => Object.keys(stepErrors(s, form, merged)).length > 0);
    if (bad) {
      setAttempted(new Set(ALL_STEPS));
      setSubmitError("Something needs a quick fix. Tap the highlighted line.");
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        const w = wordsFor(form);
        const summary: DoneSummary = {
          childName: form.child_name.trim(),
          parent: w.parent,
          who: cap(w.name),
          her: w.her,
          callTime: form.preferred_call_time || "",
          language: form.language,
          hadWorry: Boolean(form.child_worry?.trim()),
        };
        removeKey(draftKey(token));
        writeJson(doneKey(token), summary);
        window.history.replaceState({}, "");
        setPhase({ kind: "done", summary });
        return;
      }
      if (res.status === 410) {
        setPhase({ kind: "problem", problem: (data.state as ProblemKind) || "used", message: data.error || "This link can't be used." });
        return;
      }
      if (data.field && typeof data.field === "string") {
        setServerErrors({ [data.field]: data.error });
        setSubmitError(data.error || "Please check the highlighted line.");
        return;
      }
      setSubmitError(data.error || "We couldn't save the details. Please try again.");
    } catch {
      setSubmitError("Couldn't send. Check your internet and try again. Your answers are still here.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Screens ---------- */
  if (phase.kind === "checking") return <LoadingScreen />;
  if (phase.kind === "problem") {
    return <ProblemScreen kind={phase.problem} message={phase.message} onRetry={phase.problem === "offline" ? () => setCheckKey((k) => k + 1) : undefined} />;
  }
  if (phase.kind === "done") return <ThankYouScreen done={phase.summary} headingRef={headingRef} />;
  if (screen === "welcome") return <WelcomeScreen friendName={friendName} resumed={resumeAt !== "welcome"} onStart={start} />;

  const w = wordsFor(form);
  const reqIndex = REQUIRED_STEPS.indexOf(screen as StepKey);
  const extraIndex = EXTRA_STEPS.indexOf(screen as StepKey);
  const progress = SEQ.indexOf(screen) / (SEQ.length - 1);
  const counter =
    reqIndex >= 0 ? `${reqIndex + 1} of ${REQUIRED_STEPS.length}` : extraIndex >= 0 ? `Extra ${extraIndex + 1}/${EXTRA_STEPS.length}` : screen === "review" ? "Last step" : "";
  const anim = dir === "next" ? "animate-ob-next" : "animate-ob-prev";

  const header = (
    <>
      <div
        className="fixed top-0 inset-x-0 h-1 bg-ob-line/60 z-30"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full bg-ob-brand rounded-r-full transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(progress, 0.04) * 100}%` }} />
      </div>
      <header className="grid grid-cols-[1fr_auto_1fr] items-center h-11 text-[14px] font-medium text-ob-muted">
        <button
          type="button"
          onClick={goBack}
          className="justify-self-start inline-flex items-center gap-1.5 h-11 pl-1 pr-3 -ml-1 rounded-full hover:bg-black/5 hover:text-ob-ink transition-colors"
        >
          <ArrowLeft className="w-[18px] h-[18px]" aria-hidden />
          Back
        </button>
        <Logo className="h-6" />
        <span className="justify-self-end tabular-nums">{counter}</span>
      </header>
    </>
  );

  /* Checkpoint */
  if (screen === "gate") {
    return (
      <Page className="pb-14">
        {header}
        <div key={screen} className={`mt-8 ${anim} motion-reduce:animate-none`}>
          <GateView childName={form.child_name} who={w.name} headingRef={headingRef} onMore={() => goTo(EXTRA_STEPS[0])} onFinish={() => goTo("review")} />
        </div>
      </Page>
    );
  }

  /* Review */
  if (screen === "review") {
    const merged = attempted.size ? { ...allErrors, ...serverErrors } : serverErrors;
    const rows = reviewRows(form, w).filter((r) => REQUIRED_STEPS.includes(r.step) || r.value.trim());
    const skippedExtras = !EXTRA_STEPS.some((s) => hasAnswer(s, form));
    return (
      <Page className="pb-48">
        {header}
        <form onSubmit={onContinue} noValidate className="mt-6">
          <div key={screen} className={`${anim} motion-reduce:animate-none`}>
            <h1 ref={headingRef} tabIndex={-1} className="text-[28px] leading-[1.15] font-extrabold tracking-tight text-ob-ink outline-none">
              All looks good?
            </h1>
            <p className="mt-2 text-[17px] leading-relaxed text-ob-muted">Tap any line to change it, then save.</p>
            <ul className="mt-6 rounded-[24px] border border-ob-line bg-ob-card divide-y divide-ob-line overflow-hidden shadow-[0_1px_2px_rgba(32,39,36,0.04)]">
              {rows.map((r) => {
                const err = Object.values(stepErrors(r.step, form, merged))[0];
                return (
                  <li key={r.step}>
                    <button
                      type="button"
                      onClick={() => editStep(r.step)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ob-soft ${err ? "bg-red-50" : ""}`}
                      aria-label={`Change ${r.label}: ${r.value || "not added"}`}
                    >
                      <span className="w-[34%] shrink-0 text-[15px] leading-6 text-ob-muted">{r.label}</span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-[16px] leading-6 break-words ${r.value ? "font-semibold text-ob-ink" : "text-ob-faint"}`}>{r.value || "Not added"}</span>
                        {err && <span className="block mt-0.5 text-[13.5px] leading-5 text-ob-bad">{err}</span>}
                      </span>
                      <Pencil className="w-4 h-4 mt-1 shrink-0 text-ob-faint" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            {skippedExtras && (
              <button
                type="button"
                onClick={() => goTo(EXTRA_STEPS[0])}
                className="mt-4 w-full h-12 rounded-full text-[15px] font-semibold text-ob-brand hover:bg-ob-mint transition-colors"
              >
                + Add a few more details
              </button>
            )}
          </div>
          <BottomBar>
            {submitError && (
              <p role="alert" className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[14px] leading-5 text-red-700 animate-ob-fade">
                {submitError}
              </p>
            )}
            <PrimaryButton type="submit" loading={saving}>
              {saving ? "Saving…" : w.short === "Parent" ? "Save details" : `Save ${w.short}'s details`}
            </PrimaryButton>
            <p className="mt-2.5 text-center text-[12.5px] leading-5 text-ob-muted">By saving, you confirm {w.name} is happy to get a daily call from Anyash.</p>
          </BottomBar>
        </form>
      </Page>
    );
  }

  /* One question */
  const errors = attempted.has(screen)
    ? { ...stepErrors(screen, form, allErrors), ...serverErrorsFor(serverErrors, screen) }
    : serverErrorsFor(serverErrors, screen);
  const view = stepView(screen, { form, errors, set, pick, w });
  const optional = OPTIONAL_STEPS.has(screen);
  const answered = hasAnswer(screen, form);
  const skipping = optional && !answered && !returnToReview;
  const label = returnToReview ? "Save and go back" : skipping ? "Skip" : "Continue";

  return (
    <Page className="pb-40">
      {header}
      <form onSubmit={onContinue} noValidate className="mt-4">
        <div key={screen} className={`${anim} motion-reduce:animate-none`}>
          {view.art && (
            <div className="mx-auto w-32 h-32 animate-ob-float motion-reduce:animate-none" aria-hidden>
              {view.art}
            </div>
          )}
          <h1
            ref={headingRef}
            tabIndex={-1}
            className={`${view.art ? "mt-3" : "mt-6"} text-[28px] leading-[1.15] font-extrabold tracking-tight text-ob-ink outline-none [text-wrap:balance]`}
          >
            {view.title}
          </h1>
          {view.subtitle && <p className="mt-2.5 text-[17px] leading-relaxed text-ob-muted [text-wrap:pretty]">{view.subtitle}</p>}
          <div className="mt-7">{view.body}</div>
        </div>
        <BottomBar>
          {skipping ? (
            <button
              type="submit"
              className="w-full h-14 rounded-full border border-ob-line bg-ob-card text-ob-ink text-[17px] font-semibold transition-[transform,background-color] hover:bg-ob-soft active:scale-[0.99]"
            >
              Skip for now
            </button>
          ) : (
            <PrimaryButton type="submit">{label}</PrimaryButton>
          )}
        </BottomBar>
      </form>
    </Page>
  );
}
