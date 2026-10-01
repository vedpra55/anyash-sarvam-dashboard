"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-ay-accent hover:bg-ay-accent-hover text-black font-medium",
  secondary: "bg-white/[0.06] hover:bg-white/[0.1] text-zinc-100",
  ghost: "text-zinc-400 hover:text-white hover:bg-white/[0.05]",
  danger: "text-rose-300 hover:text-rose-200 hover:bg-rose-500/10",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: React.ReactNode;
}) {
  const sizing = size === "sm" ? "h-8 px-3 text-[12.5px] gap-1.5" : "h-9 px-4 text-[13px] gap-2";
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-full inline-flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0 ${className}`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
  dismissable?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/70" onClick={dismissable ? onClose : undefined} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
        className="relative w-full max-h-[92vh] flex flex-col bg-ay-surface sm:rounded-2xl rounded-t-2xl ring-1 ring-white/[0.07] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-white tracking-tight">{title}</h2>
            {description && <p className="text-[13px] text-zinc-500 mt-1 leading-5">{description}</p>}
          </div>
          {dismissable && (
            <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
              <X className="w-[18px] h-[18px]" />
            </IconButton>
          )}
        </header>
        {children && <div className="px-6 pt-5 pb-2 overflow-y-auto">{children}</div>}
        {footer && <footer className="px-6 py-5 flex items-center justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

const INPUT =
  "w-full h-10 px-3 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-ay-accent/60 focus:bg-white/[0.06] outline-none text-[14px] text-zinc-100 placeholder:text-zinc-600 transition-colors disabled:opacity-60";

export function FieldLabel({
  label,
  hint,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-[13px] text-zinc-300 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-zinc-600 mt-1.5 leading-5">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className || ""}`} />;
}

export function SelectInput({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${INPUT} cursor-pointer appearance-none bg-no-repeat pr-8 ${props.className || ""}`}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 10px center",
      }}
    >
      {children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full p-3 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.08] focus:ring-ay-accent/60 focus:bg-white/[0.06] outline-none text-[13px] leading-6 text-zinc-100 placeholder:text-zinc-600 transition-colors resize-y ${props.className || ""}`}
    />
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-[13px] text-rose-300 leading-5">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <nav className={`flex gap-6 border-b border-ay-line overflow-x-auto ${className}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`relative pb-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
            value === t.id ? "text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {t.label}
          {t.count ? <span className="ml-1.5 text-zinc-600 tabular-nums">{t.count}</span> : null}
          {value === t.id && <span className="absolute left-0 right-0 -bottom-px h-px bg-white" />}
        </button>
      ))}
    </nav>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-white/[0.04]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`h-7 px-3 rounded-md text-[12.5px] whitespace-nowrap transition-colors ${
            value === o.id ? "bg-white/[0.09] text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1.5 tabular-nums text-zinc-600">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12">
      <p className="text-[14px] text-zinc-300">{title}</p>
      {children && <div className="text-[13px] text-zinc-500 mt-1 leading-6 max-w-md">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingText({ children = "Loading…" }: { children?: React.ReactNode }) {
  return <p className="text-[13px] text-zinc-600 py-12">{children}</p>;
}

export interface ToastMessage {
  tone: "info" | "success" | "error";
  message: string;
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, toast.tone === "error" ? 8000 : 5000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  const dot = toast.tone === "success" ? "bg-emerald-400" : toast.tone === "error" ? "bg-rose-500" : "bg-ay-accent";
  return (
    <div
      role="status"
      className="fixed z-[60] bottom-5 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 max-w-[calc(100vw-32px)] sm:max-w-md flex items-start gap-3 px-4 py-3 rounded-xl bg-ay-raised ring-1 ring-white/[0.08] shadow-2xl"
    >
      <span className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <p className="text-[13px] text-zinc-200 leading-5 break-words">{toast.message}</p>
      <button onClick={onClose} aria-label="Dismiss" className="text-zinc-500 hover:text-white -mr-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
