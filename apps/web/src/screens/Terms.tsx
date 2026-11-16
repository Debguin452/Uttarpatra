import { LegalPage } from "../components/LegalPage";

export function Terms() {
  return (
    <LegalPage titleKey="terms_title" updated="2026-11-16">
      <section>
        <h2>Agreement</h2>
        <p>
          By creating an account on উত্তরপত্র ("Uttarpatro"), you agree to these terms. If you're under 18, a
          parent or guardian must be aware of and agree to your use of the service too — see our Privacy Policy
          for how we handle that.
        </p>
      </section>

      <section>
        <h2>What you're getting</h2>
        <p>
          Access to the batches, lectures, notes, and tests you've enrolled in, for as long as that batch's
          access period lasts (shown on the batch page). Free batches and resources remain free; we may change
          what's free from time to time.
        </p>
      </section>

      <section>
        <h2>One account, one device</h2>
        <p>
          Paid access is for your own use. We enforce one active device per account to keep access from being
          shared or resold; if you get a new phone, you can re-bind your account to it from Profile, and
          support can reset this if you're having trouble.
        </p>
      </section>

      <section>
        <h2>Payments and refunds</h2>
        <p>
          Manual UPI payments are verified by our team against the UTR and screenshot you submit, usually
          within one working day; access unlocks once approved. Submitting a payment that's already been used
          for another account, or a fabricated screenshot, will get the submission rejected and may lead to
          your account being blocked. Refunds for a batch are considered case-by-case — write to support
          before a batch's content has been substantially accessed.
        </p>
      </section>

      <section>
        <h2>Tests and academic integrity</h2>
        <p>
          Test scores and ranks are computed by our server using the answer key for that test, not by anything
          your device reports — a tampered clock or network can't change your score. Once you submit a test,
          the attempt is final. We expect tests to be attempted on your own, without external help; we reserve
          the right to void a result or restrict access if we find organized cheating.
        </p>
      </section>

      <section>
        <h2>Content and conduct</h2>
        <p>
          Lectures, notes, and questions are licensed to you for personal study, not for redistribution,
          re-upload, or resale. Doubt threads and the forum are for academic discussion — no harassment, no
          sharing of other students' personal information, no spam. We can remove content or restrict an
          account that breaks this.
        </p>
      </section>

      <section>
        <h2>What we don't promise</h2>
        <p>
          We work to keep lectures, tests, and payment approval running smoothly, but we don't promise the
          service will be uninterrupted or error-free — notably, we rely on several free-tier infrastructure
          providers with their own daily limits (see our architecture notes if you're curious), and a rare
          outage is possible. We're not liable for exam results, admissions outcomes, or anything beyond the
          amount you've paid us for the affected batch.
        </p>
      </section>

      <section>
        <h2>Ending an account</h2>
        <p>
          You can stop using the service any time; write to support to have your account closed and data
          deleted per our Privacy Policy. We can suspend or close an account that breaks these terms, including
          device-sharing, payment fraud, or abusive conduct toward staff or other students.
        </p>
      </section>

      <section>
        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of India, with courts in Siliguri, West Bengal having
          jurisdiction over any dispute, unless local consumer-protection law gives you another forum.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>We'll flag material changes to these terms in the app rather than updating this page silently.</p>
      </section>
    </LegalPage>
  );
}
