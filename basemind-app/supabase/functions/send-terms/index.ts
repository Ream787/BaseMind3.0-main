// Sending somebody the terms and the privacy policy.
//
// Two callers, one endpoint. Anybody signed in can send them to themselves —
// that is the "email me a copy" button on the screen that asks them to
// accept, so they have the thing they agreed to somewhere other than a page
// they clicked past. An Admin can also send them to another member, for the
// leader who says they never saw them.
//
// Sending to somebody else is Admin-only for the obvious reason: an endpoint
// that emails any address on request is a way to send mail from the group's
// own domain to anyone, and it does not stop being one because the content
// happens to be a privacy policy.
//
// Deploy: Supabase dashboard -> Edge Functions -> new function "send-terms",
// paste this file. It reads the SAME secrets as notify-approved, so if that
// one works this one needs nothing new:
//
//   RESEND_API_KEY   EMAIL_FROM   APP_URL   EMAIL_REPLY_TO (optional)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sender(from: string): string {
  const trimmed = from.trim();
  return trimmed.includes("<") ? trimmed : `BaseMind <${trimmed}>`;
}

/** Both links and the short version, in the house style of the other emails. */
function body(name: string, appUrl: string, accepted: string | null): string {
  const greeting = name.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi,";
  const acceptedLine = accepted
    ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#374151;">
         You accepted these on <strong>${escapeHtml(accepted)}</strong>.
       </p>`
    : "";
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
          Your copy of the terms
        </h1>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#374151;">
          ${greeting} here are the two pages that say what BaseMind expects of you and
          what it holds about you. Keep this email, or open them any time from the
          bottom of the sign-in page.
        </p>
        ${acceptedLine}
      </td></tr>
      <tr><td style="padding:20px 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td align="center" bgcolor="#7c3aed" style="border-radius:8px;">
            <a href="${appUrl}/termsofservice"
               style="display:block;padding:13px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              Terms of service
            </a>
          </td></tr>
          <tr><td height="10" style="line-height:10px;font-size:10px;">&nbsp;</td></tr>
          <tr><td align="center" style="border-radius:8px;border:1px solid #d8d2e4;">
            <a href="${appUrl}/privacy"
               style="display:block;padding:12px 20px;font-size:15px;font-weight:600;color:#7c3aed;text-decoration:none;border-radius:8px;">
              Privacy policy
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 28px 0;">
        <p style="margin:0;font-size:13px;line-height:1.55;color:#6b7280;">
          The short version: use it for group business, keep what you record about youth
          members to the minimum, and everything you enter can be seen by every approved
          leader in the group.
        </p>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;">
        <div style="border-top:1px solid #e7e3ee;padding-top:16px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
            Sent because you asked for a copy, or because an administrator sent you one.
          </p>
        </div>
      </td></tr>
    </table>
  </td></tr>
</table>`;
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
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in first." }, 401);

    const me = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!me.ok) return json({ error: "Sign in first." }, 401);
    const callerId = (await me.json())?.id as string | undefined;
    if (!callerId) return json({ error: "Sign in first." }, 401);

    const callerRows = (await (
      await admin(
        `users?select=id,email,name,role,status,terms_accepted_at&id=eq.${callerId}&limit=1`,
      )
    ).json()) as {
      id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      terms_accepted_at: string | null;
    }[];
    const caller = callerRows[0];
    if (!caller) return json({ error: "Sign in first." }, 401);

    const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };
    const toSelf = !userId || userId === callerId;

    // Sending to yourself is allowed even before approval — somebody sitting
    // on the pending screen is exactly who might want the terms in writing.
    // Sending to anybody else is not.
    if (!toSelf && !(caller.role === "Admin" && caller.status === "Active")) {
      return json({ error: "Only an active Admin can send that to someone else." }, 403);
    }

    // With a real caller established, it is safe to say how this is set up.
    const missing = [
      !resendKey && "RESEND_API_KEY",
      !from && "EMAIL_FROM",
      !appUrl && "APP_URL",
    ].filter(Boolean);
    if (missing.length > 0) {
      return json({ error: `Sending the terms needs these secrets set: ${missing.join(", ")}` }, 500);
    }

    let target = caller;
    if (!toSelf) {
      const rows = (await (
        await admin(
          `users?select=id,email,name,role,status,terms_accepted_at&id=eq.${userId}&limit=1`,
        )
      ).json()) as typeof callerRows;
      if (!rows[0]) return json({ error: "No such account." }, 404);
      target = rows[0];
    }

    const accepted = target.terms_accepted_at
      ? new Date(target.terms_accepted_at).toLocaleDateString("en-ZA", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(from!),
        to: [target.email],
        subject: "BaseMind — terms of service and privacy policy",
        html: body(target.name ?? "", appUrl, accepted),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error("Resend refused the terms email", send.status, detail);
      let stated = detail.slice(0, 300);
      try {
        const parsed = JSON.parse(detail) as { message?: string };
        if (parsed.message) stated = parsed.message;
      } catch {
        // Not JSON; the raw text is what there is.
      }
      return json({ error: `Resend refused it (${send.status}): ${stated}` }, 502);
    }

    return json({ sent: true, to: target.email });
  } catch (err) {
    console.error("Sending the terms failed", err);
    return json(
      { error: `Couldn't send the terms: ${err instanceof Error ? err.message : err}` },
      500,
    );
  }
});
