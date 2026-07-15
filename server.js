const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const gasApi = require('./gas-api');

const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function renderAppsScriptIncludes(content) {
  return content.replace(/<\?!=\s*include\(['"]([^'"]+)['"]\);\s*\?>/g, (_match, file) => {
    const includePath = path.join(__dirname, file.endsWith('.html') ? file : file + '.html');
    try {
      return fs.readFileSync(includePath, 'utf-8');
    } catch {
      return '';
    }
  });
}

// ── Verification GAS Web App sou demaraj ──
let GAS_AVAILABLE = false;
(async function init() {
  console.log('Verifye GAS Web App...');
  const auth = await gasApi.authenticate();
  GAS_AVAILABLE = !!auth;
  if (GAS_AVAILABLE) {
    console.log('✅ Live GAS data available');
  } else {
    console.log('ℹ️  Using mock data as fallback');
  }
})();

// ── API endpoint pou rele fonksyon GAS ─────
async function handleApiRequest(parsedUrl, req, res) {
  const match = parsedUrl.pathname.match(/^\/api\/(\w+)$/);
  if (!match) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: 'API endpoint pa valid' }));
    return;
  }

  const action = match[1];

  let body = '';
  await new Promise((resolve) => {
    req.on('data', chunk => { body += chunk; });
    req.on('end', resolve);
  });

  let args = [];
  try {
    if (body) {
      const parsed = JSON.parse(body);
      args = parsed.args || [];
    }
  } catch { /* use empty args */ }

  if (!GAS_AVAILABLE) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: 'GAS pa disponib', needsSetup: true }));
    return;
  }

  try {
    const result = await gasApi.callFunction(action, args);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);

  // ── API route ─────────────────────────────────
  if (parsed.pathname.startsWith('/api/')) {
    handleApiRequest(parsed, req, res);
    return;
  }

  // ── Sèvi fichye yo ────────────────────────────
  let filePath = path.join(__dirname, parsed.pathname === '/' ? 'Index.html' : parsed.pathname);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Pa jwenn</h1>');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
    });
    if (ext === '.html') {
      let content = renderAppsScriptIncludes(data.toString('utf-8'));
      content = content.replace('<!-- LOCAL_MODE -->',
        `<script>
          var LOCAL_MODE = true;
          var MOCK_DELAY = 300;
        </script>
        <script src="/mock-api.js"></script>`);
      res.end(content);
    } else {
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log('\nLocal Dev Server: http://localhost:' + PORT);
});
