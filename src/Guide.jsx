// Setup and usage guide shown on the site. Uses <details> so each topic opens and closes without any state.
const TOPICS = [
  {
    title: '🔑 What is the Access Key and where do I get it?',
    body: (
      <>
        <p>
          The Access Key is a password that protects the Start button, so nobody else can send mails from the
          connected mailbox. It is not issued by any website. The person who runs the server makes it up.
        </p>
        <ol>
          <li>
            Create a long random text (30+ characters). In Windows PowerShell:
            <code className="guide-code">
              [Convert]::ToBase64String((1..24 | % {'{'} Get-Random -Max 256 {'}'}) -as [byte[]])
            </code>
          </li>
          <li>Server owner: add it on the server as the environment variable <b>AUTO_API_KEY</b> and redeploy.</li>
          <li>Paste the same text in the "Access key" box in Step 2. It is stored only in your own browser.</li>
          <li>Using someone else&apos;s site? Ask its owner for the key.</li>
        </ol>
        <p className="guide-warn">Never share the key publicly, and make a new one if it ever leaks.</p>
      </>
    ),
  },
  {
    title: '📧 How do I get a Gmail App Password?',
    body: (
      <>
        <p>Gmail does not allow your normal password for sending from apps. You need a 16 character App Password:</p>
        <ol>
          <li>Open your Google Account, then Security.</li>
          <li>Turn on <b>2-Step Verification</b> (required).</li>
          <li>Search for <b>App passwords</b>, create one named &quot;ColdMailer&quot;.</li>
          <li>Copy the 16 characters. Use it as the SMTP password, never your real Gmail password.</li>
        </ol>
        <p>You can delete the App Password from the same page whenever you want.</p>
      </>
    ),
  },
  {
    title: '🎯 How do I use the Auto Hunter?',
    body: (
      <ol>
        <li>Step 1: choose one or more roles. The keywords that will be searched appear right below.</li>
        <li>Step 2: enter the Access Key and press <b>Start</b>.</li>
        <li>
          The server reads public hiring posts (Hacker News &quot;Who is hiring?&quot;), keeps the ones that match your
          roles, collects the email each recruiter shared and queues your application.
        </li>
        <li>Mails go out one by one with a gap of 30 to 60 seconds. You can close the tab.</li>
        <li>The same address is never mailed twice.</li>
      </ol>
    ),
  },
  {
    title: '✉️ How do I send my own campaign (Manual Campaign)?',
    body: (
      <ol>
        <li>Enter your Gmail address and App Password, then press Verify.</li>
        <li>Write the subject and body. Placeholders like {'{{Name}}'} are filled from your CSV columns.</li>
        <li>Upload a CSV with an Email column, or paste addresses (one per line).</li>
        <li>Attach your resume (up to 10 MB) and press Launch. You can pause or stop any time.</li>
      </ol>
    ),
  },
  {
    title: '🧩 How do I use the Chrome extension?',
    body: (
      <ol>
        <li>Open chrome://extensions and turn on Developer mode.</li>
        <li>Press <b>Load unpacked</b> and choose the extension folder.</li>
        <li>Set the same Access Key in the extension&apos;s <code>content.js</code> and reload it.</li>
        <li>Open LinkedIn, turn on monitoring in the panel and scroll. New emails are queued automatically.</li>
      </ol>
    ),
  },
  {
    title: '🛡️ Fair use and safety',
    body: (
      <ul>
        <li>Mail only people who posted a job and asked for applications. Do not spam.</li>
        <li>Keep your mail honest: your real name, a relevant role, your resume. Stop if someone asks you to.</li>
        <li>The daily limit is 300 mails to protect your mailbox from Gmail blocks.</li>
        <li>
          LinkedIn&apos;s terms restrict automated collection. The extension runs in your own browser, but use it
          slowly and at your own risk.
        </li>
        <li>
          Manual Campaign sends your App Password to this server only to send that campaign. The server does not
          store it. If you do not trust a host, run your own copy.
        </li>
      </ul>
    ),
  },
  {
    title: '❓ Something is not working',
    body: (
      <ul>
        <li><b>&quot;Wrong access key&quot;</b>: the key here differs from the server&apos;s AUTO_API_KEY.</li>
        <li><b>Stuck on Loading:</b> the free server sleeps after inactivity. Wait up to a minute and reload.</li>
        <li><b>Posts scanned but 0 queued:</b> auto-send is switched off on the server, or no SMTP login is set.</li>
        <li><b>SMTP authentication failed:</b> use an App Password, with 2-Step Verification turned on.</li>
      </ul>
    ),
  },
];

export default function Guide() {
  return (
    <section className="guide" aria-label="Guide">
      <h2 className="section-heading">Guide</h2>
      <div className="guide-list">
        {TOPICS.map((t, i) => (
          <details key={t.title} className="guide-item" open={i === 0}>
            <summary>{t.title}</summary>
            <div className="guide-body">{t.body}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
