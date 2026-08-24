import { RouterProvider } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { OfflineProvider } from "@/context/OfflineContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { missingEnvVars } from "@/lib/supabase/env";
import { router } from "@/routes";

function MissingConfig() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md rounded-lg border border-destructive/40 bg-card p-6">
        <h1 className="mb-2 text-destructive">Configuration missing</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          BaseMind can&apos;t reach Supabase because these environment variables aren&apos;t set:
        </p>
        <ul className="mb-4 list-inside list-disc text-sm">
          {missingEnvVars.map((v) => (
            <li key={v}>
              <code>{v}</code>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          Locally, copy <code>.env.example</code> to <code>.env.local</code> and fill them in. On
          Vercel, add them under Project Settings → Environment Variables, then redeploy.
        </p>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      {missingEnvVars.length > 0 ? (
        <MissingConfig />
      ) : (
        <OfflineProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AuthProvider>
        </OfflineProvider>
      )}
    </ThemeProvider>
  );
}
