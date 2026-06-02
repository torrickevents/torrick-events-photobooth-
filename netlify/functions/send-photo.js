const https = require('https');

function sendEmail(to, subject, html, base64, fileName, fileType, apiKey, fromEmail) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: `Torrick Events <${fromEmail}>`,
      to: [to], subject, html,
      attachments: [{ filename: fileName, content: base64 }]
    });
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { if (res.statusCode >= 200 && res.statusCode < 300) resolve(); else reject(new Error('Email error: ' + d)); });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function sendSMSLink(to, eventName, shortUrl, apiKey, fromEmail) {
  return new Promise((resolve, reject) => {
    const html = `<p>Your photo is ready! Tap to save: ${shortUrl}</p>`;
    const payload = JSON.stringify({
      from: `Torrick Events <${fromEmail}>`,
      to: [to], subject: 'Your photo', html
    });
    const req = https.request({
      hostname: 'api.resend.com', path: '/emails', method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { if (res.statusCode >= 200 && res.statusCode < 300) resolve(); else reject(new Error('SMS error: ' + d)); });
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { to, eventName, fileBase64, fileName, fileType, photoUrl, shortId } = body;
  if (!to) return { statusCode: 400, body: JSON.stringify({ error: 'Missing to' }) };

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'photos@torrickevents.com';
  const SITE_URL = process.env.SITE_URL || 'https://tevents-photobooth.netlify.app';
  if (!RESEND_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Resend key missing' }) };

  const SMS_DOMAINS = ['vtext.com','txt.att.net','tmomail.net','messaging.sprintpcs.com',
                       'mymetropcs.com','sms.myboostmobile.com','vmobl.com','cricketwireless.net'];
  const isSMS = SMS_DOMAINS.some(d => to.includes('@' + d));

  try {
    if (isSMS) {
      // Build short URL to our photo page
      const shareUrl = shortId
        ? `${SITE_URL}/photo.html?id=${shortId}`
        : photoUrl;
      await sendSMSLink(to, eventName, shareUrl, RESEND_KEY, FROM_EMAIL);
    } else {
      if (!fileBase64) return { statusCode: 400, body: JSON.stringify({ error: 'No photo data' }) };
      const isVideo = fileType && fileType.includes('video');
      const subject = `Your photo from ${eventName} — Torrick Events 🎉`;
      const html = `
        <div style="font-family:Georgia,serif;max-width:500px;margin:0 auto;background:#1a1209;color:#faf7f2;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:20px;">
            <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px">TORRICK EVENTS</div>
            <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin:0 auto 16px;"></div>
            <h2 style="font-style:italic;font-weight:400;font-size:26px;color:#e8d5a3;margin:0">Thanks for celebrating with us!</h2>
            <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:8px">${eventName}</p>
          </div>
          ${isVideo
            ? `<p style="text-align:center;color:rgba(255,255,255,0.7);">Your video is attached — tap to save.</p>`
            : `<img src="data:${fileType||'image/jpeg'};base64,${fileBase64}" alt="Your photo" style="width:100%;border-radius:8px;border:1px solid rgba(201,168,76,0.3);display:block;" />`
          }
          <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid rgba(201,168,76,0.2);">
            <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;">TORRICK EVENTS · Photo Booth Studio</p>
          </div>
        </div>`;
      await sendEmail(to, subject, html, fileBase64, fileName||(isVideo?'memory.webm':'photo.jpg'), fileType, RESEND_KEY, FROM_EMAIL);
    }
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch(e) {
    console.error('Error:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
