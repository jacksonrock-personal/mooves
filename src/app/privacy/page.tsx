import type { Metadata } from 'next'
import LegalShell from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Privacy Policy — Mooves',
  description: 'How Mooves collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" lastUpdated="July 20, 2026">
      <p>
        This Privacy Policy explains how <strong>Mooves</strong> (&ldquo;Mooves,&rdquo; &ldquo;we,&rdquo;
        &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects, uses, and shares information when you use the
        Mooves web app at <a href="https://makemooves.app">makemooves.app</a> and related services (the
        &ldquo;Service&rdquo;). Mooves is operated by Jackson Viccora, a sole proprietor based in Illinois,
        United States. By using the Service, you agree to the practices described here.
      </p>

      <h2>1. Information we collect</h2>

      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Mobile phone number.</strong> We use your number to create your account, verify your
          identity with a one-time code, and connect you with friends.
        </li>
        <li>
          <strong>Profile details.</strong> Your name (or display name) and, if you choose, a profile
          photo.
        </li>
        <li>
          <strong>Your activity in the app.</strong> Your availability status (&ldquo;green&rdquo; when
          you&rsquo;re free), any short status note or time you add, the friends and groups you create or
          join, and the moves you join.
        </li>
        <li>
          <strong>Discovery preferences.</strong> If you opt in, a coarse area (ZIP-code / neighborhood
          level) and the interest categories you select. See &ldquo;Location&rdquo; below.
        </li>
        <li>
          <strong>Payment information (tips &amp; sponsors).</strong> If you tip or place a sponsored move,
          our payment processor (Stripe) collects and processes your payment details. <strong>Mooves never
          sees or stores your full card number.</strong> We receive only limited confirmation data (such as
          whether a payment succeeded and an amount).
        </li>
      </ul>

      <h3>Information we collect automatically</h3>
      <ul>
        <li>
          <strong>Device &amp; usage data.</strong> Basic technical information such as IP address, browser
          type, and how you interact with the Service, collected to keep it running, secure, and improving.
        </li>
        <li>
          <strong>Cookies &amp; similar technologies.</strong> We use a secure, httpOnly session cookie to
          keep you signed in, and privacy-conscious product analytics (PostHog) to understand aggregate
          usage. We do not use advertising cookies.
        </li>
        <li>
          <strong>Push tokens.</strong> If you enable notifications, we store a push-notification token so
          we can send the alerts you asked for.
        </li>
      </ul>

      <h3>Location</h3>
      <p>
        Mooves does <strong>not</strong> collect or store your precise GPS location. If you opt into the
        discovery area feature, we convert your location to a coarse ZIP-code / neighborhood value in
        memory and store only that coarse area. Precise coordinates are never saved, logged, or shared.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide, operate, and secure the Service and your account.</li>
        <li>Verify your phone number and sign you in.</li>
        <li>Show your availability to the friends and groups you choose, and show you theirs.</li>
        <li>Send the messages and notifications you&rsquo;ve asked for (see &ldquo;Text messages&rdquo;).</li>
        <li>Process tips and sponsored placements through our payment processor.</li>
        <li>Understand aggregate usage, fix bugs, prevent abuse, and improve the product.</li>
        <li>Comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>3. Text messages (SMS)</h2>
      <div className="callout">
        <p>
          <strong>We do not share your mobile phone number.</strong> Mooves will not sell, rent, lease, or
          otherwise share your mobile phone number or your SMS/text-messaging consent with third parties or
          affiliates for their own marketing or promotional purposes. We share your number only with the
          service providers that help us operate the Service (for example, our phone-verification and
          messaging providers), strictly so they can deliver the messages you&rsquo;ve requested.
        </p>
      </div>
      <p>
        When you use Mooves, you may receive text messages such as one-time verification codes when you sign
        in and, if you opt in, service notifications (for example, a heads-up related to your groups or a
        sponsored move you submitted).
      </p>
      <ul>
        <li>
          <strong>Message frequency varies</strong> based on how you use the Service.
        </li>
        <li>
          <strong>Message and data rates may apply.</strong> These are charged by your mobile carrier and
          are your responsibility.
        </li>
        <li>
          <strong>Opt out any time.</strong> Reply <strong>STOP</strong> to any text message to unsubscribe,
          or <strong>HELP</strong> for help. Opting out of notification texts will not remove verification
          codes required to sign in.
        </li>
      </ul>

      <h2>4. How we share information</h2>
      <p>
        <strong>We do not sell your personal information.</strong> We share information only in these cases:
      </p>
      <ul>
        <li>
          <strong>With friends and groups you choose.</strong> Your name, photo, and availability are
          visible to the friends and groups you connect with in the app. If you launch a sponsored move to
          your friends, a subtle &ldquo;Sponsored&rdquo; tag is shown with it.
        </li>
        <li>
          <strong>With service providers</strong> who process data on our behalf, under contract and only to
          run the Service — for example: Firebase / Google (phone verification and push delivery), Supabase
          (database and storage), Twilio (SMS), Stripe (payments), PostHog (product analytics), and Vercel
          (hosting).
        </li>
        <li>
          <strong>For legal and safety reasons</strong> — to comply with law, respond to lawful requests, or
          protect the rights, safety, and property of Mooves and its users.
        </li>
        <li>
          <strong>In a business transfer</strong> — if Mooves is involved in a merger, acquisition, or sale
          of assets, subject to this Policy.
        </li>
      </ul>

      <h2>5. Data retention</h2>
      <p>
        We keep your information for as long as your account is active or as needed to provide the Service.
        When you delete your account, we delete or de-identify your personal information within a reasonable
        period, except where we must retain it to comply with legal, tax, security, or fraud-prevention
        obligations.
      </p>

      <h2>6. Your choices and rights</h2>
      <ul>
        <li>Update your profile, area, and interests at any time in the app.</li>
        <li>Turn notifications on or off in Settings, or reply STOP to notification texts.</li>
        <li>Delete your account, which removes your profile and associated data as described above.</li>
        <li>
          Depending on where you live, you may have rights to access, correct, delete, or port your
          personal information, or to object to certain processing. To exercise these rights, contact us at
          the address below.
        </li>
      </ul>

      <h2>7. Security</h2>
      <p>
        We use industry-standard measures — including encryption in transit, access controls, and reputable
        infrastructure providers — to protect your information. No method of transmission or storage is
        100% secure, so we cannot guarantee absolute security.
      </p>

      <h2>8. Children</h2>
      <p>
        Mooves is not directed to children under 18, and we do not knowingly collect personal information
        from anyone under 18. If you believe a minor has provided us information, please contact us and we
        will delete it.
      </p>

      <h2>9. Changes to this Policy</h2>
      <p>
        We may update this Policy from time to time. When we do, we&rsquo;ll revise the &ldquo;Last
        updated&rdquo; date above and, for material changes, provide a more prominent notice. Your continued
        use of the Service after an update means you accept the revised Policy.
      </p>

      <h2>10. Contact us</h2>
      <p>
        Questions about this Policy or your information? Email us at{' '}
        <a href="mailto:support@makemooves.app">support@makemooves.app</a>.
      </p>
    </LegalShell>
  )
}
