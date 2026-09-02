/**
 * Reading what an email link says when it comes back.
 *
 * Supabase verifies the token on its own domain and then redirects into the
 * app, putting the outcome in the URL fragment. On success the client picks
 * the tokens out and clears the fragment itself; on failure it throws before
 * it gets that far, so the error is still sitting in `window.location` — the
 * only place anything explains why the link did not work.
 *
 * Left unread, an expired link is a blank sign-in screen and a person who
 * assumes the account was never created.
 */

export type AuthRedirectProblem = {
  /** GoTrue's own code, kept for the copy to switch on. */
  code: string;
  title: string;
  detail: string;
  /** Whether a fresh confirmation email would actually fix this. */
  canResend: boolean;
};

/** Where a confirmation link should come back to. */
export function confirmRedirectUrl(origin: string): string {
  return `${origin.replace(/\/+$/, "")}/auth/callback`;
}

/**
 * Query and fragment together, fragment winning.
 *
 * GoTrue uses the fragment for the implicit flow and the query for PKCE, and
 * a link that has been through a redirect can carry both. Reading only one
 * would mean silently ignoring half the failures.
 */
function paramsOf(href: string): URLSearchParams {
  const merged = new URLSearchParams();
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return merged;
  }
  for (const [key, value] of url.searchParams) merged.set(key, value);
  for (const [key, value] of new URLSearchParams(url.hash.replace(/^#/, ""))) {
    merged.set(key, value);
  }
  return merged;
}

/** "email link is invalid" → "Email link is invalid." */
function sentence(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!trimmed) return "";
  const capped = trimmed[0].toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

const EXPIRED = {
  title: "That link has expired",
  detail:
    "Confirmation links last a day and can only be used once. Ask for a new one below and it will arrive in a moment.",
  canResend: true,
};

/**
 * What went wrong with the link, or null if nothing did.
 *
 * Takes the whole href rather than reading `window.location` so it can be
 * tested, and so a caller can capture the URL before anything rewrites it.
 */
export function readAuthRedirect(href: string): AuthRedirectProblem | null {
  const params = paramsOf(href);
  const code = params.get("error_code") ?? "";
  const error = params.get("error") ?? "";
  const description = params.get("error_description") ?? "";

  if (!code && !error && !description) return null;

  const known: Record<string, Omit<AuthRedirectProblem, "code">> = {
    otp_expired: EXPIRED,
    flow_state_expired: EXPIRED,
    flow_state_not_found: EXPIRED,
    email_not_confirmed: {
      title: "That address isn't confirmed yet",
      detail:
        "The link in the email has to be opened before you can sign in. Ask for a new one below if you can't find it.",
      canResend: true,
    },
    user_already_exists: {
      title: "That account already exists",
      detail: "The address is confirmed and registered. Sign in with it instead.",
      canResend: false,
    },
    identity_already_exists: {
      title: "That account already exists",
      detail: "The address is confirmed and registered. Sign in with it instead.",
      canResend: false,
    },
    signup_disabled: {
      title: "New accounts are switched off",
      detail: "An admin has closed registration. Ask one of them to let you in.",
      canResend: false,
    },
    over_email_send_rate_limit: {
      title: "Too many emails, too quickly",
      detail: "Wait a few minutes before asking for another link.",
      canResend: false,
    },
  };

  const match = known[code];
  if (match) return { code, ...match };

  // Anything else: say what the server said rather than inventing a reason,
  // and still offer the new link, since that fixes most of them.
  return {
    code: code || error || "unknown",
    title: "That link didn't work",
    detail:
      sentence(description) ||
      "The confirmation link couldn't be used. Ask for a new one below.",
    canResend: true,
  };
}
