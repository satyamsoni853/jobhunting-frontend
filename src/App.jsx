import { useState, useRef, useEffect } from 'react';
import './App.css';
import JobTargets from './JobTargets.jsx';
import Guide from './Guide.jsx';
import ResumeTailor from './ResumeTailor.jsx';
import JobsBoard from './JobsBoard.jsx';
import SatyamSend from './SatyamSend.jsx';
import MailerStatus from './MailerStatus.jsx';
import SmtpSettings from './SmtpSettings.jsx';

// Helper to parse CSV properly (respecting quoted values and commas within quotes)
function parseCSV(text) {
  const rows = [];
  let row = [];
  let inQuotes = false;
  let currentValue = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentValue);
        currentValue = '';
      } else if (char === '\n' || char === '\r') {
        row.push(currentValue);
        currentValue = '';
        if (row.some(cell => cell.trim() !== '')) {
          rows.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
      } else {
        currentValue += char;
      }
    }
  }
  
  if (currentValue || row.length > 0) {
    row.push(currentValue);
    if (row.some(cell => cell.trim() !== '')) {
      rows.push(row);
    }
  }
  
  if (rows.length === 0) return { headers: [], data: [] };
  
  const headers = rows[0].map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] !== undefined ? values[idx].trim() : '';
    });
    data.push(obj);
  }
  
  return { headers, data };
}

// Helper to replace placeholders like {{Column Name}}, {Column Name}, [Column Name] case-insensitively
function personalizeText(text, lead) {
  if (!text || !lead) return text;
  let personalized = text;
  Object.keys(lead).forEach(key => {
    if (key.startsWith('_')) return; // ignore helper properties
    // Escape regex characters in key
    const escapedKey = key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // Match {{Key}}, {Key}, and [Key] case-insensitively with optional spaces
    const regexDouble = new RegExp(`{{\\s*${escapedKey}\\s*}}`, 'gi');
    const regexSingle = new RegExp(`{\\s*${escapedKey}\\s*}`, 'gi');
    const regexSquare = new RegExp(`\\[\\s*${escapedKey}\\s*\\]`, 'gi');
    
    const val = lead[key] !== undefined ? lead[key] : '';
    personalized = personalized
      .replace(regexDouble, val)
      .replace(regexSingle, val)
      .replace(regexSquare, val);
  });
  return personalized;
}

// Dynamic API Base URL detection: Automatically uses local backend when testing on localhost, 
// and seamlessly switches to the production Render URL when deployed!
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Kapoor Wealth Partners & Dr. Anmol Kapoor Corporate Ecosystem Directory
const ECOSYSTEM_COMPANIES = [
  {
    name: 'Kapoor Wealth Partners',
    shortName: 'Kapoor Wealth',
    icon: '🏢',
    domains: ['kapoorwealth.com', 'kapoorwealthpartners.com'],
    color: '#ff6b00',
    category: 'Family Office & Capital'
  },
  {
    name: 'BioAro Inc.',
    shortName: 'BioAro',
    icon: '🧬',
    domains: ['bioaro.com'],
    color: '#06b6d4',
    category: 'Genomics & Precision Health'
  },
  {
    name: 'Golden Sands Estate',
    shortName: 'Golden Sands',
    icon: '🏖️',
    domains: ['goldensandsestate.com', 'goldensands.com', 'goldensandsrealestate.com'],
    color: '#f59e0b',
    category: 'Luxury Real Estate & PropTech'
  },
  {
    name: 'CardiAI Inc.',
    shortName: 'CardiAI',
    icon: '❤️',
    domains: ['cardiai.com'],
    color: '#ef4444',
    category: 'Cardiac Biotech & Diagnostics'
  },
  {
    name: 'Anryton (BioChain)',
    shortName: 'Anryton',
    icon: '⛓️',
    domains: ['anryton.com'],
    color: '#8b5cf6',
    category: 'Quantum-Resistant Blockchain'
  },
  {
    name: 'PanOmiQ',
    shortName: 'PanOmiQ',
    icon: '🔬',
    domains: ['panomiq.com'],
    color: '#10b981',
    category: 'Multi-Omics Bioinformatics'
  },
  {
    name: 'Vautra',
    shortName: 'Vautra',
    icon: '🛡️',
    domains: ['vautra.com'],
    color: '#3b82f6',
    category: 'Decentralized Health Identity & DNA NFT'
  },
  {
    name: 'Biongevity & Genelio',
    shortName: 'Biongevity',
    icon: '🌱',
    domains: ['biongevity.com', 'genelio.com'],
    color: '#14b8a6',
    category: 'Longevity & Cellular Science'
  },
  {
    name: 'Xevyo',
    shortName: 'Xevyo',
    icon: '🤖',
    domains: ['xevyo.com'],
    color: '#a855f7',
    category: 'Frontier AI Models'
  },
  {
    name: 'DIL Walk Foundation',
    shortName: 'DIL Walk',
    icon: '🩺',
    domains: ['dilwalk.ca', 'dilwalk.com'],
    color: '#ec4899',
    category: 'Heart Health Foundation'
  }
];

function App() {
  // 1. Form parameters
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientViewMode, setRecipientViewMode] = useState('text'); // 'text' | 'cards'
  const [targetCompanyDomain, setTargetCompanyDomain] = useState('kapoorwealth.com');
  const [copiedRecipients, setCopiedRecipients] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  
  // Multiple leads files state
  const [leadsFiles, setLeadsFiles] = useState([]);

  // Leads details and template placeholders
  const [leadsData, setLeadsData] = useState([]);
  const [availablePlaceholders, setAvailablePlaceholders] = useState([]);

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
      subject: 'Application for Software Engineer Position - Satyam Soni',
      body: `Dear Hiring Team,

I hope this email finds you well.

I am writing to express my strong interest in joining your team as a Software Engineer. With hands-on experience building highly responsive web interfaces using React and scalable backend services with Node.js/Express, I am confident in my ability to add immediate value to your ongoing projects.

I have attached my resume for your review, which highlights my technical expertise, open-source contributions, and past internship achievements.

Thank you for your time and consideration. I look forward to the possibility of discussing how my background aligns with your team's engineering goals.

Warm regards,
Satyam Soni
sslotsync.online`
    },
    outreach: {
      name: '⚡ Lead Generation',
      subject: 'Quick question regarding cold outreach automation at [Company Name]',
      body: `Hi Team,

I saw what you are building at your company and was highly impressed by your product's design and speed.

We help digital agencies and startups automate their B2B cold mail outreach, helping them scale conversion volume by 3x while securing 100% domain deliverability.

I have attached a brief overview case study showing our metrics. Are you open to a quick 5-minute introductory call next Tuesday at 2:00 PM to see if we can unlock similar growth for you?

Best regards,
Satyam Soni
sslotsync.online`
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
Satyam Soni`
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

  // One click "Satyam" profile: sender, subject and body from the server (same text the auto-mailer sends),
  // plus the resume PDF when the access key is saved in this browser (the resume is not public).
  // Helper to load demo data
  const loadDemoData = () => {
    setSenderEmail('sender.test.account@gmail.com');
    setAppPassword('xxxx yyyy zzzz aaaa');
    setRecipients('hr.hiring.manager@gmail.com\ntalent.acquisition@openai.com\nhello.support@github.com');
    setSubject('Application for Software Engineer Position - Satyam Soni');
    setBody(`Dear Hiring Team,\n\nI am writing to apply for the Software Engineer role. I am an expert in full-stack Javascript, React, and Node.js.\n\nI have attached my resume. Looking forward to hearing from you!\n\nBest,\nSatyam Soni\nsslotsync.online`);
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
      const response = await fetch(`${API_BASE_URL}/api/verify-smtp`, {
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
        
        let newLeadsData = [];
        let newHeaders = new Set();
        let plainEmails = [];
        
        contents.forEach(item => {
          const { headers, data } = parseCSV(item.text);
          
          if (headers.length > 0 && data.length > 0) {
            let emailCol = '';
            const emailKeywords = ['email', 'contact', 'recipient', 'to', 'mail'];
            
            for (const key of emailKeywords) {
              const found = headers.find(h => h.toLowerCase() === key);
              if (found) {
                emailCol = found;
                break;
              }
            }
            
            if (!emailCol) {
              const colScores = {};
              headers.forEach(h => { colScores[h] = 0; });
              
              const scanRows = data.slice(0, 5);
              scanRows.forEach(row => {
                headers.forEach(h => {
                  if (row[h] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[h].trim())) {
                    colScores[h]++;
                  }
                });
              });
              
              let bestCol = '';
              let maxScore = 0;
              headers.forEach(h => {
                if (colScores[h] > maxScore) {
                  maxScore = colScores[h];
                  bestCol = h;
                }
              });
              
              if (maxScore > 0) {
                emailCol = bestCol;
              }
            }
            
            if (emailCol) {
              data.forEach(row => {
                const emailVal = row[emailCol]?.trim() || '';
                if (emailVal) {
                  newLeadsData.push({
                    ...row,
                    _emailKey: emailVal.toLowerCase(),
                    _emailColName: emailCol
                  });
                }
              });
              headers.forEach(h => newHeaders.add(h));
            } else {
              const matches = item.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
              plainEmails.push(...matches);
            }
          } else {
            const matches = item.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            plainEmails.push(...matches);
          }
        });
        
        const dummyKeywords = ['test', 'example', 'sample', 'placeholder', 'dummy', 'yourname', 'email.com', 'domain.com'];
        const systemKeywords = ['noreply', 'no-reply', 'mailer-daemon', 'donotreply', 'admin-alerts', 'support-copy'];
        
        const filterEmail = (email) => {
          const clean = email.trim().toLowerCase();
          const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!regex.test(clean)) return false;
          
          const [localPart, domainPart] = clean.split('@');
          if (dummyKeywords.some(keyword => localPart.includes(keyword) || domainPart.includes(keyword))) return false;
          if (systemKeywords.some(keyword => localPart.includes(keyword))) return false;
          return true;
        };
        
        const seenEmails = new Set();
        const filteredLeads = [];
        
        newLeadsData.forEach(lead => {
          const email = lead._emailKey;
          if (filterEmail(email) && !seenEmails.has(email)) {
            seenEmails.add(email);
            filteredLeads.push(lead);
          }
        });
        
        const filteredPlainEmails = [];
        plainEmails.forEach(email => {
          const clean = email.trim().toLowerCase();
          if (filterEmail(clean) && !seenEmails.has(clean)) {
            seenEmails.add(clean);
            filteredPlainEmails.push(clean);
          }
        });
        
        const totalUniqueFound = filteredLeads.length + filteredPlainEmails.length;
        
        if (totalUniqueFound > 0) {
          setLeadsData(prev => {
            const existingEmails = new Set(prev.map(l => l._emailKey));
            const merged = [...prev];
            filteredLeads.forEach(l => {
              if (!existingEmails.has(l._emailKey)) {
                merged.push(l);
              }
            });
            return merged;
          });
          
          setAvailablePlaceholders(prev => {
            const merged = new Set([...prev, ...newHeaders]);
            return Array.from(merged);
          });
          
          const emailListToAppend = [
            ...filteredLeads.map(l => l._emailKey),
            ...filteredPlainEmails
          ];
          
          setRecipients(prev => {
            const existing = prev
              .split(/[\n,;]+/)
              .map(e => e.trim().toLowerCase())
              .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
            const merged = Array.from(new Set([...existing, ...emailListToAppend]));
            return merged.join('\n');
          });
          
          addTerminalLog('success', `✔️ Processed files successfully. Found ${totalUniqueFound} unique outreach contact(s).`);
          const totalRawMatched = plainEmails.length + newLeadsData.length;
          const filteredOutCount = totalRawMatched - totalUniqueFound;
          if (filteredOutCount > 0) {
            addTerminalLog('warning', `🧹 Cleaned out ${filteredOutCount} duplicate / system / invalid email address(es).`);
          }
        } else {
          addTerminalLog('error', `❌ No valid email contacts identified inside the file(s).`);
        }
      } catch (err) {
        addTerminalLog('error', `❌ Failed to parse leads database: ${err.message}`);
      }
    }
  };

  const removeLeadsFile = async (e, index) => {
    e.stopPropagation();
    const updatedFiles = [...leadsFiles];
    updatedFiles.splice(index, 1);
    setLeadsFiles(updatedFiles);
    
    addTerminalLog('info', 'Leads file entry removed. Re-indexing active databases...');
    
    setLeadsData([]);
    setAvailablePlaceholders([]);
    
    if (updatedFiles.length === 0) {
      setRecipients('');
      if (leadsInputRef.current) leadsInputRef.current.value = '';
      return;
    }
    
    try {
      const fileReaders = updatedFiles.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve({ name: file.name, text: event.target.result });
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      });
      
      const contents = await Promise.all(fileReaders);
      
      let newLeadsData = [];
      let newHeaders = new Set();
      let plainEmails = [];
      
      contents.forEach(item => {
        const { headers, data } = parseCSV(item.text);
        if (headers.length > 0 && data.length > 0) {
          let emailCol = '';
          const emailKeywords = ['email', 'contact', 'recipient', 'to', 'mail'];
          for (const key of emailKeywords) {
            const found = headers.find(h => h.toLowerCase() === key);
            if (found) { emailCol = found; break; }
          }
          if (!emailCol) {
            const colScores = {};
            headers.forEach(h => { colScores[h] = 0; });
            const scanRows = data.slice(0, 5);
            scanRows.forEach(row => {
              headers.forEach(h => {
                if (row[h] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row[h].trim())) {
                  colScores[h]++;
                }
              });
            });
            let bestCol = '';
            let maxScore = 0;
            headers.forEach(h => {
              if (colScores[h] > maxScore) { maxScore = colScores[h]; bestCol = h; }
            });
            if (maxScore > 0) emailCol = bestCol;
          }
          
          if (emailCol) {
            data.forEach(row => {
              const emailVal = row[emailCol]?.trim() || '';
              if (emailVal) {
                newLeadsData.push({
                  ...row,
                  _emailKey: emailVal.toLowerCase(),
                  _emailColName: emailCol
                });
              }
            });
            headers.forEach(h => newHeaders.add(h));
          } else {
            const matches = item.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            plainEmails.push(...matches);
          }
        } else {
          const matches = item.text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
          plainEmails.push(...matches);
        }
      });
      
      const dummyKeywords = ['test', 'example', 'sample', 'placeholder', 'dummy', 'yourname', 'email.com', 'domain.com'];
      const systemKeywords = ['noreply', 'no-reply', 'mailer-daemon', 'donotreply', 'admin-alerts', 'support-copy'];
      const filterEmail = (email) => {
        const clean = email.trim().toLowerCase();
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!regex.test(clean)) return false;
        const [localPart, domainPart] = clean.split('@');
        if (dummyKeywords.some(keyword => localPart.includes(keyword) || domainPart.includes(keyword))) return false;
        if (systemKeywords.some(keyword => localPart.includes(keyword))) return false;
        return true;
      };
      
      const seenEmails = new Set();
      const filteredLeads = [];
      newLeadsData.forEach(lead => {
        const email = lead._emailKey;
        if (filterEmail(email) && !seenEmails.has(email)) {
          seenEmails.add(email);
          filteredLeads.push(lead);
        }
      });
      
      const filteredPlainEmails = [];
      plainEmails.forEach(email => {
        const clean = email.trim().toLowerCase();
        if (filterEmail(clean) && !seenEmails.has(clean)) {
          seenEmails.add(clean);
          filteredPlainEmails.push(clean);
        }
      });
      
      setLeadsData(filteredLeads);
      setAvailablePlaceholders(Array.from(newHeaders));
      
      const emailListToAppend = [
        ...filteredLeads.map(l => l._emailKey),
        ...filteredPlainEmails
      ];
      setRecipients(emailListToAppend.join('\n'));
      addTerminalLog('success', `Re-indexing complete. Active leads: ${emailListToAppend.length}`);
    } catch (err) {
      addTerminalLog('error', `❌ Failed to re-index leads: ${err.message}`);
    }
  };

  const clearAllLeadsFiles = () => {
    setLeadsFiles([]);
    setLeadsData([]);
    setAvailablePlaceholders([]);
    setRecipients('');
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

        // Apply personalization if lead data exists for this email
        const lead = leadsData.find(l => l._emailKey === recipient.toLowerCase());
        const personalizedSubject = lead ? personalizeText(subject, lead) : subject;
        const personalizedBody = lead ? personalizeText(body, lead) : body;

        if (lead) {
          addTerminalLog('info', `✍️ Personalizing outreach template for: ${lead['Author Name'] || recipient}`);
        }

        const singleFormData = new FormData();
        singleFormData.append('senderEmail', senderEmail);
        singleFormData.append('appPassword', appPassword);
        singleFormData.append('subject', personalizedSubject);
        singleFormData.append('body', personalizedBody);
        singleFormData.append('recipient', recipient);
        if (resumeFileLocal) {
          singleFormData.append('resume', resumeFileLocal);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/send-single-email`, {
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

  const getParsedRecipientsList = () => {
    if (!recipients) return [];
    return recipients
      .split(/[\n,;]+/)
      .map(email => email.trim())
      .filter(email => email.length > 0);
  };

  const getFilteredRecipients = () => {
    const list = getParsedRecipientsList();
    if (!recipientSearch.trim()) return list;
    const q = recipientSearch.trim().toLowerCase();
    return list.filter(email => email.toLowerCase().includes(q));
  };

  const handleRemoveSingleRecipient = (emailToRemove) => {
    const currentList = getParsedRecipientsList();
    const updated = currentList.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
    setRecipients(updated.join('\n'));
    addTerminalLog('info', `🗑️ Removed recipient: ${emailToRemove}`);
  };

  const handleKeepOnlyMatches = () => {
    const matched = getFilteredRecipients();
    setRecipients(matched.join('\n'));
    setRecipientSearch('');
    addTerminalLog('info', `🎯 Kept only ${matched.length} search-matched recipient(s).`);
  };

  const handleRemoveSearchMatches = () => {
    const matched = getFilteredRecipients();
    const matchedSet = new Set(matched.map(e => e.toLowerCase()));
    const currentList = getParsedRecipientsList();
    const updated = currentList.filter(e => !matchedSet.has(e.toLowerCase()));
    setRecipients(updated.join('\n'));
    setRecipientSearch('');
    addTerminalLog('info', `🗑️ Removed ${matched.length} search-matched recipient(s).`);
  };

  const handleDeduplicateRecipients = () => {
    const currentList = getParsedRecipientsList();
    const seen = new Set();
    const deduped = [];
    for (const item of currentList) {
      const lower = item.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        deduped.push(item);
      }
    }
    const removedCount = currentList.length - deduped.length;
    setRecipients(deduped.join('\n'));
    if (removedCount > 0) {
      addTerminalLog('success', `🧹 Cleaned up ${removedCount} duplicate recipient(s). Total unique: ${deduped.length}.`);
    } else {
      addTerminalLog('info', `✔️ No duplicate recipients found (all ${deduped.length} are unique).`);
    }
  };

  const handleCopyRecipients = (textToCopy) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedRecipients(true);
    setTimeout(() => setCopiedRecipients(false), 2000);
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="search-highlight">{part}</span>
      ) : part
    );
  };

  const detectEcosystemCompany = (email) => {
    if (!email) return null;
    const emailLower = email.trim().toLowerCase();
    for (const comp of ECOSYSTEM_COMPANIES) {
      for (const d of comp.domains) {
        if (emailLower.endsWith(`@${d}`) || emailLower.includes(`@${d}`)) {
          return comp;
        }
      }
      const slug = comp.shortName.toLowerCase().replace(/\s+/g, '');
      if (emailLower.includes(slug)) {
        return comp;
      }
    }
    return null;
  };

  const isCompanyEmail = (email) => {
    return detectEcosystemCompany(email) !== null;
  };

  const getEcosystemStats = () => {
    const list = getParsedRecipientsList();
    if (list.length === 0) {
      return { ecosystemCount: 0, externalCount: 0, ecosystemList: [], externalList: [], byCompany: {}, total: 0 };
    }
    
    const ecosystemList = [];
    const externalList = [];
    const byCompany = {};
    
    list.forEach(email => {
      const comp = detectEcosystemCompany(email);
      if (comp) {
        ecosystemList.push({ email, comp });
        byCompany[comp.shortName] = (byCompany[comp.shortName] || 0) + 1;
      } else {
        externalList.push(email);
      }
    });

    return {
      ecosystemCount: ecosystemList.length,
      externalCount: externalList.length,
      ecosystemList,
      externalList,
      byCompany,
      total: list.length
    };
  };

  const handleKeepOnlyEcosystemEmails = () => {
    const list = getParsedRecipientsList();
    const ecosystemEmails = list.filter(e => detectEcosystemCompany(e) !== null);
    setRecipients(ecosystemEmails.join('\n'));
    addTerminalLog('success', `🏢 ECOSYSTEM FILTER: Kept ${ecosystemEmails.length} verified group emails.`);
  };

  const handleFilterBySpecificCompany = (companyShortName) => {
    const list = getParsedRecipientsList();
    const matched = list.filter(e => {
      const comp = detectEcosystemCompany(e);
      return comp && comp.shortName.toLowerCase() === companyShortName.toLowerCase();
    });
    setRecipients(matched.join('\n'));
    addTerminalLog('info', `🎯 Filtered recipient list to: ${companyShortName} (${matched.length} email(s)).`);
  };

  const handleRemoveNonEcosystemEmails = () => {
    const list = getParsedRecipientsList();
    const ecosystemEmails = list.filter(e => detectEcosystemCompany(e) !== null);
    const removedCount = list.length - ecosystemEmails.length;
    setRecipients(ecosystemEmails.join('\n'));
    addTerminalLog('warning', `🧹 Removed ${removedCount} non-ecosystem email(s).`);
  };

  return (
    <div className="app-container">
      {/* Top navigation */}
      <nav className="topnav" aria-label="Main">
        <a className="topnav-brand" href="#top">Job Hunter</a>
        <div className="topnav-links">
          <a href="#send">Send</a>
          <a href="#hunter">Hunter</a>
          <a href="#jobs">Jobs</a>
          <a href="#advanced">Advanced</a>
          <a href="#guide">Guide</a>
        </div>
      </nav>

      {/* Header Panel */}
      <header className="app-header" id="top">
        <div className="brand">
          <h1>Job Hunter</h1>
          <p className="tagline">Press Satyam, verify, paste emails, send.</p>
        </div>
      </header>

      <SatyamSend apiBaseUrl={API_BASE_URL} />
      <JobTargets apiBaseUrl={API_BASE_URL} />
      <MailerStatus apiBaseUrl={API_BASE_URL} />
      <JobsBoard apiBaseUrl={API_BASE_URL} />

      {/* Everything else: closed by default */}
      <details className="advanced" id="advanced">
        <summary>Advanced tools <span>sender setup, status, resume tailor, manual campaign</span></summary>
      <div className="grid-layout">
        
        {/* Left Side: Campaign Configuration Form */}
        <section className="left-side">
          <SmtpSettings apiBaseUrl={API_BASE_URL} />
          <ResumeTailor apiBaseUrl={API_BASE_URL} />
          <div className="card" id="manual">
            <div className="card-head">
              <div>
                <h2 style={{ margin: 0 }}>✉️ Manual Campaign</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.7 }}>
                  Prefer to send yourself? Upload a CSV and dispatch with your own SMTP login.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={loadDemoData}
                  className="btn btn-secondary"
                  disabled={isCampaignRunning}
                >
                  🪄 Load Demo Fields
                </button>
              </div>
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
                        Requires a secure 16-character Gmail <strong>App Password</strong>, not your main account password.
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

                {availablePlaceholders.length > 0 && (
                  <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(255, 107, 0, 0.05)', border: '1px dashed rgba(255, 107, 0, 0.2)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', display: 'block', marginBottom: '8px' }}>
                      📋 Available Placeholders (Click to copy):
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {availablePlaceholders.map(placeholder => (
                        <button
                          key={placeholder}
                          type="button"
                          className="template-pill"
                          style={{ margin: 0, padding: '4px 10px', fontSize: '0.75rem', borderColor: 'rgba(255, 107, 0, 0.2)' }}
                          onClick={() => {
                            navigator.clipboard.writeText(`{{${placeholder}}}`);
                            addTerminalLog('info', `Copied: {{${placeholder}}}`);
                          }}
                          title={`Click to copy {{${placeholder}}}`}
                        >
                          {`{{${placeholder}}}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                  <div className="recipient-manager-box">
                    {/* Header Row: Title, Leads Count Badge, and View Switcher */}
                    <div className="recipient-top-bar">
                      <div className="recipient-title-area">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          Recipient Email Address list
                          <span className="leads-count-badge" style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(255, 107, 0, 0.15)', color: 'var(--primary)', border: '1px solid rgba(255, 107, 0, 0.3)', textTransform: 'none', letterSpacing: 'normal' }}>
                            {getRecipientsCount()} Leads
                          </span>
                        </label>
                      </div>

                      {/* View Mode Switcher */}
                      <div className="recipient-view-toggle">
                        <button
                          type="button"
                          className={`recipient-toggle-btn ${recipientViewMode === 'text' ? 'active' : ''}`}
                          onClick={() => setRecipientViewMode('text')}
                          title="Raw editable text area"
                        >
                          ✏️ Raw Edit
                        </button>
                        <button
                          type="button"
                          className={`recipient-toggle-btn ${recipientViewMode === 'cards' ? 'active' : ''}`}
                          onClick={() => setRecipientViewMode('cards')}
                          title="Interactive cards list with remove & search inspection"
                        >
                          📋 Card List ({getFilteredRecipients().length})
                        </button>
                      </div>
                    </div>

                    {/* Group Ecosystem Alert & Intelligence Banner */}
                    {(() => {
                      const ecoStats = getEcosystemStats();
                      return (
                        <div className="ecosystem-alert-box">
                          <div className="ecosystem-alert-header">
                            <div className="ecosystem-alert-title">
                              <span>⚡</span>
                              <span>Kapoor Wealth Ecosystem Alert & Verifier</span>
                            </div>

                            {ecoStats.ecosystemCount > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="company-stat-pill success">
                                  ✓ {ecoStats.ecosystemCount} Group Verified
                                </span>
                                {ecoStats.externalCount > 0 && (
                                  <span className="company-stat-pill warning">
                                    ⚠️ {ecoStats.externalCount} External
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="recipient-action-chip success"
                                  onClick={handleKeepOnlyEcosystemEmails}
                                  title="Keep only emails belonging to Kapoor Wealth, BioAro, Golden Sands, etc."
                                >
                                  🎯 Keep Only Group Emails
                                </button>
                                {ecoStats.externalCount > 0 && (
                                  <button
                                    type="button"
                                    className="recipient-action-chip danger"
                                    onClick={handleRemoveNonEcosystemEmails}
                                    title="Remove all external (non-group) emails"
                                  >
                                    🧹 Remove External
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                Auto-detects Kapoor Wealth, BioAro, Golden Sands, CardiAI, Anryton & group emails
                              </span>
                            )}
                          </div>

                          {/* Detected Sub-Company Breakdown Pills */}
                          {ecoStats.ecosystemCount > 0 && (
                            <div className="ecosystem-chips-container">
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Detected Ventures:</span>
                              {Object.entries(ecoStats.byCompany).map(([compName, count]) => {
                                const compObj = ECOSYSTEM_COMPANIES.find(c => c.shortName === compName);
                                return (
                                  <button
                                    key={compName}
                                    type="button"
                                    className="ecosystem-badge-pill"
                                    style={{ borderColor: compObj ? compObj.color : 'var(--primary)', color: '#fff', cursor: 'pointer' }}
                                    onClick={() => handleFilterBySpecificCompany(compName)}
                                    title={`Click to filter list to only ${compName} (${count} email(s))`}
                                  >
                                    <span>{compObj ? compObj.icon : '🏢'}</span>
                                    <span>{compName}: <strong>{count}</strong></span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Integrated Search Bar */}
                    <div className="recipient-search-wrapper">
                      <span className="recipient-search-icon">🔍</span>
                      <input
                        type="text"
                        className="recipient-search-input"
                        placeholder="Search emails or ventures (e.g. bioaro.com, goldensands, palak, recruiter)..."
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                        disabled={isCampaignRunning}
                      />
                      {recipientSearch && (
                        <button
                          type="button"
                          className="recipient-search-clear"
                          onClick={() => setRecipientSearch('')}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Search Feedback & Quick Filter Actions Bar */}
                    {recipientSearch.trim() && (
                      <div className="recipient-search-feedback">
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong>{getFilteredRecipients().length}</strong> matching of {getParsedRecipientsList().length} total
                        </span>
                        <div className="recipient-search-actions">
                          <button
                            type="button"
                            className="recipient-action-chip success"
                            onClick={handleKeepOnlyMatches}
                            title="Filter list to only keep matching recipients"
                          >
                            🎯 Keep Only Matches
                          </button>
                          <button
                            type="button"
                            className="recipient-action-chip danger"
                            onClick={handleRemoveSearchMatches}
                            title="Remove all matching recipients from list"
                          >
                            🗑️ Delete Matches
                          </button>
                          <button
                            type="button"
                            className="recipient-action-chip"
                            onClick={() => handleCopyRecipients(getFilteredRecipients().join('\n'))}
                            title="Copy matched emails to clipboard"
                          >
                            📋 Copy Matches
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Main Content: Enlarged Textarea OR Interactive Cards List */}
                    {recipientViewMode === 'text' ? (
                      <>
                        {(() => {
                          const ecoStats = getEcosystemStats();
                          if (ecoStats.externalCount > 0 && ecoStats.ecosystemCount > 0) {
                            return (
                              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', color: '#f59e0b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>⚠️ <strong>{ecoStats.externalCount} email(s)</strong> are external to Kapoor Wealth/BioAro/Golden Sands group</span>
                                <button
                                  type="button"
                                  className="recipient-action-chip danger"
                                  onClick={handleRemoveNonEcosystemEmails}
                                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                >
                                  Clean & Keep Group Only
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <textarea
                          className="recipient-textarea-enlarged"
                          placeholder="palak@kapoorwealth.com&#10;hr@bioaro.com&#10;info@goldensandsestate.com&#10;recruiting@cardiai.com&#10;team@anryton.com"
                          value={recipients}
                          onChange={(e) => setRecipients(e.target.value)}
                          disabled={isCampaignRunning}
                        />
                      </>
                    ) : (
                      <div className="recipient-cards-scroll-container">
                        {getFilteredRecipients().length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {recipientSearch.trim() ? `No recipients matching "${recipientSearch}"` : 'No recipients entered yet. Type or upload a leads file!'}
                          </div>
                        ) : (
                          getFilteredRecipients().map((email, idx) => {
                            const lead = leadsData.find(l => l._emailKey === email.toLowerCase());
                            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                            const ecoComp = detectEcosystemCompany(email);
                            return (
                              <div key={`${email}-${idx}`} className="recipient-card-row">
                                <div className="recipient-card-email-info">
                                  <span className="recipient-card-icon">{isValid ? '✉️' : '⚠️'}</span>
                                  <span>{highlightMatch(email, recipientSearch)}</span>
                                  {ecoComp ? (
                                    <span
                                      className="domain-verified-badge"
                                      style={{
                                        background: `${ecoComp.color}22`,
                                        color: ecoComp.color,
                                        border: `1px solid ${ecoComp.color}55`
                                      }}
                                    >
                                      {ecoComp.icon} {ecoComp.shortName}
                                    </span>
                                  ) : (
                                    <span className="domain-verified-badge warning">
                                      ⚠️ External
                                    </span>
                                  )}
                                  {lead && lead['Author Name'] && (
                                    <span className="recipient-card-lead-name">
                                      👤 {lead['Author Name']}
                                    </span>
                                  )}
                                  {lead && lead['Company'] && (
                                    <span className="recipient-card-lead-name">
                                      🏢 {lead['Company']}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="recipient-card-remove-btn"
                                  onClick={() => handleRemoveSingleRecipient(email)}
                                  title={`Remove ${email}`}
                                  disabled={isCampaignRunning}
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* Bottom Utility Bar: Stats & Quick Operations */}
                    <div className="recipient-bottom-bar">
                      <div className="recipient-meta-info">
                        <span>Lines: {getParsedRecipientsList().length}</span>
                        <span>•</span>
                        <span>Valid Emails: {getRecipientsCount()}</span>
                        {copiedRecipients && (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Copied!</span>
                        )}
                      </div>
                      <div className="recipient-footer-actions">
                        <button
                          type="button"
                          className="recipient-action-chip"
                          onClick={handleDeduplicateRecipients}
                          disabled={isCampaignRunning || !recipients.trim()}
                          title="Remove duplicate emails from the list"
                        >
                          🧹 Deduplicate
                        </button>
                        <button
                          type="button"
                          className="recipient-action-chip"
                          onClick={() => handleCopyRecipients(recipients)}
                          disabled={!recipients.trim()}
                          title="Copy all emails to clipboard"
                        >
                          📋 Copy All
                        </button>
                        <button
                          type="button"
                          className="recipient-action-chip danger"
                          onClick={() => {
                            if (window.confirm('Clear all recipients?')) {
                              setRecipients('');
                              setRecipientSearch('');
                            }
                          }}
                          disabled={isCampaignRunning || !recipients.trim()}
                          title="Clear all recipients"
                        >
                          🗑️ Clear All
                        </button>
                      </div>
                    </div>
                  </div>
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
          <div className="card console-card">
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
              <div style={{ background: 'rgba(255, 107, 0, 0.04)', border: '1px solid rgba(255, 107, 0, 0.1)', borderRadius: '10px', padding: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💡 SMTP Organic Sending Advice
                </h3>
                <div className="checklist">
                  <div className="check-item">
                    <span className="check-dot">•</span>
                    <span>Express server utilizes <strong>1.5 second throttling delays</strong> between mails to prevent anti-spam triggers.</span>
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
      </details>

      <Guide />

      <footer className="footer-text">
        <p>sslotsync.online ColdMailer Outbound Dashboard • Powered by React, Express, Multer, and Nodemailer • Created by Satyam Soni</p>
      </footer>
    </div>
  );
}

export default App;
