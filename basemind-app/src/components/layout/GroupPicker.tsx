import { ChevronRight } from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { organisationHref, organisations } from "@/lib/orgs";

/**
 * Shown when the address names no group — the front door of a deployment
 * that runs more than one.
 *
 * A plain list of links rather than a dropdown that then navigates: each
 * group is a different database behind a different address, and a link is
 * the honest way to say so. Picking one is an ordinary page load, which is
 * what gives the app the right Supabase project to start against.
 *
 * It is deliberately bare. Nobody is signed in yet, and whether an account
 * exists in any of these groups is not something this page should reveal.
 */
export function GroupPicker() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo className="size-14" />
          <div>
            <h1 className="text-xl font-medium">Choose your group</h1>
            <p className="text-sm text-muted-foreground">
              Each group keeps its own equipment, camps and people.
            </p>
          </div>
        </div>

        {organisations.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            No groups are set up on this site yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {organisations.map((org) => (
              <li key={org.slug || "root"}>
                <a
                  href={organisationHref(org)}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="font-medium">{org.name}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
