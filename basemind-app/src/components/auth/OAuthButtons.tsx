import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";
import { confirmRedirectUrl } from "@/lib/authRedirect";
import { Button } from "@/components/ui/button";

/**
 * Sign in with Google or Apple, but only the ones actually switched on.
 *
 * Which providers a project has configured is public information — the auth
 * server publishes it at /settings, because the browser is expected to know
 * what it may offer. Asking means a provider that hasn't been set up yet
 * simply isn't shown, rather than being a button that fails when somebody
 * finally presses it. Apple in particular needs a paid developer account, so
 * a group may well have one of these and not the other for a long time.
 */
type Provider = "google" | "apple";

const LABELS: Record<Provider, string> = {
  google: "Continue with Google",
  apple: "Continue with Apple",
};

export function OAuthButtons() {
  const [enabled, setEnabled] = useState<Provider[]>([]);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    // A failure here is silent on purpose: not knowing which providers exist
    // is a reason to show none of them, not a reason to put an error in
    // front of somebody who only wants to type a password.
    fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseAnonKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (!live || !settings?.external) return;
        setEnabled(
          (["google", "apple"] as Provider[]).filter((p) => settings.external[p] === true),
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (enabled.length === 0) return null;

  async function start(provider: Provider) {
    setBusy(provider);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      // The same landing page a confirmation link uses: it already knows how
      // to wait for a session and how to explain a refusal, and a provider
      // sending somebody back with "access_denied" is the same problem.
      options: { redirectTo: confirmRedirectUrl(window.location.origin) },
    });
    // Only reached if the redirect never happened — otherwise the page is
    // already gone.
    if (oauthError) {
      setBusy(null);
      setError(oauthError.message);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      {enabled.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          disabled={busy !== null}
          onClick={() => start(provider)}
        >
          {provider === "google" ? <GoogleMark /> : <AppleMark />}
          {busy === provider ? "Taking you there…" : LABELS[provider]}
        </Button>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

/* Both marks are inline SVG: an <img> to a CDN would be a request the login
   page has to wait for, and both brands require their own logo rather than a
   lookalike. */

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.7 1.22 9.2 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg className="size-4" viewBox="0 0 384 512" aria-hidden="true" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
