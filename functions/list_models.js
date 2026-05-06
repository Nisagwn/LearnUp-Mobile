// Lists available Generative AI models for the provided API key in functions/.env
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

(async function() {
  try {
    const env = fs.existsSync('./.env') ? fs.readFileSync('./.env','utf8') : '';
    const m = env.match(/GEMINI_API_KEY=(.+)/);
    if (!m) {
      console.error('No GEMINI_API_KEY found in functions/.env');
      process.exit(2);
    }
    const apiKey = m[1].trim();
    // The SDK may not expose a listModels helper; call the REST endpoint directly.
    const fetch = global.fetch || require('node-fetch');
    // Try using API key as query parameter (works for API keys)
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`, {
      method: 'GET'
    });
    const json = await resp.json();
    if (!json || !json.models) {
      console.log('List models response:', JSON.stringify(json, null, 2));
      process.exit(0);
    }
    console.log('Available models (first 50):');
    json.models.slice(0,50).forEach((m) => console.log('-', m.name));
  } catch (e) {
    console.error('Error listing models:', e);
    process.exit(1);
  }
})();
