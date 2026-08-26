import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";
import { Star } from "lucide-react";

import { cn } from "@/components/ui/utils";
import { EMBLEMS, emblemFor } from "@/lib/userIcon";
import type { Member, Patrol } from "@/types/lab";

/**
 * Small pieces shared across the lab pages.
 *
 * They exist because twenty pages built out of raw divs drift: one uses a
 * dot for a patrol, the next a coloured word, and nobody notices until all
 * twenty are on screen at once.
 */

/**
 * Turns a 1-8 hue into the two custom properties everything here colours
 * itself with. Same variables as the person icons, so a patrol colour and
 * a leader's badge flip for dark mode together and cannot disagree.
 */
export function hueStyle(colour: number | null | undefined): CSSProperties {
  const n = colour && colour >= 1 && colour <= 8 ? colour : 1;
  return {
    "--hue": `var(--avatar-${n})`,
    "--hue-faint": `color-mix(in oklab, var(--avatar-${n}) 16%, transparent)`,
  } as CSSProperties;
}

/** FNV-1a, same as the person icons: a stable spread, not a secure hash. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * A member's badge.
 *
 * Members have no account, so there is no `avatar_emblem` column to read
 * and nothing to upload — the emblem comes from their row id, exactly as a
 * leader's does from their user id. That keeps every list of people in the
 * app looking like every other one, whether or not the people in it can
 * log in.
 *
 * The patrol's colour wins when they have a patrol: on a roster grouped by
 * patrol, a member whose disc is a different colour from their patrol's is
 * a bug report waiting to happen.
 */
export function MemberAvatar({
  member,
  patrol,
  size = "md",
  className,
}: {
  member: Pick<Member, "id" | "first_name" | "last_name">;
  patrol?: Patrol | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const h = hash(member.id);
  const emblem = emblemFor(patrol?.emblem) ?? EMBLEMS[h % EMBLEMS.length];
  const colour = patrol?.colour ?? ((h >>> 8) % 8) + 1;
  const Icon = emblem.Icon;

  const box = size === "sm" ? "size-8" : size === "lg" ? "size-14" : "size-10";
  const icon = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-border",
        box,
        className,
      )}
      style={{
        ...hueStyle(colour),
        backgroundColor: "var(--hue-faint)",
        color: "var(--hue)",
      }}
    >
      <Icon className={icon} aria-hidden />
      <span className="sr-only">{`${member.first_name} ${member.last_name}`}</span>
    </span>
  );
}

/** A patrol's name in its own colour. */
export function PatrolChip({
  patrol,
  className,
}: {
  patrol: Pick<Patrol, "name" | "colour"> | null | undefined;
  className?: string;
}) {
  if (!patrol) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground",
          className,
        )}
      >
        No patrol
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        ...hueStyle(patrol.colour),
        backgroundColor: "var(--hue-faint)",
        color: "var(--hue)",
      }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: "var(--hue)" }} />
      {patrol.name}
    </span>
  );
}

/**
 * One number and what it means. Optionally a link, because most of these
 * are a question ("four overdue?") whose next step is the page that
 * answers it.
 */
export function StatCard({
  label,
  value,
  hint,
  to,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  tone?: "default" | "warn" | "good";
  icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {icon && <span className="shrink-0 text-muted-foreground">{icon}</span>}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          tone === "warn" && "text-destructive",
          tone === "good" && "text-primary",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
    </>
  );

  const className = cn(
    "rounded-lg border bg-card p-3 text-card-foreground",
    to && "transition-colors hover:border-primary/40 hover:bg-accent",
  );

  return to ? (
    <Link to={to} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** The same "nothing here yet" box everywhere, with the way out of it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** A 1-5 rating. Read-only unless `onChange` is given. */
export function Stars({
  value,
  onChange,
  size = "size-4",
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: string;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="rounded p-0.5 hover:bg-accent"
            aria-label={`${n} out of 5`}
          >
            <Star
              className={cn(size, n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
            />
          </button>
        ) : (
          <Star
            key={n}
            className={cn(
              size,
              n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
            aria-hidden
          />
        ),
      )}
      {!onChange && <span className="sr-only">{value} out of 5</span>}
    </span>
  );
}

/**
 * A likelihood x severity score, coloured by band.
 *
 * The number on its own means nothing to somebody reading a risk
 * assessment for the first time; the colour is what makes a page of them
 * scannable, and the label is what makes the colour mean something.
 */
export function RiskScore({ likelihood, severity }: { likelihood: number; severity: number }) {
  const score = likelihood * severity;
  const band = score >= 15 ? "high" : score >= 8 ? "medium" : "low";
  const label = band === "high" ? "High" : band === "medium" ? "Medium" : "Low";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        band === "high" && "bg-destructive/15 text-destructive",
        band === "medium" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        band === "low" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      )}
      title={`${likelihood} × ${severity}`}
    >
      {label} · {score}
    </span>
  );
}
