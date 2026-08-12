import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // React and Supabase change far less often than app code, so giving
        // them their own chunks means a normal deploy doesn't invalidate them
        // in the browser cache.
        manualChunks: {
          react: ["react", "react-dom", "react-router"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    // The remaining warning is pdf-lib, which is already lazy-loaded and only
    // fetched on the Forms page.
    chunkSizeWarningLimit: 600,
  },
});
