/**
 * Box codes, and what a QR sticker actually contains.
 *
 * The sticker encodes a full URL to the box, so a phone's ordinary camera
 * opens it without anyone installing anything — which is the difference
 * between a system leaders use and one they mean to. The app's own scanner
 * accepts the same URL, and also a bare code, so a sticker printed before a
 * domain change still works.
 */

/**
 * No I, O, 0 or 1. Codes get read aloud across a store room and typed in
 * when the camera won't focus, and those four are the pairs people get
 * wrong. Six characters from this alphabet is about a billion codes, which
 * is enough for any number of scout boxes.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const PREFIX = "BM";

/** A fresh code, e.g. "BM-7K3QX2". */
export function generateBoxCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // Modulo bias is irrelevant here: the alphabet is 32 long and divides 256
  // exactly, so every character is equally likely.
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${PREFIX}-${body}`;
}

/** The URL a sticker encodes for this box. */
export function boxUrl(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/boxes/${encodeURIComponent(code)}`;
}

/**
 * Pulls a box code out of whatever the camera read.
 *
 * Accepts the sticker's URL, a bare code, and a URL from a different
 * deployment of the app — a box does not stop being that box because the
 * site moved. Returns null for anything that plainly isn't ours, so a
 * stray QR code on a cereal packet doesn't create a box.
 */
export function parseScannedCode(scanned: string): string | null {
  const text = scanned.trim();
  if (!text) return null;

  // A URL of any origin, as long as it names a box.
  const fromUrl = text.match(/\/boxes\/([^/?#\s]+)/i);
  if (fromUrl) {
    const decoded = safeDecode(fromUrl[1]);
    return isBoxCode(decoded) ? canonical(decoded) : null;
  }

  // A bare code, with or without the prefix.
  return isBoxCode(text) ? canonical(text) : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The code with its prefix, uppercased and stripped of the spaces and dashes
 * people add when writing it down. This is the one form the database and the
 * URL ever see, so "bm7k3qx2", "BM-7K3QX2" and "bm 7k3 qx2" are one box.
 */
export function canonical(code: string): string {
  return `${PREFIX}-${bareCode(code)}`;
}

function bareCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, "").replace(/^BM/, "");
}

// Built once: this runs against every frame the camera decodes.
const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

/**
 * Is this plausibly one of our codes?
 *
 * Deliberately strict. The scanner points at whatever is in front of it, and
 * a loose test would turn a QR code on a cereal packet into a new box.
 */
export function isBoxCode(value: string): boolean {
  return CODE_PATTERN.test(bareCode(value));
}

/** Sort boxes the way someone standing in a store would look for them. */
export function sortBoxes<T extends { location: string; name: string }>(boxes: T[]): T[] {
  return [...boxes].sort(
    (a, b) => a.location.localeCompare(b.location) || a.name.localeCompare(b.name),
  );
}
