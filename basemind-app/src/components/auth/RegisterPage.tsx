import { useState, type FormEvent } from "react";
import { Navigate, Link, useNavigate } from "react-router";

import { supabase } from "@/lib/supabase/client";
import {
  derivedEmail,
  isValidUsername,
  normaliseUsername,
  USERNAME_RULE,
} from "@/lib/usernames";
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

export function RegisterPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const handle = normaliseUsername(username);
    if (!isValidUsername(handle)) {
      setSubmitting(false);
      setError(`That username won't work. ${USERNAME_RULE}`);
      return;
    }

    // An account still needs an address underneath. Without a real one, a
    // fixed address is derived from the username — nothing is ever sent to
    // it, and .invalid can never resolve, so it cannot collide with anyone's.
    const authEmail = email.trim() ? email.trim().toLowerCase() : derivedEmail(handle);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: { name, username: handle, phone: phone || undefined },
      },
    });

    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // If email confirmation is required, signUp() succeeds but returns no
    // session yet — nothing to redirect into until the user confirms.
    if (data.session) {
      navigate("/", { replace: true });
    } else {
      // No session yet means Supabase wants the address confirmed. There is
      // nothing to confirm on a derived address, so say what actually
      // happened rather than sending someone to check an inbox that will
      // never receive anything.
      setAwaitingConfirmation(true);
    }
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>{email.trim() ? "Check your email" : "Account created"}</CardTitle>
            {/* Without an email there is no confirmation link to send, and
                telling somebody to check an inbox that will never receive
                anything is the worst possible dead end. */}
            <CardDescription>
              {email.trim() ? (
                <>
                  We sent a confirmation link to {email}. Confirm your address, then sign in —
                  an admin will still need to approve your account before you can see any
                  equipment.
                </>
              ) : (
                <>
                  Sign in with the username <strong>{normaliseUsername(username)}</strong>. An
                  admin still needs to approve the account before you can see any equipment.
                  If signing in says the account isn&apos;t confirmed, ask an admin — email
                  confirmation has to be switched off for accounts without an email.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-primary underline">
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            An admin will need to approve your account before you can access anything.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{USERNAME_RULE}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Only needed to reset a forgotten password. Without one, an Admin has to
                reset it for you.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
