import type { CSSProperties } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/components/ui/utils";
import { resolveIcon } from "@/lib/userIcon";

type Person = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar_emblem?: string | null;
  avatar_colour?: number | null;
};

const sizes = {
  sm: { box: "size-8", icon: "size-4", text: "text-[0.65rem]" },
  md: { box: "size-10", icon: "size-5", text: "text-xs" },
  lg: { box: "size-16", icon: "size-8", text: "text-lg" },
} as const;

/** Someone's badge: their emblem, or their letters if that's what they picked. */
export function UserAvatar({
  user,
  size = "md",
  className,
}: {
  user: Person;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { emblem, initials, colour } = resolveIcon(user);
  const { box, icon, text } = sizes[size];
  const who = user.name?.trim() || user.email || "This person";

  return (
    <Avatar
      className={cn(box, "ring-1 ring-border", className)}
      style={
        {
          // One variable per hue: the disc is the emblem's own colour, just
          // faint, so both follow the light/dark swap together.
          "--avatar": `var(--avatar-${colour})`,
          backgroundColor: "color-mix(in oklab, var(--avatar) 16%, transparent)",
          color: "var(--avatar)",
        } as CSSProperties
      }
    >
      {/* delayMs={0}: there is no image to wait on, and Radix's default wait
          would leave lists flickering empty as they scroll. */}
      <AvatarFallback className="bg-transparent" delayMs={0}>
        {emblem ? (
          <emblem.Icon className={icon} aria-hidden />
        ) : (
          <span className={cn("font-medium", text)} aria-hidden>
            {initials}
          </span>
        )}
      </AvatarFallback>
      <span className="sr-only">{`${who} — ${emblem ? `${emblem.label} badge` : "initials"}`}</span>
    </Avatar>
  );
}
