/**
 * Privacy Policy. Reviewed against the disclosures Meta App Review and
 * Google OAuth verification check for: Meta Platform Data handling and the
 * Google API Services User Data Policy Limited Use statement (verbatim).
 */
export function Privacy() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <div className="legal-updated">Effective date: July 11, 2026</div>

      <p>
        CanopyStudio ("CanopyStudio", "we", "us") provides an AI-assisted advertising and content
        platform at canopystudio.app (the "Service") that helps agencies and businesses plan,
        create, publish, and report on paid and organic marketing. This policy explains what
        information we collect, how we use it, and the choices you have. Questions or requests:{' '}
        <a href="mailto:support@canopystudio.app">support@canopystudio.app</a>.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account information.</strong> Your name, email address, and password hash when
          you create an account; your profile details if you sign in with a third-party identity
          provider such as Google or Facebook (name, email, and avatar as shared by that provider).
        </li>
        <li>
          <strong>Workspace content.</strong> The clients, brand profiles, website content you ask
          us to analyze, uploaded assets (logos, photos, videos), briefs, generated ad copy,
          content calendars, and settings you create in the Service.
        </li>
        <li>
          <strong>Connected platform data.</strong> When you connect an advertising or publishing
          account (for example Meta or Google Ads), we access and store the data needed to provide
          the Service: account and page identifiers, campaign, ad set, and ad structure, spend and
          performance metrics, and the access credentials you authorize. We access this data only
          with your authorization and only on your instruction (scheduled refreshes you enable, or
          actions you take in the Service).
        </li>
        <li>
          <strong>Usage and billing data.</strong> AI usage metering (token counts and costs),
          plan and payment status, and standard technical logs (IP address, browser type,
          timestamps) needed to operate and secure the Service.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To provide the Service: dashboards, reporting, AI generation, and publishing.</li>
        <li>
          To generate content on your behalf: your workspace content and connected-platform data
          may be included in prompts to AI model providers (see "Service providers" below) solely
          to produce the outputs you request. We do not permit these providers to train their
          models on your data under our agreements with them.
        </li>
        <li>To bill you, prevent abuse, secure the Service, and comply with law.</li>
        <li>To communicate with you about the Service (reports, notifications you configure).</li>
      </ul>
      <p>We do not sell personal information, and we do not use it for third-party advertising.</p>

      <h2>Meta Platform Data</h2>
      <p>
        When you connect Facebook or Instagram accounts, we receive data from Meta's platform
        ("Platform Data") under the{' '}
        <a href="https://developers.facebook.com/terms/" target="_blank" rel="noreferrer">
          Meta Platform Terms
        </a>
        . We use Platform Data only to provide the features you request — retrieving campaign and
        page insights, publishing posts and ads you approve, and reporting — and never for
        independent advertising, profiling, or resale. Platform Data is retained only while your
        connection remains active and as needed to provide the Service. When you disconnect an
        account or delete your CanopyStudio account, we delete the associated Platform Data within
        30 days, except where retention is required by law. You may request deletion at any time —
        see our <a href="/legal/data-deletion">Data Deletion page</a>.
      </p>

      <h2>Google user data</h2>
      <p>
        If you sign in with Google or connect Google services (such as Google Ads), we access only
        the scopes you grant and use that data solely to provide the features you request.
        CanopyStudio's use and transfer to any other app of information received from Google APIs
        will adhere to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2>Service providers</h2>
      <p>
        We share data with processors only as needed to run the Service, under agreements limiting
        their use of it: Supabase (database, authentication, file storage), Stripe (payments — we
        never store full card numbers), AI model providers (Anthropic, OpenAI, xAI) for the
        generation features you invoke, Resend (email delivery), and Slack (only if you configure a
        Slack webhook). Connected platforms (Meta, Google) receive the content you instruct us to
        publish and the API calls needed to operate your accounts.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        We keep your data while your account is active. You can delete individual clients,
        assets, and generated content in the app at any time. On account deletion, we remove your
        personal information and workspace content within 30 days, except minimal records we must
        retain for legal, billing, or security purposes. See{' '}
        <a href="/legal/data-deletion">Data Deletion</a> for step-by-step instructions.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit and at rest. Platform access credentials are stored
        server-side, are never exposed to the browser after entry, and access within the Service is
        restricted by row-level security to members of your workspace.
      </p>

      <h2>Children</h2>
      <p>The Service is for business use and not directed to children under 16.</p>

      <h2>Changes</h2>
      <p>
        We will post any changes to this policy on this page and update the effective date. For
        material changes we will notify account owners by email.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:support@canopystudio.app">support@canopystudio.app</a>
      </p>
    </>
  );
}
