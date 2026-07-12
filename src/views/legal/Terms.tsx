/**
 * Terms of Service. The Payments section stays deliberately general until
 * the Stripe billing phase ships; update it alongside that launch.
 */
export function Terms() {
  return (
    <>
      <h1>Terms of Service</h1>
      <div className="legal-updated">Effective date: July 11, 2026</div>

      <p>
        These terms govern your use of CanopyStudio (the "Service"), provided by CanopyStudio
        ("we", "us"). By creating an account or using the Service you agree to these terms. If you
        use the Service on behalf of an organization, you represent that you have authority to
        bind that organization.
      </p>

      <h2>The Service</h2>
      <p>
        CanopyStudio is an AI-assisted platform for planning, creating, publishing, and reporting
        on paid and organic marketing across connected platforms such as Meta (Facebook and
        Instagram) and Google Ads. Features may change as the Service evolves.
      </p>

      <h2>Accounts and workspaces</h2>
      <ul>
        <li>You are responsible for your credentials and for activity under your account.</li>
        <li>
          Workspace owners control member access and are responsible for the members they invite.
        </li>
        <li>You must provide accurate information and keep it current.</li>
      </ul>

      <h2>Connected platforms</h2>
      <p>
        When you connect a third-party account (for example a Meta Business or Google Ads
        account), you represent that you are authorized to operate that account, and you authorize
        us to access it on your behalf to provide the Service. Your use of connected platforms
        remains subject to their own terms, including the Meta Platform Terms and Google's terms
        of service. We are not responsible for actions those platforms take on your accounts
        (such as reviews, restrictions, or policy enforcement).
      </p>

      <h2>AI-generated content</h2>
      <ul>
        <li>
          The Service produces AI-generated text, images, and recommendations. AI output can be
          inaccurate or unsuitable. <strong>You are responsible for reviewing and approving all
          content before it is published</strong> — publishing actions in the Service happen only
          on your explicit approval.
        </li>
        <li>
          You are responsible for ensuring published content complies with applicable law and the
          advertising policies of the destination platform.
        </li>
        <li>
          As between you and us, you own the content you provide and the outputs generated for
          you, to the extent permitted by law and the applicable model providers' terms.
        </li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        You may not use the Service to publish unlawful, deceptive, or infringing content; to
        violate platform policies; to attempt unauthorized access to accounts or data; or to
        resell the Service without our agreement.
      </p>

      <h2>Payments</h2>
      <p>
        Paid plans and usage-based charges are billed through Stripe. Current pricing is shown in
        the Service before you subscribe or purchase. Usage-based AI charges accrue as you use AI
        features and are billed according to your plan. Except where required by law, payments
        are non-refundable. We may change pricing with advance notice; changes apply from your
        next billing cycle.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate accounts that violate these terms or create risk for the Service, other users,
        or connected platforms. Sections that by their nature should survive termination do so.
      </p>

      <h2>Disclaimers and limitation of liability</h2>
      <p>
        The Service is provided "as is" without warranties of any kind. To the maximum extent
        permitted by law, we are not liable for indirect, incidental, special, consequential, or
        punitive damages, or for lost profits, revenue, or data. Our total liability for any claim
        relating to the Service is limited to the amounts you paid us in the twelve months before
        the claim arose.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms; we will post changes here and update the effective date, and
        for material changes we will notify account owners by email. Continued use after changes
        take effect constitutes acceptance.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@canopystudio.app">support@canopystudio.app</a>
      </p>
    </>
  );
}
