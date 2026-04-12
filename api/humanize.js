// api/humanize.js — Vercel Serverless Function
// Proxies AI API (key never exposed to browser) + saves history to Supabase

const { createClient } = require('@supabase/supabase-js');

const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  // CORS headers (allow Vercel preview URLs + production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { text, tone = 'Casual', intensity = 70 } = req.body || {};

  if (!text || typeof text !== 'string' || text.trim().length < 10)
    return res.status(400).json({ error: 'Please provide at least 10 characters of text.' });

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount > 5000)
    return res.status(400).json({ error: `Text too long (${wordCount} words). Maximum is 5,000.` });

  if (!GEMINI_KEY)
    return res.status(500).json({ error: 'Server misconfiguration: missing API key.' });

  const lvlDesc =
    intensity < 35 ? 'lightly touch' :
    intensity < 65 ? 'moderately rewrite' :
    intensity < 85 ? 'thoroughly rewrite' : 'completely rewrite';

  const toneHint = TONE_DESC[tone] || 'natural and conversational';

  const prompt = `You are an expert human writer. ${lvlDesc} the AI-generated text below to sound genuinely human.
Tone: ${tone} — ${toneHint}
Intensity: ${intensity}/100 — ${lvlDesc} it.
Rules:
- Strip all AI-tell phrases: "Certainly!", "As an AI", "It is important to note", "In conclusion", "Furthermore", "Moreover", "It's worth noting", "Absolutely!", "Great question!".
- Vary sentence lengths. Mix short punchy sentences with longer flowing ones.
- Use natural contractions where the tone allows (you're, it's, don't, we've).
- Convert bullet lists into smooth readable prose paragraphs.
- Preserve ALL original facts, data, and meaning — never invent or add anything.
- Output ONLY the rewritten text. No preamble. No commentary. No explanations.

Text:
${text.trim()}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7 + intensity / 400,
            topP: 0.95,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({}));
      const msg = errBody?.error?.message || `AI service error (${geminiRes.status})`;
      return res.status(geminiRes.status).json({ error: msg });
    }

    const data       = await geminiRes.json();
    const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!outputText)
      return res.status(500).json({ error: 'Empty response from AI. Please try again.' });

    // Save to Supabase (non-blocking — don't fail the request if DB write fails)
    if (SUPABASE_URL && SUPABASE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      supabase.from('humanizations').insert({
        input_text:  text.trim(),
        output_text: outputText,
        tone,
        intensity:   Number(intensity),
        word_count:  outputText.split(/\s+/).filter(Boolean).length,
      }).then(({ error }) => {
        if (error) console.error('[Supabase insert error]', error.message);
      });
    }

    return res.status(200).json({ result: outputText });

  } catch (err) {
    console.error('[humanize error]', err);
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
};
