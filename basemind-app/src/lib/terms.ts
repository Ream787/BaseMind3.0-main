/**
 * The terms and the privacy notice, and when they last changed.
 *
 * The version is a date rather than a number so that "you accepted the terms
 * of 2 September 2026" is a sentence somebody can check against the page they
 * are looking at. Bump it only when the terms actually change in a way people
 * should re-read — every account is asked to accept again, and asking for a
 * typo fix teaches people to click through without reading, which defeats
 * the entire point of asking.
 */
export const TERMS_VERSION = "2026-09-02";

/** How that version reads on the page. */
export const TERMS_UPDATED = "2 September 2026";

/**
 * Where to write about privacy.
 *
 * Null until the group has a mailbox that is actually read: an address in a
 * privacy notice is a promise to answer, and the domain's mail currently
 * goes nowhere. While it is null the pages point at the administrators
 * instead, which is true. Set it to a real address and it appears
 * everywhere it is needed, including in Google's OAuth consent screen
 * checks, which expect a way to make contact.
 */
export const PRIVACY_CONTACT: string | null = null;

/** Canonical paths, so the pages, the emails and the router agree. */
export const TERMS_PATH = "/termsofservice";
export const PRIVACY_PATH = "/privacy";
