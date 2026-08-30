import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

import { Logo } from "@/components/ui/logo";

/**
 * The terms, in words a Scout leader would actually read.
 *
 * Reachable without signing in, because it is linked from the login and
 * registration pages and somebody deciding whether to make an account has to
 * be able to read it first.
 *
 * Deliberately short and specific. A wall of imported boilerplate about
 * arbitration venues and third-party advertising would describe an app this
 * is not, and nobody would read to the end of it to find the two paragraphs
 * that matter: what is stored about you, and what happens to it.
 */
const UPDATED = "30 August 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function TermsPage() {
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
            <h1>Terms of use</h1>
            <p className="text-sm text-muted-foreground">Last updated {UPDATED}</p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-6">
        <Section title="What this is">
          <p>
            BaseMind is a private tool for running one Scout group: its equipment, camps,
            food and paperwork. It is run by the group&apos;s leaders for the group&apos;s
            own use. It is not a commercial service, there is nothing to pay, and there
            is no advertising in it.
          </p>
        </Section>

        <Section title="Who can use it">
          <p>
            Accounts are for leaders and helpers of the group. Registering does not give
            you access on its own — an administrator approves each account, and can
            change your role or remove your access at any time, usually because you have
            left the group or your role has changed.
          </p>
          <p>
            Your account is yours. Don&apos;t share your password or let somebody else use
            your login: the app records who checked what and who lent what, and that
            record is only worth keeping if it names the right person.
          </p>
        </Section>

        <Section title="What you put in it">
          <p>
            Use it for group business. What you enter — inventory, camp plans, notes on
            equipment — belongs to the group rather than to you, and stays with the group
            if you leave.
          </p>
          <p>
            Keep personal information about youth members to the minimum the task needs,
            and never put anything sensitive in a free-text note that other leaders would
            not be expected to read. Everyone with an approved account can see the
            group&apos;s equipment, camps and food records.
          </p>
          <p>
            Nothing here replaces SCOUTS South Africa policy. Where the two differ, the
            policy wins.
          </p>
        </Section>

        <Section title="What it stores about you">
          <p>
            Your name, username, email address, role, and an avatar if you set one. Plus
            what you do in the app: the items you checked, the loans you recorded, the
            bug reports you sent, and — where you use the assistant — the questions you
            asked it.
          </p>
          <p>
            The data lives in a hosted database (Supabase) and the app is served by
            Vercel. Questions asked of the assistant are sent to Google&apos;s Gemini API
            to be answered. Nothing is sold, and nothing is shared outside the group
            except through those services, which are used to run the app itself.
          </p>
          <p>
            Under the Protection of Personal Information Act you can ask what is held
            about you, ask for it to be corrected, and ask for your account to be
            removed. Ask an administrator. Removing your account does not remove the
            group&apos;s equipment records, which are the group&apos;s own.
          </p>
        </Section>

        <Section title="What it does not promise">
          <p>
            It is provided as it is. It may be offline, slow, or wrong. Camp forms,
            safety plans and checklists it produces are a starting point for a leader to
            check, not a substitute for one — read anything it generates before you rely
            on it or hand it in.
          </p>
          <p>
            Keep your own copy of anything you cannot afford to lose. Backups exist, but
            this is a group&apos;s own tool, not a service with a support desk behind it.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            These terms can change as the app does. The date at the top says when they
            last did. Carrying on using the app after a change means you accept it; if
            you don&apos;t, ask an administrator to close your account.
          </p>
        </Section>

        <Section title="Getting hold of somebody">
          <p>
            Ask any group administrator, or use{" "}
            <Link to="/" className="text-primary underline">
              Report a bug
            </Link>{" "}
            in the app&apos;s account menu — it reaches the same people.
          </p>
        </Section>
      </div>

      <footer className="mt-auto border-t pt-4 text-xs text-muted-foreground">
        BaseMind is run by the group, for the group.
      </footer>
    </div>
  );
}
