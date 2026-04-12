// api/humanize.js — Vercel Serverless Function
// Proxies AI API (key never exposed to browser) + saves history to Supabase

const { createClient } = require('@supabase/supabase-js');
const { OpenRouter } = require("@openrouter/sdk");

const TONE_DESC = {
  Casual:        'relaxed everyday language like texting a close friend',
  Professional:  'polished formal language suitable for business communication',
  Friendly:      'warm encouraging approachable like a helpful colleague',
  Academic:      'precise structured evidence-conscious scholarly writing',
  Storytelling:  'vivid narrative-driven with emotional depth and imagery',
  'Gen Z':       'internet-native witty casual with contemporary slang and energy',
  Persuasive:    'compelling, confident, and motivating — drives the reader to act',
  Empathetic:    'warm, understanding, and emotionally resonant — the reader feels heard',
};

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { text, tone = 'Casual', intensity = 70 } = req.body || {};

  const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!text || text.trim().length < 10)
    return res.status(400).json({ error: 'Please provide at least 10 characters.' });

  if (!OPENROUTER_KEY)
    return res.status(500).json({ error: 'Missing API key.' });

  const lvlDesc = intensity < 35 ? 'lightly touch' : intensity < 65 ? 'moderately rewrite' : intensity < 85 ? 'thoroughly rewrite' : 'completely rewrite';
  const toneHint = TONE_DESC[tone] || 'natural and conversational';
  const prompt = `You are an expert human writer. ${lvlDesc} the AI-generated text below to sound genuinely human.
Tone: ${tone} — ${toneHint}
Intensity: ${intensity}/100 — ${lvlDesc} it.
Rules:
- Strip all AI-tell phrases.
- Vary sentence lengths.
- Use natural contractions.
- Output ONLY the rewritten text. No preamble.

Text:
${text.trim()}`;

  try {
    const openrouter = new OpenRouter({ apiKey: OPENROUTER_KEY });
    
    // Using chat.send for simplicity as per user snippet spirit
    const completion = await openrouter.chat.completions.create({
      model: 'nvidia/nemotron-3-super-120b-a12b:free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7 + intensity / 400,
    });

    const outputText = completion?.choices?.[0]?.message?.content?.trim();
    if (!outputText) throw new Error('Empty response from AI.');

    // Save to Supabase
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      supabase.from('humanizations').insert({
        input_text: text,
        output_text: outputText,
        tone,
        intensity: Number(intensity),
        word_count: outputText.split(/\s+/).length
      }).catch(e => console.error(e));
    }

    return res.status(200).json({ result: outputText });

  } catch (err) {
    console.error('[humanize error]', err);
    const msg = err.message || 'Unexpected server error.';
    return res.status(500).json({ error: msg });
  }
};
