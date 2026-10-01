"use client";

import React, { use, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { OnboardingInput, validateOnboarding } from "@/lib/onboarding";
import { EMPTY_ONBOARDING, OnboardingForm } from "@/components/anyash/OnboardingForm";
import { Button, FormError } from "@/components/anyash/primitives";

type LinkState = "checking" | "valid" | "invalid" | "done";

/**
 * Public onboarding page a child opens from a single-use link, usually on
 * their phone. No dashboard chrome and no data from other families.
 */
export default function OnboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<LinkState>("checking");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState<OnboardingInput>(EMPTY_ONBOARDING);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/onboarding/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) setState("valid");
        else {
          setMessage(data.error || "This link can't be used.");
          setState("invalid");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setMessage("Couldn't open the form. Check your internet and reload the page.");
        setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const valid = validateOnboarding(form);
    if (!valid.ok) return setError(valid.error);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/onboarding/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) {
        setMessage(data.error);
        setState("invalid");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Couldn't save. Please try again.");
      setState("done");
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ay-canvas text-zinc-300">
      <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 pt-8 pb-32">
        <p className="text-[15px] font-semibold text-white tracking-tight">Anyash</p>

        {state === "checking" && <p className="mt-10 text-[14px] text-zinc-500">Opening the form…</p>}

        {state === "invalid" && (
          <div className="mt-10">
            <h1 className="text-[22px] font-semibold text-white tracking-tight">This link can't be used</h1>
            <p className="mt-2 text-[14px] leading-6 text-zinc-400">{message}</p>
          </div>
        )}

        {state === "done" && (
          <div className="mt-10">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <h1 className="mt-4 text-[22px] font-semibold text-white tracking-tight">Dhanyavaad!</h1>
            <p className="mt-2 text-[14px] leading-6 text-zinc-400">
              {form.honorific || "Unki"} ki details save ho gayi hain. Anyash pehli call mein inhi baaton se shuru karega, aur
              dheere dheere unse khud confirm karega. Aapki chinta wali baat unse kabhi nahi kahi jayegi.
            </p>
          </div>
        )}

        {state === "valid" && (
          <form onSubmit={submit}>
            <h1 className="mt-8 text-[22px] font-semibold text-white tracking-tight leading-snug">
              Mummy/Papa ke baare mein thoda bataiye
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-zinc-400">
              Anyash unhe roz call karke haal-chaal poochta hai. Aapke jawab se woh pehli call se hi sahi baatein poochega.
              Sirf naam, bulane ka tareeka, bhasha, phone aur aapka naam zaroori hai. Baaki jitna pata ho, utna bharein.
            </p>
            <div className="mt-8">
              <OnboardingForm idPrefix="onboard" value={form} onChange={setForm} />
            </div>
            <div className="mt-6">
              <FormError>{error}</FormError>
            </div>

            <div className="fixed inset-x-0 bottom-0 bg-ay-canvas/95 backdrop-blur border-t border-ay-line">
              <div className="mx-auto w-full max-w-[640px] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <p className="text-[12px] text-zinc-500 leading-5">Yeh link sirf ek baar kaam karta hai.</p>
                <Button type="submit" variant="primary" disabled={saving} className="h-11 px-6 text-[14px]">
                  {saving ? "Saving…" : "Save details"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
