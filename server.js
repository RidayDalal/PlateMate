import express from 'express';
import * as dotenv from 'dotenv';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import pkg from 'pg';
import * as youtubeTranscript from 'youtube-transcript/dist/youtube-transcript.esm.js';
const { Pool } = pkg;

dotenv.config();

/* ─────────────────────────────────────────────────────────────────────────── */
/* ENVIRONMENT & DATABASE SETUP                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
const {
  OPENROUTER_API_KEY,
  YOUTUBE_API,
  OR_MODEL_ID = 'google/gemma-3n-e4b-it:free',
  PORT = 3000,
  DB_USER = 'postgres',
  DB_PASSWORD = 'your_password',
  DB_HOST = 'localhost',
  DB_DATABASE = 'platemate',
  SESSION_SECRET = 'platemate-fallback-secret'
} = process.env;

const pool = new Pool({
  user: DB_USER,
  host: DB_HOST,
  database: DB_DATABASE,
  password: DB_PASSWORD,
  port: 5432,
});

if (!OPENROUTER_API_KEY || !YOUTUBE_API) {
  console.error('❌ Missing API Keys in .env');
  process.exit(1);
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

function parseYouTubeDurationToSeconds(isoDuration = '') {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

/* ── HELPER: YouTube Fetch with Postgres Cache & Optimized Query ─────────── */
async function getRecipeVideo(dishName) {
  try {
    // 1. Check Cache (Use cleaned name)
    const dbRes = await pool.query('SELECT video_id FROM recipe_requests WHERE recipe_name = $1', [dishName]);
    if (dbRes.rows.length > 0 && dbRes.rows[0].video_id) {
      console.log(`📦 Cache Hit: ${dishName}`);
      return dbRes.rows[0].video_id;
    }

    // 2. Fetch from YouTube with Optimized "Step-by-Step" query
    console.log(`🔍 YouTube API Fetch for: ${dishName}`);
    const searchQuery = encodeURIComponent(`${dishName} recipe step by step tutorial`);
    
    // videoEmbeddable=true ensures the video can actually be played in your <iframe>
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&key=${YOUTUBE_API}&maxResults=8&type=video&videoEmbeddable=true&videoDuration=medium`
    );
    
    const data = await ytRes.json();
    const candidateIds = (data.items || [])
      .map(item => item?.id?.videoId)
      .filter(Boolean);

    if (candidateIds.length === 0) return null;

    const detailsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${candidateIds.join(',')}&key=${YOUTUBE_API}`
    );
    const detailsData = await detailsRes.json();

    const MIN_VIDEO_SECONDS = 4 * 60;
    const videoId = (detailsData.items || [])
      .find(item => parseYouTubeDurationToSeconds(item?.contentDetails?.duration) > MIN_VIDEO_SECONDS)
      ?.id || null;

    if (videoId) {
      // 3. Save to Cache (Using UPSERT logic)
      await pool.query(
        `INSERT INTO recipe_requests (recipe_name, video_id) 
         VALUES ($1, $2) 
         ON CONFLICT (recipe_name) DO UPDATE SET video_id = EXCLUDED.video_id`,
        [dishName, videoId]
      );
    }
    return videoId;
  } catch (err) {
    console.error('⚠️ Video helper error:', err.message);
    return null;
  }
}

/* ── HELPER: AI Response ─────────────────────────────────────────────────── */
async function getAIResponse(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: OR_MODEL_ID, messages, max_tokens: 1000, temperature: 0.7 })
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

async function getVideoTranscript(videoId) {
  if (!videoId) return '';

  try {
    const transcript = await youtubeTranscript.fetchTranscript(videoId);
    if (!Array.isArray(transcript) || transcript.length === 0) return '';

    // Keep token usage predictable while preserving step-level context.
    return transcript
      .map(line => line.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  } catch (err) {
    console.warn(`⚠️ Transcript unavailable for ${videoId}:`, err.message);
    return '';
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* EXPRESS ROUTES                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));

app.post('/find-recipes', async (req, res) => {
  const { ingredients, diet, cuisine } = req.body;
  
  // Prompting the AI to keep names short helps our Database Cache stay consistent
  const prompt = `Suggest 5-8 popular ${cuisine} dishes using: ${ingredients}. Diet: ${diet}. 
  IMPORTANT: Return ONLY a JSON array of short dish names (max 3 words each). No descriptions.`;

  try {
    const aiText = await getAIResponse([{ role: 'user', content: prompt }]);
    const recipes = JSON.parse(aiText.replace(/```json|```/g, '')).map(name => ({ name }));
    res.json({ recipes });
  } catch (err) {
    res.status(500).json({ recipes: [{ name: "Vegetable Curry" }] });
  }
});

app.post('/explain-dish', async (req, res) => {
  const { dish, inputIngredients, diet, includeVideo } = req.body;

  // Clean the dish name in case the AI added a description (e.g. "Dish Name: Description")
  const cleanName = dish.split(':')[0].split(' - ')[0].trim();

  try {
    let videoId = null;
    let message = '';

    if (includeVideo !== false) {
      // Video-first flow keeps the recipe aligned with the shown video.
      videoId = await getRecipeVideo(cleanName);
      const transcriptText = await getVideoTranscript(videoId);

      const videoPrompt = transcriptText
        ? `You are given a YouTube recipe transcript for "${cleanName}".
Use this transcript as the PRIMARY source and create a clean, structured recipe.
Transcript:
"""${transcriptText}"""

User constraints:
- Preferred/available ingredients: ${inputIngredients || 'not specified'}
- Diet: ${diet || 'none'}

Output requirements:
- Keep the method faithful to the transcript's technique and order.
- If transcript is noisy, refine wording but do not invent a different dish.
- Include: short description, ingredients list, numbered cooking steps, and practical substitutions that preserve the same recipe style.`
        : `Provide a recipe for "${dish}" using ${inputIngredients}. Diet: ${diet}.
No transcript was available from the selected video, so generate a high-quality standard recipe.
Include a brief description, clear cooking steps, and smart ingredient substitutions.`;

      message = await getAIResponse([{ role: 'user', content: videoPrompt }]);
    } else {
      message = await getAIResponse([{
        role: 'user',
        content: `Provide a recipe for "${dish}" using ${inputIngredients}. Diet: ${diet}. 
        Include a brief description, clear cooking steps, and smart ingredient substitutions.`
      }]);
    }

    res.json({ message, videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate recipe content." });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/* AUTH ROUTES                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name.trim(), email.toLowerCase().trim(), hashed]
    );

    const user = result.rows[0];
    req.session.userId = user.id;
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

app.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ user: null });
  }
  try {
    const result = await pool.query('SELECT id, name, email FROM users WHERE id = $1', [req.session.userId]);
    res.json({ user: result.rows[0] || null });
  } catch {
    res.json({ user: null });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/* SAVED RECIPES ROUTES                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

app.post('/save-recipe', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to save recipes.' });
  }

  const { recipe_name } = req.body;
  if (!recipe_name) return res.status(400).json({ error: 'Recipe name is required.' });

  try {
    await pool.query(
      `INSERT INTO saved_recipes (user_id, recipe_name)
       VALUES ($1, $2) ON CONFLICT (user_id, recipe_name) DO NOTHING`,
      [req.session.userId, recipe_name.trim()]
    );
    res.json({ saved: true });
  } catch (err) {
    console.error('Save recipe error:', err);
    res.status(500).json({ error: 'Failed to save recipe.' });
  }
});

app.delete('/save-recipe', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  const { recipe_name } = req.body;
  try {
    await pool.query(
      'DELETE FROM saved_recipes WHERE user_id = $1 AND recipe_name = $2',
      [req.session.userId, recipe_name.trim()]
    );
    res.json({ removed: true });
  } catch (err) {
    console.error('Unsave error:', err);
    res.status(500).json({ error: 'Failed to remove recipe.' });
  }
});

app.get('/saved-recipes', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, recipe_name, saved_at FROM saved_recipes WHERE user_id = $1 ORDER BY saved_at DESC',
      [req.session.userId]
    );
    res.json({ recipes: result.rows });
  } catch (err) {
    console.error('Fetch saved error:', err);
    res.status(500).json({ error: 'Failed to load saved recipes.' });
  }
});

app.get('/is-saved', async (req, res) => {
  if (!req.session.userId) return res.json({ saved: false });

  const { recipe_name } = req.query;
  try {
    const result = await pool.query(
      'SELECT id FROM saved_recipes WHERE user_id = $1 AND recipe_name = $2',
      [req.session.userId, recipe_name]
    );
    res.json({ saved: result.rows.length > 0 });
  } catch {
    res.json({ saved: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PlateMate running → http://localhost:${PORT}`);
});