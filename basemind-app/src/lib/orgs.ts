/**
 * One app, several Scout groups, a separate database each.
 *
 * Nothing is shared between groups — not a table, not a row, not a user
 * account. Each one is its own Supabase project, and the URL says which:
 *
 *     /g/14th-delport/equipment     the 14th's kit
 *     /g/2nd-pretoria/equipment     somebody else's, in another database
 *
 * A path rather than a subdomain, because a subdomain needs DNS and a
 * certificate per group and this needs nothing: one deployment, one domain,
 * one line of configuration per group.
 *
 * Separate databases rather than a group_id column on every table is the
 * right trade here even though it is more setup. A column is one forgotten
 * `where` away from showing one group another group's camps; two projects
 * cannot leak into each other by mistake, only by being handed the wrong
 * key. The cost is that every group is set up by hand, which is the part
 * Rudi said he does not mind.
 *
 * The anon key sits in this configuration in plain sight, as it already did
 * in the single-group build: it is a public key. It identifies the project,
 * it does not grant anything — row-level security does that, and an anon key
 * on its own returns nothing from any table.
 */

export type Organisation = {
  /** URL segment. Empty means this group lives at the root of the site. */
  slug: string;
  /** What it's called on screen. */
  name: string;
  /** Its Supabase project URL. */
  url: string;
  /** Its publishable anon key. */
  anonKey: string;
};

const trimTrailingSlash = (url: string) => url.replace(/\/+$|\s+$/g, "");

/** A slug is a URL segment, so keep it to what reads as one. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Reads the configured list. Exported so it can be tested without a browser:
 * one malformed entry must not take the site down with it.
 */
export function parseOrganisations(raw: string): Organisation[] {
  // Not set at all is the ordinary single-group case, not a mistake worth
  // printing to everybody's console.
  if (!raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Shouting about it here would blank the app. The caller falls back to
    // the single-group variables and App shows the missing-config screen.
    console.error("VITE_ORGS is not valid JSON, so it was ignored.");
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.flatMap((entry): Organisation[] => {
    if (!entry || typeof entry !== "object") return [];
    const { slug, name, url, anonKey } = entry as Record<string, unknown>;
    if (typeof url !== "string" || typeof anonKey !== "string" || !url || !anonKey) return [];
    const cleanSlug = typeof slug === "string" ? slug.trim().toLowerCase() : "";
    if (cleanSlug && !SLUG.test(cleanSlug)) return [];
    return [
      {
        slug: cleanSlug,
        name: typeof name === "string" && name.trim() ? name.trim() : cleanSlug || "BaseMind",
        url: trimTrailingSlash(url),
        anonKey,
      },
    ];
  });
}

/**
 * Every group this deployment knows about.
 *
 * VITE_ORGS is the list. Without it, the old single-group variables still
 * work exactly as they did, so a deployment that has never heard of groups
 * carries on unchanged.
 */
export const organisations: Organisation[] = (() => {
  const configured = parseOrganisations(import.meta.env.VITE_ORGS || "");
  if (configured.length > 0) return configured;

  const url = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || "");
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) return [];
  return [{ slug: "", name: import.meta.env.VITE_ORG_NAME || "BaseMind", url, anonKey }];
})();

/** The group at the root of the site, if one is configured to live there. */
export const rootOrganisation = organisations.find((o) => o.slug === "") ?? null;

export function organisationBySlug(slug: string): Organisation | null {
  return organisations.find((o) => o.slug === slug.toLowerCase()) ?? null;
}

/**
 * Which group a URL is asking for.
 *
 * `/g/<slug>/…` names one. Anything else is the root group, and when there
 * isn't one the answer is nobody — which is what puts the picker on screen
 * rather than quietly loading somebody's data.
 */
/** Where the list of groups lives. Outside every group's basename. */
export const PICKER_PATH = "/groups";

export function resolveOrganisation(pathname: string): Organisation | null {
  return resolveFrom(organisations, pathname);
}

/** The same question, asked of any list — which is what makes it testable. */
export function resolveFrom(orgs: Organisation[], pathname: string): Organisation | null {
  // The one address that is nobody's group, so that a site whose root IS a
  // group still has somewhere to show the list.
  if (pathname === PICKER_PATH || pathname === `${PICKER_PATH}/`) return null;
  const match = /^\/g\/([^/]+)/.exec(pathname);
  if (match) {
    const slug = decodeURIComponent(match[1]).toLowerCase();
    return orgs.find((o) => o.slug === slug) ?? null;
  }
  return orgs.find((o) => o.slug === "") ?? null;
}

/**
 * The group this page load is for.
 *
 * Read once, at startup, from the address bar. Switching group is a fresh
 * page load on purpose: a Supabase client is built around one project's URL
 * and key, and swapping those underneath a running app would leave half the
 * screen holding the other group's rows.
 */
export const currentOrganisation: Organisation | null =
  typeof window === "undefined" ? rootOrganisation : resolveOrganisation(window.location.pathname);

/** What react-router hangs every route off, so pages know nothing about this. */
export const basename = currentOrganisation?.slug ? `/g/${currentOrganisation.slug}` : "/";

/** Where a group's app starts, for links and for the picker. */
export function organisationHref(org: Organisation): string {
  return org.slug ? `/g/${org.slug}/` : "/";
}

/**
 * Prefix for anything stored on the device.
 *
 * Two groups share an origin, so they share localStorage and IndexedDB. The
 * offline cache of one group's equipment must not be read back as the
 * other's.
 */
export const storagePrefix = currentOrganisation?.slug ? `${currentOrganisation.slug}:` : "";
