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
  const FROM_EMAIL = process.env.FROM_EMAIL || 'photos@torrickevents.com';

  if (!RESEND_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Resend API key not configured' }) };
  }

  const isVideo = fileType && fileType.includes('video');
  const isSMS = to.includes('@vtext.com') || to.includes('@txt.att.net') || 
                to.includes('@tmomail.net') || to.includes('@messaging.sprintpcs.com') ||
                to.includes('@mymetropcs.com') || to.includes('@sms.myboostmobile.com') ||
                to.includes('@vmobl.com') || to.includes('@cricketwireless.net');

  const subject = `Your photo from ${eventName} — Torrick Events 🎉`;

  // For SMS carriers — keep it super short, just attach the photo
  // For email — full branded template with inline photo
  const htmlBody = isSMS ? `
    <p>📸 Your photo from ${eventName} is attached!</p>
    <p>— Torrick Events</p>
  ` : `
    <div style="font-family:Georgia,serif;max-width:500px;margin:0 auto;background:#1a1209;color:#faf7f2;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:11px;letter-spacing:6px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px">TORRICK EVENTS</div>
        <div style="width:60px;height:1px;background:linear-gradient(90deg,transparent,#C9A84C,transparent);margin:0 auto 16px;"></div>
        <h2 style="font-style:italic;font-weight:400;font-size:26px;color:#e8d5a3;margin:0">Thanks for celebrating with us!</h2>
        <p style="color:rgba(255,255,255,0.6);font-size:14px;margin-top:8px">${eventName}</p>
      </div>
      ${isVideo
        ? `<p style="text-align:center;color:rgba(255,255,255,0.7);font-size:14px;">Your video is attached below — tap it to open and save to your camera roll.</p>`
        : `<img src="data:${fileType || 'image/jpeg'};base64,${fileBase64}" alt="Your photo" style="width:100%;border-radius:8px;border:1px solid rgba(201,168,76,0.3);display:block;" />`
      }
      <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid rgba(201,168,76,0.2);">
        <p style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;">TORRICK EVENTS · Photo Booth Studio</p>
        <p style="color:rgba(255,255,255,0.3);font-size:10px;margin-top:4px;">Can't see the photo? It's also attached below.</p>
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
          console.error('Resend error:', res.statusCode, data);
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
