import { useRef } from "react";
import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { COLOURS, EMBLEMS, INITIALS, resolveIcon } from "@/lib/userIcon";
import type { UserProfile } from "@/types/database";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/UserAvatar";
import { cn } from "@/components/ui/utils";

type IconPatch = Partial<Pick<UserProfile, "avatar_emblem" | "avatar_colour">>;

/**
 * Choosing your badge.
 *
 * Everything here is optional. The badge shown before anyone touches it was
 * worked out from the user's id, and "Start again" puts that back — so there
 * is no state in which a person has no icon.
 */
export function IconPicker({
  profile,
  online,
  onChange,
}: {
  profile: UserProfile;
  online: boolean;
  /** Applied straight away, so the header updates as you click. */
  onChange: (patch: IconPatch) => void;
}) {
  /**
   * Counts saves so a late failure can tell whether it is still the current
   * choice. Without it, an error from the first of two quick taps would revert
   * to a state the person has already moved on from.
   */
  const latestSave = useRef(0);

  const current = resolveIcon(profile);
  const usingInitials = !current.emblem;

  async function save(patch: IconPatch) {
    // Optimistic, and deliberately not disabled while it saves: these are
    // one-tap choices you make several of in a row, and blocking the picker
    // for a round trip per tap silently swallowed the next one — which is
    // exactly what "it doesn't do anything" looks like on a slow connection.
    const previous: IconPatch = {
      avatar_emblem: profile.avatar_emblem,
      avatar_colour: profile.avatar_colour,
    };
    const mine = ++latestSave.current;
    onChange(patch);

    const { error } = await supabase.from("users").update(patch).eq("id", profile.id);
    if (!error) return;

    // Only undo it if nothing has been picked since; otherwise the newer
    // choice stands and this one is just reported.
    if (latestSave.current === mine) onChange(previous);

    // The columns are the one piece of this feature that needs setting up, so
    // name the migration rather than passing on "schema cache" as an answer.
    const missingColumn = /avatar_(emblem|colour)/.test(error.message);
    toast.error(
      missingColumn
        ? "Your badge can't be saved until migration 0010_user_icons.sql has been run on the database."
        : error.message,
    );
  }

  const busy = !online;

  return (
    <section className="flex flex-col gap-4 border-t pt-6">
      <div>
        <h2 className="font-medium">Your icon</h2>
        <p className="text-sm text-muted-foreground">
          The badge beside your name. You already have one — pick a different emblem or
          colour if you&apos;d rather, or use your initials instead.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatar user={profile} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium">
            {usingInitials ? "Your initials" : current.emblem!.label} ·{" "}
            {COLOURS[current.colour - 1].label}
          </span>
          <span className="text-sm text-muted-foreground">
            {current.automatic ? "Picked from your account, not by you." : "Picked by you."}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Emblem</span>
          <button
            type="button"
            disabled={busy}
            aria-pressed={usingInitials}
            onClick={() => save({ avatar_emblem: INITIALS })}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              "hover:bg-accent disabled:opacity-50",
              usingInitials
                ? "border-primary bg-accent text-primary"
                : "text-muted-foreground",
            )}
          >
            Use my initials ({current.initials})
          </button>
        </div>
        <div className="grid grid-cols-8 gap-2">
          {EMBLEMS.map((emblem) => {
            const selected = !usingInitials && emblem.key === current.emblem!.key;
            const Icon = emblem.Icon;
            return (
              <button
                key={emblem.key}
                type="button"
                disabled={busy}
                title={emblem.label}
                aria-label={emblem.label}
                aria-pressed={selected}
                onClick={() => save({ avatar_emblem: emblem.key })}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border transition-colors",
                  "hover:bg-accent disabled:opacity-50",
                  selected ? "border-primary bg-accent text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Colour</span>
        <div className="flex flex-wrap gap-2">
          {COLOURS.map((colour) => {
            const selected = colour.index === current.colour;
            return (
              <button
                key={colour.index}
                type="button"
                disabled={busy}
                title={colour.label}
                aria-label={colour.label}
                aria-pressed={selected}
                onClick={() => save({ avatar_colour: colour.index })}
                className={cn(
                  "size-8 rounded-full border-2 transition-transform disabled:opacity-50",
                  selected ? "scale-110 border-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: `var(--avatar-${colour.index})` }}
              />
            );
          })}
        </div>
      </div>

      {!current.automatic && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => save({ avatar_emblem: null, avatar_colour: null })}
        >
          <Wand2 className="size-4" />
          Start again
        </Button>
      )}
    </section>
  );
}
