import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Trophy } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/maze";
import type { MazeRun } from "@/types/database";

/**
 * Who has found the maze, and how they did.
 *
 * Admin-only, and quiet about it: no heading shouting EASTER EGG, because
 * half the fun is that whoever finds it gets to be the one who mentions it.
 * Row-level security is what actually restricts this — an Admin sees every
 * run, everybody else sees only their own, so rendering it here is a
 * convenience rather than the protection.
 */
export function MazeLeaderboard() {
  const [runs, setRuns] = useState<MazeRun[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const [{ data: rows }, { data: users }] = await Promise.all([
        supabase
          .from("maze_runs")
          .select("*")
          .order("seconds", { ascending: true })
          .limit(20),
        supabase.from("users").select("id, name"),
      ]);
      if (!active) return;
      setRuns(rows ?? []);
      setNames(new Map((users ?? []).map((u) => [u.id, u.name])));
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading || runs.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <Trophy className="size-4 text-primary" />
          Camp maze
        </h2>
        <p className="text-sm text-muted-foreground">
          {runs.length === 1
            ? "Somebody found the maze."
            : `${new Set(runs.map((r) => r.user_id)).size} people have found the maze.`}
        </p>
      </div>

      <ol className="flex flex-col gap-1">
        {runs.map((run, i) => (
          <li
            key={run.id}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-muted-foreground">{i + 1}</span>
              <span className="truncate font-medium">
                {names.get(run.user_id) ?? "Someone"}
              </span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {formatDuration(run.seconds)} · {run.moves} moves ·{" "}
              {format(parseISO(run.completed_at), "d MMM")}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
