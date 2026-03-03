// /*
//  * Kitchen Assistant backend — OpenRouter (meta-llama/llama-3.3-8b-instruct:free)
//  * -----------------------------------------------------------------------------
//  * 1.  npm i express dotenv
//  * 2.  .env file **NOT** in source control, e.g.:
//  *        OPENROUTER_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
//  *        OR_MODEL_ID=meta-llama/llama-3.3-8b-instruct:free   # optional override
//  *        PORT=3000                                          # optional override
//  * 3.  node server.js
//  */

// import express from 'express';
// import * as dotenv from 'dotenv';
// dotenv.config();

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ENVIRONMENT                                                               */
// /* ─────────────────────────────────────────────────────────────────────────── */
// const {
//   OPENROUTER_API_KEY,
//   OR_MODEL_ID,
//   PORT
// } = process.env;

// if (!OPENROUTER_API_KEY) {
//   console.error('❌  OPENROUTER_API_KEY missing in .env');
//   process.exit(1);
// }

// const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';  // :contentReference[oaicite:0]{index=0}

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  HELPER – CALL THE OPENROUTER CHAT ENDPOINT                                */
// /* ─────────────────────────────────────────────────────────────────────────── */
// async function getAIResponse(messages) {
//   const res = await fetch(OPENROUTER_URL, {
//     method : 'POST',
//     headers: {
//       Authorization : `Bearer ${OPENROUTER_API_KEY}`,
//       'Content-Type': 'application/json'
//       // Optional leaderboard headers:
//       // 'HTTP-Referer': 'http://localhost:3000',
//       // 'X-Title'     : 'Kitchen-Assistant'
//     },
//     body: JSON.stringify({
//       model     : OR_MODEL_ID,
//       messages,
//       max_tokens: 512,          // see OpenRouter "Max Tokens" param :contentReference[oaicite:1]{index=1}
//       temperature: 0.7
//     })
//   });

//   if (!res.ok) {
//     throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
//   }

//   const data = await res.json();                    // OpenAI-style response
//   return data.choices?.[0]?.message?.content?.trim() || '';
// }

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  EXPRESS MIDDLEWARE                                                        */
// /* ─────────────────────────────────────────────────────────────────────────── */
// const app = express();
// app.use(express.json());
// app.use(express.static('public'));   // index.html, app.js, styles.css …

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ROUTE – FIND RECIPES  (demo logic)                                        */
// /* ─────────────────────────────────────────────────────────────────────────── */
// app.post('/find-recipes', (req, res) => {
//   const { ingredients = '' } = req.body;
//   const inputList = ingredients
//     .toLowerCase()
//     .split(',')
//     .map(t => t.trim())
//     .filter(Boolean);

//   // 🔸 replace with a real DB/API
//   const allRecipes = [
//     { name: 'Pasta Bolognese', required: ['pasta', 'tomato', 'beef', 'onion'] },
//     { name: 'Chicken Curry',   required: ['chicken', 'curry powder', 'onion', 'tomato'] },
//     { name: 'Fried Rice',      required: ['rice', 'egg', 'soy sauce', 'carrot'] }
//   ];

//   const matches = allRecipes.map(r => ({
//     name: r.name,
//     missingIngredients: r.required.filter(item => !inputList.includes(item))
//   }));

//   res.json({ recipes: matches });
// });

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ROUTE – EXPLAIN SELECTED DISH                                             */
// /* ─────────────────────────────────────────────────────────────────────────── */
// app.post('/explain-dish', async (req, res) => {
//   const { dish, inputIngredients = '', missingIngredients = [] } = req.body;

//   const messages = [
//     {
//       role   : 'system',
//       content: 'You are a helpful kitchen assistant.'
//     },
//     {
//       role   : 'user',
//       content: `
// Dish: ${dish}
// User has: ${inputIngredients || 'none'}
// Missing: ${missingIngredients.join(', ') || 'none'}

// Please provide:
// • A brief dish description
// • Clear cooking steps
// • Smart substitutions for vegetarian alternative of the dish`
// .trim()
//     }
//   ];

//   try {
//     const aiText = await getAIResponse(messages);
//     res.json({ message: aiText });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error generating AI response.' });
//   }
// });

// /* ─────────────────────────────────────────────────────────────────────────── */
// app.listen(PORT, () => {
//   console.log(`🚀  Kitchen Assistant running → http://localhost:${PORT}`);
// });





// import express from 'express';
// import * as dotenv from 'dotenv';
// // For Node <18 you may need: import fetch from 'node-fetch';

// dotenv.config();

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ENVIRONMENT                                                               */
// /* ─────────────────────────────────────────────────────────────────────────── */
// const {
//   OPENROUTER_API_KEY,
//   OR_MODEL_ID,
//   PORT = 3000,
//   GOOGLE_CSE_API_KEY,
//   GOOGLE_CSE_CX
// } = process.env;

// if (!OPENROUTER_API_KEY) {
//   console.error('❌  OPENROUTER_API_KEY missing in .env');
//   process.exit(1);
// }
// if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX) {
//   console.error('❌  GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX missing in .env');
//   process.exit(1);
// }

// const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  HELPER – CALL OPENROUTER CHAT ENDPOINT                                     */
// /* ─────────────────────────────────────────────────────────────────────────── */
// async function getAIResponse(messages) {
//   const res = await fetch(OPENROUTER_URL, {
//     method : 'POST',
//     headers: {
//       Authorization : `Bearer ${OPENROUTER_API_KEY}`,
//       'Content-Type': 'application/json'
//     },
//     body: JSON.stringify({
//       model      : OR_MODEL_ID,
//       messages,
//       max_tokens : 512,
//       temperature: 0.7
//     })
//   });

//   if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
//   const data = await res.json();
//   return data.choices?.[0]?.message?.content?.trim() || '';
// }

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  HELPER – GOOGLE CSE SEARCH                                                */
// /* ─────────────────────────────────────────────────────────────────────────── */
// async function searchDishes({ ingredients = '', diet = 'non-veg', cuisine = 'indian' }) {
//   const dietKeyword = diet === 'vegan' ? 'vegan' : (diet === 'veg' ? 'vegetarian' : '');

//   // Build a textual query for the Custom Search API
//   const queryParts = [cuisine, dietKeyword, 'dishes'];
//   if (ingredients) queryParts.push(ingredients.replace(/\s*,\s*/g, ' '));

//   const query = queryParts.filter(Boolean).join(' ').trim();

//   const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_CX}&num=10&q=${encodeURIComponent(query)}`;
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(`Google CSE ${res.status}: ${await res.text()}`);

//   const json = await res.json();
//   const titles = (json.items || []).map(i => i.title);

//   // Clean up titles → probable dish names. Remove trailing site / keyword noise.
//   const dishNames = titles.map(t =>
//     t.replace(/(\s*-\s*recipe.*|\s*\|.*)$/i, '').trim()
//   );

//   // De‑duplicate and limit to 10
//   const unique = [...new Set(dishNames)].slice(0, 10);
//   return unique.map(name => ({ name, missingIngredients: [] }));
// }

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  EXPRESS APP SETUP                                                         */
// /* ─────────────────────────────────────────────────────────────────────────── */
// const app = express();
// app.use(express.json());
// app.use(express.static('public'));   // index.html, app.js, styles.css …

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ROUTE – FIND RECIPES (GOOGLE CSE)                                         */
// /* ─────────────────────────────────────────────────────────────────────────── */
// app.post('/find-recipes', async (req, res) => {
//   const {
//     ingredients = '',
//     diet = 'non-veg',
//     cuisine = 'indian',
//     people = 1
//   } = req.body;

//   try {
//     const recipes = await searchDishes({ ingredients, diet, cuisine });
//     res.json({ recipes, people });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching recipes.' });
//   }
// });

// /* ─────────────────────────────────────────────────────────────────────────── */
// /*  ROUTE – EXPLAIN SELECTED DISH                                             */
// /* ─────────────────────────────────────────────────────────────────────────── */
// app.post('/explain-dish', async (req, res) => {
//   const { dish, inputIngredients = '', missingIngredients = [] } = req.body;

//   const messages = [
//     { role: 'system', content: 'You are a helpful kitchen assistant.' },
//     {
//       role   : 'user',
//       content: `Dish: ${dish}\nUser has: ${inputIngredients || 'none'}\nMissing: ${missingIngredients.join(', ') || 'none'}\n\nPlease provide:\n• A brief dish description\n• Clear cooking steps\n• Smart substitutions for a vegetarian alternative of the dish`
//     }
//   ];

//   try {
//     const aiText = await getAIResponse(messages);
//     res.json({ message: aiText });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error generating AI response.' });
//   }
// });

// /* ─────────────────────────────────────────────────────────────────────────── */
// app.listen(PORT, () => {
//   console.log(`🚀  Kitchen Assistant running → http://localhost:${PORT}`);
// });







import express from 'express';
import * as dotenv from 'dotenv';
// For Node <18, you may need: import fetch from 'node-fetch';

dotenv.config();

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ENVIRONMENT                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
const {
  OPENROUTER_API_KEY,
  OR_MODEL_ID,
  PORT = 3000,
  GOOGLE_CSE_API_KEY,
  GOOGLE_CSE_CX,
  DISH_EXTRACT_URL = 'http://localhost:5000/extract-dishes' // Python micro‑service
} = process.env;

if (!OPENROUTER_API_KEY) {
  console.error('❌  OPENROUTER_API_KEY missing in .env');
  process.exit(1);
}
if (!GOOGLE_CSE_API_KEY || !GOOGLE_CSE_CX) {
  console.error('❌  GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX missing in .env');
  process.exit(1);
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPER – CALL OPENROUTER CHAT ENDPOINT                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
async function getAIResponse(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model      : OR_MODEL_ID,
      messages,
      max_tokens : 512,
      temperature: 0.7
    })
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPER – GOOGLE CSE SEARCH                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
async function googleSearchTitles({ ingredients = '', diet = 'non-veg', cuisine = 'indian' }) {
  const dietKeyword = diet === 'vegan' ? 'vegan' : (diet === 'veg' ? 'vegetarian' : '');
  const queryParts  = [cuisine, dietKeyword, 'recipes', ingredients.replace(/\s*,\s*/g, ' ')];
  const query       = queryParts.filter(Boolean).join(' ').trim();

  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_CSE_API_KEY}&cx=${GOOGLE_CSE_CX}&num=10&q=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google CSE ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.items || []).map(i => i.title);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPER – CALL PYTHON NLP SERVICE TO EXTRACT DISH NAMES                    */
/* ─────────────────────────────────────────────────────────────────────────── */
async function extractDishNames(titles) {
  try {
    const res = await fetch(DISH_EXTRACT_URL, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ titles })
    });
    if (!res.ok) throw new Error(`Dish‑extract ${res.status}: ${await res.text()}`);
    return await res.json(); // expects array of names
  } catch (err) {
    console.error('⚠️  NLP service failed, falling back to regex:', err.message);
    return titles.map(t => t.split(/[-–|:•]/)[0].trim());
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPER – NORMALISATION & DEDUP                                            */
/* ─────────────────────────────────────────────────────────────────────────── */
function normalise(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, '').trim();
}

function uniqueTrimmed(dishNames) {
  const unique = [];

  for (let raw of dishNames) {
    if (!raw) continue;

    // Enforce ≤3 words
    const words = raw.split(/\s+/).filter(Boolean).slice(0, 3);
    if (words.length === 0) continue;
    const candidate = words.join(' ');

    const candSet = new Set(words.map(w => w.toLowerCase()));
    let duplicateIndex = -1;

    for (let i = 0; i < unique.length; i++) {
      const existWords = unique[i].toLowerCase().split(/\s+/);
      const existSet   = new Set(existWords);

      // Equivalent if every word in the shorter is in the longer
      const shorterSet = candSet.size <= existSet.size ? candSet : existSet;
      const longerSet  = candSet.size >  existSet.size ? candSet : existSet;
      const equivalent = [...shorterSet].every(w => longerSet.has(w));

      if (equivalent) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex === -1) {
      unique.push(candidate);
    } else {
      // Keep the shorter of the two equivalents
      if (candidate.split(' ').length < unique[duplicateIndex].split(' ').length) {
        unique[duplicateIndex] = candidate;
      }
    }

    if (unique.length === 10) break; // Stop once we hit 10 unique dishes
  }

  return unique.slice(0, 10);
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  HELPER – HIGH‑LEVEL SEARCH FUNCTION                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
async function searchDishes({ ingredients, diet, cuisine }) {
  const titles    = await googleSearchTitles({ ingredients, diet, cuisine });
  const extracted = await extractDishNames(titles);
  const cleaned   = uniqueTrimmed(extracted);
  return cleaned.map(name => ({ name, missingIngredients: [] }));
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  EXPRESS APP SETUP                                                         */
/* ─────────────────────────────────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use(express.static('public')); // index.html, app.js, styles.css …

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ROUTE – FIND RECIPES                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */
app.post('/find-recipes', async (req, res) => {
  const { ingredients = '', diet = 'non-veg', cuisine = 'indian', people = 1 } = req.body;

  try {
    const recipes = await searchDishes({ ingredients, diet, cuisine });
    res.json({ recipes, people });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching recipes.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ROUTE – EXPLAIN SELECTED DISH                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
app.post('/explain-dish', async (req, res) => {
  const { dish, inputIngredients = '', missingIngredients = [] } = req.body;

  const messages = [
    { role: 'system', content: 'You are a helpful kitchen assistant.' },
    {
      role   : 'user',
      content: `Dish: ${dish}\nUser has: ${inputIngredients || 'none'}\nMissing: ${missingIngredients.join(', ') || 'none'}\n\nPlease provide:\n• A brief dish description\n• Clear cooking steps\n• Smart substitutions for a vegetarian alternative of the dish`
    }
  ];

  try {
    const aiText = await getAIResponse(messages);
    res.json({ message: aiText });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating AI response.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`🚀  Kitchen Assistant running → http://localhost:${PORT}`);
});
