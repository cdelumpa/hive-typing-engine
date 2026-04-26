const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
// override: true lets values in .env authoritatively replace ambient shell env.
// Without this, a shell-defined ANTHROPIC_API_KEY="" silently shadows the real
// key from .env and the SDK fails with an unhelpful auth-resolution error.
require('dotenv').config({ override: true });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[boot] FATAL: ANTHROPIC_API_KEY is not set. Check .env');
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/content', express.static('../content'));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/analyze', async (req, res) => {
  const { systemPrompt, userMessage } = req.body;
  const started = Date.now();
  console.log(`[analyze] request received — system ${systemPrompt?.length ?? 0} chars, user ${userMessage?.length ?? 0} chars`);

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 12000,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      });

      const text = response.content[0].text;

      // Strip any accidental markdown fences before parsing
      const clean = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const result = JSON.parse(clean);
      const elapsed = ((Date.now() - started) / 1000).toFixed(1);
      console.log(`[analyze] usage — ${JSON.stringify(response.usage)}`);
      console.log(`[analyze] success — attempt ${attempt}, ${elapsed}s, confirmed_type=${result?.hypothesis?.confirmed_type}, confidence=${result?.hypothesis?.confidence_level}, outcome=${result?.hypothesis?.stage4_outcome}, flags=${result?.flags?.length ?? 0}`);
      return res.json({ ok: true, result });
    } catch (err) {
      console.error(`[analyze] attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await delay(Math.pow(2, attempt) * 1000);
    }
  }

  console.error('[analyze] all 3 attempts failed — returning fallback to client');
  return res.status(500).json({
    ok: false,
    message:
      'Your results are being prepared — check your email within 24 hours.',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Hive Typing Engine → http://localhost:${PORT}`)
);
