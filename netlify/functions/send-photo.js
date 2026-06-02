const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { to, eventName, fileBase64, fileName, fileType } = body;
  if (!to || !fileBase64) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Resend API key not configured' }) };
  }

  const isVideo = fileType && fileType.includes('video');
  const subject = `Your photo from ${eventName} — Torrick Events 🎉`;

  const htmlBody = `
    <div style="font-family:Georgia,serif;max-width:500px;margin:0 auto;background:#1a1209;color:#faf7f2;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px">TORRICK EVENTS</div>
        <h2 style="font-style:italic;font-weight:400;font-size:26px;color:#e8d5a3;margin:0">Thanks for celebrating with us!</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:8px">${eventName}</p>
      </div>
      ${isVideo
        ? `<p style="text-align:center;color:rgba(255,255,255,0.7);font-size:14px">Your video is attached!</p>`
        : `<img src="cid:photo" alt="Your photo" style="width:100%;border-radius:8px;" />`
      }
      <div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid rgba(201,168,76,0.2);">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px">TORRICK EVENTS · Photo Booth Studio</p>
      </div>
    </div>
  `;

  const payload = JSON.stringify({
    from: `Torrick Events <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html: htmlBody,
    attachments: [{
      filename: fileName || (isVideo ? 'memory.webm' : 'photo.jpg'),
      content: fileBase64
    }]
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: 200, body: JSON.stringify({ success: true }) });
        } else {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Resend error: ' + data }) });
        }
      });
    });
    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });
    req.write(payload);
    req.end();
  });
};
