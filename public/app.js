/* ─────────────────────────────────────────────────────────────────────────── */
/* AUTH STATE                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
let currentUser = null;

async function checkAuth() {
  try {
    const res = await fetch('/me');
    const { user } = await res.json();
    currentUser = user;
    updateAuthUI();
  } catch { currentUser = null; updateAuthUI(); }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const userMenu = document.getElementById('userMenu');

  if (currentUser) {
    loginBtn.classList.add('hidden');
    userMenu.classList.remove('hidden');
    document.getElementById('userAvatar').src =
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`;
    document.getElementById('menuUserName').textContent = currentUser.name;
  } else {
    loginBtn.classList.remove('hidden');
    userMenu.classList.add('hidden');
  }
}

checkAuth();

/* ── Auth Modal ── */
const authModal    = document.getElementById('authModal');
const authTitle    = document.getElementById('authTitle');
const authSubmit   = document.getElementById('authSubmit');
const authToggle   = document.getElementById('authToggle');
const authToggleText = document.getElementById('authToggleText');
const authError    = document.getElementById('authError');
const nameField    = document.getElementById('nameField');
let isRegister = false;

function setAuthMode(register) {
  isRegister = register;
  authTitle.textContent = register ? 'Create Account' : 'Log In';
  authSubmit.textContent = register ? 'Sign Up' : 'Log In';
  authToggleText.textContent = register ? 'Already have an account?' : "Don't have an account?";
  authToggle.textContent = register ? 'Log In' : 'Sign Up';
  nameField.classList.toggle('hidden', !register);
  authError.classList.add('hidden');
}

document.getElementById('loginBtn').addEventListener('click', () => {
  setAuthMode(false);
  authModal.showModal();
});

authToggle.addEventListener('click', () => setAuthMode(!isRegister));

document.getElementById('authModalClose').addEventListener('click', () => authModal.close());

authSubmit.addEventListener('click', async () => {
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name     = document.getElementById('authName').value.trim();

  if (!email || !password || (isRegister && !name)) {
    authError.textContent = 'Please fill in all fields.';
    authError.classList.remove('hidden');
    return;
  }

  const url  = isRegister ? '/register' : '/login';
  const body = isRegister ? { name, email, password } : { email, password };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      authError.textContent = data.error;
      authError.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    updateAuthUI();
    authModal.close();

    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authName').value = '';
  } catch {
    authError.textContent = 'Something went wrong. Please try again.';
    authError.classList.remove('hidden');
  }
});

/* ── Logout ── */
document.getElementById('menuLogout').addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST' });
  currentUser = null;
  updateAuthUI();
});

/* ── Saved Recipes Modal ── */
const savedModal = document.getElementById('savedModal');

document.getElementById('menuSavedRecipes').addEventListener('click', async () => {
  savedModal.showModal();
  await loadSavedRecipes();
});

document.getElementById('savedModalClose').addEventListener('click', () => savedModal.close());

async function loadSavedRecipes() {
  const list = document.getElementById('savedList');
  list.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Loading…</p>';

  try {
    const res = await fetch('/saved-recipes');
    const { recipes } = await res.json();

    if (!recipes || recipes.length === 0) {
      list.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">No saved recipes yet.</p>';
      return;
    }

    list.innerHTML = '';
    recipes.forEach(r => {
      const item = document.createElement('div');
      item.className = 'saved-recipe-item';
      item.innerHTML = `
        <span class="saved-recipe-name">${r.recipe_name}</span>
        <div class="saved-recipe-actions">
          <button class="saved-open-btn" title="Open recipe">Open</button>
          <button class="saved-remove-btn" title="Remove" data-name="${r.recipe_name}">✕</button>
        </div>`;

      item.querySelector('.saved-open-btn').addEventListener('click', () => handleDishClick(r.recipe_name));
      item.querySelector('.saved-remove-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await fetch('/save-recipe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_name: r.recipe_name })
        });
        loadSavedRecipes();
      });

      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<p class="pm-red-text text-sm text-center py-4">Failed to load saved recipes.</p>';
  }
}

/* ── Profile click (shows user info) ── */
document.getElementById('menuProfile').addEventListener('click', () => {
  if (!currentUser) return;
  alert(`Name: ${currentUser.name}\nEmail: ${currentUser.email}`);
});

/* ── 1. INGREDIENT VALIDATION ───────────────────────────────────────────── */
const ingredientsEl    = document.getElementById('ingredients');
const ingredientsError = document.getElementById('ingredientsError');

ingredientsEl.addEventListener('input', () => {
  if (ingredientsEl.value.trim()) {
    ingredientsEl.classList.remove('input-error');
    ingredientsError.classList.add('hidden');
  }
});

/* ── 2. DIETARY RESTRICTION TOGGLE PILLS (single-select, deselectable) ───── */
document.querySelectorAll('.diet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const alreadySelected = btn.classList.contains('selected');
    document.querySelectorAll('.diet-btn').forEach(b => b.classList.remove('selected'));
    if (!alreadySelected) btn.classList.add('selected');
  });
});

/* ── 3. SERVINGS COUNTER ────────────────────────────────────────────────── */
document.getElementById('plusBtn').addEventListener('click', () => {
  const el = document.getElementById('peopleCount');
  el.textContent = parseInt(el.textContent, 10) + 1;
});
document.getElementById('minusBtn').addEventListener('click', () => {
  const el = document.getElementById('peopleCount');
  const v  = parseInt(el.textContent, 10);
  if (v > 1) el.textContent = v - 1;
});

/* ── 4. FIND RECIPES ────────────────────────────────────────────────────── */
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

  fetch('/find-recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredients,
      diet:    document.querySelector('.diet-btn.selected')?.dataset.value || '',
      cuisine: document.getElementById('cuisineSelect').value,
      people:  document.getElementById('peopleCount').textContent
    })
  })
  .then(res => res.json())
  .then(data => displayRecipes(data.recipes))
  .catch(err => console.error('Error finding recipes:', err));
});

/* ── 5. RENDER RECIPE CARDS ─────────────────────────────────────────────── */
function displayRecipes(recipes) {
  const list = document.getElementById('recipesList');
  list.innerHTML = '';

  recipes.forEach((r, i) => {
    const card = document.createElement('div');
    card.className = 'recipe-item';
    card.textContent = r.name;
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';
    card.style.transition = `all 0.3s ease ${i * 0.08}s`;
    card.addEventListener('click', () => handleDishClick(r.name));
    list.appendChild(card);
    setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 50);
  });
}

/* ── 6. DISH CLICK → OPEN RECIPE TAB ───────────────────────────────────── */
function handleDishClick(dishName) {
  const userIngredients = ingredientsEl.value;
  const activeDiet      = document.querySelector('.diet-btn.selected')?.dataset.value || '';

  /* Open window immediately to beat pop-up blockers */
  const win = window.open('', '_blank');
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
      background: #FDFAF6; color: #1e1e2e;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 1.25rem;
    }
    .logo   { font-size: 1.5rem; font-weight: 800; color: #C4573A; }
    .spinner {
      width: 52px; height: 52px;
      border: 4px solid #EDE0D8; border-top-color: #C4573A;
      border-radius: 50%; animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .sub { font-size: 0.875rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="logo">PlateMate</div>
  <div class="spinner"></div>
  <p style="font-size:1.1rem;font-weight:700;">Plating your ${dishName}…</p>
  <p class="sub">AI is crafting your personalised recipe</p>
</body>
</html>`);
  win.document.close();

  const includeVideo = document.getElementById('includeVideoToggle')?.checked ?? false;

  /* Fetch recipe + video in parallel from the server */
  fetch('/explain-dish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dish: dishName,
      inputIngredients: userIngredients,
      diet: activeDiet,
      includeVideo
    })
  })
  .then(res => res.json())
  .then(({ message, videoId }) => {
    const formattedContent = formatRecipeContent(message);

    /* Build video embed only when a videoId is returned */
    const videoHTML = videoId ? `
      <div class="video-wrap">
        <h3 class="rc-heading">Visual Guide</h3>
        <div class="video-responsive">
          <iframe
            src="https://www.youtube.com/embed/${videoId}?rel=0"
            title="Recipe video"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      </div>` : '';

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

    body { font-family: 'Inter', sans-serif; background: #FDFAF6; color: #1e1e2e; min-height: 100vh; }

    /* Top bar */
    .topbar {
      position: sticky; top: 0; z-index: 10;
      background: rgba(255,255,255,0.88); backdrop-filter: blur(12px);
      border-bottom: 1px solid #EDE0D8;
      display: flex; align-items: center; padding: 0.9rem 2rem; gap: 1rem;
    }
    .topbar-logo { font-size: 1.25rem; font-weight: 800; color: #C4573A; }
    .topbar-sep  { color: #D4846A; }
    .topbar-dish { font-size: 0.95rem; font-weight: 600; color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-right { margin-left: auto; display: flex; align-items: center; gap: 0.5rem; }
    .save-btn {
      cursor: pointer; font-family: inherit;
      background: none; border: 1.5px solid #D4846A; color: #C4573A;
      font-weight: 600; font-size: 0.8rem; padding: 0.35rem 0.9rem;
      border-radius: 999px; transition: all 0.2s;
      display: flex; align-items: center; gap: 0.35rem;
    }
    .save-btn:hover { background: #FFF2EE; }
    .save-btn.saved { background: #C4573A; color: #fff; border-color: #C4573A; }
    .back-btn {
      cursor: pointer; font-family: inherit;
      background: none; border: 1.5px solid #D4846A; color: #C4573A;
      font-weight: 600; font-size: 0.8rem; padding: 0.35rem 0.9rem;
      border-radius: 999px; transition: background 0.15s, color 0.15s;
    }
    .back-btn:hover { background: #C4573A; color: #fff; }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, #C4573A 0%, #A83D22 100%);
      padding: 3.5rem 2rem 3rem; text-align: center;
      animation: fadeDown 0.5s ease both;
    }
    .hero-label {
      display: inline-block; background: rgba(255,255,255,0.2);
      color: #fff; font-size: 0.75rem; font-weight: 700;
      letter-spacing: 0.1em; text-transform: uppercase;
      padding: 0.25rem 0.75rem; border-radius: 999px; margin-bottom: 1rem;
    }
    .hero h1 {
      font-size: clamp(1.8rem, 5vw, 2.8rem); font-weight: 800;
      color: #fff; letter-spacing: -0.5px; line-height: 1.15;
    }

    /* Page wrapper */
    .page { max-width: 740px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }

    /* Recipe card */
    .recipe-card {
      background: #fff; border: 1px solid #EDE0D8; border-radius: 18px;
      padding: 2rem 2.25rem;
      box-shadow: 0 4px 24px rgba(196,87,58,0.07);
      animation: fadeUp 0.45s ease 0.1s both;
    }

    /* Video embed */
    .video-wrap { margin-bottom: 1.5rem; }
    .video-responsive {
      position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;
      border-radius: 12px; background: #000;
    }
    .video-responsive iframe {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    }

    /* Content elements */
    .rc-heading {
      font-size: 1rem; font-weight: 700; color: #C4573A;
      margin: 1.6rem 0 0.6rem; padding-bottom: 0.4rem;
      border-bottom: 2px solid #EDE0D8;
    }
    .rc-heading:first-child { margin-top: 0; }
    .rc-para { font-size: 0.95rem; line-height: 1.75; color: #475569; margin-bottom: 0.6rem; }
    .rc-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; margin-bottom: 0.6rem; }
    .rc-list li { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.93rem; line-height: 1.65; color: #475569; }
    .rc-list li::before {
      content: ''; flex-shrink: 0; width: 7px; height: 7px;
      background: #C4573A; border-radius: 50%; margin-top: 0.5rem;
    }
    .rc-step {
      display: flex; align-items: flex-start; gap: 0.85rem;
      padding: 0.75rem 1rem; margin-bottom: 0.5rem;
      background: #FDFAF6; border-radius: 10px; border-left: 3px solid #C4573A;
      font-size: 0.93rem; line-height: 1.65; color: #334155;
    }
    .rc-step-num {
      flex-shrink: 0; width: 24px; height: 24px;
      background: #C4573A; color: #fff; border-radius: 50%;
      font-size: 0.72rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center; margin-top: 0.1rem;
    }

    /* Animations */
    @keyframes fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px);  } to { opacity:1; transform:translateY(0); } }

    /* Footer */
    .footer { text-align: center; padding: 1.5rem; font-size: 0.78rem; color: #94a3b8; }
    .footer span { color: #C4573A; font-weight: 600; }
  </style>
</head>
<body>

  <nav class="topbar">
    <span class="topbar-logo">PlateMate</span>
    <span class="topbar-sep">›</span>
    <span class="topbar-dish">${dishName}</span>
    <div class="topbar-right">
      <button id="saveRecipeBtn" class="save-btn" onclick="toggleSave()">
        <svg id="saveIcon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        <span id="saveText">Save</span>
      </button>
      <button class="back-btn" onclick="window.close()">✕ Close</button>
    </div>
  </nav>

  <div class="hero">
    <div class="hero-label">AI Recipe</div>
    <h1>${dishName}</h1>
  </div>

  <div class="page">
    <div class="recipe-card">
      ${videoHTML}
      ${formattedContent}
    </div>
  </div>

  <div class="footer">Crafted for you by <span>PlateMate AI</span></div>

  <script>
    const recipeName = ${JSON.stringify(dishName)};
    let isSaved = false;

    (async () => {
      try {
        const res = await fetch('/is-saved?recipe_name=' + encodeURIComponent(recipeName));
        const data = await res.json();
        if (data.saved) { isSaved = true; updateSaveUI(); }
      } catch {}
    })();

    function updateSaveUI() {
      const btn  = document.getElementById('saveRecipeBtn');
      const icon = document.getElementById('saveIcon');
      const text = document.getElementById('saveText');
      if (isSaved) {
        btn.classList.add('saved');
        icon.setAttribute('fill', 'currentColor');
        text.textContent = 'Saved';
      } else {
        btn.classList.remove('saved');
        icon.setAttribute('fill', 'none');
        text.textContent = 'Save';
      }
    }

    async function toggleSave() {
      if (isSaved) {
        await fetch('/save-recipe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_name: recipeName })
        });
        isSaved = false;
      } else {
        const res = await fetch('/save-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe_name: recipeName })
        });
        const data = await res.json();
        if (data.error) { alert(data.error); return; }
        isSaved = true;
      }
      updateSaveUI();
    }
  </script>

</body>
</html>`);
    win.document.close();
  })
  .catch(err => {
    console.error('Recipe error:', err);
    win.document.body.innerHTML = `
      <div style="font-family:Inter,sans-serif;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;height:100vh;gap:1rem;background:#FDFAF6;">
        <div style="font-size:1.5rem;font-weight:800;color:#C4573A;">PlateMate</div>
        <div style="font-size:1rem;color:#C4573A;font-weight:600;">Failed to load recipe. Please try again.</div>
        <button onclick="window.close()"
                style="padding:0.5rem 1.5rem;background:#C4573A;color:#fff;border:none;
                       border-radius:999px;font-size:0.9rem;cursor:pointer;">Close</button>
      </div>`;
  });
}

/* ── 7. FORMAT AI TEXT INTO STRUCTURED HTML ─────────────────────────────── */
function formatRecipeContent(text) {
  const lines = text.split('\n');
  let html = '';
  let inBulletList = false;

  const closeBulletList = () => {
    if (inBulletList) { html += '</ul>'; inBulletList = false; }
  };

  const styleLine = s =>
    s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
     .replace(/\*(.*?)\*/g,     '<em>$1</em>');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeBulletList(); continue; }

    if (/^#{1,3}\s/.test(line)) {
      closeBulletList();
      html += `<h3 class="rc-heading">${styleLine(line.replace(/^#{1,3}\s/, ''))}</h3>`;
    } else if (/^[A-Z][^:]{2,50}:$/.test(line)) {
      closeBulletList();
      html += `<h3 class="rc-heading">${styleLine(line)}</h3>`;
    } else if (/^\d+[\.\)]\s/.test(line)) {
      closeBulletList();
      const num = line.match(/^(\d+)/)[1];
      const txt = styleLine(line.replace(/^\d+[\.\)]\s/, ''));
      html += `<div class="rc-step"><span class="rc-step-num">${num}</span><span>${txt}</span></div>`;
    } else if (/^[•\-\*]\s/.test(line)) {
      if (!inBulletList) { html += '<ul class="rc-list">'; inBulletList = true; }
      html += `<li>${styleLine(line.replace(/^[•\-\*]\s/, ''))}</li>`;
    } else {
      closeBulletList();
      html += `<p class="rc-para">${styleLine(line)}</p>`;
    }
  }

  closeBulletList();
  return html;
}
