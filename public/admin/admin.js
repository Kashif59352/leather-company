// Shared helper used by both login.html and dashboard.html.
// requireLogin=true  -> used on dashboard.html: redirect to login if NOT logged in.
// requireLogin=false -> used on login.html: redirect to dashboard if ALREADY logged in.
async function checkSession(requireLogin) {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (requireLogin && !data.loggedIn) {
      window.location.href = 'login.html';
    }
    if (!requireLogin && data.loggedIn) {
      window.location.href = 'dashboard.html';
    }
    return data;
  } catch (err) {
    if (requireLogin) window.location.href = 'login.html';
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'login.html';
}
