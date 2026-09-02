import { useState } from "react";
import { Link } from "react-router";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase/client";
import { functionErrorMessage } from "@/lib/functionError";
import { useAuth } from "@/context/AuthContext";
import type { UserProfile } from "@/types/database";
import {
  PRIVACY_PATH,
  TERMS_PATH,
  TERMS_UPDATED,
  TERMS_VERSION,
} from "@/lib/terms";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

/** Has this account accepted the terms as they stand today? */
export function hasAcceptedTerms(profile: UserProfile): boolean {
  return profile.terms_accepted_at !== null && profile.terms_version === TERMS_VERSION;
}

/**
 * The terms, before the app.
 *
 * Shown instead of the app rather than as a dialog over it: a dialog invites
 * dismissing, and an acceptance somebody clicked past to get at the screen
 * behind it is not worth recording. The links open the full text, which is
 * why they are links and not a scroll box nobody reaches the bottom of.
 *
 * Signing out is offered plainly. Somebody who does not accept has to have
 * somewhere to go that isn't the back button.
 */
export function TermsGate({ profile }: { profile: UserProfile }) {
  const { patchProfile, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const returning = profile.terms_accepted_at !== null;

  async function accept() {
    setSaving(true);
    const accepted_at = new Date().toISOString();
    const { error } = await supabase
      .from("users")
      .update({ terms_accepted_at: accepted_at, terms_version: TERMS_VERSION })
      .eq("id", profile.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    // Fold it in rather than reloading: the gate is watching this profile,
    // and a round trip here is a spinner between somebody and the app they
    // were already trying to open.
    patchProfile({ terms_accepted_at: accepted_at, terms_version: TERMS_VERSION });
  }

  async function emailCopy() {
    setSending(true);
    const { error } = await supabase.functions.invoke("send-terms", { body: {} });
    setSending(false);
    if (error) {
      toast.error("Couldn't send it", { description: await functionErrorMessage(error) });
      return;
    }
    toast.success(`Sent to ${profile.email}`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Logo className="size-8" />
            <div>
              <CardTitle>
                {returning ? "The terms have changed" : "Before you start"}
              </CardTitle>
              <CardDescription>Updated {TERMS_UPDATED}</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">
            {returning
              ? "They have been rewritten since you last accepted them. Please have a look before carrying on."
              : "BaseMind is your group's own tool. Two short pages say what it expects of you and what it holds about you."}
          </p>

          <div className="flex flex-col gap-2">
            <Link
              to={TERMS_PATH}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <span className="font-medium">Terms of service</span>
              <span className="text-xs text-muted-foreground">Read →</span>
            </Link>
            <Link
              to={PRIVACY_PATH}
              className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
            >
              <span className="font-medium">Privacy policy</span>
              <span className="text-xs text-muted-foreground">Read →</span>
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            The short version: use it for group business, keep what you record about
            youth members to the minimum, and everything you enter can be seen by every
            approved leader in the group.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" disabled={saving} onClick={accept}>
            <ShieldCheck className="size-4" />
            {saving ? "Saving…" : "I've read and accept both"}
          </Button>

          <Button
            variant="outline"
            className="w-full"
            disabled={sending}
            onClick={emailCopy}
          >
            <Mail className="size-4" />
            {sending ? "Sending…" : "Email me a copy"}
          </Button>

          <button
            type="button"
            onClick={logout}
            className="text-xs text-muted-foreground underline"
          >
            Not now — sign out
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}
