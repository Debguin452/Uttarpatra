import { LegalPage } from "../components/LegalPage";

/**
 * India's DPDP Act, 2023 and DPDP Rules, 2025 are being switched on in
 * phases (Gazette notifications G.S.R. 843(E)/846(E), 13 Nov 2025): the
 * Data Protection Board and definitions took effect immediately, but
 * the substantive notice/consent machinery — including Rule 10's
 * verifiable-parental-consent mechanism for users under 18 — only comes
 * into force on 13 May 2027. This policy complies voluntarily ahead of
 * that date rather than waiting for the deadline, since this app's
 * users are mostly minors. It is not a substitute for legal review.
 */
export function Privacy() {
  return (
    <LegalPage titleKey="privacy_title" updated="2026-11-16">
      <section>
        <h2>Who this is and what it covers</h2>
        <p>
          উত্তরপত্র ("Uttarpatro", "we", "us") is a Siliguri-based coaching platform for Class 11,
          Class 12, NEET and JEE students. This policy explains what personal data we collect through the
          website and app, why, and what rights you have over it. It applies to every student, parent/guardian,
          and teacher using the service.
        </p>
      </section>

      <section>
        <h2>A note for parents and guardians</h2>
        <p>
          Most students on this platform are under 18. Under Section 9 of India's Digital Personal Data
          Protection Act, 2023, processing a child's personal data requires verifiable consent from a parent or
          lawful guardian. The Act's own mechanism for that (DPDP Rules, 2025, Rule 10 — verification via
          government-notified Digital Locker services) does not come into force until 13 May 2027. Until the
          official mechanism exists, we treat registration by anyone identifying their age as under 18 as
          requiring a parent or guardian's explicit awareness and agreement, captured as a checkbox at
          sign-up naming the guardian. We will move to the government's verification mechanism once it is
          available to platforms our size.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> name, phone or email, class, board, school, and a profile photo if you add one.</li>
          <li><strong>Guardian details, if you're under 18:</strong> a parent/guardian's name and a way to reach them.</li>
          <li><strong>Payment records:</strong> the batch, amount, and — for manual UPI payments — the UTR reference and a screenshot you submit as proof, kept only to verify that one payment.</li>
          <li><strong>Learning activity:</strong> which lectures you've watched, test attempts and scores, doubts you've asked, and streaks — so progress reports and results work.</li>
          <li><strong>Technical data:</strong> basic request logs for security and abuse prevention.</li>
        </ul>
      </section>

      <section>
        <h2>Why we collect it</h2>
        <p>
          To run the service you've signed up for: giving you access to the batches you've paid for, scoring
          and ranking tests, answering doubts, sending notices about your classes, and keeping the service
          secure. We don't use your data for anything beyond that, and
          we don't sell it.
        </p>
      </section>

      <section>
        <h2>Who it's shared with</h2>
        <p>
          We use a small number of infrastructure providers to run the app, each only for the task named:
          Google Firebase (sign-in and a small amount of per-student app data), Cloudflare (hosting, the
          database, and anti-abuse checks), and Google Drive (storage for notes and payment-proof images you
          or we upload). None of them are permitted to use your data for their own purposes. Some of these
          providers process data on servers outside India; we rely on their standard safeguards for this, as
          the DPDP Act's own cross-border transfer rules are not yet in force.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          Account and academic records for as long as your account is active and for a reasonable period after,
          in case you return or need a transcript. Payment screenshots are deleted once a payment is approved
          or rejected and no longer needed as proof. You can ask us to delete your account and data at any time
          (see "Your rights" below); some records may be kept longer where law requires it, such as payment
          records for tax purposes.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          You — or a parent/guardian, for a student under 18 — can ask to see what we hold about you, correct
          it, withdraw consent, or have it deleted, by writing to the contact below. We'll respond within a
          reasonable time. Withdrawing consent may mean some parts of the service stop working for you.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Passwords are never stored by us — sign-in goes through Google's authentication service. Payment
          approval, test scoring and anything else sensitive runs through access-controlled systems, not the
          student-facing app directly. No system is perfectly secure; if we ever have a data breach that
          affects you, we'll tell you what happened and what we're doing about it.
        </p>
      </section>

      <section>
        <h2>Contact and grievance redressal</h2>
        <p>
          For any question about this policy, a data request, or a complaint: [grievance officer name], reachable
          at [email/phone to be filled in before launch]. If you're not satisfied with our response, India's
          Data Protection Board (once it begins accepting complaints) is the next avenue.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          If this policy changes in a way that matters, we'll show a notice in the app, not just update this
          page quietly.
        </p>
      </section>
    </LegalPage>
  );
}
