const trimTrailingSlash = (url: string) => url.replace(/\/+$|\s+$/g, "");

export const supabaseUrl = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || "");
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const validateConfig = () => {
  const missing: string[] = [];
  if (!supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missing.push("VITE_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Set these in .env.local (see .env.example).`,
    );
  }
};
