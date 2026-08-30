/**
 * Usernames, and how they get you signed in.
 *
 * Every account has a real email address, and that address is what Supabase
 * Auth authenticates against. A username therefore has to be turned into an
 * address before anyone can sign in — and that lookup deliberately does NOT
 * happen here.
 *
 * An endpoint the app could ask "which email owns this username" would be a
 * way to read every member's email address out of the group, so the resolving
 * and the sign-in both happen inside the `sign-in` Edge Function, which hands
 * back a session and never the address.
 */

/** What a username may contain. Deliberately narrow. */
const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.-]{1,28}[a-z0-9])$/;

export const USERNAME_RULE =
  "3 to 30 characters: letters, numbers, dots, dashes and underscores.";

/** Lower-cased and trimmed. Usernames are not case-sensitive. */
export function normaliseUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normaliseUsername(raw));
}

/** Does this look like an email rather than a username? */
export function looksLikeEmail(value: string): boolean {
  return value.trim().includes("@");
}

/**
 * Addresses this app derived for itself during a brief window when an email
 * was optional. `.invalid` can never resolve, so nothing was ever sent to
 * one. Recognised only so such an account is never shown as having an email.
 */
export function isDerivedEmail(email: string | null): boolean {
  return !!email && email.trim().toLowerCase().endsWith("@basemind.invalid");
}

/** What to show instead of an address the app invented. */
export function displayEmail(email: string | null): string {
  return !email || isDerivedEmail(email) ? "No email" : email;
}
