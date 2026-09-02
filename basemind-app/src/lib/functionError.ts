/**
 * Getting the actual reason out of a failed Edge Function call.
 *
 * supabase-js throws away the body. Whatever the function said — an
 * unverified sending domain, a revoked key, a missing secret — arrives as
 * the constant string "Edge Function returned a non-2xx status code", which
 * is true of every failure there has ever been and therefore useless. The
 * response itself is hung off the error as `context`, and that is where the
 * message actually is.
 */

type WithContext = { message?: string; context?: unknown };

/**
 * The function's own message, falling back to whatever we can get.
 *
 * Async because reading the body is, and callers are already awaiting the
 * invoke that produced the error.
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const err = error as WithContext;
  const context = err?.context;

  // Not a Response — a network failure, or a shape we don't know. The
  // generic message is all there is.
  if (!context || typeof (context as Response).text !== "function") {
    return err?.message ?? "Something went wrong.";
  }

  const response = context as Response;

  // A body can only be read once, and clone() cannot undo that — it has to
  // be called while the body is still intact. If something upstream already
  // drained it there is nothing left to quote, so fall back rather than
  // throwing on top of an error we were trying to explain.
  if (response.bodyUsed) return statusOnly(response, err);

  try {
    // Cloned so that a caller wanting to read the response itself still can.
    const text = await response.clone().text();
    if (!text.trim()) return statusOnly(response, err);

    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      const stated = parsed.error ?? parsed.message;
      if (typeof stated === "string" && stated.trim()) return stated.trim();
    } catch {
      // Not JSON. The raw text is still better than the generic message,
      // as long as it isn't a page of HTML from something upstream.
      if (!/^\s*</.test(text)) return text.slice(0, 300);
    }
    return statusOnly(response, err);
  } catch {
    return statusOnly(response, err);
  }
}

/** No usable body, so at least say which failure it was. */
function statusOnly(response: Response, err: WithContext): string {
  const status = response.status;
  if (status === 401) return "You need to sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That function isn't deployed.";
  return err?.message ?? `The server returned ${status}.`;
}
