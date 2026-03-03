import express from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

/* ─────────────────────────────────────────────────────────────────────────── */
/* ENVIRONMENT                                                                */
/* ─────────────────────────────────────────────────────────────────────────── */
const {
  OPENROUTER_API_KEY,
  OR_MODEL_ID,
  PORT = 3000
} = process.env;

// Only checking for the OpenRouter key now
if (!OPENROUTER_API_KEY) {
  console.error('❌  OPENROUTER_API_KEY missing in .env');
  process.exit(1);
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPER – CALL OPENROUTER CHAT ENDPOINT                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
async function getAIResponse(messages) {
  const res = await fetch(OPENROUTER_URL, {
    method : 'POST',
    headers: {
      Authorization : `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model      : OR_MODEL_ID || 'google/gemini-2.0-flash-001', // Defaulting to a fast model
      messages,
      max_tokens : 1000,
      temperature: 0.7
    })
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* HELPER – AI DISH GENERATION (Replaces Google Search)                       */
/* ─────────────────────────────────────────────────────────────────────────── */
async function searchDishes({ ingredients, diet, cuisine }) {
  // Combine rules and user data into one string
  const combinedPrompt = `You are a culinary expert. 
  Suggest 5 to 8 popular ${cuisine} ${diet} dishes that can be made using: ${ingredients}. 
  
  IMPORTANT: Return ONLY a raw JSON array of strings. No prose, no backticks. 
  Example: ["Paneer Butter Masala", "Dal Tadka"]`;

  const messages = [
    { role: 'user', content: combinedPrompt }
  ];

  try {
    const aiText = await getAIResponse(messages);
    const cleanedText = aiText.replace(/```json|```/g, '').trim();
    const dishNames = JSON.parse(cleanedText); 
    
    return dishNames.map(name => ({ name, missingIngredients: [] }));
  } catch (err) {
    console.error('⚠️ AI Generation failed:', err.message);
    return [{ name: "Vegetable Curry", missingIngredients: [] }];
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* EXPRESS APP SETUP                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
const app = express();
app.use(express.json());
app.use(express.static('public')); 

/* ─────────────────────────────────────────────────────────────────────────── */
/* ROUTE – FIND RECIPES                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
app.post('/find-recipes', async (req, res) => {
  const { ingredients = '', diet = 'non-veg', cuisine = 'indian', people = 1 } = req.body;

  try {
    const recipes = await searchDishes({ ingredients, diet, cuisine });
    res.json({ recipes, people });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating recipe suggestions.' });
  }
});

/* ─────────────────────────────────────────────────────────────────────────── */
/* ROUTE – EXPLAIN SELECTED DISH                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
app.post('/explain-dish', async (req, res) => {
  const { dish, inputIngredients = '' } = req.body;

  const messages = [
    {
      role: 'user',
      content: `Act as a helpful kitchen assistant. 
      For the dish "${dish}", the user has these ingredients: ${inputIngredients || 'none'}.
      
      Please provide:
      • A brief description
      • Clear cooking steps
      • Smart substitutions for a vegetarian alternative`
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
  console.log(`🚀  PlateMate running → http://localhost:${PORT}`);
});