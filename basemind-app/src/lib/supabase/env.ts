import { currentOrganisation, organisations } from "@/lib/orgs";

/**
 * Which project this page load talks to.
 *
 * It used to come straight from VITE_SUPABASE_URL. It now comes from the
 * group in the address bar, which for a single-group deployment is still
 * exactly those two variables.
 */
export const supabaseUrl = currentOrganisation?.url ?? "";
export const supabaseAnonKey = currentOrganisation?.anonKey ?? "";

/**
 * Nothing is configured at all — as opposed to "several groups are
 * configured and this URL names none of them", which is the picker's job
 * rather than an error.
 */
export const missingEnvVars =
  organisations.length === 0 ? ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"] : [];
