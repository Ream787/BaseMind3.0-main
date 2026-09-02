import { useMemo, useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router";
import { CheckCircle2, MailWarning } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { confirmRedirectUrl, readAuthRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

/**
 * Where a confirmation email lands.
 *
 * Two jobs. When the link worked, the client has already taken the tokens
 * out of the URL and this is just the moment between that and the app
 * opening. When it did not, this is the only place that says so — without it
 * an expired link drops someone on a blank sign-in screen, where the natural
 * conclusion is that registering never worked and the natural next step is
 * to register again.
 */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();

  // Read once, on the first render: the client clears the fragment as soon
  // as it has read a successful one out of it.
  const problem = useMemo(() => readAuthRedirect(window.location.href), []);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  if (!problem && session) return <Navigate to="/" replace />;

  async function resend(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setSendError(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: confirmRedirectUrl(window.location.origin) },
    });
    setSending(false);
    if (error) setSendError(error.message);
    else setSent(true);
  }

  if (problem) {
    return (
      <Shell>
        <CardHeader>
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950">
            <MailWarning className="size-5 text-amber-700 dark:text-amber-300" />
          </div>
          <CardTitle>{problem.title}</CardTitle>
          <CardDescription>{problem.detail}</CardDescription>
        </CardHeader>

        {problem.canResend && !sent && (
          <form onSubmit={resend}>
            <CardContent className="flex flex-col gap-3 text-left">
              <div className="flex flex-col gap-2">
                <Label htmlFor="resend-email">Your email address</Label>
                <Input
                  id="resend-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {sendError && <p className="text-sm text-destructive">{sendError}</p>}
              <Button type="submit" disabled={sending || email.trim() === ""}>
                {sending ? "Sending…" : "Send me a new link"}
              </Button>
            </CardContent>
          </form>
        )}

        {sent && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sent. Open the new link on this device — the old one stops working.
            </p>
          </CardContent>
        )}

        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-primary underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <CardHeader>
          <CardTitle>Confirming your email…</CardTitle>
          <CardDescription>One moment.</CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  // Confirmed, but no session — the link was opened on a different device
  // from the one that registered, which is ordinary and fine.
  return (
    <Shell>
      <CardHeader>
        <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle2 className="size-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <CardTitle>Your email is confirmed</CardTitle>
        <CardDescription>
          Sign in with it, or with your username. An admin still has to approve the account
          before there is anything to see.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link to="/login">Sign in</Link>
        </Button>
      </CardFooter>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm text-center">{children}</Card>
    </div>
  );
}
