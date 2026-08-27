import * as React from "react";

import { cn } from "./utils";

/**
 * The BaseMind mark. Kept byte-identical to public/favicon.svg — if you redraw
 * one, redraw the other, plus the maskable and apple-touch variants beside it.
 *
 * The purple is hardcoded rather than themed: a logo that changes colour
 * between light and dark stops being a logo. White on this purple clears
 * contrast against both page backgrounds.
 */
function Logo({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="BaseMind"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      <rect width="100" height="100" rx="24" fill="#7c3aed" />
      <path d="M50 22 L82 70 H18 Z" fill="#ffffff" />
      <path d="M50 44 L64 70 H36 Z" fill="#7c3aed" />
      <rect x="14" y="76" width="72" height="8" rx="4" fill="#ffffff" opacity=".5" />
    </svg>
  );
}

export { Logo };
