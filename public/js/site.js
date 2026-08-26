function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    if (!products.length) {
      grid.innerHTML = '<div class="products-empty">No products added yet.</div>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <div class="card">
        <div class="card-img" style="background-image:url('${escapeHtml(p.imageUrl)}')"></div>
        <div class="card-body">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.description)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = '<div class="products-empty">Could not load products right now.</div>';
  }
}

loadProducts();
