/**
 * A small maze, and the rules for walking it.
 *
 * Kept away from React entirely so the awkward parts — is this maze actually
 * solvable, does a wall really block you — can be checked without rendering
 * anything. A maze with no route through it is the one bug a player cannot
 * work around, and it is invisible until someone is already stuck in it.
 */

export type Cell = {
  /** Walls, clockwise from the top. Carving a passage removes both sides. */
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

export type Maze = {
  width: number;
  height: number;
  /** Row-major, `height` rows of `width` cells. */
  cells: Cell[];
};

export type Direction = "up" | "right" | "down" | "left";

const MOVES: Record<Direction, { dx: number; dy: number; wall: keyof Cell; opposite: keyof Cell }> =
  {
    up: { dx: 0, dy: -1, wall: "top", opposite: "bottom" },
    right: { dx: 1, dy: 0, wall: "right", opposite: "left" },
    down: { dx: 0, dy: 1, wall: "bottom", opposite: "top" },
    left: { dx: -1, dy: 0, wall: "left", opposite: "right" },
  };

export const index = (maze: Maze, x: number, y: number) => y * maze.width + x;

export const inside = (maze: Maze, x: number, y: number) =>
  x >= 0 && y >= 0 && x < maze.width && y < maze.height;

/**
 * Recursive backtracking, which produces a "perfect" maze: exactly one route
 * between any two cells, no loops and no unreachable corners. That property
 * is why it's worth using rather than scattering walls at random — every
 * maze it makes is solvable by construction, and the test suite checks it
 * anyway rather than taking that on trust.
 *
 * `random` is injectable so a test can pin the maze instead of hoping.
 */
export function generateMaze(width: number, height: number, random = Math.random): Maze {
  const maze: Maze = {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({
      top: true,
      right: true,
      bottom: true,
      left: true,
    })),
  };

  const visited = new Set<number>();
  const stack: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  visited.add(0);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const options = (Object.keys(MOVES) as Direction[]).filter((direction) => {
      const { dx, dy } = MOVES[direction];
      const nx = current.x + dx;
      const ny = current.y + dy;
      return inside(maze, nx, ny) && !visited.has(index(maze, nx, ny));
    });

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const direction = options[Math.floor(random() * options.length) % options.length];
    const { dx, dy, wall, opposite } = MOVES[direction];
    const nx = current.x + dx;
    const ny = current.y + dy;

    // Knock out both sides of the same wall. Removing only one would let you
    // walk one way through it and not the other, which looks like a bug from
    // inside the maze and is impossible to explain.
    maze.cells[index(maze, current.x, current.y)][wall] = false;
    maze.cells[index(maze, nx, ny)][opposite] = false;

    visited.add(index(maze, nx, ny));
    stack.push({ x: nx, y: ny });
  }

  return maze;
}

/** Can you walk from here in this direction? */
export function canMove(maze: Maze, x: number, y: number, direction: Direction): boolean {
  if (!inside(maze, x, y)) return false;
  const { dx, dy, wall } = MOVES[direction];
  if (maze.cells[index(maze, x, y)][wall]) return false;
  return inside(maze, x + dx, y + dy);
}

/** Where you end up, or where you started if a wall is in the way. */
export function move(
  maze: Maze,
  x: number,
  y: number,
  direction: Direction,
): { x: number; y: number } {
  if (!canMove(maze, x, y, direction)) return { x, y };
  const { dx, dy } = MOVES[direction];
  return { x: x + dx, y: y + dy };
}

/**
 * Shortest route from one cell to another, as a step count. Null when there
 * is no route at all — which for a perfect maze should never happen, and is
 * exactly the thing worth asserting.
 */
export function shortestPath(
  maze: Maze,
  from: { x: number; y: number },
  to: { x: number; y: number },
): number | null {
  const seen = new Set<number>([index(maze, from.x, from.y)]);
  let frontier = [from];
  let steps = 0;

  while (frontier.length > 0) {
    if (frontier.some((c) => c.x === to.x && c.y === to.y)) return steps;

    const next: { x: number; y: number }[] = [];
    for (const cell of frontier) {
      for (const direction of Object.keys(MOVES) as Direction[]) {
        if (!canMove(maze, cell.x, cell.y, direction)) continue;
        const target = move(maze, cell.x, cell.y, direction);
        const key = index(maze, target.x, target.y);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(target);
      }
    }
    frontier = next;
    steps += 1;
  }

  return null;
}

/** Every cell reachable from the start. Used to prove none are stranded. */
export function reachableCount(maze: Maze): number {
  const seen = new Set<number>([0]);
  const stack = [{ x: 0, y: 0 }];

  while (stack.length > 0) {
    const cell = stack.pop()!;
    for (const direction of Object.keys(MOVES) as Direction[]) {
      if (!canMove(maze, cell.x, cell.y, direction)) continue;
      const target = move(maze, cell.x, cell.y, direction);
      const key = index(maze, target.x, target.y);
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push(target);
    }
  }

  return seen.size;
}

/** mm:ss, for a timer nobody wants to read as 187 seconds. */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
