"use client";

import React, { use, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { OnboardingErrors, OnboardingInput, onboardingErrors } from "@/lib/onboarding";
import {
  DayStep,
  HealthStep,
  NotesStep,
  ParentStep,
  ReachStep,
  ReviewStep,
  STEPS,
  YouStep,
  stepErrors,
  stepHasAnswers,
  whoOf,
} from "@/components/onboard/steps";
import {
  BottomBar,
  DoneSummary,
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
 * phone, to add their own parent. One question group per screen; answers are
 * kept on the phone until they're saved.
 */

const EMPTY: OnboardingInput = {
  parent_name: "",
  honorific: "",
  language: "",
  phone_number: "",
  child_name: "",
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

/** 0 is the welcome screen, 1..STEPS.length the questions, then the review. */
const REVIEW = STEPS.length + 1;

type Phase =
  | { kind: "checking" }
  | { kind: "form" }
  | { kind: "done"; summary: DoneSummary }
  | { kind: "problem"; problem: ProblemKind; message: string };

/* ------------------------------------------------------------------ */
/* Answers kept on this phone                                          */
/* ------------------------------------------------------------------ */

const draftKey = (token: string) => `anyash:onboard:${token.slice(0, 20)}`;
const doneKey = (token: string) => `anyash:onboard-done:${token.slice(0, 20)}`;

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
  v: 1;
  form: OnboardingInput;
  step: number;
}

/** A stored draft, checked field by field so an old or edited copy can't break the form. */
function readDraft(token: string): Draft | null {
  const d = readJson<Draft>(draftKey(token));
  if (!d || d.v !== 1 || typeof d.form !== "object" || !d.form) return null;
  const form = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof OnboardingInput)[]) {
    const v = (d.form as any)[k];
    if (Array.isArray(EMPTY[k])) (form as any)[k] = Array.isArray(v) ? v.filter((x: unknown) => typeof x === "string") : [];
    else if (typeof v === "string") (form as any)[k] = v;
  }
  const step = Number.isInteger(d.step) ? Math.min(Math.max(d.step, 0), REVIEW) : 0;
  return { v: 1, form, step };
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [friendName, setFriendName] = useState<string | null>(null);
  const [form, setForm] = useState<OnboardingInput>(EMPTY);
  const [step, setStep] = useState(0);
  /** The step a returning person stopped at (0 when starting fresh). */
  const [resumeStep, setResumeStep] = useState(0);
  /** Steps where Continue was pressed: their errors show, and update as the person types. */
  const [attempted, setAttempted] = useState<Set<number>>(() => new Set());
  /** Errors the server sent back for a field (e.g. a phone number already on file). */
  const [serverErrors, setServerErrors] = useState<OnboardingErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  /** Set when a step was opened from the review screen: Continue goes back there. */
  const [returnToReview, setReturnToReview] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [checkKey, setCheckKey] = useState(0);

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
            setResumeStep(draft.step);
          } else if (label) {
            setForm({ ...EMPTY, child_name: label });
          }
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
        setPhase({
          kind: "problem",
          problem: "offline",
          message: "Please check your internet connection and try again. Nothing you've typed will be lost.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, checkKey]);

  /* ---------- Keep answers on this phone ---------- */
  useEffect(() => {
    if (phase.kind !== "form") return;
    // On the welcome screen, keep the step they stopped at.
    writeJson(draftKey(token), { v: 1, form, step: step || resumeStep } satisfies Draft);
  }, [form, step, resumeStep, phase.kind, token]);

  /* ---------- Steps and the phone's back button ---------- */
  const phaseRef = useRef(phase.kind);
  useEffect(() => {
    phaseRef.current = phase.kind;
  }, [phase.kind]);
  const depthRef = useRef(0);

  useEffect(() => {
    if (phase.kind !== "form") return;
    const onPop = (e: PopStateEvent) => {
      if (phaseRef.current !== "form") return;
      const s = e.state?.anyashStep;
      if (typeof s !== "number") return;
      depthRef.current = e.state?.depth ?? 0;
      setReturnToReview(false);
      setStep(s);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [phase.kind]);

  // Mark where the person starts, so the back button can return to it.
  useEffect(() => {
    if (phase.kind !== "form") return;
    window.history.replaceState({ ...(window.history.state || {}), anyashStep: step, depth: 0 }, "");
    depthRef.current = 0;
    // Only when the form first opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind]);

  const goTo = useCallback((next: number) => {
    depthRef.current += 1;
    window.history.pushState({ ...(window.history.state || {}), anyashStep: next, depth: depthRef.current }, "");
    setStep(next);
  }, []);

  const goBack = () => {
    setReturnToReview(false);
    if (depthRef.current > 0) {
      window.history.back(); // popstate sets the step
    } else {
      const prev = Math.max(0, step - 1);
      window.history.replaceState({ ...(window.history.state || {}), anyashStep: prev, depth: 0 }, "");
      setStep(prev);
    }
  };

  // New screen: start at the top and move focus to its heading (no keyboard pop-up).
  useEffect(() => {
    if (phase.kind === "checking") return;
    window.scrollTo({ top: 0 });
    if (phase.kind === "done" || step > 0) headingRef.current?.focus({ preventScroll: true });
  }, [step, phase.kind]);

  /* ---------- Answers ---------- */
  const set = useCallback(<K extends keyof OnboardingInput>(key: K, v: OnboardingInput[K]) => {
    setForm((f) => ({ ...f, [key]: v }));
    setServerErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
    setSubmitError("");
  }, []);

  const allErrors = onboardingErrors(form);
  const errorsFor = (stepIndex: number): OnboardingErrors => {
    const def = STEPS[stepIndex - 1];
    if (!def) return {};
    const shown = attempted.has(stepIndex) ? stepErrors(def, allErrors) : {};
    return { ...stepErrors(def, serverErrors), ...shown };
  };

  const firstStepWithErrors = () => {
    const merged = { ...allErrors, ...serverErrors };
    const i = STEPS.findIndex((s) => s.fields.some((f) => merged[f]));
    return i === -1 ? null : i + 1;
  };

  const next = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (step === 0) {
      const start = resumeStep || 1;
      setResumeStep(0);
      return goTo(start);
    }
    if (step === REVIEW) return submit();
    const def = STEPS[step - 1];
    setAttempted((a) => new Set(a).add(step));
    const errs = { ...stepErrors(def, allErrors), ...stepErrors(def, serverErrors) };
    if (Object.keys(errs).length) {
      // Bring the first problem into view.
      requestAnimationFrame(() => {
        document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    if (returnToReview) {
      setReturnToReview(false);
      return goTo(REVIEW);
    }
    goTo(step + 1);
  };

  const editFromReview = (stepIndex: number) => {
    setReturnToReview(true);
    goTo(stepIndex + 1);
  };

  /* ---------- Submit ---------- */
  const submit = async () => {
    if (saving) return;
    const bad = firstStepWithErrors();
    if (bad) {
      setAttempted(new Set(STEPS.map((_, i) => i + 1)));
      setSubmitError("A few details need fixing. Tap Edit on the highlighted section.");
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
        const summary: DoneSummary = {
          childName: form.child_name.trim(),
          who: capitalize(whoOf(form)),
          parentName: form.parent_name.trim(),
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
        setSubmitError(data.error || "Please check the highlighted section.");
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
    return (
      <ProblemScreen
        kind={phase.problem}
        message={phase.message}
        onRetry={phase.problem === "offline" ? () => setCheckKey((k) => k + 1) : undefined}
      />
    );
  }
  if (phase.kind === "done") return <ThankYouScreen done={phase.summary} headingRef={headingRef} />;
  if (step === 0) return <WelcomeScreen friendName={friendName} resumed={resumeStep > 0} onStart={() => next()} />;

  const errors = errorsFor(step);
  const def = STEPS[step - 1];
  const props = { form, set, errors, headingRef };
  const isReview = step === REVIEW;
  const skippable = def?.optional && !stepHasAnswers(def, form);
  const label = isReview ? "Save details" : returnToReview ? "Save and review" : skippable ? "Skip for now" : "Continue";

  return (
    <Page className="pb-44">
      <header className="flex items-center gap-3 h-11">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="w-11 h-11 -ml-3 rounded-full flex items-center justify-center text-ob-ink hover:bg-ob-soft"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[13px] text-ob-muted">
            <span>{isReview ? "Last step" : `Step ${step} of ${STEPS.length}`}</span>
            <Logo className="scale-[0.85] origin-right" />
          </div>
          <div
            className="mt-1.5 h-1.5 rounded-full bg-ob-line overflow-hidden"
            role="progressbar"
            aria-label="Progress"
            aria-valuemin={0}
            aria-valuemax={STEPS.length}
            aria-valuenow={Math.min(step, STEPS.length)}
          >
            <div
              className="h-full rounded-full bg-ob-ink transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${(Math.min(step, REVIEW) / REVIEW) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <form onSubmit={next} noValidate className="mt-8">
        <div key={step} className="animate-ob-in motion-reduce:animate-none">
          {step === 1 && <YouStep {...props} />}
          {step === 2 && <ParentStep {...props} />}
          {step === 3 && <ReachStep {...props} />}
          {step === 4 && <DayStep {...props} />}
          {step === 5 && <HealthStep {...props} />}
          {step === 6 && <NotesStep {...props} />}
          {isReview && (
            <ReviewStep
              form={form}
              errors={attempted.size ? { ...allErrors, ...serverErrors } : serverErrors}
              headingRef={headingRef}
              onEdit={editFromReview}
            />
          )}
        </div>

        <BottomBar>
          {submitError && (
            <p role="alert" className="mb-3 rounded-2xl bg-[#FBEAE6] ring-1 ring-ob-bad/20 px-4 py-3 text-[14px] leading-5 text-ob-bad">
              {submitError}
            </p>
          )}
          <PrimaryButton type="submit" loading={saving}>
            {saving ? "Saving…" : label}
          </PrimaryButton>
          {isReview && (
            <p className="mt-2.5 text-center text-[12.5px] leading-5 text-ob-muted">
              By saving, you confirm {whoOf(form)} is happy to get a daily call from Anyash.
            </p>
          )}
        </BottomBar>
      </form>
    </Page>
  );
}

