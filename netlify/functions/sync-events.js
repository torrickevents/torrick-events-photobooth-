const https = require('https');

const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
const SITE_ID = process.env.NETLIFY_SITE_ID;

function blobRequest(method, key, data) {
  return new Promise((resolve, reject) => {
    const path = `/api/v1/blobs/${SITE_ID}/torrick-events-db/${key}`;
    const payload = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.netlify.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 404) return resolve(null);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(d ? JSON.parse(d) : null); }
          catch(e) { resolve(null); }
        } else reject(new Error('Blob error: ' + res.statusCode + ' ' + d));
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  if (!['GET','POST'].includes(event.httpMethod)) {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  if (!NETLIFY_TOKEN || !SITE_ID) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) };
  }

  // Hash PIN for security — never store raw PIN
  const crypto = require('crypto');
  const hashPin = (pin) => crypto.createHash('sha256').update(pin + 'torrick-salt-2026').digest('hex').slice(0, 16);

  if (event.httpMethod === 'GET') {
    // Load events for a PIN
    const pin = event.queryStringParameters?.pin;
    if (!pin) return { statusCode: 400, body: JSON.stringify({ error: 'Missing PIN' }) };
    const hashedPin = hashPin(pin);
    try {
      const data = await blobRequest('GET', hashedPin, null);
      return { statusCode: 200, body: JSON.stringify({ events: data?.events || [] }) };
    } catch(e) {
      return { statusCode: 200, body: JSON.stringify({ events: [] }) };
    }
  }

  if (event.httpMethod === 'POST') {
    // Save events for a PIN
    let body;
    try { body = JSON.parse(event.body); } catch(e) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }
    const { pin, events: eventsData } = body;
    if (!pin || !eventsData) return { statusCode: 400, body: JSON.stringify({ error: 'Missing pin or events' }) };
    const hashedPin = hashPin(pin);
    try {
      await blobRequest('PUT', hashedPin, { events: eventsData, updated: Date.now() });
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch(e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }
};