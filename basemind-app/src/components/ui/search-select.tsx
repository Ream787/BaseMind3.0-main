import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";

import { cn } from "./utils";

export type SearchOption = {
  value: string;
  label: string;
  /** Shown small and to the right — a count, a room, a quantity. */
  hint?: string;
  disabled?: boolean;
};

/**
 * A dropdown you can type into.
 *
 * A plain Select is fine for four conditions and useless for two hundred
 * pieces of kit: you scroll a list you cannot search, on a phone, holding the
 * thing you are trying to find. This filters as you type, works with the
 * keyboard, and can offer to create the value you typed when it isn't there.
 *
 * Deliberately not a Radix popover — the list is rendered in place rather
 * than in a portal, so it stays inside a scrolling dialog and cannot end up
 * floating over the wrong part of the page on a small screen.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Pick one",
  searchPlaceholder = "Type to search…",
  emptyText = "Nothing matches",
  onCreate,
  createLabel = "Add",
  disabled,
  id,
  className,
}: {
  value: string | null;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Given when a value that doesn't exist yet may be created. */
  onCreate?: (label: string) => void;
  createLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, query]);

  // Typing narrows the list, so the highlight has to come back to the top or
  // it ends up pointing past the end of it.
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const exactMatch = options.some(
    (o) => o.label.trim().toLowerCase() === query.trim().toLowerCase(),
  );
  const canCreate = !!onCreate && query.trim().length > 0 && !exactMatch;

  function choose(option: SearchOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function create() {
    if (!canCreate) return;
    onCreate!(query.trim());
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      const count = matches.length + (canCreate ? 1 : 0);
      if (count > 0) setActive((prev) => (prev + step + count) % count);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active < matches.length) choose(matches[active]);
      else create();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="border-input dark:bg-input/30 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-input-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          <div className="relative border-b">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            {/* A native input, not the Input component: that one is a plain
                function component on React 18, so a ref passed to it is
                dropped and the box would never take focus when opened. */}
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent px-3 pl-8 text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>

          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            {matches.map((option, i) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  disabled={option.disabled}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm disabled:opacity-50",
                    i === active && "bg-accent",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Check
                      className={cn(
                        "size-4 shrink-0",
                        option.value === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{option.label}</span>
                  </span>
                  {option.hint && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  )}
                </button>
              </li>
            ))}

            {matches.length === 0 && !canCreate && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyText}
              </li>
            )}

            {canCreate && (
              <li>
                <button
                  type="button"
                  onClick={create}
                  onMouseEnter={() => setActive(matches.length)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                    active === matches.length && "bg-accent",
                  )}
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">
                    {createLabel} &ldquo;{query.trim()}&rdquo;
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
