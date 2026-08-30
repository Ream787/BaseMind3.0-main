/**
 * Signing in with a username instead of an email.
 *
 * Supabase Auth is built around an email, so every account has one
 * underneath. For an account registered without one, the app derives a fixed
 * address from the username and uses that. Nothing is ever sent to it.
 *
 * `.invalid` is reserved by the IETF precisely so it can never resolve, which
 * makes it impossible for a derived address to collide with somebody's real
 * one. A made-up domain like basemind.local could be registered tomorrow.
 */
const DERIVED_DOMAIN = "basemind.invalid";

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

/** The address an email-less account signs in with. */
export function derivedEmail(username: string): string {
  return `${normaliseUsername(username)}@${DERIVED_DOMAIN}`;
}

/** True for an address this app made up, rather than one a person gave. */
export function isDerivedEmail(email: string | null): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${DERIVED_DOMAIN}`);
}

/**
 * The address to hand to Supabase for whatever somebody typed.
 *
 * An email is used as it stands. Anything else is treated as a username and
 * mapped to its derived address — which is why a username sign-in works
 * without the app having to look up anybody's real email address first, and
 * so without any way to ask the server "who owns this username".
 */
export function signInEmailFor(identifier: string): string {
  const value = identifier.trim();
  return looksLikeEmail(value) ? value.toLowerCase() : derivedEmail(value);
}

/** What to show instead of an address the app invented. */
export function displayEmail(email: string | null): string {
  return !email || isDerivedEmail(email) ? "No email" : email;
}
