/* ─────────────────────────────────────────────────────────────────────────── */
/* GATED APP — session cookie + isLoggedIn                                     */
/* ─────────────────────────────────────────────────────────────────────────── */
let currentUser = null;
let isLoggedIn = false;
let gateSignupMode = false;

const authGate = document.getElementById('authGate');
const appShell = document.getElementById('appShell');
const authTabLogin = document.getElementById('authTabLogin');
const authTabSignup = document.getElementById('authTabSignup');
const authNameWrap = document.getElementById('authNameWrap');
const authAllergiesWrap = document.getElementById('authAllergiesWrap');
const authDietWrap = document.getElementById('authDietWrap');
const authSubmit = document.getElementById('authSubmit');
const authError = document.getElementById('authError');

function setGateMode(signup) {
  gateSignupMode = signup;
  authTabLogin.classList.toggle('pm-auth-tab--active', !signup);
  authTabLogin.setAttribute('aria-selected', signup ? 'false' : 'true');
  authTabSignup.classList.toggle('pm-auth-tab--active', signup);
  authTabSignup.setAttribute('aria-selected', signup ? 'true' : 'false');
  authNameWrap.classList.toggle('hidden', !signup);
  authDietWrap.classList.toggle('hidden', !signup);
  authAllergiesWrap.classList.toggle('hidden', !signup);
  authSubmit.textContent = signup ? 'Sign up' : 'Log in';
  authError.classList.add('hidden');
}

authTabLogin.addEventListener('click', () => setGateMode(false));
authTabSignup.addEventListener('click', () => setGateMode(true));

document.querySelectorAll('.signup-diet-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const alreadySelected = btn.classList.contains('selected');
    document.querySelectorAll('.signup-diet-pill').forEach(b => b.classList.remove('selected'));
    if (!alreadySelected) btn.classList.add('selected');
  });
});

document.querySelectorAll('.allergy-pill').forEach(pill => {
  pill.addEventListener('click', () => pill.classList.toggle('selected'));
});

function selectedSignupDiet() {
  const sel = document.querySelector('#signupDietGroup .signup-diet-pill.selected');
  return sel?.dataset.value || '';
}

function clearSignupDietSelection() {
  document.querySelectorAll('.signup-diet-pill').forEach(b => b.classList.remove('selected'));
}

function selectedAllergies() {
  return [...document.querySelectorAll('.allergy-pill.selected')].map(p => p.dataset.value);
}

function clearAllergySelection() {
  document.querySelectorAll('.allergy-pill').forEach(p => p.classList.remove('selected'));
}

authSubmit.addEventListener('click', async () => {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();

  if (!email || !password || (gateSignupMode && !name)) {
    authError.textContent = 'Please fill in all required fields.';
    authError.classList.remove('hidden');
    return;
  }

  const url = gateSignupMode ? '/api/register' : '/api/login';
  const body = gateSignupMode
    ? {
        name,
        email,
        password,
        allergies: selectedAllergies(),
        dietary_restriction: selectedSignupDiet()
      }
    : { email, password };

  const loadingMsg = gateSignupMode ? 'Creating your account…' : 'Signing you in…';
  authSubmit.disabled = true;

  try {
    const { res, data } = await window.AuthFlowLoading.run(loadingMsg, async () => {
      const r = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      let d = {};
      try {
        d = await r.json();
      } catch {
        /* non-JSON body */
      }
      return { res: r, data: d };
    });

    if (!res.ok) {
      authError.textContent = data.error || 'Something went wrong.';
      authError.classList.remove('hidden');
      return;
    }

    currentUser = data.user;
    isLoggedIn = true;
    applyGatedView();

    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authName').value = '';
    clearAllergySelection();
    clearSignupDietSelection();
    setGateMode(false);
  } catch {
    authError.textContent = 'Network error. Please try again.';
    authError.classList.remove('hidden');
  } finally {
    authSubmit.disabled = false;
  }
});

async function checkAuth() {
  try {
    const res = await fetch('/me', { credentials: 'same-origin' });
    const { user } = await res.json();
    currentUser = user;
    isLoggedIn = !!user;
    applyGatedView();
  } catch {
    currentUser = null;
    isLoggedIn = false;
    applyGatedView();
  }
}

function applyGatedView() {
  if (isLoggedIn && currentUser) {
    authGate.classList.add('hidden');
    appShell.classList.remove('hidden');
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      avatar.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.name)}`;
    }
    document.getElementById('menuUserName').textContent = currentUser.name;
    refreshCookbook();
  } else {
    authGate.classList.remove('hidden');
    appShell.classList.add('hidden');
    currentUser = null;
    isLoggedIn = false;
    const list = document.getElementById('cookbookList');
    if (list) list.innerHTML = '';
  }
}

checkAuth();

/* ── Logout ── */
document.getElementById('menuLogout').addEventListener('click', async () => {
  try {
    await window.AuthFlowLoading.run('Signing you out…', async () => {
      await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    });
  } catch {
    /* still return to gate */
  }
  currentUser = null;
  isLoggedIn = false;
  applyGatedView();
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
    const res = await fetch('/api/saved-recipes', { credentials: 'same-origin' });
    const { recipes, error } = await res.json();

    if (!res.ok) {
      list.innerHTML = `<p class="pm-red-text text-sm text-center py-4">${error || 'Failed to load saved recipes.'}</p>`;
      return;
    }

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
          <button class="saved-remove-btn" title="Remove" data-id="${r.id}">✕</button>
        </div>`;

      item.querySelector('.saved-open-btn').addEventListener('click', () => openSavedRecipeById(r.id));
      item.querySelector('.saved-remove-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
        await fetch(`/api/saved-recipe/${id}`, { method: 'DELETE', credentials: 'same-origin' });
        loadSavedRecipes();
        refreshCookbook();
      });

      list.appendChild(item);
    });
  } catch {
    list.innerHTML = '<p class="pm-red-text text-sm text-center py-4">Failed to load saved recipes.</p>';
  }
}

async function refreshCookbook() {
  const list = document.getElementById('cookbookList');
  if (!list || !currentUser) return;

  list.innerHTML = '<p class="text-slate-400 text-sm col-span-full">Loading…</p>';

  try {
    const res = await fetch('/api/saved-recipes', { credentials: 'same-origin' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed');

    const recipes = data.recipes || [];
    if (recipes.length === 0) {
      list.innerHTML = '<p class="text-slate-400 text-sm col-span-full">No saved recipes yet. Open a recipe and tap Save.</p>';
      return;
    }

    list.innerHTML = '';
    recipes.forEach(r => {
      const card = document.createElement('div');
      card.className = 'recipe-item';
      card.textContent = r.recipe_name;
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => openSavedRecipeById(r.id));
      list.appendChild(card);
    });
  } catch {
    list.innerHTML = '<p class="pm-red-text text-sm col-span-full">Could not load cookbook.</p>';
  }
}

window.refreshCookbook = refreshCookbook;

/* ── 1. INGREDIENT VALIDATION ───────────────────────────────────────────── */
const ingredientsEl    = document.getElementById('ingredients');
const ingredientsError = document.getElementById('ingredientsError');

ingredientsEl.addEventListener('input', () => {
  if (ingredientsEl.value.trim()) {
    ingredientsEl.classList.remove('input-error');
    ingredientsError.classList.add('hidden');
  }
});

/* ── 2. RECIPE MODE (text vs video masterclass) ─────────────────────────── */
document.querySelectorAll('.recipe-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.recipe-mode-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

function getRecipeModeIncludeVideo() {
  const sel = document.querySelector('.recipe-mode-btn.selected');
  return sel?.dataset.includeVideo === 'true';
}

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
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ingredients,
      cuisine: document.getElementById('cuisineSelect').value,
      people:  document.getElementById('peopleCount').textContent
    })
  })
  .then(res => {
    if (res.status === 401) {
      currentUser = null;
      isLoggedIn = false;
      applyGatedView();
      throw new Error('Session expired');
    }
    return res.json();
  })
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

/* ── 6. RECIPE WINDOW (shared HTML + save payload) ─────────────────────── */
function serializeRecipeCtxPayload(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function recipeLoadingDocument(titleLine, subLine) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleLine} — PlateMate</title>
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
  <p style="font-size:1.1rem;font-weight:700;">${titleLine}</p>
  <p class="sub">${subLine}</p>
</body>
</html>`;
}

function buildVideoSectionHtml(videoId) {
  if (!videoId) return '';
  return `
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
      </div>`;
}

function buildRecipeDocumentHtml({
  dishName,
  formattedContent,
  videoId,
  heroLabel = 'AI Recipe',
  savedRecipeId = null,
  initialSaved = false
}) {
  const videoHTML = buildVideoSectionHtml(videoId);
  const ctxJson = serializeRecipeCtxPayload({
    recipeName: dishName,
    recipeTextHtml: formattedContent,
    videoId: videoId || null,
    savedRecipeId,
    initialSaved
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${dishName} — PlateMate</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body { font-family: 'Inter', sans-serif; background: #FDFAF6; color: #1e1e2e; min-height: 100vh; }

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

    .page { max-width: 740px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem; }

    .recipe-card {
      background: #fff; border: 1px solid #EDE0D8; border-radius: 18px;
      padding: 2rem 2.25rem;
      box-shadow: 0 4px 24px rgba(196,87,58,0.07);
      animation: fadeUp 0.45s ease 0.1s both;
    }

    .video-wrap { margin-bottom: 1.5rem; }
    .video-responsive {
      position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;
      border-radius: 12px; background: #000;
    }
    .video-responsive iframe {
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    }

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

    .rc-masterclass-note {
      font-size: 0.9rem; line-height: 1.6; color: #64748b;
      margin: 0 0 1.25rem; padding: 0.65rem 0.85rem;
      background: #FDFAF6; border-radius: 10px; border-left: 3px solid #C4573A;
    }

    @keyframes fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px);  } to { opacity:1; transform:translateY(0); } }

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
    <div class="hero-label">${heroLabel}</div>
    <h1>${dishName}</h1>
  </div>

  <div class="page">
    <div class="recipe-card">
      ${videoHTML}
      ${formattedContent}
    </div>
  </div>

  <div class="footer">Crafted for you by <span>PlateMate AI</span></div>

  <script type="application/json" id="pm-recipe-ctx">${ctxJson}</script>
  <script>
    const ctx = JSON.parse(document.getElementById('pm-recipe-ctx').textContent);
    let isSaved = !!ctx.initialSaved;
    let savedRecipeId = ctx.savedRecipeId;

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

    (async () => {
      if (ctx.initialSaved) {
        updateSaveUI();
        return;
      }
      try {
        const res = await fetch('/api/saved-recipes', { credentials: 'same-origin' });
        const data = await res.json();
        const row = (data.recipes || []).find(function (r) { return r.recipe_name === ctx.recipeName; });
        if (row) {
          isSaved = true;
          savedRecipeId = row.id;
          updateSaveUI();
        }
      } catch (e) {}
    })();

    async function toggleSave() {
      if (isSaved) {
        if (savedRecipeId == null) { updateSaveUI(); return; }
        const res = await fetch('/api/saved-recipe/' + savedRecipeId, {
          method: 'DELETE',
          credentials: 'same-origin'
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) { alert(data.error || 'Could not remove recipe.'); return; }
        isSaved = false;
        savedRecipeId = null;
      } else {
        const res = await fetch('/api/save-recipe', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipe_name: ctx.recipeName,
            recipe_text: ctx.recipeTextHtml,
            video_id: ctx.videoId
          })
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok) { alert(data.error || 'Could not save recipe.'); return; }
        if (data.id != null) savedRecipeId = data.id;
        isSaved = true;
      }
      updateSaveUI();
      try {
        if (window.opener && typeof window.opener.refreshCookbook === 'function') {
          window.opener.refreshCookbook();
        }
      } catch (e) {}
    }
  </script>

</body>
</html>`;
}

function openSavedRecipeById(savedId) {
  const win = window.open('', '_blank');
  win.document.write(recipeLoadingDocument('Opening your saved recipe…', 'Loading from your cookbook'));
  win.document.close();

  fetch(`/api/saved-recipe/${savedId}`, { credentials: 'same-origin' })
    .then(res => res.json().then(data => ({ ok: res.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) throw new Error(data.error || 'Failed');
      if (data.recipe_text == null || String(data.recipe_text).trim() === '') {
        win.document.open();
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>PlateMate</title></head>
<body style="font-family:Inter,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:1rem;background:#FDFAF6;padding:2rem;text-align:center;">
<p style="color:#C4573A;font-weight:600;">This saved recipe has no stored text (older save).</p>
<p style="color:#64748b;font-size:0.9rem;">Remove it from Saved Recipes and save again from a new recipe.</p>
<button onclick="window.close()" style="padding:0.5rem 1.5rem;background:#C4573A;color:#fff;border:none;border-radius:999px;cursor:pointer;">Close</button>
</body></html>`);
        win.document.close();
        return;
      }
      const doc = buildRecipeDocumentHtml({
        dishName: data.recipe_name,
        formattedContent: data.recipe_text,
        videoId: data.video_id,
        heroLabel: 'Saved Recipe',
        savedRecipeId: data.id,
        initialSaved: true
      });
      win.document.open();
      win.document.write(doc);
      win.document.close();
    })
    .catch(() => {
      win.document.open();
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FDFAF6;">
<p style="color:#C4573A;">Could not open saved recipe. <button onclick="window.close()">Close</button></p></body></html>`);
      win.document.close();
    });
}

/* ── 7. DISH CLICK → AI RECIPE TAB (video-sync text is what gets saved) ── */
function handleDishClick(dishName) {
  const userIngredients = ingredientsEl.value;

  const includeVideo = getRecipeModeIncludeVideo();

  const win = window.open('', '_blank');
  const loadingSub = includeVideo
    ? 'Finding a masterclass video, then syncing the recipe to its transcript…'
    : 'AI is crafting your text recipe…';
  win.document.write(recipeLoadingDocument(`Plating your ${dishName}…`, loadingSub));
  win.document.close();

  fetch('/explain-dish', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dish: dishName,
      inputIngredients: userIngredients,
      includeVideo
    })
  })
  .then(async res => {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      currentUser = null;
      isLoggedIn = false;
      applyGatedView();
      win.document.open();
      win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FDFAF6;"><p style="color:#C4573A;">Session expired—please log in again. <button onclick="window.close()">Close</button></p></body></html>`);
      win.document.close();
      return null;
    }
    if (!res.ok) throw new Error(data.message || 'Failed');
    return data;
  })
  .then(payload => {
    if (!payload) return;
    const { message, videoId } = payload;
    const formattedContent = formatRecipeContent(message);

    let contentBelowVideo = formattedContent;
    if (includeVideo && videoId) {
      contentBelowVideo =
        '<p class="rc-masterclass-note">The written recipe below follows the video above (transcript-synced).</p>' +
        formattedContent;
    } else if (includeVideo && !videoId) {
      contentBelowVideo =
        '<p class="rc-masterclass-note">No suitable embeddable video was found; this recipe is AI-generated without transcript sync.</p>' +
        formattedContent;
    }

    const doc = buildRecipeDocumentHtml({
      dishName,
      formattedContent: contentBelowVideo,
      videoId: includeVideo ? videoId : null,
      heroLabel: includeVideo ? 'Video Masterclass' : 'Text Recipe',
      savedRecipeId: null,
      initialSaved: false
    });
    win.document.open();
    win.document.write(doc);
    win.document.close();
  })
  .catch(err => {
    console.error('Recipe error:', err);
    try {
    win.document.body.innerHTML = `
      <div style="font-family:Inter,sans-serif;display:flex;flex-direction:column;align-items:center;
                  justify-content:center;height:100vh;gap:1rem;background:#FDFAF6;">
        <div style="font-size:1.5rem;font-weight:800;color:#C4573A;">PlateMate</div>
        <div style="font-size:1rem;color:#C4573A;font-weight:600;">Failed to load recipe. Please try again.</div>
        <button onclick="window.close()"
                style="padding:0.5rem 1.5rem;background:#C4573A;color:#fff;border:none;
                       border-radius:999px;font-size:0.9rem;cursor:pointer;">Close</button>
      </div>`;
    } catch { /* window may be in bad state */ }
  });
}

/* ── 8. FORMAT AI TEXT INTO STRUCTURED HTML ─────────────────────────────── */
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
