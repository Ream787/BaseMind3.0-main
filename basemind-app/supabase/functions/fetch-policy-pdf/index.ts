// Downloads a policy PDF from a link, so a document can be added by URL.
//
// This runs server-side for two reasons. The obvious one is CORS: almost no
// site serves a PDF with headers that let another origin read it, so the
// browser simply can't fetch it. The other is that the browser would be
// downloading it over the user's connection, which at camp is the connection
// you least want to spend on a 4 MB file.
//
// The text extraction still happens in the browser afterwards, reusing the
// same pdf.js path as an ordinary upload, so there is exactly one definition
// of "readable text" in the app.
//
// SECURITY - this fetches a URL a user typed, from inside our infrastructure,
// which is the classic shape of a server-side request forgery. Guards below:
//   * only http/https
//   * caller must be an Active Admin or Manager, checked against the database
//   * redirects are followed by hand, re-checking the destination each hop
//   * loopback, private, link-local and cloud-metadata addresses are refused
//   * the response must actually be a PDF, and is capped at 15 MB
//
// Residual risk worth knowing: a public hostname that resolves to a private
// address ("DNS rebinding") is not caught, because name resolution isn't
// available to us here to check. The blocklist covers literal addresses and
// the metadata hostnames, which is what an attacker reaches for first.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function
// "fetch-policy-pdf", paste this file. No secrets needed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Big enough for a scanned handbook, small enough not to blow the response. */
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

/**
 * Addresses that are only reachable from inside somebody's network, and so
 * are never a legitimate place to find a Scout policy.
 */
function isBlockedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local") ||
    host === "metadata" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  const v4 = parseIpv4(host);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 || // this network
      a === 10 || // private
      a === 127 || // loopback
      (a === 169 && b === 254) || // link-local, incl. cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 192 && b === 0) || // IETF protocol assignments
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast and reserved
    );
  }

  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    // Unique-local (fc00::/7) and link-local (fe80::/10).
    if (/^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true;
    // IPv4 written inside an IPv6 address still points at the same machine.
    const mapped = host.match(/((\d{1,3}\.){3}\d{1,3})$/);
    if (mapped) return isBlockedHost(mapped[1]);
  }

  return false;
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be downloaded.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("That address is on a private network, so it can't be downloaded.");
  }
  return url;
}

/** Is the caller allowed to change what the assistant answers from? */
async function callerMayManage(authHeader: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return false;

  const sub = subjectOf(authHeader);
  if (!sub || !/^[0-9a-f-]{36}$/i.test(sub)) return false;

  // Asked of the database with the caller's own token, so row-level security
  // decides what comes back. Reading the role straight out of the JWT would
  // mean trusting a value the client controls.
  const res = await fetch(
    `${supabaseUrl}/rest/v1/users?select=role,status&id=eq.${sub}&limit=1`,
    { headers: { Authorization: authHeader, apikey: anonKey } },
  );
  if (!res.ok) return false;

  const [row] = (await res.json()) as { role?: string; status?: string }[];
  return row?.status === "Active" && (row.role === "Admin" || row.role === "Manager");
}

/** The `sub` claim, read without verifying - the database does the verifying. */
function subjectOf(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sub = JSON.parse(json)?.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/** Follows redirects by hand so every hop is checked, not just the first. */
async function fetchFollowing(start: URL): Promise<Response> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      headers: { Accept: "application/pdf,*/*" },
    });
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get("location");
    await res.body?.cancel();
    if (!location) throw new Error(`The link redirected (${res.status}) without saying where.`);
    url = checkUrl(new URL(location, url).toString());
  }
  throw new Error("The link redirected too many times.");
}

/** Reads the body, refusing to buffer more than the cap. */
async function readCapped(res: Response): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) {
    throw new Error(`That file is ${(declared / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("The server sent an empty response.");

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("That file is larger than the 15 MB limit.");
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/** Chunked, because spreading a multi-megabyte array into a call blows the stack. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode(...bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

/** A sensible document name from the URL, since few servers send one. */
function fileNameFrom(url: URL, disposition: string | null): string {
  const fromHeader = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)?.[1];
  const candidate = fromHeader ?? url.pathname.split("/").filter(Boolean).pop() ?? "policy.pdf";
  const decoded = decodeURIComponent(candidate).replace(/[\\/:*?"<>|]/g, "").trim();
  if (!decoded) return "policy.pdf";
  return /\.pdf$/i.test(decoded) ? decoded : `${decoded}.pdf`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Not signed in." }, 401);

    if (!(await callerMayManage(auth))) {
      return json({ error: "Only Group Managers and Admins can add policies." }, 403);
    }

    const { url: raw } = (await req.json()) as { url?: string };
    if (!raw?.trim()) return json({ error: "No link given." }, 400);

    const url = checkUrl(raw);
    const res = await fetchFollowing(url);

    if (!res.ok) {
      await res.body?.cancel();
      return json(
        {
          error: `The link couldn't be downloaded (${res.status}).`,
          detail:
            res.status === 403 || res.status === 401
              ? "The site refused the download. It may need a sign-in, in which case save the PDF and upload the file instead."
              : `The server at ${url.hostname} returned ${res.status} ${res.statusText}.`,
        },
        502,
      );
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const bytes = await readCapped(res);

    // Trust the bytes over the header: plenty of servers label a PDF as
    // octet-stream, and a login page returned as text/html would otherwise
    // be stored as if it were the policy.
    const magic = new TextDecoder().decode(bytes.subarray(0, 5));
    if (magic !== "%PDF-") {
      return json(
        {
          error: "That link isn't a PDF.",
          detail: contentType.includes("html")
            ? "It returned a web page. Open it in a browser, find the PDF itself, and use that link."
            : `The file starts with ${JSON.stringify(magic)} rather than a PDF header (content-type: ${contentType || "none"}).`,
        },
        400,
      );
    }

    return json({
      fileName: fileNameFrom(url, res.headers.get("content-disposition")),
      byteLength: bytes.byteLength,
      base64: toBase64(bytes),
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 400);
  }
});
