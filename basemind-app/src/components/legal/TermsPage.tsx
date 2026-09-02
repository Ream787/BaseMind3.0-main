import { Link } from "react-router";

import { ContactLine, LegalLayout, Section } from "@/components/legal/LegalLayout";
import { PRIVACY_CONTACT, PRIVACY_PATH, TERMS_UPDATED } from "@/lib/terms";

/**
 * The terms, in words a Scout leader would actually read.
 *
 * Reachable without signing in, because it is linked from the login and
 * registration pages and somebody deciding whether to make an account has to
 * be able to read it first.
 *
 * Deliberately short and specific. A wall of imported boilerplate about
 * arbitration venues and third-party advertising would describe an app this
 * is not, and nobody would read to the end of it to find the paragraphs that
 * matter. What is held about people has its own page now, because a privacy
 * notice buried inside terms of use is one nobody finds.
 */
export function TermsPage() {
  return (
    <LegalLayout title="Terms of service" updated={TERMS_UPDATED}>
      <Section title="What this is">
        <p>
          BaseMind is a private tool for running one Scout group: its equipment, camps,
          food and paperwork. It is run by the group&apos;s leaders for the group&apos;s
          own use. It is not a commercial service, there is nothing to pay, and there is
          no advertising in it.
        </p>
      </Section>

      <Section title="Who can use it">
        <p>
          Accounts are for leaders and helpers of the group. Registering does not give
          you access on its own — an administrator approves each account, and can change
          your role or remove your access at any time, usually because you have left the
          group or your role has changed.
        </p>
        <p>
          Your account is yours. Don&apos;t share your password or let somebody else use
          your login: the app records who checked what and who lent what, and that record
          is only worth keeping if it names the right person.
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
          Your account details, what you do in the app, and anything you enter about
          other people — borrowers, site contacts, the names and numbers in a camp
          safety plan. It is set out in full, including which outside services ever see
          any of it, in the{" "}
          <Link to={PRIVACY_PATH} className="text-primary underline">
            privacy policy
          </Link>
          .
        </p>
      </Section>

      <Section title="What it does not promise">
        <p>
          It is provided as it is. It may be offline, slow, or wrong. Camp forms, safety
          plans and checklists it produces are a starting point for a leader to check,
          not a substitute for one — read anything it generates before you rely on it or
          hand it in. The assistant answers from documents it has been given and can
          still be wrong; check anything that matters against the policy itself.
        </p>
        <p>
          Keep your own copy of anything you cannot afford to lose. Backups exist, but
          this is a group&apos;s own tool, not a service with a support desk behind it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms can change as the app does. The date at the top says when they last
          did. When they change in a way worth reading, you will be asked to accept them
          again the next time you sign in; if you would rather not, ask an administrator
          to close your account.
        </p>
      </Section>

      <Section title="Getting hold of somebody">
        <ContactLine email={PRIVACY_CONTACT} />
      </Section>
    </LegalLayout>
  );
}
