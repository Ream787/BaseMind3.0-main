import * as React from "react";

import { cn } from "./utils";

/**
 * The BaseMind mark: a tent in white on near-black, standing on a lavender
 * ground line. Kept byte-identical to public/favicon.svg — if you redraw one,
 * redraw the other.
 *
 * The colours are hardcoded rather than themed. A logo that changes colour
 * between light and dark stops being a logo, and this one is a dark tile on
 * purpose: it reads the same on a white page, a dark page and a phone's home
 * screen, which is where it spends most of its life.
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
      <rect width="100" height="100" rx="24" fill="#18181b" />
      <path
        d="M22 73 L50 26 L78 73"
        fill="none"
        stroke="#ffffff"
        strokeWidth="13"
        strokeLinejoin="round"
      />
      <rect x="19" y="80" width="62" height="11" rx="5.5" fill="#b8a1ff" />
    </svg>
  );
}

export { Logo };
