'use client';

import { useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile script failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile (Step 2.1, anti SMS-pumping and e-mail bombing). Adds a hidden `captchaToken` field to the
 * surrounding form; the server action passes it to Supabase Auth, which verifies it when captcha protection is on.
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set (local stack, e2e).
 */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const locale = useLocale();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    void loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          'response-field-name': 'captchaToken',
          language: locale,
          appearance: 'interaction-only',
        });
      })
      .catch(() => undefined); // Supabase refuses the request without a token; the form shows its error.
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, locale]);

  if (!siteKey) return null;
  return <div ref={container} />;
}
