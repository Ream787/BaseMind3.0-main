/**
 * Ordnance Survey grid references, both ways.
 *
 * A phone gives you a latitude and longitude. A UK map, a campsite
 * booking form and everybody on the other end of a radio want a grid
 * reference. Converting between them by hand at a campsite is exactly the
 * sort of job that is easy to get wrong and hard to notice.
 *
 * ACCURACY, HONESTLY
 * ------------------
 * This uses a Helmert transformation between WGS84 (what GPS gives) and
 * OSGB36 (what the map is drawn on). That is good to roughly 5 metres
 * across Great Britain — fine for "which field", fine for a six-figure
 * reference, and NOT the centimetre-accurate OSTN15 transformation that
 * surveying uses. Six figures is 100 m precision, so the error is well
 * inside the last digit; ten figures would be quoting metres this cannot
 * actually deliver, which is why nothing here offers ten.
 *
 * It is also only defined over Great Britain. Outside the grid there is
 * no answer to give, and the functions say so rather than returning a
 * reference that looks plausible.
 */

const DEG = Math.PI / 180;

/** Airy 1830 — the ellipsoid the OS grid is drawn on. */
const AIRY = { a: 6377563.396, b: 6356256.909 };
/** WGS84 — the ellipsoid GPS reports against. */
const WGS84 = { a: 6378137.0, b: 6356752.3142 };

/**
 * The seven Helmert parameters for WGS84 -> OSGB36.
 *
 * Shifts in metres, rotations in seconds of arc, scale in parts per
 * million. Reversing the sign of every one of them converts back, which
 * is what `osgb36ToWgs84` does.
 */
const WGS84_TO_OSGB36 = {
  tx: -446.448,
  ty: 125.157,
  tz: -542.06,
  rx: -0.1502,
  ry: -0.247,
  rz: -0.8421,
  s: 20.4894,
};

type Cartesian = { x: number; y: number; z: number };

function toCartesian(lat: number, lon: number, ellipsoid: { a: number; b: number }): Cartesian {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  const eSquared = (ellipsoid.a ** 2 - ellipsoid.b ** 2) / ellipsoid.a ** 2;
  const nu = ellipsoid.a / Math.sqrt(1 - eSquared * Math.sin(phi) ** 2);

  return {
    x: nu * Math.cos(phi) * Math.cos(lambda),
    y: nu * Math.cos(phi) * Math.sin(lambda),
    z: (1 - eSquared) * nu * Math.sin(phi),
  };
}

function fromCartesian(point: Cartesian, ellipsoid: { a: number; b: number }) {
  const eSquared = (ellipsoid.a ** 2 - ellipsoid.b ** 2) / ellipsoid.a ** 2;
  const p = Math.sqrt(point.x ** 2 + point.y ** 2);

  // Latitude has no closed form here, so it is iterated. Four passes is
  // well past convergence for any point on Earth; the loop stops early
  // once it stops moving.
  let phi = Math.atan2(point.z, p * (1 - eSquared));
  for (let i = 0; i < 10; i++) {
    const nu = ellipsoid.a / Math.sqrt(1 - eSquared * Math.sin(phi) ** 2);
    const next = Math.atan2(point.z + eSquared * nu * Math.sin(phi), p);
    if (Math.abs(next - phi) < 1e-12) {
      phi = next;
      break;
    }
    phi = next;
  }

  return { lat: phi / DEG, lon: Math.atan2(point.y, point.x) / DEG };
}

function helmert(point: Cartesian, p: typeof WGS84_TO_OSGB36, reverse = false): Cartesian {
  const sign = reverse ? -1 : 1;
  const tx = sign * p.tx;
  const ty = sign * p.ty;
  const tz = sign * p.tz;
  // Seconds of arc to radians, and ppm to a plain multiplier.
  const rx = (sign * p.rx * Math.PI) / (180 * 3600);
  const ry = (sign * p.ry * Math.PI) / (180 * 3600);
  const rz = (sign * p.rz * Math.PI) / (180 * 3600);
  const s = 1 + (sign * p.s) / 1e6;

  return {
    x: tx + point.x * s - point.y * rz + point.z * ry,
    y: ty + point.x * rz + point.y * s - point.z * rx,
    z: tz - point.x * ry + point.y * rx + point.z * s,
  };
}

/** National Grid projection constants — the OS's own definition. */
const GRID = {
  /** Scale factor on the central meridian. */
  f0: 0.9996012717,
  /** True origin: 49°N, 2°W. */
  phi0: 49 * DEG,
  lambda0: -2 * DEG,
  /** False origin, in metres, so nothing in Britain is negative. */
  e0: 400000,
  n0: -100000,
};

/**
 * Latitude and longitude on the Airy ellipsoid to easting and northing.
 *
 * This is the Transverse Mercator projection written out longhand. The
 * series terms are the OS's published coefficients; they are not derived
 * here and should not be "tidied".
 */
function toEastingNorthing(lat: number, lon: number) {
  const { a, b } = AIRY;
  const { f0, phi0, lambda0, e0, n0 } = GRID;

  const phi = lat * DEG;
  const lambda = lon * DEG;
  const eSquared = (a ** 2 - b ** 2) / a ** 2;
  const n = (a - b) / (a + b);

  const nu = (a * f0) / Math.sqrt(1 - eSquared * Math.sin(phi) ** 2);
  const rho = (a * f0 * (1 - eSquared)) / (1 - eSquared * Math.sin(phi) ** 2) ** 1.5;
  const etaSquared = nu / rho - 1;

  const m =
    b *
    f0 *
    ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (phi - phi0) -
      (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(phi - phi0) * Math.cos(phi + phi0) +
      ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) *
        Math.sin(2 * (phi - phi0)) *
        Math.cos(2 * (phi + phi0)) -
      (35 / 24) * n ** 3 * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0)));

  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const tan = Math.tan(phi);

  const i = m + n0;
  const ii = (nu / 2) * sin * cos;
  const iii = (nu / 24) * sin * cos ** 3 * (5 - tan ** 2 + 9 * etaSquared);
  const iiia = (nu / 720) * sin * cos ** 5 * (61 - 58 * tan ** 2 + tan ** 4);
  const iv = nu * cos;
  const v = (nu / 6) * cos ** 3 * (nu / rho - tan ** 2);
  const vi =
    (nu / 120) *
    cos ** 5 *
    (5 - 18 * tan ** 2 + tan ** 4 + 14 * etaSquared - 58 * tan ** 2 * etaSquared);

  const d = lambda - lambda0;

  return {
    northing: i + ii * d ** 2 + iii * d ** 4 + iiia * d ** 6,
    easting: e0 + iv * d + v * d ** 3 + vi * d ** 5,
  };
}

/** The inverse projection: easting and northing back to Airy lat/lon. */
function fromEastingNorthing(easting: number, northing: number) {
  const { a, b } = AIRY;
  const { f0, phi0, lambda0, e0, n0 } = GRID;

  const eSquared = (a ** 2 - b ** 2) / a ** 2;
  const n = (a - b) / (a + b);

  let phi = phi0;
  let m = 0;

  // Latitude is iterated until the meridional arc matches the northing.
  do {
    phi = (northing - n0 - m) / (a * f0) + phi;
    m =
      b *
      f0 *
      ((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * (phi - phi0) -
        (3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) * Math.sin(phi - phi0) * Math.cos(phi + phi0) +
        ((15 / 8) * n ** 2 + (15 / 8) * n ** 3) *
          Math.sin(2 * (phi - phi0)) *
          Math.cos(2 * (phi + phi0)) -
        (35 / 24) * n ** 3 * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0)));
  } while (Math.abs(northing - n0 - m) >= 0.00001);

  const nu = (a * f0) / Math.sqrt(1 - eSquared * Math.sin(phi) ** 2);
  const rho = (a * f0 * (1 - eSquared)) / (1 - eSquared * Math.sin(phi) ** 2) ** 1.5;
  const etaSquared = nu / rho - 1;

  const tan = Math.tan(phi);
  const sec = 1 / Math.cos(phi);

  const vii = tan / (2 * rho * nu);
  const viii = (tan / (24 * rho * nu ** 3)) * (5 + 3 * tan ** 2 + etaSquared - 9 * tan ** 2 * etaSquared);
  const ix = (tan / (720 * rho * nu ** 5)) * (61 + 90 * tan ** 2 + 45 * tan ** 4);
  const x = sec / nu;
  const xi = (sec / (6 * nu ** 3)) * (nu / rho + 2 * tan ** 2);
  const xii = (sec / (120 * nu ** 5)) * (5 + 28 * tan ** 2 + 24 * tan ** 4);
  const xiia = (sec / (5040 * nu ** 7)) * (61 + 662 * tan ** 2 + 1320 * tan ** 4 + 720 * tan ** 6);

  const d = easting - e0;

  return {
    lat: (phi - vii * d ** 2 + viii * d ** 4 - ix * d ** 6) / DEG,
    lon: (lambda0 + x * d - xi * d ** 3 + xii * d ** 5 - xiia * d ** 7) / DEG,
  };
}

/**
 * The two-letter prefixes, laid out as the OS lays them: a 5x5 block of
 * 500 km squares, each split into a 5x5 block of 100 km squares, with I
 * skipped in both alphabets because it reads as a 1.
 */
const LETTERS = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

/** A grid reference, or an explanation of why there isn't one. */
export type GridResult =
  | { ok: true; ref: string; easting: number; northing: number }
  | { ok: false; reason: string };

/**
 * Latitude and longitude (WGS84, as a phone reports it) to a grid
 * reference. `digits` is per axis: 3 gives the familiar six-figure
 * reference, 4 gives eight figures.
 */
export function latLonToGridRef(lat: number, lon: number, digits: 2 | 3 | 4 = 3): GridResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, reason: "That isn't a position." };
  }

  const osgb = fromCartesian(
    helmert(toCartesian(lat, lon, WGS84), WGS84_TO_OSGB36),
    AIRY,
  );
  const { easting, northing } = toEastingNorthing(osgb.lat, osgb.lon);

  if (easting < 0 || easting > 700000 || northing < 0 || northing > 1300000) {
    return {
      ok: false,
      reason: "That's outside the British National Grid — it only covers Great Britain.",
    };
  }

  const e100k = Math.floor(easting / 100000);
  const n100k = Math.floor(northing / 100000);

  // Index into the 5x5 of 500 km squares, then into the 5x5 of 100 km
  // squares inside it. The +19/-5 offsets place the grid's origin, which
  // sits south-west of Britain in the sea.
  const first = LETTERS[(19 - n100k - ((19 - n100k) % 5) + Math.floor((e100k + 10) / 5))];
  const second = LETTERS[((19 - n100k) * 5) % 25 + (e100k % 5)];

  if (!first || !second) {
    return { ok: false, reason: "That's outside the British National Grid." };
  }

  const scale = 10 ** (5 - digits);
  const e = Math.floor((easting % 100000) / scale)
    .toString()
    .padStart(digits, "0");
  const n = Math.floor((northing % 100000) / scale)
    .toString()
    .padStart(digits, "0");

  return {
    ok: true,
    ref: `${first}${second} ${e} ${n}`,
    easting: Math.round(easting),
    northing: Math.round(northing),
  };
}

export type LatLonResult =
  | { ok: true; lat: number; lon: number }
  | { ok: false; reason: string };

/**
 * A grid reference back to latitude and longitude.
 *
 * Accepts "SU 123 456", "su123456" and anything in between, because
 * that is how they get written down.
 */
export function gridRefToLatLon(input: string): LatLonResult {
  const cleaned = input.toUpperCase().replace(/\s+/g, "");
  const match = cleaned.match(/^([A-Z]{2})(\d+)$/);

  if (!match) {
    return { ok: false, reason: "Grid references look like SU 123 456 — two letters, then digits." };
  }

  const [, letters, digits] = match;
  if (digits.length % 2 !== 0 || digits.length > 10) {
    return { ok: false, reason: "There must be the same number of digits for easting and northing." };
  }

  const l1 = LETTERS.indexOf(letters[0]);
  const l2 = LETTERS.indexOf(letters[1]);
  if (l1 < 0 || l2 < 0) {
    return { ok: false, reason: "Those letters aren't a National Grid square (there is no I)." };
  }

  // Undo the two 5x5 lookups from latLonToGridRef.
  let e100k = ((l1 - 2) % 5) * 5 + (l2 % 5);
  let n100k = (19 - Math.floor(l1 / 5) * 5) - Math.floor(l2 / 5);

  if (e100k < 0 || e100k > 6 || n100k < 0 || n100k > 12) {
    return { ok: false, reason: "That square isn't on the British National Grid." };
  }

  const half = digits.length / 2;
  const scale = 10 ** (5 - half);
  // Centre of the square rather than its south-west corner: a six-figure
  // reference names a 100 m square, and its middle is the least wrong
  // single point to put on a map.
  const easting = e100k * 100000 + Number(digits.slice(0, half)) * scale + scale / 2;
  const northing = n100k * 100000 + Number(digits.slice(half)) * scale + scale / 2;

  const airy = fromEastingNorthing(easting, northing);
  const wgs = fromCartesian(
    helmert(toCartesian(airy.lat, airy.lon, AIRY), WGS84_TO_OSGB36, true),
    WGS84,
  );

  return { ok: true, lat: wgs.lat, lon: wgs.lon };
}

/** Decimal degrees to the degrees/minutes/seconds a map margin uses. */
export function toDMS(value: number, isLatitude: boolean): string {
  const hemisphere = isLatitude
    ? value >= 0
      ? "N"
      : "S"
    : value >= 0
      ? "E"
      : "W";
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = ((minutesFull - minutes) * 60).toFixed(1);

  return `${degrees}° ${String(minutes).padStart(2, "0")}′ ${seconds.padStart(4, "0")}″ ${hemisphere}`;
}
