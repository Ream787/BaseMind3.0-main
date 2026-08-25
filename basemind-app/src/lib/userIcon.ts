/**
 * Everyone gets a little camp badge of their own.
 *
 * The badge is worked out from the user's id, so it exists the moment an
 * account does: nothing to upload, nothing to generate, and it renders the
 * same on every device and while offline. Picking one yourself just pins the
 * values the id would otherwise have chosen.
 */
import {
  Axe,
  Backpack,
  Binoculars,
  Bird,
  Compass,
  Flame,
  Flashlight,
  Footprints,
  Leaf,
  Map,
  Mountain,
  Sailboat,
  Star,
  Tent,
  TreePine,
  Waves,
  type LucideIcon,
} from "lucide-react";

export type EmblemKey =
  | "tent"
  | "campfire"
  | "compass"
  | "pine"
  | "mountain"
  | "backpack"
  | "map"
  | "binoculars"
  | "axe"
  | "torch"
  | "owl"
  | "leaf"
  | "star"
  | "river"
  | "canoe"
  | "trail";

type Emblem = {
  key: EmblemKey;
  /** Shown in the picker, and read out to screen readers. */
  label: string;
  Icon: LucideIcon;
};

/**
 * The value `avatar_emblem` holds for someone who would rather have their
 * initials than a picture. Reserved, so it can never collide with an emblem.
 */
export const INITIALS = "initials";

/** Sixteen emblems x eight colours: 128 badges, which is plenty for a group. */
export const EMBLEMS: Emblem[] = [
  { key: "tent", label: "Tent", Icon: Tent },
  { key: "campfire", label: "Campfire", Icon: Flame },
  { key: "compass", label: "Compass", Icon: Compass },
  { key: "pine", label: "Pine tree", Icon: TreePine },
  { key: "mountain", label: "Mountain", Icon: Mountain },
  { key: "backpack", label: "Backpack", Icon: Backpack },
  { key: "map", label: "Map", Icon: Map },
  { key: "binoculars", label: "Binoculars", Icon: Binoculars },
  { key: "axe", label: "Axe", Icon: Axe },
  { key: "torch", label: "Torch", Icon: Flashlight },
  { key: "owl", label: "Owl", Icon: Bird },
  { key: "leaf", label: "Leaf", Icon: Leaf },
  { key: "star", label: "Star", Icon: Star },
  { key: "river", label: "River", Icon: Waves },
  { key: "canoe", label: "Canoe", Icon: Sailboat },
  { key: "trail", label: "Trail", Icon: Footprints },
];

/** Indexes into `--avatar-N` in theme.css, which flips them for dark mode. */
export const COLOURS = [
  { index: 1, label: "Violet" },
  { index: 2, label: "Teal" },
  { index: 3, label: "Amber" },
  { index: 4, label: "Green" },
  { index: 5, label: "Rose" },
  { index: 6, label: "Blue" },
  { index: 7, label: "Lime" },
  { index: 8, label: "Magenta" },
] as const;

export function emblemFor(key: string | null | undefined): Emblem | null {
  return EMBLEMS.find((e) => e.key === key) ?? null;
}

/**
 * FNV-1a. Not for security — just a cheap spread that gives the same answer
 * in every browser, so a person's badge doesn't change between devices.
 */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Initials, for anyone who'd rather have letters than a picture. */
export function initialsFor(user: { name?: string | null; email?: string | null }): string {
  const name = user.name?.trim() ?? "";
  if (name) {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return user.email?.[0]?.toUpperCase() ?? "?";
}

export type ResolvedIcon = {
  /** The emblem to draw, or null when this person chose their letters. */
  emblem: Emblem | null;
  /** Their letters. Always worked out, so there is always something to draw. */
  initials: string;
  /** 1-8, matching `--avatar-N`. */
  colour: number;
  /** True when nothing was chosen and both halves came from the id. */
  automatic: boolean;
};

type IconFields = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatar_emblem?: string | null;
  avatar_colour?: number | null;
};

/**
 * The badge to draw for someone. Chosen values win; anything unset falls back
 * to the id, so half a choice still gives a whole badge.
 */
export function resolveIcon(user: IconFields): ResolvedIcon {
  const h = hash(user.id);
  const wantsInitials = user.avatar_emblem === INITIALS;
  const chosen = emblemFor(user.avatar_emblem);
  // Different bits for each half, so two people who share an emblem aren't
  // forced to share a colour as well.
  const derivedEmblem = EMBLEMS[h % EMBLEMS.length];
  const derivedColour = ((h >>> 8) % COLOURS.length) + 1;

  const colour =
    user.avatar_colour && user.avatar_colour >= 1 && user.avatar_colour <= COLOURS.length
      ? user.avatar_colour
      : derivedColour;

  return {
    // An unrecognised key falls through to the derived emblem rather than
    // breaking, so the list can grow without stranding anyone.
    emblem: wantsInitials ? null : (chosen ?? derivedEmblem),
    initials: initialsFor(user),
    colour,
    automatic: !wantsInitials && !chosen && !user.avatar_colour,
  };
}
