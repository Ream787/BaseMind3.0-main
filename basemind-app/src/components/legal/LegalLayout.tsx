import { useEffect } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/ui/logo";
import { PRIVACY_PATH, TERMS_PATH } from "@/lib/terms";

/**
 * The shell both legal pages share.
 *
 * They are reachable without signing in, because they are linked from the
 * login page, quoted to Google's OAuth review, and read by somebody deciding
 * whether to make an account at all — all three happen before there is a
 * session to check.
 */
export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  // Whoever is reviewing this page — a leader, or somebody at Google — sees
  // the tab before they see the heading.
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · BaseMind`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <Link
          to="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to BaseMind
        </Link>
        <div className="flex items-center gap-3">
          <Logo className="size-8" />
          <div>
            <h1>{title}</h1>
            <p className="text-sm text-muted-foreground">Last updated {updated}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">{children}</div>

      <footer className="mt-auto flex flex-col gap-2 border-t pt-4 text-xs text-muted-foreground">
        <p>
          <Link to={TERMS_PATH} className="underline">
            Terms of service
          </Link>
          {" · "}
          <Link to={PRIVACY_PATH} className="underline">
            Privacy policy
          </Link>
        </p>
        <p>BaseMind is run by the group, for the group.</p>
      </footer>
    </div>
  );
}

/** One titled block of prose. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

/** How to reach somebody, given the group may not have a public mailbox. */
export function ContactLine({ email }: { email: string | null }) {
  if (email) {
    return (
      <p>
        Write to{" "}
        <a href={`mailto:${email}`} className="text-primary underline">
          {email}
        </a>
        , or ask any group administrator.
      </p>
    );
  }
  return (
    <p>
      Ask any group administrator — they are the people who approve accounts. Inside the
      app, &ldquo;Report a bug&rdquo; in the account menu reaches the same people.
    </p>
  );
}
