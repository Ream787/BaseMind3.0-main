/**
 * Sunrise, sunset and the phase of the moon, worked out locally.
 *
 * Every one of these is arithmetic on a date and a position, so there is
 * no reason for it to need a network. That matters here more than it
 * usually would: the times you want are for a field you are standing in,
 * and the field has no signal. A weather API would have been less code
 * and useless at exactly the moment it was needed.
 *
 * The algorithm is the standard sunrise equation, accurate to about a
 * minute at the latitudes anybody camps at. It has no answer inside the
 * Arctic and Antarctic circles on the days the sun does not rise or set
 * at all; those return nulls and a flag saying which case it is, rather
 * than a plausible-looking wrong time.
 */

const DEG = Math.PI / 180;

/** Julian date of the Unix epoch, and of J2000.0, as day numbers. */
const UNIX_EPOCH_JD = 2440587.5;
const J2000 = 2451545.0;

/**
 * Mean solar noon for a calendar day at a longitude, as days since
 * J2000.0.
 *
 * The date is read as a *calendar* date and anchored at 12:00 UTC before
 * the day number is taken. Anchoring at local noon instead — which is
 * the obvious thing to write — silently folds the running machine's time
 * zone into every result: the day length comes out right and every
 * clock time is wrong by the UTC offset, which is a hard bug to see
 * because sunrise still looks like a sunrise.
 *
 * Longitude is east-positive; the classic formulation of this equation
 * is west-positive, hence the sign.
 */
function meanSolarNoon(date: Date, longitude: number): number {
  const utcNoon = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const dayNumber = Math.round(utcNoon / 86400000 + UNIX_EPOCH_JD - J2000);
  return dayNumber - longitude / 360;
}

/**
 * Where the sun is, for a given mean solar noon.
 *
 * Returns the transit (true solar noon, which is not the same thing as
 * clock noon) and the declination — how far north or south of the
 * equator the sun appears, which is what gives the year its seasons and
 * this function its only interesting term.
 */
function solarPosition(meanNoon: number) {
  // Mean anomaly: where the Earth is around its orbit.
  const meanAnomaly = (357.5291 + 0.98560028 * meanNoon) % 360;
  // The equation of the centre, correcting for the orbit being an
  // ellipse rather than a circle.
  const centre =
    1.9148 * Math.sin(meanAnomaly * DEG) +
    0.02 * Math.sin(2 * meanAnomaly * DEG) +
    0.0003 * Math.sin(3 * meanAnomaly * DEG);
  const eclipticLongitude = (meanAnomaly + centre + 180 + 102.9372) % 360;

  const transit =
    J2000 +
    meanNoon +
    0.0053 * Math.sin(meanAnomaly * DEG) -
    0.0069 * Math.sin(2 * eclipticLongitude * DEG);

  // 23.44 degrees is the tilt of the Earth's axis.
  const declination = Math.asin(
    Math.sin(eclipticLongitude * DEG) * Math.sin(23.44 * DEG),
  );

  return { transit, declination };
}

/** Julian day number back to an ordinary Date. */
const fromJulian = (julian: number) => new Date((julian - UNIX_EPOCH_JD) * 86400000);

/**
 * The hour angle at which the sun sits `elevation` degrees above the
 * horizon, or null when it never reaches that height (or never drops
 * below it) on this day at this latitude.
 */
function hourAngle(elevation: number, latitude: number, declination: number): number | null {
  const cosOmega =
    (Math.sin(elevation * DEG) - Math.sin(latitude * DEG) * Math.sin(declination)) /
    (Math.cos(latitude * DEG) * Math.cos(declination));

  if (cosOmega > 1 || cosOmega < -1) return null;
  return Math.acos(cosOmega) / DEG;
}

export type SunTimes = {
  /** Local Date, or null on a day the sun never crosses the horizon. */
  sunrise: Date | null;
  sunset: Date | null;
  /** True solar noon — when the sun is actually highest. */
  solarNoon: Date;
  /** Length of the day in minutes; 0 or 1440 in the polar cases. */
  daylightMinutes: number;
  /** True when the sun is up for the whole 24 hours. */
  midnightSun: boolean;
  /** True when it never comes up. */
  polarNight: boolean;
};

/**
 * Sunrise and sunset for a date and position.
 *
 * `latitude` and `longitude` are decimal degrees, north and east
 * positive. The returned Dates are ordinary Dates, so they format in the
 * viewer's own time zone with the same helpers as everything else.
 */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const meanNoon = meanSolarNoon(date, longitude);
  const { transit, declination } = solarPosition(meanNoon);

  // -0.833 degrees rather than 0: the sun's disc is half a degree wide,
  // and the atmosphere bends its image up by about another third of a
  // degree, so it appears to rise before it geometrically does.
  const omega = hourAngle(-0.833, latitude, declination);

  if (omega === null) {
    // Which polar case it is depends on which side of the horizon the
    // sun is stuck on, and that follows from the signs of latitude and
    // declination agreeing.
    const up = latitude * declination > 0;
    return {
      sunrise: null,
      sunset: null,
      solarNoon: fromJulian(transit),
      daylightMinutes: up ? 24 * 60 : 0,
      midnightSun: up,
      polarNight: !up,
    };
  }

  const sunrise = fromJulian(transit - omega / 360);
  const sunset = fromJulian(transit + omega / 360);

  return {
    sunrise,
    sunset,
    solarNoon: fromJulian(transit),
    daylightMinutes: Math.round((sunset.getTime() - sunrise.getTime()) / 60000),
    midnightSun: false,
    polarNight: false,
  };
}

/**
 * How dark it gets, and when.
 *
 * Civil twilight — the sun 6 degrees below the horizon — is the useful
 * one for a camp: roughly the point at which you cannot read a map
 * without a torch, which is the thing actually being planned around.
 */
export function civilTwilight(date: Date, latitude: number, longitude: number) {
  const meanNoon = meanSolarNoon(date, longitude);
  const { transit, declination } = solarPosition(meanNoon);
  const omega = hourAngle(-6, latitude, declination);

  if (omega === null) return { dawn: null, dusk: null };

  return {
    dawn: fromJulian(transit - omega / 360),
    dusk: fromJulian(transit + omega / 360),
  };
}

export type MoonPhase = {
  /** 0 = new, 0.5 = full, approaching 1 = new again. */
  fraction: number;
  /** How much of the disc is lit, 0-1. */
  illumination: number;
  name: string;
  /** A drawable emoji, which is enough for a camp and needs no asset. */
  emoji: string;
};

const PHASES: { upTo: number; name: string; emoji: string }[] = [
  { upTo: 0.0625, name: "New moon", emoji: "🌑" },
  { upTo: 0.1875, name: "Waxing crescent", emoji: "🌒" },
  { upTo: 0.3125, name: "First quarter", emoji: "🌓" },
  { upTo: 0.4375, name: "Waxing gibbous", emoji: "🌔" },
  { upTo: 0.5625, name: "Full moon", emoji: "🌕" },
  { upTo: 0.6875, name: "Waning gibbous", emoji: "🌖" },
  { upTo: 0.8125, name: "Last quarter", emoji: "🌗" },
  { upTo: 0.9375, name: "Waning crescent", emoji: "🌘" },
  { upTo: 1.0001, name: "New moon", emoji: "🌑" },
];

/**
 * The phase of the moon, from the mean synodic month.
 *
 * This ignores the moon's orbital eccentricity, so it can be a few hours
 * out at the quarters. For "will there be enough light to strike camp
 * without torches" that is well inside the noise; for astronomy it is
 * not, and nothing here claims otherwise.
 */
export function moonPhase(date: Date): MoonPhase {
  const SYNODIC_MONTH = 29.530588853;
  // A known new moon: 6 January 2000, 18:14 UTC.
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14) / 86400000;
  const days = date.getTime() / 86400000 - knownNewMoon;

  let fraction = (days % SYNODIC_MONTH) / SYNODIC_MONTH;
  if (fraction < 0) fraction += 1;

  // The lit fraction follows a cosine, not the phase directly: a moon
  // halfway through its cycle is fully lit, not half lit.
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const phase = PHASES.find((p) => fraction < p.upTo) ?? PHASES[0];

  return { fraction, illumination, name: phase.name, emoji: phase.emoji };
}
