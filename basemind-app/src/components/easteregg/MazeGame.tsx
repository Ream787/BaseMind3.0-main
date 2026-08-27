import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, RotateCcw, Trophy } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  canMove,
  formatDuration,
  generateMaze,
  move,
  shortestPath,
  type Direction,
} from "@/lib/maze";
import { Button } from "@/components/ui/button";

/** Big enough to be a maze, small enough to fit a phone without pinching. */
const SIZE = 11;

/**
 * The thing behind ten taps on the wordmark.
 *
 * Deliberately complete rather than a joke: it keeps time, counts moves, and
 * records a finish so the Admin page can show who got here. An easter egg
 * that does nothing is found once; one with a scoreboard gets shown to the
 * rest of the troop.
 */
export function MazeGame() {
  const { profile } = useAuth();
  const [seed, setSeed] = useState(0);
  const maze = useMemo(() => generateMaze(SIZE, SIZE), [seed]);
  const goal = { x: SIZE - 1, y: SIZE - 1 };

  const [at, setAt] = useState({ x: 0, y: 0 });
  // Where the player is, updated synchronously. React state is not readable
  // again until the next render, so two taps landing in the same frame would
  // both start from the old square and the second would be thrown away.
  const atRef = useRef({ x: 0, y: 0 });
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const saved = useRef(false);

  const best = useMemo(() => shortestPath(maze, { x: 0, y: 0 }, goal) ?? 0, [maze, goal]);

  useEffect(() => {
    if (startedAt === null || finished) return;
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      250,
    );
    return () => clearInterval(timer);
  }, [startedAt, finished]);

  const step = useCallback(
    (direction: Direction) => {
      if (finished) return;
      // Worked out here rather than inside a setState updater. Bumping the
      // move count from inside one counted every move twice, because React
      // runs updaters more than once to catch exactly that kind of side
      // effect hiding in a function that is supposed to be pure.
      const from = atRef.current;
      if (!canMove(maze, from.x, from.y, direction)) return;
      const to = move(maze, from.x, from.y, direction);
      atRef.current = to;
      setStartedAt((prev) => prev ?? Date.now());
      setAt(to);
      setMoves((m) => m + 1);
    },
    [maze, finished],
  );

  // Arrow keys and WASD. preventDefault stops the page scrolling under it.
  useEffect(() => {
    const keys: Record<string, Direction> = {
      ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
      w: "up", s: "down", a: "left", d: "right",
    };
    const onKey = (e: KeyboardEvent) => {
      const direction = keys[e.key];
      if (!direction) return;
      e.preventDefault();
      step(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  // Finishing writes the run once. The ref guards against the effect running
  // twice in StrictMode and recording the same run two times.
  useEffect(() => {
    if (at.x !== goal.x || at.y !== goal.y || finished) return;
    setFinished(true);
    const seconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    setElapsed(seconds);

    if (saved.current || !profile?.id) return;
    saved.current = true;
    void supabase
      .from("maze_runs")
      .insert({ user_id: profile.id, seconds, moves, size: SIZE })
      .then(({ error }) => {
        if (error) toast.error(`Finished, but the run wasn't saved: ${error.message}`);
      });
  }, [at, goal.x, goal.y, finished, startedAt, moves, profile?.id]);

  function restart() {
    saved.current = false;
    setSeed((s) => s + 1);
    atRef.current = { x: 0, y: 0 };
    setAt({ x: 0, y: 0 });
    setMoves(0);
    setStartedAt(null);
    setElapsed(0);
    setFinished(false);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-md items-center justify-between gap-3">
        <div>
          <h1>Camp maze</h1>
          <p className="text-sm text-muted-foreground">
            Get from the top left to the flag. Arrow keys, or the buttons.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={restart}>
          <RotateCcw className="size-4" />
          New maze
        </Button>
      </div>

      <div className="flex w-full max-w-md justify-between text-sm text-muted-foreground">
        <span>Time {formatDuration(elapsed)}</span>
        <span>Moves {moves}</span>
        <span>Best possible {best}</span>
      </div>

      {/* Drawn with borders rather than images: a wall is literally a border
          on the cell, so what you see and what canMove() allows cannot drift. */}
      <div
        className="grid w-full max-w-md touch-none select-none border-2 border-foreground bg-card"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
      >
        {maze.cells.map((cell, i) => {
          const x = i % SIZE;
          const y = Math.floor(i / SIZE);
          const here = at.x === x && at.y === y;
          const isGoal = goal.x === x && goal.y === y;
          return (
            <div
              key={i}
              className="relative aspect-square"
              style={{
                borderTop: cell.top ? "2px solid currentColor" : undefined,
                borderRight: cell.right ? "2px solid currentColor" : undefined,
                borderBottom: cell.bottom ? "2px solid currentColor" : undefined,
                borderLeft: cell.left ? "2px solid currentColor" : undefined,
              }}
            >
              {isGoal && (
                <Flag className="absolute inset-0 m-auto size-3 text-primary sm:size-4" />
              )}
              {here && (
                <span className="absolute inset-0 m-auto size-2/3 rounded-full bg-primary sm:size-1/2" />
              )}
            </div>
          );
        })}
      </div>

      {finished ? (
        <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center">
          <Trophy className="size-6 text-primary" />
          <p className="font-medium">
            Out in {formatDuration(elapsed)}, {moves} moves
          </p>
          <p className="text-sm text-muted-foreground">
            {moves === best
              ? "That is the shortest route there was. Nothing wasted."
              : `The shortest route was ${best} moves.`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={restart}>
              Another one
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/equipment">Back to work</Link>
            </Button>
          </div>
        </div>
      ) : (
        /* A d-pad, because this is mostly going to be played on a phone
           where there is no arrow key to press. */
        <div className="grid grid-cols-3 gap-2">
          <span />
          <Button variant="outline" size="icon" aria-label="Up" onClick={() => step("up")}>
            <ArrowUp className="size-4" />
          </Button>
          <span />
          <Button variant="outline" size="icon" aria-label="Left" onClick={() => step("left")}>
            <ArrowLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Down" onClick={() => step("down")}>
            <ArrowDown className="size-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Right" onClick={() => step("right")}>
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
