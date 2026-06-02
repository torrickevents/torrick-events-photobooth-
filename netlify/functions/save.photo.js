const https = require('https');

// Save photo URL to Netlify Blobs via REST API
function saveToBlobs(id, data, siteId, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = https.request({
      hostname: 'api.netlify.com',
      path: `/api/v1/blobs/${siteId}/torrick-photos/${id}`,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error('Blob save failed: ' + res.statusCode + ' ' + d));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { photoUrl, eventName } = body;
  if (!photoUrl) return { statusCode: 400, body: JSON.stringify({ error: 'Missing photoUrl' }) };

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = process.env.SITE_ID;

  if (!NETLIFY_TOKEN || !SITE_ID) {
    // Fallback: just return the original URL if blobs not configured
    return { statusCode: 200, body: JSON.stringify({ shortId: null, photoUrl }) };
  }

  // Generate short ID
  const id = Math.random().toString(36).substring(2, 9);

  try {
    await saveToBlobs(id, { photoUrl, eventName, created: Date.now() }, SITE_ID, NETLIFY_TOKEN);
    return { statusCode: 200, body: JSON.stringify({ shortId: id }) };
  } catch(e) {
    console.error('Blob error:', e.message);
    // Fallback to raw URL if blobs fail
    return { statusCode: 200, body: JSON.stringify({ shortId: null, photoUrl }) };
  }
};
