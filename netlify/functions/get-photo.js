const https = require('https');

function getFromBlobs(id, siteId, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.netlify.com',
      path: `/api/v1/blobs/${siteId}/torrick-photos/${id}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(d)); }
          catch(e) { reject(new Error('Parse error')); }
        } else reject(new Error('Not found: ' + res.statusCode));
      });
    });
    req.on('error', reject);
    req.end();
  });
}

exports.handler = async (event) => {
  const id = event.queryStringParameters?.id;
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing id' }) };

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  const SITE_ID = process.env.NETLIFY_SITE_ID;
  if (!NETLIFY_TOKEN || !SITE_ID) return { statusCode: 500, body: JSON.stringify({ error: 'Not configured' }) };

  try {
    const data = await getFromBlobs(id, SITE_ID, NETLIFY_TOKEN);
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch(e) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Photo not found' }) };
  }
};
