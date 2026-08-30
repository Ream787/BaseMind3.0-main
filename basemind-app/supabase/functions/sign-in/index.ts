// Signing in with a username.
//
// Every account has a real email address, and that address is what Supabase
// Auth authenticates against. So a username sign-in has to turn a username
// into an address — and that lookup must NOT be something the app can do,
// because an endpoint answering "which email owns this username" is a way to
// read every member's email address out of the group.
//
// So it happens here. The service role reads the address, this function does
// the sign-in itself, and only the session comes back. The email is never
// returned to the browser, and there is no way to ask for one without also
// knowing the password.
//
// Failures are deliberately identical whether the username doesn't exist or
// the password is wrong. A different message for each would turn this into a
// username checker.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function "sign-in",
// paste this file. No secrets to set; the keys below are injected already.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_FAILURE = "That username or password isn't right.";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: "The sign-in function is not configured." }, 500);
    }

    const { username, password } = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const handle = (username ?? "").trim().toLowerCase();
    if (!handle || !password) return json({ error: GENERIC_FAILURE }, 400);

    // An email should never reach this function — the browser signs in with
    // one directly. Refusing here keeps this endpoint useless as a way of
    // testing whether an address exists.
    if (handle.includes("@")) return json({ error: GENERIC_FAILURE }, 400);

    // Service role, because the caller is by definition not signed in yet.
    // Only the address is selected: nothing else about the person is read.
    const lookup = await fetch(
      `${supabaseUrl}/rest/v1/users?select=email&username=eq.${encodeURIComponent(handle)}&limit=1`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );

    // A broken lookup is NOT a failed sign-in, and must not be reported as
    // one. Returning the generic message here made a misconfigured function
    // indistinguishable from a wrong username, which is exactly the state
    // nobody can debug. This says nothing about any account, so it is safe
    // to be specific about.
    if (!lookup.ok) {
      return json(
        {
          error: "Sign-in by username is misconfigured — an admin needs to look at it.",
          detail: `Looking up the username returned ${lookup.status}: ${(await lookup.text()).slice(0, 200)}`,
        },
        500,
      );
    }

    const rows = (await lookup.json()) as { email?: string }[];
    const email = rows[0]?.email;
    // No such username. Same answer as a wrong password, on purpose.
    if (!email) return json({ error: GENERIC_FAILURE }, 401);

    const auth = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const session = await auth.json();
    if (!auth.ok) {
      // Pass through the reasons that are about the ACCOUNT rather than the
      // credentials — "email not confirmed" is something the person needs to
      // be told, and it reveals nothing a wrong password wouldn't.
      const description: string = session?.error_description ?? session?.msg ?? "";
      const accountState = /confirm|banned|disabled/i.test(description);
      return json({ error: accountState ? description : GENERIC_FAILURE }, 401);
    }

    // Only the tokens go back. The browser installs them with setSession and
    // from that point on this account is signed in exactly as if it had used
    // its email address.
    return json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch {
    return json({ error: GENERIC_FAILURE }, 400);
  }
});
