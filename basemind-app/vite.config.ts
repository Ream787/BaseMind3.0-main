import { defineConfig } from "vite";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "maskable-icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "BaseMind",
        short_name: "BaseMind",
        description: "Scout equipment, camps and food management",
        theme_color: "#7c3aed",
        background_color: "#faf9fc",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          // Launchers crop a maskable icon to their own shape, so this one is
          // full-bleed with the tent pulled into the safe circle. The rounded
          // favicon would lose its corners and the ground line to that crop.
          { src: "maskable-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
          // PNG fallback for anything that won't read an SVG icon — iOS above all.
          { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
      },
      workbox: {
        // Take over as soon as a new build is fetched rather than waiting for
        // every tab to close. Combined with the reload in lib/staleDeploy, a
        // deploy landing mid-session self-heals instead of 404ing on chunks
        // the old page still refers to.
        skipWaiting: true,
        clientsClaim: true,
        // Old builds' chunks are useless once the new shell is live, and
        // leaving them cached is what makes a stale tab look half-working.
        cleanupOutdatedCaches: true,
        // The app shell is precached so it opens with no signal at all.
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        // pdf-lib alone is ~440 kB; the default 2 MB cap would skip it.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            // Supabase data is cached by the app in IndexedDB, not here —
            // this only keeps auth/token round-trips from being served stale.
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
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
