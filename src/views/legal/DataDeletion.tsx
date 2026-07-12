/**
 * Data deletion instructions. Meta App Review requires a public URL with
 * user-facing deletion instructions; this page also documents the Data
 * Deletion Request callback the Meta app registers (built in the Meta
 * OAuth phase — keep the description here in sync when it ships).
 */
export function DataDeletion() {
  return (
    <>
      <h1>Data Deletion</h1>
      <div className="legal-updated">Effective date: July 11, 2026</div>

      <p>
        You can delete your data from CanopyStudio at any time. This page describes what gets
        deleted and every way to request deletion.
      </p>

      <h2>Delete data yourself, in the app</h2>
      <ul>
        <li>
          <strong>Individual content</strong> — clients, uploaded assets, generated copy, posts,
          and plans can be deleted from their pages in the app; deletion is immediate.
        </li>
        <li>
          <strong>Platform connections</strong> — removing a connected Meta or Google account
          (Settings → Connections, or the client's Ad Accounts tab) stops all access, and we
          delete the stored credentials and associated platform data within 30 days.
        </li>
        <li>
          <strong>Your whole account</strong> — contact us (below) from the email on your account
          and we will delete the account, workspace content, and personal information within 30
          days, except minimal records we must keep for legal, billing, or security purposes.
        </li>
      </ul>

      <h2>Request deletion by email</h2>
      <p>
        Email <a href="mailto:support@canopystudio.app">support@canopystudio.app</a> from the
        address associated with your account with the subject "Data deletion request". We will
        confirm completion within 30 days.
      </p>

      <h2>Facebook / Instagram users</h2>
      <p>
        If you connected CanopyStudio through Facebook, you can also trigger deletion from
        Facebook itself: <em>Settings &amp; Privacy → Settings → Apps and Websites</em>, select
        CanopyStudio, and choose Remove. Facebook then sends us an automated deletion request; we
        delete the data associated with your Facebook account and issue a confirmation code you
        can use to check the status of your request on this page's URL.
      </p>
    </>
  );
}
