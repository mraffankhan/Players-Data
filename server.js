const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Allow large base64 image payloads up to 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/google-apps-script', express.static(path.join(__dirname, 'google-apps-script')));

// API Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    spreadsheetId: process.env.SPREADSHEET_ID || '1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw',
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID || '1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw'}/edit`,
    hasScriptUrl: Boolean(process.env.GOOGLE_SCRIPT_URL && process.env.GOOGLE_SCRIPT_URL.trim() !== '')
  });
});

// Test Google Apps Script connection
app.get('/api/test-connection', async (req, res) => {
  const scriptUrl = req.query.url || process.env.GOOGLE_SCRIPT_URL;

  if (!scriptUrl || scriptUrl.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'No Google Apps Script URL provided.'
    });
  }

  try {
    const response = await fetch(scriptUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Google Apps Script returned HTTP status ${response.status}`
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      message: 'Successfully connected to Google Apps Script!',
      data
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reach Google Apps Script: ' + err.message
    });
  }
});

// Save Script URL into .env file directly from web UI
app.post('/api/save-script-url', (req, res) => {
  const { scriptUrl } = req.body;
  if (!scriptUrl) {
    return res.status(400).json({ success: false, message: 'Missing script URL' });
  }

  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    if (envContent.includes('GOOGLE_SCRIPT_URL=')) {
      envContent = envContent.replace(/GOOGLE_SCRIPT_URL=.*(\r?\n|$)/, `GOOGLE_SCRIPT_URL=${scriptUrl}\n`);
    } else {
      envContent += `\nGOOGLE_SCRIPT_URL=${scriptUrl}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    process.env.GOOGLE_SCRIPT_URL = scriptUrl;

    return res.json({ success: true, message: 'Google Script URL saved successfully!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Primary Registration Endpoint
app.post('/api/register', async (req, res) => {
  const scriptUrl = req.body.customScriptUrl || process.env.GOOGLE_SCRIPT_URL;

  // If no Google Script URL is provided yet, operate in Demo Mode with full feedback
  if (!scriptUrl || scriptUrl.trim() === '') {
    console.log('[Registration] Demo Mode submission received for Team:', req.body.teamName);
    const mockId = 'DEMO-' + Date.now();
    return res.json({
      status: 'demo',
      success: true,
      submissionId: mockId,
      teamName: req.body.teamName,
      message: 'Demo Mode: Form validated and received locally! Please connect your Google Apps Script URL to save automatically to your Google Sheet and Google Drive.',
      demoNotice: true
    });
  }

  try {
    console.log(`[Registration] Forwarding submission for "${req.body.teamName}" to Google Apps Script...`);

    // Clean payload: remove customScriptUrl before forwarding
    const payload = { ...req.body };
    delete payload.customScriptUrl;

    const googleRes = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      }
    });

    const text = await googleRes.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { status: 'raw', rawText: text };
    }

    console.log('[Registration] Google response:', result);
    return res.json(result);
  } catch (err) {
    console.error('[Registration] Error forwarding to Google Apps Script:', err);
    return res.status(500).json({
      status: 'error',
      success: false,
      message: 'Failed to transmit data to Google: ' + err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Esports Tournament Registration Portal is running!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📊 Target Sheet: https://docs.google.com/spreadsheets/d/${process.env.SPREADSHEET_ID || '1-PWO7tjRHSFLv_5SgoqH6fbWzRppVavlWnnzGQKhWuw'}/edit`);
  console.log(`⚙️  Google Script URL: ${process.env.GOOGLE_SCRIPT_URL ? 'CONFIGURED' : 'NOT CONFIGURED (Operating in Demo/Setup Mode)'}`);
  console.log(`====================================================`);
});
