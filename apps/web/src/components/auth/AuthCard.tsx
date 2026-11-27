import type { ReactNode } from 'react';

/** Narrow centred card used by the sign-in, MFA, recovery and password pages. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 p-5 shadow-sm">{children}</div>
    </section>
  );
}
