import { Link } from "react-router";

import { ContactLine, LegalLayout, Section } from "@/components/legal/LegalLayout";
import { PRIVACY_CONTACT, TERMS_PATH, TERMS_UPDATED } from "@/lib/terms";

/**
 * What the app holds about people, and who else ever sees it.
 *
 * Specific rather than generic on purpose. A policy assembled out of
 * boilerplate would list advertising partners and analytics vendors this app
 * does not have, and would leave out the two things that actually matter
 * here: that leaders enter details about other people, including youth
 * members, and that questions typed at the assistant are sent to Google.
 */
export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy policy" updated={TERMS_UPDATED}>
      <Section title="Who holds this information">
        <p>
          BaseMind is run by the Scout group&apos;s own leaders, for that group. The
          group is the responsible party for everything in it under the Protection of
          Personal Information Act. There is no company behind it, nothing is sold, and
          there is no advertising.
        </p>
      </Section>

      <Section title="What is held about you">
        <p>
          <strong>Your account.</strong> Your name, email address, username if you set
          one, phone number if you gave one, your role, whether your account is approved,
          and the emblem and colour you picked for your avatar. If you signed in with
          Google or Apple, that is the name and email address they passed on — Apple may
          send a <code>privaterelay.appleid.com</code> address instead of your real one,
          and that is all we ever see.
        </p>
        <p>
          <strong>What you do.</strong> Equipment you checked and when, faults you
          reported, loans you recorded, storage places you created, policies you added,
          bug reports you sent, and any games in the app you have played. These are
          attached to your name because a stock check nobody signed is a stock check
          nobody can ask about.
        </p>
        <p>
          <strong>What you ask the assistant.</strong> Questions you type at the policy
          assistant are saved so the conversation can be reopened, and are sent to Google
          to be answered.
        </p>
      </Section>

      <Section title="Information you enter about other people">
        <p>
          Much of what the app holds is entered by leaders about somebody else, and it is
          the group&apos;s responsibility rather than the app&apos;s to keep it right:
        </p>
        <p>
          Names, phone numbers and email addresses of people who borrow equipment;
          contact details for camping sites; and, in a camp&apos;s safety plan, the names
          and phone numbers of the leader in charge, the standby contact, the first
          aider, and the nearest hospital. Camp forms uploaded to the app are stored as
          you filled them in and may contain anything the official form asks for.
        </p>
        <p>
          Anyone with an approved account in the group can see all of it. Please put in
          the least a task needs — particularly about youth members — and keep anything
          sensitive out of free-text notes.
        </p>
      </Section>

      <Section title="Why it is held">
        <p>
          To run the group: to know where kit is and whether it works, who has borrowed
          it, what a camp needs, and who to phone when something goes wrong on one.
          Account details exist so that access can be given to leaders and refused to
          everybody else, and so that records can name who did what.
        </p>
      </Section>

      <Section title="Who else sees it">
        <p>
          Nobody outside the group, except the services used to run the app itself. None
          of them are advertisers, and none are given the data for their own purposes:
        </p>
        <p>
          <strong>Supabase</strong> stores the database, accounts and uploaded files.{" "}
          <strong>Vercel</strong> serves the app. <strong>Resend</strong> sends the app&apos;s
          emails, so it handles your address. <strong>Google</strong> answers assistant
          questions, sorts policy documents and tidies equipment names through its Gemini
          API — what is sent is the question and the equipment or policy text it concerns.
          If you sign in with <strong>Google or Apple</strong>, that sign-in happens on
          their side and they tell us your name and email address.
        </p>
        <p>
          The database is hosted in the European Union rather than in South Africa, so
          your information leaves the country. That is a cross-border transfer under
          POPIA, to a region whose data protection law is at least as strict.
        </p>
      </Section>

      <Section title="What the app stores on your device">
        <p>
          Your sign-in token, so you stay signed in, and a copy of recently viewed
          records so the app still works in a store room with no signal. Both live in
          your browser and are cleared when you sign out or clear site data. There are no
          advertising cookies and no analytics or tracking of any kind — nothing counts
          your visits or follows you to other sites.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Account details are kept while you have an account. Equipment, camp and loan
          records are the group&apos;s own and are kept as long as they are useful —
          knowing a tent was checked three years ago is the point of checking it.
        </p>
        <p>
          Closing your account removes your details. It does not remove the group&apos;s
          records, but your name comes off them, so a check you did will still show as
          done and no longer as done by you.
        </p>
      </Section>

      <Section title="How it is kept safe">
        <p>
          Every account has to be approved by an administrator before it can see
          anything, and what each role may read or change is enforced by the database
          itself rather than only hidden in the app — so an approved leader cannot reach
          the rest by going around the screens. Traffic is encrypted. Uploaded camp forms
          are in private storage that only signed-in, approved accounts can open.
        </p>
        <p>
          No system is perfect. If you think something has gone wrong, say so quickly
          rather than quietly.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under POPIA you may ask what is held about you, ask for it to be corrected, ask
          for your account and details to be deleted, and object to how the information
          is used. You may also complain to the Information Regulator of South Africa.
        </p>
        <ContactLine email={PRIVACY_CONTACT} />
      </Section>

      <Section title="Children">
        <p>
          Accounts are for leaders and adult helpers, not for youth members. Information
          about youth members reaches the app only when a leader enters it — for a camp,
          a loan or a safety plan — and a parent or guardian may ask what is held about
          their child through the group in the usual way.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          This notice changes as the app does, and the date at the top says when it last
          did. If a change matters, you will be asked to read and accept it the next time
          you sign in.
        </p>
        <p>
          See also the{" "}
          <Link to={TERMS_PATH} className="text-primary underline">
            terms of service
          </Link>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
