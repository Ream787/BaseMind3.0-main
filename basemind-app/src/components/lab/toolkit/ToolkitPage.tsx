import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Compass,
  Flashlight,
  LifeBuoy,
  MapPin,
  Radio,
  Shuffle,
  Sunrise,
  Timer as TimerIcon,
  UtensilsCrossed,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";

import { useLabTable } from "@/lib/lab/useLabTable";
import { latLonToGridRef, gridRefToLatLon, toDMS } from "@/lib/lab/gridref";
import { civilTwilight, moonPhase, sunTimes } from "@/lib/lab/sun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LabPage } from "@/components/lab/LabPage";
import { PatrolChip } from "@/components/lab/LabUi";
import { TOOLKIT_TABS } from "@/components/layout/SectionTabs";

/**
 * The toolkit: the small things you want in a field.
 *
 * Everything on this page works with no connection. That is the rule that
 * decided what went on it — a sunrise table computed from a date and a
 * position belongs here; a weather forecast does not, however much more
 * useful a forecast would be on a good day. A tool that fails at a
 * campsite is worse than no tool, because you stopped carrying the paper
 * one.
 *
 * The only thing that touches the network is the browser's own
 * geolocation, and every tool that uses it also takes typed-in numbers.
 */

type Tool = {
  key: string;
  name: string;
  blurb: string;
  icon: typeof Compass;
  render: () => JSX.Element;
};

export function ToolkitPage() {
  const [open, setOpen] = useState<string | null>("sun");

  const tools: Tool[] = [
    {
      key: "sun",
      name: "Sun and moon",
      blurb: "Sunrise, sunset, when it gets dark, and how much moon there will be.",
      icon: Sunrise,
      render: () => <SunTool />,
    },
    {
      key: "grid",
      name: "Grid references",
      blurb: "Between what the phone says and what the map wants.",
      icon: MapPin,
      render: () => <GridTool />,
    },
    {
      key: "picker",
      name: "Pick and split",
      blurb: "Random teams, a random name, or who goes first.",
      icon: Shuffle,
      render: () => <PickerTool />,
    },
    {
      key: "timer",
      name: "Timer",
      blurb: "Count down a round, or time one.",
      icon: TimerIcon,
      render: () => <TimerTool />,
    },
    {
      key: "morse",
      name: "Morse",
      blurb: "Translate it, and flash it with the screen.",
      icon: Radio,
      render: () => <MorseTool />,
    },
    {
      key: "scaler",
      name: "Recipe scaler",
      blurb: "A recipe for six, cooked for twenty-three.",
      icon: UtensilsCrossed,
      render: () => <ScalerTool />,
    },
    {
      key: "knots",
      name: "Knots",
      blurb: "Six knots, what each is for, and how it goes.",
      icon: Waypoints,
      render: () => <KnotsTool />,
    },
    {
      key: "signals",
      name: "Emergency signals",
      blurb: "Whistle, torch and what to say when you call for help.",
      icon: LifeBuoy,
      render: () => <SignalsTool />,
    },
  ];

  return (
    <LabPage
      title="Toolkit"
      description="Small things that work with no signal."
      feature="toolkit"
      tabs={TOOLKIT_TABS}
    >
      <ul className="grid gap-3 md:grid-cols-2">
        {tools.map((tool) => {
          const isOpen = open === tool.key;
          return (
            <li
              key={tool.key}
              className={`rounded-lg border bg-card ${isOpen ? "md:col-span-2" : ""}`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : tool.key)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                <span className="mt-0.5 rounded-md bg-secondary p-2 text-secondary-foreground">
                  <tool.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{tool.name}</span>
                  <span className="block text-sm text-muted-foreground">{tool.blurb}</span>
                </span>
              </button>
              {isOpen && <div className="border-t p-3 sm:p-4">{tool.render()}</div>}
            </li>
          );
        })}
      </ul>
    </LabPage>
  );
}

// ----------------------------------------------------------------------
// Sun and moon
// ----------------------------------------------------------------------

/** Somewhere in the middle of Britain, so the tool says something on first open. */
const DEFAULT_POSITION = { lat: 52.5, lon: -1.9 };

function SunTool() {
  const [lat, setLat] = useState(String(DEFAULT_POSITION.lat));
  const [lon, setLon] = useState(String(DEFAULT_POSITION.lon));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [locating, setLocating] = useState(false);

  const parsed = {
    lat: Number.parseFloat(lat),
    lon: Number.parseFloat(lon),
    date: new Date(`${date}T12:00:00`),
  };
  const valid =
    Number.isFinite(parsed.lat) &&
    Number.isFinite(parsed.lon) &&
    !Number.isNaN(parsed.date.getTime());

  const result = useMemo(() => {
    if (!valid) return null;
    return {
      sun: sunTimes(parsed.date, parsed.lat, parsed.lon),
      twilight: civilTwilight(parsed.date, parsed.lat, parsed.lon),
      moon: moonPhase(parsed.date),
    };
    // Recomputing on the parsed primitives, not the object, so this does
    // not run on every keystroke that leaves the numbers unchanged.
  }, [valid, parsed.lat, parsed.lon, date]);

  function locate() {
    if (!navigator.geolocation) {
      toast.error("This browser can't do location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(5));
        setLon(position.coords.longitude.toFixed(5));
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        toast.error(error.message);
      },
    );
  }

  const time = (value: Date | null) => (value ? format(value, "HH:mm") : "—");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <Label className="mb-1.5 block text-xs">Latitude</Label>
          <Input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Longitude</Label>
          <Input value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={locate} disabled={locating} className="w-full">
            <Compass className="size-4" />
            {locating ? "Finding…" : "Use where I am"}
          </Button>
        </div>
      </div>

      {result && (
        <>
          {result.sun.midnightSun || result.sun.polarNight ? (
            <p className="rounded-lg border p-4 text-center text-sm">
              {result.sun.midnightSun
                ? "The sun does not set here on this date."
                : "The sun does not rise here on this date."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Sunrise" value={time(result.sun.sunrise)} />
              <Readout label="Sunset" value={time(result.sun.sunset)} />
              <Readout
                label="Dark by"
                value={time(result.twilight.dusk)}
                hint="End of civil twilight"
              />
              <Readout
                label="Daylight"
                value={`${Math.floor(result.sun.daylightMinutes / 60)}h ${String(
                  result.sun.daylightMinutes % 60,
                ).padStart(2, "0")}m`}
              />
            </div>
          )}

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <span className="text-3xl" aria-hidden>
              {result.moon.emoji}
            </span>
            <span className="text-sm">
              <strong className="block">{result.moon.name}</strong>
              <span className="text-muted-foreground">
                {(result.moon.illumination * 100).toFixed(0)}% lit —{" "}
                {result.moon.illumination > 0.6
                  ? "enough to walk by without a torch on a clear night"
                  : result.moon.illumination < 0.2
                    ? "effectively no moon; bring torches"
                    : "some light, but not enough to rely on"}
              </span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Times are in this device&apos;s time zone. Accurate to about a minute, which is well
            inside the margin for &ldquo;get the tents up before dark&rdquo;.
          </p>
        </>
      )}
    </div>
  );
}

function Readout({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ----------------------------------------------------------------------
// Grid references
// ----------------------------------------------------------------------

function GridTool() {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [ref, setRef] = useState("");
  const [locating, setLocating] = useState(false);

  const forward = useMemo(() => {
    const a = Number.parseFloat(lat);
    const b = Number.parseFloat(lon);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return latLonToGridRef(a, b);
  }, [lat, lon]);

  const backward = useMemo(() => (ref.trim() ? gridRefToLatLon(ref) : null), [ref]);

  function locate() {
    if (!navigator.geolocation) {
      toast.error("This browser can't do location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(5));
        setLon(position.coords.longitude.toFixed(5));
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        toast.error(error.message);
      },
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Position to grid reference</h3>
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="51.64330"
            inputMode="decimal"
            aria-label="Latitude"
          />
          <Input
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            placeholder="0.00330"
            inputMode="decimal"
            aria-label="Longitude"
          />
        </div>
        <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
          <Compass className="size-4" />
          {locating ? "Finding…" : "Use where I am"}
        </Button>

        {forward &&
          (forward.ok ? (
            <div className="rounded-lg border p-3">
              <p className="font-mono text-2xl font-semibold tracking-wide">{forward.ref}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Easting {forward.easting}, northing {forward.northing}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {forward.reason}
            </p>
          ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium">Grid reference to position</h3>
        <Input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="SU 123 456"
          aria-label="Grid reference"
          className="font-mono"
        />

        {backward &&
          (backward.ok ? (
            <div className="rounded-lg border p-3">
              <p className="text-lg font-semibold tabular-nums">
                {backward.lat.toFixed(5)}, {backward.lon.toFixed(5)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {toDMS(backward.lat, true)} · {toDMS(backward.lon, false)}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {backward.reason}
            </p>
          ))}
      </section>

      <p className="text-xs text-muted-foreground md:col-span-2">
        British National Grid only, and good to about five metres — plenty for a six-figure
        reference, which names a hundred-metre square anyway. Not survey grade, and it will
        refuse rather than guess outside Great Britain.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Pick and split
// ----------------------------------------------------------------------

function PickerTool() {
  const { rows: members } = useLabTable("members", { orderBy: "first_name" });
  const { rows: patrols } = useLabTable("patrols", { orderBy: "sort_order" });

  const [source, setSource] = useState<"members" | "typed">("members");
  const [typed, setTyped] = useState("");
  const [teamCount, setTeamCount] = useState("2");
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const names = useMemo(() => {
    if (source === "typed") {
      return typed
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean);
    }
    return members.filter((m) => m.active).map((m) => `${m.first_name} ${m.last_name}`);
  }, [source, typed, members]);

  /**
   * Fisher-Yates, then deal round-robin.
   *
   * Dealing round-robin rather than chopping the shuffled list into
   * chunks matters when the numbers do not divide: chunking makes the
   * last team the small one every time, and with 23 people and 4 teams
   * that is a team of two against three teams of seven.
   */
  function split() {
    const count = Math.max(2, Math.min(Number(teamCount) || 2, names.length));
    const shuffled = [...names];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const result: string[][] = Array.from({ length: count }, () => []);
    shuffled.forEach((name, index) => result[index % count].push(name));
    setTeams(result);
    setPicked(null);
  }

  function pickOne() {
    if (names.length === 0) return;
    setPicked(names[Math.floor(Math.random() * names.length)]);
    setTeams(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-md border p-0.5 sm:w-fit">
        {(
          [
            ["members", `The roster (${members.filter((m) => m.active).length})`],
            ["typed", "A list I type"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSource(value)}
            className={`flex-1 whitespace-nowrap rounded px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
              source === value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {source === "typed" && (
        <textarea
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          rows={4}
          placeholder="One name per line, or separated by commas"
          className="w-full rounded-md border bg-input-background p-2 text-sm"
        />
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-24">
          <Label className="mb-1.5 block text-xs">Teams</Label>
          <Input
            inputMode="numeric"
            value={teamCount}
            onChange={(e) => setTeamCount(e.target.value)}
          />
        </div>
        <Button onClick={split} disabled={names.length < 2}>
          <Shuffle className="size-4" />
          Split them up
        </Button>
        <Button variant="outline" onClick={pickOne} disabled={names.length === 0}>
          Pick one
        </Button>
        {patrols.length > 0 && (
          <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            or just use patrols:
            {patrols.map((p) => (
              <PatrolChip key={p.id} patrol={p} />
            ))}
          </span>
        )}
      </div>

      {picked && (
        <p className="rounded-lg border p-4 text-center text-2xl font-semibold">{picked}</p>
      )}

      {teams && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team, index) => (
            <li key={index} className="rounded-lg border p-3">
              <p className="text-sm font-medium">
                Team {index + 1}{" "}
                <span className="text-muted-foreground">({team.length})</span>
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                {team.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {names.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No names yet — add members to the roster, or type a list.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Timer
// ----------------------------------------------------------------------

function TimerTool() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [countdownFrom, setCountdownFrom] = useState<number | null>(null);
  const startedRef = useRef<number>(0);

  /**
   * Driven by wall-clock arithmetic rather than by counting ticks. A
   * phone screen that sleeps stops firing intervals, and a timer that
   * counts intervals quietly loses the minutes it was asleep for —
   * which is precisely the interval you were timing.
   */
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedRef.current) / 1000);
      setSeconds(countdownFrom === null ? elapsed : Math.max(0, countdownFrom - elapsed));
    }, 250);
    return () => window.clearInterval(id);
  }, [running, countdownFrom]);

  useEffect(() => {
    if (running && countdownFrom !== null && seconds === 0) {
      setRunning(false);
      toast.success("Time!");
      // A short vibration where it is supported. No audio: a page that
      // makes noise without being asked is a page people close.
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [running, countdownFrom, seconds]);

  function start(from: number | null) {
    startedRef.current = Date.now();
    setCountdownFrom(from);
    setSeconds(from ?? 0);
    setRunning(true);
  }

  const display = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <p
        className={`text-center font-mono text-6xl font-semibold tabular-nums ${
          countdownFrom !== null && seconds <= 10 && running ? "text-destructive" : ""
        }`}
      >
        {display}
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 5, 10, 15].map((minutes) => (
          <Button key={minutes} variant="outline" size="sm" onClick={() => start(minutes * 60)}>
            {minutes} min
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => start(null)}>
          Stopwatch
        </Button>
      </div>

      <div className="flex justify-center gap-2">
        <Button
          onClick={() => {
            if (running) {
              setRunning(false);
            } else {
              // Resuming keeps whatever is on the clock by moving the
              // start point back to match it.
              startedRef.current =
                Date.now() - (countdownFrom === null ? seconds : countdownFrom - seconds) * 1000;
              setRunning(true);
            }
          }}
        >
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setRunning(false);
            setSeconds(countdownFrom ?? 0);
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Morse
// ----------------------------------------------------------------------

const MORSE: Record<string, string> = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--", X: "-..-",
  Y: "-.--", Z: "--..", "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "/": "-..-.", "!": "-.-.--",
};

const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function MorseTool() {
  const [text, setText] = useState("SOS");
  const [flashing, setFlashing] = useState(false);
  const [lit, setLit] = useState(false);

  const encoded = useMemo(
    () =>
      text
        .toUpperCase()
        .split("")
        .map((char) => (char === " " ? "/" : (MORSE[char] ?? "")))
        .filter(Boolean)
        .join(" "),
    [text],
  );

  /** Decoding is offered too, because half the fun is reading it back. */
  const decoded = useMemo(() => {
    if (!/^[.\-/\s]+$/.test(text.trim())) return null;
    return text
      .trim()
      .split(/\s+/)
      .map((token) => (token === "/" ? " " : (FROM_MORSE[token] ?? "?")))
      .join("");
  }, [text]);

  /**
   * Flash the message with the screen.
   *
   * The timings are the real ones — a dash is three dots, the gap
   * between letters is three dots, between words seven — because a
   * signal with invented timing is not morse, it is a flickering phone.
   */
  useEffect(() => {
    if (!flashing) {
      setLit(false);
      return;
    }

    const unit = 200;
    const sequence: { on: boolean; length: number }[] = [];

    for (const symbol of encoded) {
      if (symbol === ".") sequence.push({ on: true, length: 1 }, { on: false, length: 1 });
      else if (symbol === "-") sequence.push({ on: true, length: 3 }, { on: false, length: 1 });
      else if (symbol === " ") sequence.push({ on: false, length: 2 });
      else if (symbol === "/") sequence.push({ on: false, length: 6 });
    }
    if (sequence.length === 0) return;

    let index = 0;
    let timeout: number;

    const step = () => {
      const part = sequence[index % sequence.length];
      setLit(part.on);
      index += 1;
      timeout = window.setTimeout(step, part.length * unit);
    };
    step();

    return () => window.clearTimeout(timeout);
  }, [flashing, encoded]);

  return (
    <div className="space-y-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type letters, or type dots and dashes"
      />

      {encoded && (
        <div className="rounded-lg border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Morse</p>
          <p className="break-all font-mono text-lg tracking-widest">{encoded}</p>
        </div>
      )}

      {decoded && decoded !== text.trim() && (
        <div className="rounded-lg border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Reads as</p>
          <p className="text-lg font-medium">{decoded}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setFlashing(!flashing)} disabled={!encoded}>
          <Flashlight className="size-4" />
          {flashing ? "Stop flashing" : "Flash it"}
        </Button>
        {flashing && (
          <span className="text-xs text-muted-foreground">
            Repeating. Dot 0.2s, dash 0.6s — real timings.
          </span>
        )}
      </div>

      {flashing && (
        <div
          className="flex h-32 items-center justify-center rounded-lg border transition-colors duration-75"
          style={{
            backgroundColor: lit ? "#ffffff" : "#000000",
          }}
          aria-hidden
        />
      )}

      <p className="text-xs text-muted-foreground">
        SOS is <span className="font-mono">... --- ...</span> — three short, three long, three
        short, sent as one run with no letter gaps.
      </p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Recipe scaler
// ----------------------------------------------------------------------

function ScalerTool() {
  const [recipe, setRecipe] = useState(
    "500 g pasta\n2 tins chopped tomatoes\n1 onion\n200 g cheese\n3 tbsp oil",
  );
  const [serves, setServes] = useState("6");
  const [target, setTarget] = useState("24");

  const factor = (Number(target) || 0) / (Number(serves) || 1);

  /**
   * Scales the leading number on each line and leaves the rest alone.
   *
   * Deliberately dim: it does not try to understand units, convert
   * between them, or know that you cannot buy 1.3 onions. A parser that
   * guessed would be wrong occasionally and trusted always, which is
   * worse than one that visibly only multiplies.
   */
  const scaled = useMemo(() => {
    return recipe.split("\n").map((line) => {
      const match = line.match(/^\s*(\d+(?:[.,]\d+)?)\s*(.*)$/);
      if (!match) return { original: line, scaled: line, changed: false };

      const value = Number.parseFloat(match[1].replace(",", "."));
      const result = value * factor;
      // Two decimals on small numbers, whole numbers once it is big
      // enough that the fraction is noise.
      const shown = result >= 10 ? Math.round(result).toString() : result.toFixed(2).replace(/\.?0+$/, "");

      return { original: line, scaled: `${shown} ${match[2]}`, changed: true };
    });
  }, [recipe, factor]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs">Written for</Label>
            <Input
              inputMode="numeric"
              value={serves}
              onChange={(e) => setServes(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label className="mb-1.5 block text-xs">Cooking for</Label>
            <Input
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">The recipe, one ingredient per line</Label>
          <textarea
            value={recipe}
            onChange={(e) => setRecipe(e.target.value)}
            rows={10}
            className="w-full rounded-md border bg-input-background p-2 font-mono text-sm"
          />
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          × {factor.toFixed(2)} — rounded sensibly, and the units are left exactly as you wrote
          them.
        </p>
        <ul className="divide-y rounded-lg border">
          {scaled.map((line, index) => (
            <li key={index} className="p-2 font-mono text-sm">
              {line.scaled || <span className="text-muted-foreground">—</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Reference cards
// ----------------------------------------------------------------------

const KNOTS = [
  {
    name: "Reef knot",
    use: "Joining two ropes of the same thickness, or tying a bandage.",
    how: "Left over right and under, then right over left and under. If it looks like a granny knot, one of the two was the wrong way round.",
    warning: "Not for taking a load. It capsizes under strain and it will not be your fault when it does.",
  },
  {
    name: "Bowline",
    use: "A loop that will not tighten — round a post, or round a person.",
    how: "Make a small loop. The rabbit comes out of the hole, round the tree, and back down the hole.",
    warning: "Check the tail is inside the loop, not outside. Outside is not a bowline.",
  },
  {
    name: "Clove hitch",
    use: "Starting and finishing a lashing; tying to a spar.",
    how: "Two turns round the spar with the second crossing over the first, tail tucked under.",
    warning: "Slips along a smooth pole under a sideways pull. Fine inside a lashing, not on its own.",
  },
  {
    name: "Round turn and two half hitches",
    use: "Tying to a ring or a rail when there is a load on it.",
    how: "A full turn round the object — that is the bit taking the strain — then two half hitches round the standing part.",
    warning: "The round turn is not optional. Without it you are holding the load with the hitches.",
  },
  {
    name: "Sheet bend",
    use: "Joining two ropes of different thicknesses.",
    how: "Bight in the thicker rope; the thinner one comes up through it, round the back, and tucks under itself.",
    warning: "Both tails must end up on the same side. Opposite sides is a much weaker knot.",
  },
  {
    name: "Figure of eight",
    use: "A stopper knot, so a rope cannot run out through a hole.",
    how: "Round the standing part, back through the loop from the far side. It looks like an eight because it is one.",
    warning: "Tighten it, or it shakes out.",
  },
];

function KnotsTool() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {KNOTS.map((knot) => (
        <li key={knot.name} className="rounded-lg border p-3">
          <p className="font-medium">{knot.name}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{knot.use}</p>
          <p className="mt-2 text-sm">{knot.how}</p>
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{knot.warning}</p>
        </li>
      ))}
    </ul>
  );
}

function SignalsTool() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border p-3">
        <h3 className="font-medium">Whistle and torch</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <div>
            <dt className="font-medium">Six blasts in a minute, then wait a minute</dt>
            <dd className="text-muted-foreground">
              The international distress signal. Repeat it. Six, pause, six.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Three blasts, repeated</dt>
            <dd className="text-muted-foreground">
              &ldquo;Come to me&rdquo; — a leader calling everybody in.
            </dd>
          </div>
          <div>
            <dt className="font-medium">One long blast</dt>
            <dd className="text-muted-foreground">Stop and listen.</dd>
          </div>
          <div>
            <dt className="font-medium">Torch at night</dt>
            <dd className="text-muted-foreground">
              Same counts, with flashes. Six flashes, a minute&apos;s pause, six again.
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Agree the signals out loud before you go out, and make sure everybody has heard them
          once. A signal nobody has heard before is just a noise.
        </p>
      </section>

      <section className="rounded-lg border p-3">
        <h3 className="font-medium">Calling for help</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Say these six things, in this order, and stay on the line until they hang up.
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm">
          <li>Where you are — grid reference, or the nearest road and landmark.</li>
          <li>Your name, and a number they can ring back.</li>
          <li>What has happened.</li>
          <li>How many people are hurt, and how badly.</li>
          <li>How old they are.</li>
          <li>The weather where you are, and how easy you are to get to.</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          In Great Britain, ask for the police and then mountain rescue if you are on a hill. If
          you cannot speak, a 999 call and then 55 on the keypad reaches a silent-call operator.
        </p>
      </section>
    </div>
  );
}
