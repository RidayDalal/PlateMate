/* 1.  SEARCH FOR RECIPES  */
const ingredientsEl   = document.getElementById('ingredients');
const ingredientsError = document.getElementById('ingredientsError');

// ── Ingredient validation ──────────────────────────────────────────────────
ingredientsEl.addEventListener('input', () => {
  if (ingredientsEl.value.trim()) {
    ingredientsEl.classList.remove('input-error');
    ingredientsError.classList.add('hidden');
  }
});

// ── Dietary restriction toggle pills (single-select, deselectable) ─────────
document.querySelectorAll('.diet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const isAlreadySelected = btn.classList.contains('selected');
    document.querySelectorAll('.diet-btn').forEach(b => b.classList.remove('selected'));
    if (!isAlreadySelected) btn.classList.add('selected');
  });
});

document.getElementById('searchBtn').addEventListener('click', () => {
  const ingredients = ingredientsEl.value.trim();

  if (!ingredients) {
    ingredientsEl.classList.add('input-error');
    ingredientsError.classList.remove('hidden');
    ingredientsEl.focus();
    return;
  }

  ingredientsError.classList.add('hidden');
  ingredientsEl.classList.remove('input-error');

  const selectedDiet    = document.querySelector('.diet-btn.selected')?.dataset.value || '';
  const selectedCuisine = document.getElementById('cuisineSelect').value;
  const selectedPeople  = document.getElementById('peopleCount').value;
  const requestData = {
      ingredients,
      diet: selectedDiet,
      cuisine: selectedCuisine,
      people: selectedPeople
    };
  
fetch('/find-recipes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestData)
})
  .then(response => response.json())
  .then(data => displayRecipes(data.recipes))
  .catch(error => console.error('Error:', error));
});

/* 2.  RENDER RECIPE CARDS  */
function displayRecipes(recipes) {
  const list = document.getElementById('recipesList');
  list.innerHTML = '';

  recipes.forEach((r, index) => {
      const card = document.createElement('div');
      card.className = 'recipe-item';
      card.textContent = r.name;
      
      // Add a fade-in effect via inline style or CSS animation
      card.style.opacity = '0';
      card.style.transform = 'translateY(10px)';
      card.style.transition = `all 0.3s ease ${index * 0.1}s`;

      card.addEventListener('click', () => handleDishClick(r.name, r.missingIngredients || []));
      list.appendChild(card);

      // Trigger the animation
      setTimeout(() => {
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
      }, 50);
  });
}

/* 3.  FORMAT AI TEXT INTO STRUCTURED HTML  */
function formatRecipeContent(text) {
  const lines = text.split('\n');
  let html = '';
  let inBulletList = false;

  const closeBulletList = () => {
    if (inBulletList) { html += '</ul>'; inBulletList = false; }
  };

  const styleLine = (line) =>
    line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

  for (let raw of lines) {
    const line = raw.trim();

    if (!line) {
      closeBulletList();
      continue;
    }

    // Markdown-style headings
    if (/^#{1,3}\s/.test(line)) {
      closeBulletList();
      const txt = styleLine(line.replace(/^#{1,3}\s/, ''));
      html += `<h3 class="rc-heading">${txt}</h3>`;
      continue;
    }

    // Plain-text section labels ending with ":"
    if (/^[A-Z][^:]{2,50}:$/.test(line)) {
      closeBulletList();
      html += `<h3 class="rc-heading">${styleLine(line)}</h3>`;
      continue;
    }

    // Numbered steps  e.g.  "1. Heat the pan"
    if (/^\d+[\.\)]\s/.test(line)) {
      closeBulletList();
      const num = line.match(/^(\d+)/)[1];
      const txt = styleLine(line.replace(/^\d+[\.\)]\s/, ''));
      html += `<div class="rc-step"><span class="rc-step-num">${num}</span><span>${txt}</span></div>`;
      continue;
    }

    // Bullet points  •  -  *
    if (/^[•\-\*]\s/.test(line)) {
      if (!inBulletList) { html += '<ul class="rc-list">'; inBulletList = true; }
      const txt = styleLine(line.replace(/^[•\-\*]\s/, ''));
      html += `<li>${txt}</li>`;
      continue;
    }

    // Regular paragraph
    closeBulletList();
    html += `<p class="rc-para">${styleLine(line)}</p>`;
  }

  closeBulletList();
  return html;
}

/* 4.  WHEN A DISH IS CLICKED, OPEN RESULT IN NEW TAB  */
function handleDishClick(dishName, missingIngredients) {
  const userIngredients = document.getElementById('ingredients').value;

  const win = window.open('', '_blank');

  // ── Loading screen ───────────────────────────────────────────────────────
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Loading ${dishName}… — PlateMate</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', sans-serif;
      background: #FDFAF6;
      color: #1e1e2e;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
    }
    .logo { font-size: 1.5rem; font-weight: 800; color: #C4573A; letter-spacing: -0.5px; }
    .spinner {
      width: 52px; height: 52px;
      border: 4px solid #EDE0D8;
      border-top-color: #C4573A;
      border-radius: 50%;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-dish { font-size: 1.2rem; font-weight: 700; color: #1e1e2e; }
    .loading-sub  { font-size: 0.875rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="logo">PlateMate</div>
  <div class="spinner"></div>
  <div class="loading-dish">Plating your ${dishName}…</div>
  <div class="loading-sub">AI is crafting your personalised recipe</div>
</body>
</html>`);
  win.document.close();

  // ── Fetch recipe ─────────────────────────────────────────────────────────
  const activeDiet = document.querySelector('.diet-btn.selected')?.dataset.value || '';

  fetch('/explain-dish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dish: dishName, inputIngredients: userIngredients, missingIngredients, diet: activeDiet })
  })
  .then(r => r.json())
  .then(({ message }) => {
    const formattedContent = formatRecipeContent(message);

    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${dishName} — PlateMate</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      background: #FDFAF6;
      color: #1e1e2e;
      min-height: 100vh;
    }

    /* ── Top bar ── */
    .topbar {
      position: sticky; top: 0; z-index: 10;
      background: rgba(255,255,255,0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #EDE0D8;
      display: flex; align-items: center;
      padding: 0.9rem 2rem; gap: 1rem;
    }
    .topbar-logo { font-size: 1.25rem; font-weight: 800; color: #C4573A; letter-spacing: -0.5px; }
    .topbar-sep  { color: #D4846A; font-size: 1.1rem; }
    .topbar-dish { font-size: 0.95rem; font-weight: 600; color: #475569; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .back-btn {
      margin-left: auto;
      background: none; border: 1.5px solid #D4846A;
      color: #C4573A; font-family: inherit; font-weight: 600;
      font-size: 0.8rem; padding: 0.35rem 0.9rem;
      border-radius: 999px; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .back-btn:hover { background: #C4573A; color: #fff; }

    /* ── Hero ── */
    .hero {
      background: linear-gradient(135deg, #C4573A 0%, #A83D22 100%);
      padding: 3.5rem 2rem 3rem;
      text-align: center;
      animation: fadeDown 0.5s ease both;
    }
    .hero-label {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      color: #fff; font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.25rem 0.75rem; border-radius: 999px;
      margin-bottom: 1rem;
    }
    .hero h1 {
      font-size: clamp(1.8rem, 5vw, 2.8rem);
      font-weight: 800; color: #fff;
      letter-spacing: -0.5px; line-height: 1.15;
    }

    /* ── Content wrapper ── */
    .page { max-width: 740px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }

    /* ── Recipe card ── */
    .recipe-card {
      background: #fff;
      border: 1px solid #EDE0D8;
      border-radius: 18px;
      padding: 2rem 2.25rem;
      box-shadow: 0 4px 24px rgba(196,87,58,0.07);
      animation: fadeUp 0.45s ease 0.1s both;
    }

    /* ── Content elements ── */
    .rc-heading {
      font-size: 1rem; font-weight: 700;
      color: #C4573A;
      margin: 1.6rem 0 0.6rem;
      padding-bottom: 0.4rem;
      border-bottom: 2px solid #EDE0D8;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .rc-heading:first-child { margin-top: 0; }

    .rc-para {
      font-size: 0.95rem; line-height: 1.75;
      color: #475569; margin-bottom: 0.6rem;
    }

    .rc-list {
      list-style: none; padding: 0;
      display: flex; flex-direction: column; gap: 0.45rem;
      margin-bottom: 0.6rem;
    }
    .rc-list li {
      display: flex; align-items: flex-start; gap: 0.6rem;
      font-size: 0.93rem; line-height: 1.65; color: #475569;
    }
    .rc-list li::before {
      content: '';
      flex-shrink: 0;
      width: 7px; height: 7px;
      background: #C4573A;
      border-radius: 50%;
      margin-top: 0.5rem;
    }

    .rc-step {
      display: flex; align-items: flex-start; gap: 0.85rem;
      padding: 0.75rem 1rem;
      margin-bottom: 0.5rem;
      background: #FDFAF6;
      border-radius: 10px;
      border-left: 3px solid #C4573A;
      font-size: 0.93rem; line-height: 1.65; color: #334155;
    }
    .rc-step-num {
      flex-shrink: 0;
      width: 24px; height: 24px;
      background: #C4573A; color: #fff;
      border-radius: 50%;
      font-size: 0.72rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      margin-top: 0.1rem;
    }

    /* ── Animations ── */
    @keyframes fadeDown {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Footer ── */
    .footer {
      text-align: center; padding: 1.5rem;
      font-size: 0.78rem; color: #94a3b8;
    }
    .footer span { color: #C4573A; font-weight: 600; }
  </style>
</head>
<body>

  <nav class="topbar">
    <span class="topbar-logo">PlateMate</span>
    <span class="topbar-sep">›</span>
    <span class="topbar-dish">${dishName}</span>
    <button class="back-btn" onclick="window.close()">✕ Close</button>
  </nav>

  <div class="hero">
    <div class="hero-label">AI Recipe</div>
    <h1>${dishName}</h1>
  </div>

  <div class="page">
    <div class="recipe-card">
      ${formattedContent}
    </div>
  </div>

  <div class="footer">Crafted for you by <span>PlateMate AI</span></div>

</body>
</html>`);
    win.document.close();
  })
  .catch(err => {
    console.error('Error:', err);
    win.document.body.innerHTML = `
      <div style="font-family:Inter,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;background:#FDFAF6;">
        <div style="font-size:1.5rem;font-weight:800;color:#C4573A;">PlateMate</div>
        <div style="font-size:1rem;color:#C4573A;font-weight:600;">Failed to load recipe. Please try again.</div>
        <button onclick="window.close()" style="padding:0.5rem 1.5rem;background:#C4573A;color:#fff;border:none;border-radius:999px;font-size:0.9rem;cursor:pointer;">Close</button>
      </div>`;
  });
}

document.getElementById('plusBtn').addEventListener('click', () => {
  const countEl = document.getElementById('peopleCount');
  countEl.textContent = parseInt(countEl.textContent, 10) + 1;
});

document.getElementById('minusBtn').addEventListener('click', () => {
  const countEl = document.getElementById('peopleCount');
  const current = parseInt(countEl.textContent, 10);
  if (current > 1) countEl.textContent = current - 1;
});
