import * as React from "react";

import { cn } from "./utils";

/**
 * The BaseMind mark: a tent in white on near-black, standing on a lavender
 * ground line. Kept byte-identical to public/favicon.svg — if you redraw one,
 * redraw the other.
 *
 * The tent is a filled polygon, not a stroked path. It was stroked before,
 * which rounded the peak into a dome and cut the legs off at a slant where
 * they should sit flat on the ground. Six points say it exactly, and spare
 * the other two copies of this mark from having to agree about stroke width,
 * joins and caps as well as coordinates.
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
      <path d="M50 21 L17 70 L36 70 L50 43 L64 70 L83 70 Z" fill="#ffffff" />
      <rect x="14" y="76.5" width="72" height="7.5" rx="3.75" fill="#b8a1ff" />
    </svg>
  );
}

export { Logo };
