// Simple local invoker for getGeminiResponse
// Usage: node test_invoke_getGemini.js

const http = require('http');
const { getGeminiResponse } = require('./index.js');

async function startServerAndInvoke() {
  const port = 8888;
  const server = http.createServer((req, res) => {
    // Route to our function only for /invoke — parse JSON body first
    if (req.url === '/invoke' && req.method === 'POST') {
      let chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          req.body = raw ? JSON.parse(raw) : {};
        } catch (e) {
          req.body = {};
        }

        // Add Express-like helpers expected by firebase wrapper
        res.status = function(code) { this.statusCode = code; return this; };
        res.json = function(obj) { this.setHeader('Content-Type', 'application/json'); this.end(JSON.stringify(obj)); return this; };

        return getGeminiResponse(req, res);
      });
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  });

  server.listen(port, async () => {
    console.log(`Local test server listening on http://127.0.0.1:${port}`);
    try {
      // 1) Quick mock invocation
      const bodyMock = JSON.stringify({ userMessage: 'Merhaba, test mesajı', overrideApiKey: 'mock' });
      const respMock = await fetch(`http://127.0.0.1:${port}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyMock
      });
      console.log('\n== Mock invocation ==');
      console.log('Status:', respMock.status);
      console.log('Body:', await respMock.text());

      // 2) If a local .env with GEMINI_API_KEY exists, try a real invocation (safe: will only log limited info)
      const fs = require('fs');
      const envPath = './.env';
      if (fs.existsSync(envPath)) {
        const raw = fs.readFileSync(envPath, 'utf8');
        const match = raw.match(/GEMINI_API_KEY=(.+)/);
        if (match && match[1]) {
          const realKey = match[1].trim();
          console.log('\n== Real invocation using local .env GEMINI_API_KEY (first 8 chars will be shown) ==');
          const bodyReal = JSON.stringify({ userMessage: 'Merhaba, test mesajı (real)', overrideApiKey: realKey });
          const respReal = await fetch(`http://127.0.0.1:${port}/invoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyReal
          });
          console.log('Status:', respReal.status);
          const realText = await respReal.text();
          console.log('Body:', realText);
        } else {
          console.log('No GEMINI_API_KEY found in .env');
        }
      } else {
        console.log('No local .env file present for real invocation.');
      }
    } catch (e) {
      console.error('Error invoking local handler:', e);
    } finally {
      server.close();
    }
  });
}

startServerAndInvoke();
