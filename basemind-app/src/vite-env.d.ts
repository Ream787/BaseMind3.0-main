/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** A single group's Supabase project. Used when VITE_ORGS isn't set. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** What to call that single group on screen. */
  readonly VITE_ORG_NAME?: string;
  /**
   * Several groups, as JSON. Each has its own Supabase project, and its slug
   * is the bit of the address that picks it:
   *
   *   [{"slug":"14th-delport","name":"14th Delport","url":"https://abc.supabase.co","anonKey":"ey…"}]
   *
   * A slug of "" puts that group at the root of the site.
   */
  readonly VITE_ORGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
