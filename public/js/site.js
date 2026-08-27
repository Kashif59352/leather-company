function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  const moreWrap = document.getElementById('products-more-wrap');
  if (!grid) return;
  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    if (!products.length) {
      grid.innerHTML = '<div class="products-empty">No products added yet.</div>';
      return;
    }

    const visible = products.slice(0, 6);
    grid.innerHTML = visible.map(p => `
      <div class="card">
        <div class="card-img" style="background-image:url('${escapeHtml(p.imageUrl)}')"></div>
        <div class="card-body">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.description)}</p>
        </div>
      </div>
    `).join('');

    if (moreWrap) {
      moreWrap.style.display = products.length > 6 ? 'block' : 'none';
    }
  } catch (err) {
    grid.innerHTML = '<div class="products-empty">Could not load products right now.</div>';
  }
}

async function loadTeam() {
  const grid = document.getElementById('team-grid');
  if (!grid) return;
  try {
    const res = await fetch('/api/team');
    const team = await res.json();

    if (!team.length) {
      grid.innerHTML = '<div class="products-empty">Team information coming soon.</div>';
      return;
    }

    grid.innerHTML = team.map(m => `
      <div class="team-card">
        <div class="team-photo" style="${m.imageUrl ? `background-image:url('${escapeHtml(m.imageUrl)}')` : ''}">${m.imageUrl ? '' : escapeHtml(initials(m.name))}</div>
        <div class="card-body">
          <h3>${escapeHtml(m.name)}</h3>
          <div class="team-role">${escapeHtml(m.designation)}</div>
          <p>${escapeHtml(m.description)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<div class="products-empty">Could not load team right now.</div>';
  }
}

function initials(name) {
  return (name || '').replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

loadProducts();
loadTeam();
