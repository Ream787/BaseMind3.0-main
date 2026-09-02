// Telling somebody their account has been approved.
//
// Supabase's own SMTP settings only serve its auth emails — there is no
// "send this" API behind them, and nothing from that panel reaches a
// function — so this sends the mail itself, through Resend's HTTP API.
//
// HTTP rather than SMTP on purpose: it needs one secret instead of four, and
// it is a plain request rather than a TCP conversation with STARTTLS in the
// middle of it, which is the part that tends to be flaky from an edge
// runtime.
//
// Everything is re-checked here rather than trusted from the browser. The
// caller's token is exchanged for a user id, that id is looked up with the
// service role, and it has to be an Active Admin — an endpoint that emails
// anybody on request, on the word of whoever called it, is a way to send mail
// from the group's domain to any address you like.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function
// "notify-approved", paste this file. Then set its secrets:
//
//   RESEND_API_KEY  the key from resend.com/api-keys, starting "re_"
//   EMAIL_FROM      an address on a domain verified with Resend, e.g.
//                   "noreply@basemind.co.za". A display name is added if
//                   you don't write one.
//   APP_URL         where the button points: "https://www.basemind.co.za",
//                   scheme and all.
//   EMAIL_REPLY_TO  optional. Worth setting to a mailbox somebody reads,
//                   because replies to a noreply address go nowhere.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Row = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  approval_emailed_at: string | null;
};

/**
 * "noreply@basemind.co.za" becomes "BaseMind <noreply@basemind.co.za>".
 *
 * A bare address shows up in an inbox as "noreply", which looks like spam
 * from a group nobody has heard of. An address that already carries a name
 * is left exactly as written.
 */
function sender(from: string): string {
  const trimmed = from.trim();
  return trimmed.includes("<") ? trimmed : `BaseMind <${trimmed}>`;
}

/** The same look as the confirmation email: tables, inline styles, no fonts. */
function body(name: string, role: string, appUrl: string): string {
  const greeting = name.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#f4f2f7;margin:0;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e7e3ee;">
      <tr><td style="padding:28px 28px 0;text-align:center;">
        <div style="font-size:22px;font-weight:700;color:#7c3aed;letter-spacing:-0.4px;">BaseMind</div>
        <div style="font-size:13px;color:#6b7280;padding-top:2px;">Scout equipment, camps and food</div>
      </td></tr>
      <tr><td style="padding:24px 28px 0;">
        <h1 style="margin:0 0 8px;font-size:19px;line-height:1.35;color:#111827;font-weight:600;">
          You're in
        </h1>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#374151;">
          ${greeting} an admin has approved your BaseMind account. You can sign in now,
          with your username or your email address.
        </p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151;">
          You've been given the <strong>${escapeHtml(role)}</strong> role.
        </p>
      </td></tr>
      <tr><td style="padding:24px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td align="center" bgcolor="#7c3aed" style="border-radius:8px;">
            <a href="${appUrl}/login"
               style="display:block;padding:14px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              Open BaseMind
            </a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;">
        <div style="border-top:1px solid #e7e3ee;padding-top:16px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
            Not expecting this? Someone signed up with your address and an admin approved it.
            Tell whoever runs your group's BaseMind.
          </p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

/** A name goes into HTML, and a name is whatever somebody typed. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("EMAIL_FROM");
  const replyTo = Deno.env.get("EMAIL_REPLY_TO");
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "This function is not configured." }, 500);
  }

  const admin = (path: string) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });

  try {
    // Who is asking. The token is the caller's, so this cannot be spoofed by
    // passing somebody else's id in the body.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in first." }, 401);

    const me = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!me.ok) return json({ error: "Sign in first." }, 401);
    const callerId = (await me.json())?.id as string | undefined;
    if (!callerId) return json({ error: "Sign in first." }, 401);

    const callerRows = (await (
      await admin(`users?select=role,status&id=eq.${callerId}&limit=1`)
    ).json()) as { role?: string; status?: string }[];
    const caller = callerRows[0];
    if (caller?.role !== "Admin" || caller?.status !== "Active") {
      return json({ error: "Only an active Admin can send that." }, 403);
    }

    // Only now, with an Admin on the line, is it safe to describe how this
    // function is configured. Answering that to anyone who asks tells the
    // internet which of the group's mail secrets are missing, and the anon
    // key that reaches this endpoint ships inside the app.
    const missing = [
      !resendKey && "RESEND_API_KEY",
      !from && "EMAIL_FROM",
      !appUrl && "APP_URL",
    ].filter(Boolean);
    if (missing.length > 0) {
      return json({ error: `Approval emails need these secrets set: ${missing.join(", ")}` }, 500);
    }

    const { userId } = (await req.json()) as { userId?: string };
    if (!userId) return json({ error: "Which account?" }, 400);

    const rows = (await (
      await admin(
        `users?select=id,email,name,role,status,approval_emailed_at&id=eq.${userId}&limit=1`,
      )
    ).json()) as Row[];
    const target = rows[0];
    if (!target) return json({ error: "No such account." }, 404);

    // Only ever announces something that is true. If the row is not Active,
    // saying "you're in" would be a lie the app then has to contradict.
    if (target.status !== "Active") {
      return json({ error: "That account isn't approved." }, 409);
    }
    // Not an error: two admins approving the same person is a race, not a
    // mistake, and the second one should quietly do nothing.
    if (target.approval_emailed_at) return json({ sent: false, reason: "already-sent" });

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(from!),
        to: [target.email],
        subject: "Your BaseMind account is approved",
        html: body(target.name ?? "", target.role, appUrl),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!send.ok) {
      // Resend says useful things here — an unverified domain, a key that
      // was revoked — and the admin who pressed the button is exactly who
      // needs to read them.
      const detail = await send.text();
      // Also to the log, because the person who reads the toast and the
      // person who goes looking in the dashboard afterwards are often not
      // the same person, and the toast is gone in ten seconds.
      console.error("Resend refused the approval email", send.status, detail);
      return json(
        { error: `Resend refused it (${send.status}): ${detail.slice(0, 300)}` },
        502,
      );
    }

    // Only after the send. Stamping first would mean a failed send is never
    // retried, which is the wrong way round: a duplicate is an annoyance, and
    // silence is somebody sitting on a pending screen forever.
    await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ approval_emailed_at: new Date().toISOString() }),
    });

    return json({ sent: true });
  } catch (err) {
    console.error("Approval email failed", err);
    return json(
      { error: `Couldn't send the approval email: ${err instanceof Error ? err.message : err}` },
      500,
    );
  }
});
