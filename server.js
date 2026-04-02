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

/** Adds profile columns if the DB predates them (PostgreSQL 11+). */
async function ensureUserProfileColumns() {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}';
    `);
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS dietary_restriction TEXT NOT NULL DEFAULT '';
    `);
  } catch (err) {
    console.warn('⚠️ Could not extend users table (run migrations/002_gated_users_saved_recipes.sql):', err.message);
  }
}

if (!OPENROUTER_API_KEY || !YOUTUBE_API) {
  console.error('❌ Missing API Keys in .env');
  process.exit(1);
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_ALLERGIES = new Set([
  'Peanuts', 'Dairy', 'Gluten', 'Shellfish', 'Soy', 'Tree Nuts'
]);

function sanitizeAllergies(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter(a => typeof a === 'string' && ALLOWED_ALLERGIES.has(a)))];
}

const ALLOWED_DIETS = new Set(['vegetarian', 'halal', 'vegan']);

function sanitizeDietaryRestriction(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim().toLowerCase();
  if (!s) return '';
  return ALLOWED_DIETS.has(s) ? s : '';
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  next();
}

async function getUserRecipeContext(userId) {
  try {
    const r = await pool.query(
      'SELECT allergies, dietary_restriction FROM users WHERE id = $1',
      [userId]
    );
    const row = r.rows[0];
    if (!row) return { allergies: [], dietary_restriction: '' };
    const a = row.allergies;
    const allergies = Array.isArray(a) ? a.filter(x => typeof x === 'string' && x.trim()) : [];
    const dietary_restriction = sanitizeDietaryRestriction(row.dietary_restriction);
    return { allergies, dietary_restriction };
  } catch {
    return { allergies: [], dietary_restriction: '' };
  }
}

/** High-priority allergy instruction prepended to recipe prompts (text + video-sync paths). */
function buildAllergySystemBlock(dishName, allergies) {
  if (!allergies.length) return '';
  const list = allergies.join(', ');
  return `SYSTEM REQUIREMENT: The user has the following allergies: ${list}. If the recipe for "${dishName}" contains any of these ingredients, you MUST provide a clear warning at the top of the recipe and explicitly list safe substitutions within the cooking steps.

`;
}

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
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static('public'));

app.post('/find-recipes', requireAuth, async (req, res) => {
  const { ingredients, cuisine } = req.body;

  const { dietary_restriction: userDiet } = await getUserRecipeContext(req.session.userId);
  const dietLine = userDiet
    ? `The user's dietary restriction (from profile): ${userDiet}. Only suggest dishes that fit this restriction.`
    : 'No specific dietary restriction on file; still avoid obviously conflicting pairings.';

  // Prompting the AI to keep names short helps our Database Cache stay consistent
  const prompt = `Suggest up to 6 popular ${cuisine} dishes using: ${ingredients}. Never list more than 6 dish names.
${dietLine}
IMPORTANT: Return ONLY a JSON array of short dish names (max 3 words each). No descriptions. The array must contain between 1 and 6 items inclusive.`;

  try {
    const aiText = await getAIResponse([{ role: 'user', content: prompt }]);
    const parsed = JSON.parse(aiText.replace(/```json|```/g, ''));
    const list = Array.isArray(parsed) ? parsed : [];
    const recipes = list
      .slice(0, 6)
      .map(entry => {
        const label = typeof entry === 'string' ? entry : entry?.name;
        return label != null && String(label).trim() ? { name: String(label).trim() } : null;
      })
      .filter(Boolean);
    res.json({ recipes: recipes.length ? recipes : [{ name: 'Vegetable Curry' }] });
  } catch (err) {
    res.status(500).json({ recipes: [{ name: "Vegetable Curry" }] });
  }
});

app.post('/explain-dish', requireAuth, async (req, res) => {
  const { dish, inputIngredients, includeVideo } = req.body;

  // Clean the dish name in case the AI added a description (e.g. "Dish Name: Description")
  const cleanName = dish.split(':')[0].split(' - ')[0].trim();

  try {
    const { allergies: userAllergies, dietary_restriction: userDiet } =
      await getUserRecipeContext(req.session.userId);
    const dietLabel = userDiet || 'none';
    const allergyBlock = buildAllergySystemBlock(cleanName, userAllergies);
    const allergyTail = userAllergies.length
      ? '\nFollow the SYSTEM REQUIREMENT above: warning at the top if needed, and safe substitutions called out in the ingredient list and numbered steps.'
      : '';

    let videoId = null;
    let message = '';

    if (includeVideo !== false) {
      // Video-first flow keeps the recipe aligned with the shown video.
      videoId = await getRecipeVideo(cleanName);
      const transcriptText = await getVideoTranscript(videoId);

      const videoPromptBody = transcriptText
        ? `You are given a YouTube recipe transcript for "${cleanName}".
Use this transcript as the PRIMARY source and create a clean, structured recipe.
Transcript:
"""${transcriptText}"""

User constraints:
- Preferred/available ingredients: ${inputIngredients || 'not specified'}
- Diet (from user profile): ${dietLabel}

Output requirements:
- Keep the method faithful to the transcript's technique and order.
- If transcript is noisy, refine wording but do not invent a different dish.
- Include: short description, ingredients list, numbered cooking steps, and practical substitutions that preserve the same recipe style.${allergyTail}`
        : `Provide a recipe for "${dish}" using ${inputIngredients}. Diet (from user profile): ${dietLabel}.
No transcript was available from the selected video, so generate a high-quality standard recipe.
Include a brief description, clear cooking steps, and smart ingredient substitutions.${allergyTail}`;

      message = await getAIResponse([{ role: 'user', content: allergyBlock + videoPromptBody }]);
    } else {
      const textPromptBody = `Provide a recipe for "${dish}" using ${inputIngredients}. Diet (from user profile): ${dietLabel}. 
Include a brief description, clear cooking steps, and smart ingredient substitutions.${allergyTail}`;

      message = await getAIResponse([{ role: 'user', content: allergyBlock + textPromptBody }]);
    }

    res.json({ message, videoId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate recipe content." });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/* AUTH (API) — bcrypt + express-session cookie                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

app.post('/api/register', async (req, res) => {
  const { name, email, password, allergies, dietary_restriction } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const allergyList = sanitizeAllergies(allergies);
  const diet = sanitizeDietaryRestriction(dietary_restriction);

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [email.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, allergies, dietary_restriction)
       VALUES ($1, $2, $3, $4::text[], $5)
       RETURNING id, name, email, allergies, dietary_restriction`,
      [name.trim(), email.toLowerCase().trim(), hashed, allergyList, diet]
    );

    const user = result.rows[0];
    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        allergies: user.allergies || [],
        dietary_restriction: user.dietary_restriction || ''
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE lower(email) = lower($1)',
      [email.trim()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        allergies: user.allergies || [],
        dietary_restriction: user.dietary_restriction || ''
      }
    });
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
    const result = await pool.query(
      'SELECT id, name, email, allergies, dietary_restriction FROM users WHERE id = $1',
      [req.session.userId]
    );
    const row = result.rows[0];
    if (!row) return res.json({ user: null });
    res.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        allergies: row.allergies || [],
        dietary_restriction: row.dietary_restriction || ''
      }
    });
  } catch {
    res.json({ user: null });
  }
});

app.patch('/api/profile', requireAuth, async (req, res) => {
  const { name, email, allergies, dietary_restriction } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const emailNorm = email.toLowerCase().trim();
  const allergyList = sanitizeAllergies(Array.isArray(allergies) ? allergies : []);
  const diet = sanitizeDietaryRestriction(
    dietary_restriction != null ? dietary_restriction : ''
  );

  try {
    const taken = await pool.query(
      'SELECT id FROM users WHERE lower(email) = lower($1) AND id <> $2',
      [emailNorm, req.session.userId]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: 'That email is already in use by another account.' });
    }

    await pool.query(
      `UPDATE users
       SET name = $1, email = $2, allergies = $3::text[], dietary_restriction = $4
       WHERE id = $5`,
      [name.trim(), emailNorm, allergyList, diet, req.session.userId]
    );

    const result = await pool.query(
      'SELECT id, name, email, allergies, dietary_restriction FROM users WHERE id = $1',
      [req.session.userId]
    );
    const row = result.rows[0];
    res.json({
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        allergies: row.allergies || [],
        dietary_restriction: row.dietary_restriction || ''
      }
    });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/* SAVED RECIPES (API) — DB only; no AI / YouTube on read                       */
/* ─────────────────────────────────────────────────────────────────────────── */

app.post('/api/save-recipe', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in to save recipes.' });
  }

  const { recipe_name, recipe_text, video_id } = req.body;
  if (!recipe_name || typeof recipe_text !== 'string') {
    return res.status(400).json({ error: 'recipe_name and recipe_text are required.' });
  }

  const name = String(recipe_name).trim();
  const vid = video_id != null && String(video_id).trim() !== '' ? String(video_id).trim() : null;

  try {
    const result = await pool.query(
      `INSERT INTO saved_recipes (user_id, recipe_name, recipe_text, video_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, recipe_name)
       DO UPDATE SET
         recipe_text = EXCLUDED.recipe_text,
         video_id = EXCLUDED.video_id,
         saved_at = NOW()
       RETURNING id`,
      [req.session.userId, name, recipe_text, vid]
    );
    res.json({ saved: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Save recipe error:', err);
    res.status(500).json({ error: 'Failed to save recipe.' });
  }
});

app.get('/api/saved-recipes', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, recipe_name, saved_at
       FROM saved_recipes
       WHERE user_id = $1
       ORDER BY saved_at DESC`,
      [req.session.userId]
    );
    res.json({ recipes: result.rows });
  } catch (err) {
    console.error('Fetch saved error:', err);
    res.status(500).json({ error: 'Failed to load saved recipes.' });
  }
});

app.get('/api/saved-recipe/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid recipe id.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, recipe_name, recipe_text, video_id
       FROM saved_recipes
       WHERE id = $1 AND user_id = $2`,
      [id, req.session.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch saved recipe error:', err);
    res.status(500).json({ error: 'Failed to load recipe.' });
  }
});

app.delete('/api/saved-recipe/:id', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid recipe id.' });
  }

  try {
    const del = await pool.query(
      'DELETE FROM saved_recipes WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.session.userId]
    );
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found.' });
    }
    res.json({ removed: true });
  } catch (err) {
    console.error('Unsave error:', err);
    res.status(500).json({ error: 'Failed to remove recipe.' });
  }
});

await ensureUserProfileColumns();
app.listen(PORT, () => {
  console.log(`🚀 PlateMate running → http://localhost:${PORT}`);
});