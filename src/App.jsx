import { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  // 1. Form parameters
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  
  // Multiple leads files state
  const [leadsFiles, setLeadsFiles] = useState([]);

  // 2. Auxiliary Form States
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef(null);
  const leadsInputRef = useRef(null);

  // 3. Verification & API status states
  const [verifyStatus, setVerifyStatus] = useState('idle'); // 'idle' | 'checking' | 'verified' | 'failed'
  const [verifyMessage, setVerifyMessage] = useState('');
  const [isCampaignRunning, setIsCampaignRunning] = useState(false);
  const [isCampaignPaused, setIsCampaignPaused] = useState(false);

  // 4. Campaign Running Metrics
  const [campaignProgress, setCampaignProgress] = useState(0); // Current index
  const [totalRecipientsCount, setTotalRecipientsCount] = useState(0);
  const [stats, setStats] = useState({ successful: 0, failed: 0, total: 0 });
  const [terminalLogs, setTerminalLogs] = useState([]);
  const terminalEndRef = useRef(null);

  // Active loop controllers (using refs to avoid stale enclosure states inside React closures)
  const campaignControlRef = useRef({ isCancelled: false, isPaused: false, currentIndex: 0 });
  const isLoopActiveRef = useRef(false);

  // Pre-configured email templates
  const templates = {
    jobSeeker: {
      name: '👔 Job Application',
      subject: 'Application for Software Engineer Position - [Your Name]',
      body: `Dear Hiring Team,

I hope this email finds you well.

I am writing to express my strong interest in joining your team as a Software Engineer. With hands-on experience building highly responsive web interfaces using React and scalable backend services with Node.js/Express, I am confident in my ability to add immediate value to your ongoing projects.

I have attached my resume for your review, which highlights my technical expertise, open-source contributions, and past internship achievements.

Thank you for your time and consideration. I look forward to the possibility of discussing how my background aligns with your team's engineering goals.

Warm regards,
[Your Name]
[Your Phone Number]
[Your Portfolio/GitHub Link]`
    },
    outreach: {
      name: '⚡ Lead Generation',
      subject: 'Quick question regarding cold outreach automation at [Company Name]',
      body: `Hi Team,

I saw what you are building at your company and was highly impressed by your product's design and speed.

We help digital agencies and startups automate their B2B cold mail outreach, helping them scale conversion volume by 3x while securing 100% domain deliverability.

I have attached a brief overview case study showing our metrics. Are you open to a quick 5-minute introductory call next Tuesday at 2:00 PM to see if we can unlock similar growth for you?

Best regards,
[Your Name]
[Your Website]`
    },
    partnership: {
      name: '🤝 Strategic Partnership',
      subject: 'Exploring collaborative synergies with [Company Name]',
      body: `Dear Operations Team,

I hope you are having an excellent week.

I am reaching out to explore potential integration and partnership opportunities between our products. Our platforms serve highly overlapping user bases, and a unified workflow could significantly reduce friction and overhead costs for our mutual customers.

I have attached a standard partnership proposal detailing the technical feasibility and marketing benefits.

Please let me know if you would be open to a brief chat sometime next week to discuss this further.

Warmly,
[Your Name]`
    }
  };

  // Helper to load templates
  const loadTemplate = (key) => {
    const selected = templates[key];
    if (selected) {
      setSubject(selected.subject);
      setBody(selected.body);
      addTerminalLog('info', `Loaded preset template: "${selected.name}"`);
    }
  };

  // Helper to load demo data
  const loadDemoData = () => {
    setSenderEmail('sender.test.account@gmail.com');
    setAppPassword('xxxx yyyy zzzz aaaa');
    setRecipients('hr.hiring.manager@gmail.com\ntalent.acquisition@openai.com\nhello.support@github.com');
    setSubject('Application for Software Engineer Position - Alex Mercer');
    setBody(`Dear Hiring Team,\n\nI am writing to apply for the Software Engineer role. I am an expert in full-stack Javascript, React, and Node.js.\n\nI have attached my resume. Looking forward to hearing from you!\n\nBest,\nAlex Mercer`);
    addTerminalLog('warning', 'Loaded sample demo credentials & recipient emails.');
  };

  // Auto-scroll terminal to bottom when logs update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Add line entry to terminal console
  const addTerminalLog = (type, text) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { type, text, time: timestamp }]);
  };

  // 1. Verify SMTP Connection API
  const handleVerifySMTP = async () => {
    if (!senderEmail) {
      setVerifyStatus('failed');
      setVerifyMessage('Please enter a sender email address.');
      return;
    }
    if (!appPassword) {
      setVerifyStatus('failed');
      setVerifyMessage('Please enter your Google App Password.');
      return;
    }

    setVerifyStatus('checking');
    setVerifyMessage('Verifying SMTP connection credentials...');
    addTerminalLog('info', `📡 Testing SMTP auth connectivity for: ${senderEmail}...`);

    try {
      const response = await fetch('http://localhost:5000/api/verify-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderEmail, appPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setVerifyStatus('verified');
        setVerifyMessage('SMTP Credentials Verified & Working!');
        addTerminalLog('success', '🔓 Authentication verified! SMTP transport successfully opened.');
      } else {
        setVerifyStatus('failed');
        setVerifyMessage(data.error || 'SMTP verification failed.');
        addTerminalLog('error', `❌ Auth failed: ${data.details || data.error}`);
      }
    } catch (err) {
      setVerifyStatus('failed');
      setVerifyMessage('Could not connect to backend server.');
      addTerminalLog('error', `❌ Connection error: ${err.message}`);
    }
  };

  // Resume File attachment handler
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
      addTerminalLog('info', `Attached resume: ${e.target.files[0].name} (${Math.round(e.target.files[0].size / 1024)} KB)`);
    }
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    addTerminalLog('info', 'Resume attachment removed.');
  };

  // Leads CSV/TXT files dropzone handlers (Supports Multiple Uploads, Deduplication & Quality Filtering)
  const handleLeadsFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setLeadsFiles(prev => [...prev, ...files]);
      
      addTerminalLog('info', `📁 Loading ${files.length} leads file(s)...`);
      
      try {
        const fileReaders = files.map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve({ name: file.name, text: event.target.result });
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsText(file);
          });
        });
        
        const contents = await Promise.all(fileReaders);
        let combinedText = '';
        contents.forEach(item => {
          combinedText += '\n' + item.text;
        });

        // Search the whole text for email structures
        const emailMatches = combinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        const totalMatchesCount = emailMatches.length;

        // Custom Outbound Quality Filters (unnecessary/placeholder/system emails)
        const dummyKeywords = ['test', 'example', 'sample', 'placeholder', 'dummy', 'yourname', 'email.com', 'domain.com'];
        const systemKeywords = ['noreply', 'no-reply', 'mailer-daemon', 'donotreply', 'admin-alerts', 'support-copy'];
        
        const cleanEmails = emailMatches
          .map(email => email.trim().toLowerCase())
          .filter(email => {
            // 1. Syntactic regex validation
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!regex.test(email)) return false;

            // Split into Local and Domain blocks
            const [localPart, domainPart] = email.split('@');

            // 2. Reject dummy/placeholder accounts
            const isDummy = dummyKeywords.some(keyword => localPart.includes(keyword) || domainPart.includes(keyword));
            if (isDummy) return false;

            // 3. Reject automated system notifications
            const isSystem = systemKeywords.some(keyword => localPart.includes(keyword));
            if (isSystem) return false;

            return true;
          });

        // Deduplicate the matched emails
        const uniqueEmails = Array.from(new Set(cleanEmails));
        const filteredOutCount = totalMatchesCount - uniqueEmails.length;

        if (uniqueEmails.length > 0) {
          // Merge with any existing emails in the recipients textarea box
          setRecipients(prev => {
            const existing = prev
              .split(/[\n,;]+/)
              .map(e => e.trim().toLowerCase())
              .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            const merged = Array.from(new Set([...existing, ...uniqueEmails]));
            return merged.join('\n');
          });

          addTerminalLog('success', `✔️ Processed files successfully. Found ${uniqueEmails.length} unique outreach contact(s).`);
          if (filteredOutCount > 0) {
            addTerminalLog('warning', `🧹 Cleaned out ${filteredOutCount} duplicate / system / invalid email address(es) (e.g. test@, noreply@, etc.).`);
          }
        } else {
          addTerminalLog('error', `❌ No valid email contacts identified inside the file(s).`);
        }
      } catch (err) {
        addTerminalLog('error', `❌ Failed to parse leads database: ${err.message}`);
      }
    }
  };

  const removeLeadsFile = (e, index) => {
    e.stopPropagation();
    setLeadsFiles(prev => {
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });
    addTerminalLog('info', 'Leads file entry removed.');
  };

  const clearAllLeadsFiles = () => {
    setLeadsFiles([]);
    if (leadsInputRef.current) leadsInputRef.current.value = '';
    addTerminalLog('info', 'All leads file attachments cleared.');
  };

  // Campaign control actions
  const handlePauseCampaign = () => {
    setIsCampaignPaused(true);
    campaignControlRef.current.isPaused = true;
    addTerminalLog('warning', '⏸️ Pause requested. Cooldown active... Campaign will pause after the current send finishes.');
  };

  const handleResumeCampaign = () => {
    setIsCampaignPaused(false);
    campaignControlRef.current.isPaused = false;
    addTerminalLog('success', '▶️ Resuming campaign sending loop...');
    // Resume dispatching
    dispatchEmailsLoop(totalRecipientsCount);
  };

  const handleStopCampaign = () => {
    setIsCampaignRunning(false);
    setIsCampaignPaused(false);
    campaignControlRef.current.isCancelled = true;
    campaignControlRef.current.isPaused = false;
    addTerminalLog('error', '🛑 Campaign stopped forcefully by user.');
  };

  // Sequential, pauseable, stoppable campaign sender loop
  const dispatchEmailsLoop = async (totalCount) => {
    // 1. Concurrency guard: Prevent duplicate concurrent loop runs (double clicks/React state race conditions)
    if (isLoopActiveRef.current) {
      console.warn("Prevented duplicate concurrent campaign loop execution.");
      return;
    }

    isLoopActiveRef.current = true;

    try {
      const parsed = recipients
        .split(/[\n,;]+/)
        .map(email => email.trim())
        .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

      const resumeFileLocal = resumeFile;

      while (
        campaignControlRef.current.currentIndex < totalCount &&
        !campaignControlRef.current.isCancelled &&
        !campaignControlRef.current.isPaused
      ) {
        const i = campaignControlRef.current.currentIndex;
        const recipient = parsed[i];

        addTerminalLog('info', `✉️ [${i + 1}/${totalCount}] Dispatching email to: ${recipient}...`);

        const singleFormData = new FormData();
        singleFormData.append('senderEmail', senderEmail);
        singleFormData.append('appPassword', appPassword);
        singleFormData.append('subject', subject);
        singleFormData.append('body', body);
        singleFormData.append('recipient', recipient);
        if (resumeFileLocal) {
          singleFormData.append('resume', resumeFileLocal);
        }

        try {
          const response = await fetch('http://localhost:5000/api/send-single-email', {
            method: 'POST',
            body: singleFormData
          });

          const data = await response.json();

          if (response.ok && data.status === 'success') {
            setStats(prev => ({ ...prev, successful: prev.successful + 1 }));
            addTerminalLog('success', `✔️ SUCCESS: Delivered to ${recipient}`);
          } else {
            setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            addTerminalLog('error', `❌ FAILED: to ${recipient} (${data.error || 'SMTP rejection'})`);
          }
        } catch (err) {
          setStats(prev => ({ ...prev, failed: prev.failed + 1 }));
          addTerminalLog('error', `❌ CONNECTION ERROR: for ${recipient} (${err.message})`);
        }

        // Update progress index
        const nextIndex = i + 1;
        campaignControlRef.current.currentIndex = nextIndex;
        setCampaignProgress(nextIndex);

        // Throttled organics sending
        if (
          nextIndex < totalCount &&
          !campaignControlRef.current.isCancelled &&
          !campaignControlRef.current.isPaused
        ) {
          addTerminalLog('info', '⏳ Applying organic server cooldown safety delay...');
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Campaign state handlers
      if (campaignControlRef.current.isCancelled) {
        setIsCampaignRunning(false);
        setIsCampaignPaused(false);
        addTerminalLog('error', `🛑 Campaign Aborted! Progress stopped at [${campaignControlRef.current.currentIndex}/${totalCount}]`);
      } else if (campaignControlRef.current.isPaused) {
        addTerminalLog('warning', `⏸️ Campaign Suspended! Halted at lead #${campaignControlRef.current.currentIndex + 1}. Click Resume to continue.`);
      } else if (campaignControlRef.current.currentIndex >= totalCount) {
        setIsCampaignRunning(false);
        setIsCampaignPaused(false);
        addTerminalLog('success', `🎉 Campaign Complete! Successfully processed ${totalCount} email dispatches.`);
      }
    } finally {
      // 2. Lock release: Always clear loop execution lock
      isLoopActiveRef.current = false;
    }
  };

  // Launch campaign trigger
  const handleLaunchCampaign = (e) => {
    e.preventDefault();

    // Concurrency guard: Ignore launch click if loop is active
    if (isLoopActiveRef.current || isCampaignRunning) {
      console.warn("Outbound campaign loop is currently active. Action ignored.");
      return;
    }

    // Validations
    if (!senderEmail || !appPassword) {
      addTerminalLog('error', 'Aborted: Sender Email and App Password are required.');
      alert('Please fill out Gmail Credentials (Step 1)');
      return;
    }
    if (!subject || !body) {
      addTerminalLog('error', 'Aborted: Email Subject and Body templates are required.');
      alert('Please compose your Email Campaign (Step 2)');
      return;
    }
    if (!recipients) {
      addTerminalLog('error', 'Aborted: No recipient email addresses provided.');
      alert('Please enter at least one Recipient Email (Step 3)');
      return;
    }

    const parsed = recipients
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (parsed.length === 0) {
      addTerminalLog('error', 'Aborted: No valid email addresses found.');
      alert('Please check your Recipient Emails list for valid syntax.');
      return;
    }

    // Reset loop control state and active dashboard parameters
    campaignControlRef.current = { isCancelled: false, isPaused: false, currentIndex: 0 };
    setIsCampaignRunning(true);
    setIsCampaignPaused(false);
    setCampaignProgress(0);
    setTotalRecipientsCount(parsed.length);
    setStats({ successful: 0, failed: 0, total: parsed.length });
    setTerminalLogs([]);

    addTerminalLog('info', '🚀 Outbound Campaign Initiated!');
    addTerminalLog('info', `📂 Attachment state: ${resumeFile ? `${resumeFile.name} loaded.` : 'None'}`);
    addTerminalLog('info', `📝 Found ${parsed.length} valid recipient(s). Dispatching payload sequentially...`);

    // Begin sending
    dispatchEmailsLoop(parsed.length);
  };

  const getRecipientsCount = () => {
    if (!recipients) return 0;
    return recipients
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)).length;
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="brand">
          <h1>ColdMailer</h1>
          <p>Next-Generation Fullstack Organic SMTP Campaign Engine</p>
        </div>
        
        <div className="tech-stack-badges">
          <div className="tech-badge react">React</div>
          <div className="tech-badge node">Node.js</div>
          <div className="tech-badge express">Express</div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid-layout">
        
        {/* Left Side: Campaign Configuration Form */}
        <section className="left-side">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>✉️ Dispatch Campaign</h2>
              <button 
                type="button" 
                onClick={loadDemoData} 
                className="btn btn-secondary"
                disabled={isCampaignRunning}
              >
                🪄 Load Demo Fields
              </button>
            </div>

            <form onSubmit={handleLaunchCampaign}>
              
              {/* STEP 1: SMTP Config */}
              <fieldset style={{ border: 'none', padding: 0, marginBottom: '24px' }}>
                <legend style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 1: Gmail SMTP Authentication
                </legend>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      <span>📧</span> Sender Gmail Address
                    </label>
                    <input 
                      type="email" 
                      className="input-field"
                      placeholder="e.g. yourname@gmail.com"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      disabled={isCampaignRunning}
                    />
                  </div>

                  <div className="form-group">
                    <label>
                      <span>🔑</span> Gmail App Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        className="input-field"
                        placeholder="16-character code"
                        value={appPassword}
                        onChange={(e) => setAppPassword(e.target.value)}
                        disabled={isCampaignRunning}
                        style={{ paddingRight: '45px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                      >
                        {showPassword ? '👁️' : '🙈'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '16px', alignItems: 'center', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleVerifySMTP}
                    disabled={isCampaignRunning || verifyStatus === 'checking'}
                    className="btn btn-secondary btn-verify"
                  >
                    {verifyStatus === 'checking' ? 'Testing Link...' : 'Verify SMTP'}
                  </button>
                  <div>
                    {verifyStatus === 'verified' && (
                      <div className="verification-status success">✔️ {verifyMessage}</div>
                    )}
                    {verifyStatus === 'failed' && (
                      <div className="verification-status failed">❌ {verifyMessage}</div>
                    )}
                    {verifyStatus === 'checking' && (
                      <div className="verification-status checking">⏳ Connecting to Google servers...</div>
                    )}
                    {verifyStatus === 'idle' && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Requires a secure 16-character Gmail **App Password**, not your main account password.
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* STEP 2: Compose Email */}
              <fieldset style={{ border: 'none', padding: 0, marginBottom: '24px' }}>
                <legend style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 2: Compose Outreach Content
                </legend>

                <div style={{ marginBottom: '14px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Quick template insert:</span>
                  <div className="templates-container">
                    <button type="button" onClick={() => loadTemplate('jobSeeker')} className="template-pill" disabled={isCampaignRunning}>👔 Job Seeker</button>
                    <button type="button" onClick={() => loadTemplate('outreach')} className="template-pill" disabled={isCampaignRunning}>⚡ Lead Gen</button>
                    <button type="button" onClick={() => loadTemplate('partnership')} className="template-pill" disabled={isCampaignRunning}>🤝 Partner Proposal</button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Subject Line</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="Enter email subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isCampaignRunning}
                  />
                </div>

                <div className="form-group">
                  <label>Email Body Template</label>
                  <textarea 
                    className="input-field textarea-field"
                    placeholder="Compose your professional message body here..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    disabled={isCampaignRunning}
                  />
                </div>
              </fieldset>

              {/* STEP 3: Attach & Recipients */}
              <fieldset style={{ border: 'none', padding: 0, marginBottom: '24px' }}>
                <legend style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 3: Resume Attachment & Leads list
                </legend>

                <div className="form-row">
                  {/* Resume Upload */}
                  <div className="form-group">
                    <label>Attach Resume (PDF / Docx / Images)</label>
                    <div 
                      className={`file-upload-zone ${resumeFile ? 'active' : ''}`}
                      onClick={() => !isCampaignRunning && fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                        disabled={isCampaignRunning}
                      />
                      <div className="file-icon">{resumeFile ? '📝' : '📤'}</div>
                      {resumeFile ? (
                        <div className="file-name-pill">
                          {resumeFile.name} ({Math.round(resumeFile.size / 1024)} KB)
                          <button type="button" className="remove-file-btn" onClick={removeFile}>×</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to browse or drop resume</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Supports PDF, DOCX up to 10MB</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Multiple Leads Upload */}
                  <div className="form-group">
                    <label>Upload Leads Files (.csv, .txt)</label>
                    <div 
                      className={`file-upload-zone ${leadsFiles.length > 0 ? 'active' : ''}`}
                      onClick={() => !isCampaignRunning && leadsInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={leadsInputRef}
                        style={{ display: 'none' }}
                        onChange={handleLeadsFileChange}
                        accept=".csv,.txt"
                        multiple
                        disabled={isCampaignRunning}
                      />
                      <div className="file-icon">{leadsFiles.length > 0 ? '📊' : '📁'}</div>
                      {leadsFiles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--secondary)' }}>
                            {leadsFiles.length} file(s) processed
                          </span>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '50px', overflowY: 'auto' }}>
                            {leadsFiles.map((file, idx) => (
                              <span key={idx} className="file-name-pill" style={{ background: 'rgba(6, 182, 212, 0.1)', borderColor: 'rgba(6, 182, 212, 0.2)', color: 'var(--secondary)', fontSize: '0.7rem', padding: '2px 8px', marginTop: 0 }}>
                                {file.name}
                                <button type="button" className="remove-file-btn" onClick={(e) => removeLeadsFile(e, idx)}>×</button>
                              </span>
                            ))}
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); clearAllLeadsFiles(); }} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.7rem', marginTop: '4px' }}>Clear Files</button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to select leads list(s)</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Supports multiple CSV/TXT uploads</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Recipient Email Address list
                      <span className="leads-count-badge" style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--primary)', border: '1px solid rgba(168, 85, 247, 0.3)', textTransform: 'none', letterSpacing: 'normal' }}>
                        {getRecipientsCount()} Leads
                      </span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-filled from files, fully editable</span>
                  </div>
                  <textarea 
                    className="input-field"
                    style={{ minHeight: '80px', fontFamily: 'var(--mono)', fontSize: '0.85rem' }}
                    placeholder="hr.manager@company.com&#10;recruitment@startup.io&#10;partner@business.org"
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    disabled={isCampaignRunning}
                  />
                </div>
              </fieldset>

              {/* Dynamic Operations Launch Button Group */}
              {!isCampaignRunning ? (
                <button 
                  type="submit" 
                  className="btn"
                  style={{ width: '100%', padding: '14px', fontSize: '1.05rem' }}
                >
                  🚀 Launch Outbound Campaign
                </button>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {!isCampaignPaused ? (
                    <button 
                      type="button" 
                      onClick={handlePauseCampaign} 
                      className="btn" 
                      style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)' }}
                    >
                      ⏸️ Pause Campaign
                    </button>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleResumeCampaign} 
                      className="btn" 
                      style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                    >
                      ▶️ Resume Campaign
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={handleStopCampaign} 
                    className="btn" 
                    style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' }}
                  >
                    🛑 Stop Campaign
                  </button>
                </div>
              )}

            </form>
          </div>
        </section>

        {/* Right Side: Dispatch Progress Console */}
        <section className="right-side">
          
          {/* Diagnostic Console Panel */}
          <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <h2>🛰️ Operational Console</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Tracks email execution status, API loop responses, and SMTP logs.
            </p>

            <div className="dispatch-dashboard" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Stats Counters */}
              <div className="stats-circle-container">
                <div className="stat-circle-card">
                  <div className="stat-label">Total Leads</div>
                  <div className="stat-number total">{stats.total}</div>
                </div>
                <div className="stat-circle-card">
                  <div className="stat-label">Successful</div>
                  <div className="stat-number success">{stats.successful}</div>
                </div>
                <div className="stat-circle-card">
                  <div className="stat-label">Failed</div>
                  <div className="stat-number failed">{stats.failed}</div>
                </div>
              </div>

              {/* Progress Tracker */}
              {isCampaignRunning || campaignProgress > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                  <div className="progress-header">
                    <span>
                      {isCampaignPaused ? '⚠️ Campaign Paused' : '⚡ Sending Campaign Emails...'}
                    </span>
                    <span>
                      {campaignProgress} / {totalRecipientsCount} ({Math.round((campaignProgress / totalRecipientsCount) * 100)}%)
                    </span>
                  </div>
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ 
                        width: `${(campaignProgress / totalRecipientsCount) * 100}%`,
                        background: isCampaignPaused ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(90deg, var(--primary) 0%, var(--secondary) 100%)'
                      }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Launch a campaign to activate the live progress bar dashboard.
                </div>
              )}

              {/* Terminal Logs Window */}
              <div className="terminal" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                <div className="terminal-header">
                  <div className="terminal-dots">
                    <span className="t-dot red"></span>
                    <span className="t-dot yellow"></span>
                    <span className="t-dot green"></span>
                  </div>
                  <span className="terminal-title">LIVE CONNECTION STREAM</span>
                </div>
                <div className="terminal-body" style={{ flexGrow: 1 }}>
                  {terminalLogs.length > 0 ? (
                    terminalLogs.map((log, index) => (
                      <div key={index} className={`log-entry log-${log.type}`}>
                        <span className="log-time">[{log.time}]</span>
                        <span>{log.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className="terminal-empty">
                      <span>Live campaign logs will print here when dispatched.</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>

              {/* Campaign Guidelines */}
              <div style={{ background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.1)', borderRadius: '10px', padding: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💡 SMTP Organic Sending Advice
                </h3>
                <div className="checklist">
                  <div className="check-item">
                    <span className="check-dot">•</span>
                    <span>Express server utilizes **1.5 second throttling delays** between mails to prevent anti-spam triggers.</span>
                  </div>
                  <div className="check-item">
                    <span className="check-dot">•</span>
                    <span>Supports multiple uploads; automatically filters out system emails like <code>noreply@</code> and dummy variables.</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

      </div>

      <footer className="footer-text">
        <p>ColdMailer Outbound Dashboard • Powered by React, Express, Multer, and Nodemailer</p>
      </footer>
    </div>
  );
}

export default App;
