const profileGate = document.getElementById('profileGate');
const profileLoading = document.getElementById('profileLoading');
const profileFormWrap = document.getElementById('profileFormWrap');
const profileForm = document.getElementById('profileForm');
const profileFlash = document.getElementById('profileFlash');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');

function showFlash(ok, text) {
  profileFlash.textContent = text;
  profileFlash.classList.remove('hidden', 'pm-red-text');
  profileFlash.style.background = ok ? '#e8efe4' : '#FFF2EE';
  if (!ok) profileFlash.classList.add('pm-red-text');
}

function hideFlash() {
  profileFlash.classList.add('hidden');
}

function selectedDiet() {
  const sel = document.querySelector('#profileDietGroup .signup-diet-pill.selected');
  return sel?.dataset.value || '';
}

function selectedAllergies() {
  return [...document.querySelectorAll('#profileAllergyGroup .allergy-pill.selected')].map(p => p.dataset.value);
}

function applyUserToForm(user) {
  profileName.value = user.name || '';
  profileEmail.value = user.email || '';

  document.querySelectorAll('#profileDietGroup .signup-diet-pill').forEach(b => {
    b.classList.toggle('selected', b.dataset.value === (user.dietary_restriction || ''));
  });

  const set = new Set(user.allergies || []);
  document.querySelectorAll('#profileAllergyGroup .allergy-pill').forEach(p => {
    p.classList.toggle('selected', set.has(p.dataset.value));
  });
}

document.querySelectorAll('#profileDietGroup .signup-diet-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    const already = btn.classList.contains('selected');
    document.querySelectorAll('#profileDietGroup .signup-diet-pill').forEach(b => b.classList.remove('selected'));
    if (!already) btn.classList.add('selected');
  });
});

document.querySelectorAll('#profileAllergyGroup .allergy-pill').forEach(pill => {
  pill.addEventListener('click', () => pill.classList.toggle('selected'));
});

document.getElementById('profileLogoutBtn').addEventListener('click', async () => {
  try {
    await window.AuthFlowLoading.run('Signing you out…', async () => {
      await fetch('/logout', { method: 'POST', credentials: 'same-origin' });
    });
  } catch {
    /* continue to home */
  }
  window.location.href = '/';
});

profileForm.addEventListener('submit', async e => {
  e.preventDefault();
  hideFlash();

  const body = {
    name: profileName.value.trim(),
    email: profileEmail.value.trim(),
    allergies: selectedAllergies(),
    dietary_restriction: selectedDiet()
  };

  const btn = document.getElementById('profileSaveBtn');
  btn.disabled = true;

  try {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showFlash(false, data.error || 'Could not save.');
      btn.disabled = false;
      return;
    }

    applyUserToForm(data.user);
    showFlash(true, 'Profile saved.');
    btn.disabled = false;
  } catch {
    showFlash(false, 'Network error. Try again.');
    btn.disabled = false;
  }
});

(async function init() {
  try {
    const res = await fetch('/me', { credentials: 'same-origin' });
    const { user } = await res.json();

    profileLoading.classList.add('hidden');

    if (!user) {
      profileGate.classList.remove('hidden');
      return;
    }

    applyUserToForm(user);
    profileFormWrap.classList.remove('hidden');
  } catch {
    profileLoading.classList.add('hidden');
    profileGate.classList.remove('hidden');
  }
})();
