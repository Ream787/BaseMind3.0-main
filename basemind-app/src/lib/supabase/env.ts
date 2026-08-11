const trimTrailingSlash = (url: string) => url.replace(/\/+$|\s+$/g, "");

export const supabaseUrl = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || "");
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const missingEnvVars = [
  !supabaseUrl && "VITE_SUPABASE_URL",
  !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
].filter((v): v is string => !!v);
