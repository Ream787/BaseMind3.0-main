import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.ts";

const app = new Hono();

app.use("*", logger(console.log));

app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

// Health root
app.get("/", (c) => c.json({ status: "function deployed" }));

// =====================
// PASSWORD RESET EMAIL ENDPOINT
// =====================
app.post("/send-reset-email", async (c) => {
  try {
    const { email, newPassword } = await c.req.json();

    if (!email || !newPassword) {
      return c.json({ error: "Email and newPassword are required" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("Error: RESEND_API_KEY environment variable is not set");
      return c.json({ error: "Email service not configured. RESEND_API_KEY is missing." }, 500);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "ScoutManager <onboarding@resend.dev>",
        to: [email],
        subject: "ScoutManager - Your Password Has Been Reset",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #7c3aed;">ScoutManager Password Reset</h2>
            <p>Your password has been reset. Here are your new login credentials:</p>
            <div style="background: #f3f0ff; border: 1px solid #7c3aed; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0;"><strong>New Password:</strong> <code style="background: #e9e5f5; padding: 2px 6px; border-radius: 4px;">${newPassword}</code></p>
            </div>
            <p style="color: #666; font-size: 14px;">Please log in and consider changing your password. If you did not request this reset, contact your administrator immediately.</p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Resend API error (${response.status}): ${errorBody}`);
      return c.json({ error: `Failed to send email: ${response.status}`, details: errorBody }, 500);
    }

    const data = await response.json();
    console.log(`Password reset email sent to ${email}, id: ${data.id}`);
    return c.json({ success: true, emailId: data.id });
  } catch (err) {
    console.error(`Send reset email error: ${err}`);
    return c.json({ error: `Server error sending reset email: ${err}` }, 500);
  }
});

// =====================
// KV DATA ENDPOINTS
// =====================

// Generic GET by prefix
app.get("/data/:prefix", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const results = await kv.getByPrefix(`scout:${prefix}:`);
    return c.json({ data: results });
  } catch (err) {
    console.error(`GET data error for prefix ${c.req.param("prefix")}: ${err}`);
    return c.json({ error: `Failed to fetch data: ${err}` }, 500);
  }
});

// Generic PUT (upsert) single item
app.put("/data/:prefix/:id", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const id = c.req.param("id");
    const body = await c.req.json();
    await kv.set(`scout:${prefix}:${id}`, body);
    return c.json({ success: true });
  } catch (err) {
    console.error(`PUT data error: ${err}`);
    return c.json({ error: `Failed to save data: ${err}` }, 500);
  }
});

// Generic DELETE single item
app.delete("/data/:prefix/:id", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const id = c.req.param("id");
    await kv.del(`scout:${prefix}:${id}`);
    return c.json({ success: true });
  } catch (err) {
    console.error(`DELETE data error: ${err}`);
    return c.json({ error: `Failed to delete data: ${err}` }, 500);
  }
});

// Bulk save
app.post("/data/:prefix/bulk", async (c) => {
  try {
    const prefix = c.req.param("prefix");
    const { items } = await c.req.json();
    if (!Array.isArray(items)) {
      return c.json({ error: "items must be an array" }, 400);
    }
    const keys = items.map((item: { id: string }) => `scout:${prefix}:${item.id}`);
    await kv.mset(keys, items);
    return c.json({ success: true, count: keys.length });
  } catch (err) {
    console.error(`Bulk save error: ${err}`);
    return c.json({ error: `Failed to bulk save: ${err}` }, 500);
  }
});

// Settings (single key)
app.get("/settings", async (c) => {
  try {
    const result = await kv.get("scout:settings");
    return c.json({ settings: result || null });
  } catch (err) {
    console.error(`GET settings error: ${err}`);
    return c.json({ error: `Failed to fetch settings: ${err}` }, 500);
  }
});

app.put("/settings", async (c) => {
  try {
    const body = await c.req.json();
    await kv.set("scout:settings", body);
    return c.json({ success: true });
  } catch (err) {
    console.error(`PUT settings error: ${err}`);
    return c.json({ error: `Failed to save settings: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);