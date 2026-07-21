import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Terms of Use — Mooves',
  description: 'The terms that govern your use of Mooves.',
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use" lastUpdated="July 20, 2026">
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) are a legal agreement between you and{' '}
        <strong>Mooves</strong> (&ldquo;Mooves,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;), operated by Jackson Viccora, a sole proprietor based in Illinois, United States,
        governing your use of the
        Mooves web app at <a href="https://makemooves.app">makemooves.app</a> and related services (the
        &ldquo;Service&rdquo;). By using the Service, you agree to these Terms. If you don&rsquo;t agree,
        please don&rsquo;t use the Service.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old and able to form a binding contract to use Mooves. By using the
        Service, you represent that you meet these requirements and that the information you provide is
        accurate.
      </p>

      <h2>2. Your account</h2>
      <p>
        You sign in with your mobile phone number and a one-time verification code. You&rsquo;re responsible
        for the activity on your account and for keeping access to your phone and number secure. Notify us
        promptly if you believe your account has been used without your permission. One person, one account
        — don&rsquo;t impersonate anyone or misrepresent who you are.
      </p>

      <h2>3. What Mooves is</h2>
      <p>
        Mooves helps you share when you&rsquo;re free with friends you choose, so you can make plans in
        person or over your own text messages. Mooves shows availability and connects people; it does not
        arrange, supervise, or take responsibility for any meeting, activity, event, or plan that results.
        <strong> You are solely responsible for your own safety and conduct when meeting or interacting with
        anyone.</strong>
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for anything unlawful, harmful, harassing, hateful, or abusive.</li>
        <li>Impersonate others, misrepresent your identity, or collect other users&rsquo; information.</li>
        <li>Send spam, scams, or unsolicited promotions to other users.</li>
        <li>Attempt to access accounts, data, or systems you&rsquo;re not authorized to access.</li>
        <li>Interfere with, disrupt, reverse-engineer, or overload the Service or its infrastructure.</li>
        <li>Use bots, scrapers, or automated means to access the Service without our permission.</li>
      </ul>
      <p>
        We may suspend or terminate accounts that violate these Terms or that we reasonably believe pose a
        risk to other users or to Mooves.
      </p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of the content you add to Mooves (such as your name, photo, and status notes).
        You grant Mooves a non-exclusive, worldwide, royalty-free license to host, store, and display that
        content solely to operate and provide the Service to you and the people you choose to share with.
        You&rsquo;re responsible for the content you post and confirm you have the rights to share it.
      </p>

      <h2>6. Text messages</h2>
      <p>
        By providing your mobile number, you consent to receive text messages from Mooves, including
        verification codes and — if you opt in — service notifications. Message frequency varies, and
        message and data rates may apply. Reply <strong>STOP</strong> to opt out of notification texts or{' '}
        <strong>HELP</strong> for help. See our{' '}
        <a href="/privacy">Privacy Policy</a> for details on how we handle your number.
      </p>

      <h2>7. Payments, tips, and sponsored moves</h2>
      <p>
        Tips and sponsored placements are processed by our payment provider, Stripe. Charges are described
        at the time you make them. <strong>Tips are voluntary, one-time, and non-refundable.</strong>{' '}
        Sponsored-move fees are charged as disclosed at submission and are generally non-refundable once a
        placement runs. Sponsors are responsible for the accuracy and lawfulness of the moves they submit;
        Mooves reviews submissions and may reject or remove any content at its discretion.
      </p>

      <h2>8. Service availability &amp; changes</h2>
      <p>
        We&rsquo;re actively building Mooves and may add, change, or remove features, or suspend or
        discontinue the Service, at any time. We aren&rsquo;t liable to you for any modification, suspension,
        or discontinuation of the Service.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        The Service is provided <strong>&ldquo;as is&rdquo; and &ldquo;as available,&rdquo;</strong> without
        warranties of any kind, whether express or implied, including fitness for a particular purpose,
        merchantability, and non-infringement. We do not warrant that the Service will be uninterrupted,
        error-free, or secure, or that any plans made through it will be safe or successful.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Mooves and its operator will not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or for any loss arising from your use of —
        or inability to use — the Service, including any interaction, meeting, or plan with another user.
        Our total liability for any claim relating to the Service will not exceed the greater of the amounts
        you paid us in the twelve months before the claim or US $100.
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless Mooves and its operator from any claims, damages, losses,
        and expenses (including reasonable legal fees) arising out of your use of the Service, your content,
        or your violation of these Terms or the rights of others.
      </p>

      <h2>12. Termination</h2>
      <p>
        You may stop using Mooves and delete your account at any time. We may suspend or terminate your
        access if you violate these Terms or if we discontinue the Service. Sections that by their nature
        should survive termination (including ownership, disclaimers, limitation of liability, and
        indemnification) will survive.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Illinois and applicable United States federal
        law, without regard to conflict-of-laws rules. Any disputes will be handled in the state or federal
        courts located in Illinois, unless applicable law requires otherwise.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. When we do, we&rsquo;ll revise the &ldquo;Last
        updated&rdquo; date above. Your continued use of the Service after an update means you accept the
        revised Terms.
      </p>

      <h2>15. Contact us</h2>
      <p>
        Questions about these Terms? Email us at{' '}
        <a href="mailto:support@makemooves.app">support@makemooves.app</a>.
      </p>
    </LegalShell>
  )
}
