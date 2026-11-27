'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-900">{label}</span>
      <input
        {...input}
        className="mt-1 block min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100"
      />
      {hint ? <span className="mt-1 block text-sm text-ink-600">{hint}</span> : null}
    </label>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-12 w-full rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={
        tone === 'error'
          ? 'rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900'
          : 'rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900'
      }
    >
      {children}
    </p>
  );
}
