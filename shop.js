const PRODUCTS = {
  apple: { name: "Apple", emoji: "🍏" },
  banana: { name: "Banana", emoji: "🍌" },
  lemon: { name: "Lemon", emoji: "🍋" },
};

function getBasket() {
  try {
    const basket = localStorage.getItem("basket");
    if (!basket) return [];
    const parsed = JSON.parse(basket);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Error parsing basket from localStorage:", error);
    return [];
  }
}

function addToBasket(product) {
  const basket = getBasket();
  basket.push(product);
  localStorage.setItem("basket", JSON.stringify(basket));
}

function clearBasket() {
  localStorage.removeItem("basket");
}

function renderBasket() {
  const basket = getBasket();
  const basketList = document.getElementById("basketList");
  const cartButtonsRow = document.querySelector(".cart-buttons-row");
  if (!basketList) return;
  basketList.innerHTML = "";
  if (basket.length === 0) {
    basketList.innerHTML = "<li>No products in basket.</li>";
    if (cartButtonsRow) cartButtonsRow.style.display = "none";
    return;
  }
  // Separate regular products from requested (pseudo) products
  const regular = [];
  const requested = [];
  basket.forEach((product, idx) => {
    if (product && typeof product === "object" && product.requested) {
      requested.push({ product, idx });
    } else {
      regular.push({ product, idx });
    }
  });

  // Render regular products
  if (regular.length > 0) {
    regular.forEach(({ product, idx }) => {
      const item = PRODUCTS[product];
      const li = document.createElement("li");
      if (item) {
        li.innerHTML = `
          <span class='basket-emoji'>${item.emoji}</span>
          <span>${item.name}</span>
          <div class="order-item-actions">
            <button class="remove-btn" data-index="${idx}">Remove</button>
          </div>`;
      } else {
        li.textContent = String(product);
      }
      basketList.appendChild(li);
    });
  }

  // Render requested products with visual separation and notification
  if (requested.length > 0) {
    const header = document.createElement("li");
    header.innerHTML = '<strong>Requested items</strong>';
    header.style.marginTop = '0.8rem';
    basketList.appendChild(header);
    requested.forEach(({ product, idx }) => {
      const li = document.createElement("li");
      li.className = 'requested-item';
      const linkHtml = product.link
        ? `<div class="request-link"><a href="${product.link}" target="_blank" rel="noopener">Reference</a></div>`
        : "";
      li.innerHTML = `
        <div class="requested-main">
          <span class='basket-emoji'>📦</span>
          <span class="requested-name">${escapeHtml(product.name)}</span>
        </div>
        <div class="requested-desc">${escapeHtml(product.description || '')}</div>
        ${linkHtml}
        <div class="requested-notice">Requested product — our team will review availability.</div>
        <div class="order-item-actions">
          <button class="edit-request-btn" data-index="${idx}">Edit</button>
          <button class="remove-btn" data-index="${idx}">Remove</button>
        </div>`;
      basketList.appendChild(li);
    });
  }
  if (cartButtonsRow) cartButtonsRow.style.display = "flex";
}

// Utility to escape simple HTML in user input
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function removeBasketItem(index) {
  const basket = getBasket();
  if (index < 0 || index >= basket.length) return;
  const prev = JSON.parse(JSON.stringify(basket));
  const removed = basket[index];
  basket.splice(index, 1);
  localStorage.setItem("basket", JSON.stringify(basket));
  renderBasket();
  renderBasketIndicator();
  const name = (removed && removed.requested) ? removed.name : (PRODUCTS[removed] && PRODUCTS[removed].name) || String(removed);
  showToast(`${name} removed from basket`, 'Undo', function () {
    localStorage.setItem("basket", JSON.stringify(prev));
    renderBasket();
    renderBasketIndicator();
  });
}

function updateBasketItem(index, newItem) {
  const basket = getBasket();
  if (index < 0 || index >= basket.length) return;
  basket[index] = newItem;
  localStorage.setItem("basket", JSON.stringify(basket));
  renderBasket();
  renderBasketIndicator();
}

// Event delegation for remove/edit buttons inside basket list
document.addEventListener('click', function (e) {
  const rem = e.target.closest('.remove-btn');
  if (rem) {
    const idx = Number(rem.getAttribute('data-index'));
    removeBasketItem(idx);
    return;
  }
  const edit = e.target.closest('.edit-request-btn');
  if (edit) {
    const idx = Number(edit.getAttribute('data-index'));
    openRequestModalForEdit(idx);
  }
});

// Modal + floating request button
let _editingIndex = null;
function createRequestModal() {
  if (document.getElementById('requestModal')) return;
  const modal = document.createElement('div');
  modal.id = 'requestModal';
  modal.className = 'request-modal';
  modal.innerHTML = `
    <div class="request-modal-inner" role="dialog" aria-modal="true" aria-label="Request product">
      <h2>Request a product</h2>
      <div class="form-group">
        <label for="req-name">Product name</label>
        <input id="req-name" type="text" required />
      </div>
      <div class="form-group">
        <label for="req-desc">Description</label>
        <input id="req-desc" type="text" />
      </div>
      <div class="form-group">
        <label for="req-link">Reference link</label>
        <input id="req-link" type="text" />
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:8px;">
        <button id="req-submit">Add request</button>
        <button id="req-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelector('#req-cancel').addEventListener('click', closeRequestModal);
  modal.querySelector('#req-submit').addEventListener('click', function () {
    const name = document.getElementById('req-name').value.trim();
    const desc = document.getElementById('req-desc').value.trim();
    const link = document.getElementById('req-link').value.trim();
    if (!name) {
      alert('Please provide a product name.');
      return;
    }
    const requestedProduct = {
      id: 'req-' + Date.now(),
      requested: true,
      name,
      description: desc,
      link,
    };
    if (_editingIndex !== null) {
      updateBasketItem(_editingIndex, requestedProduct);
      _editingIndex = null;
    } else {
      addToBasket(requestedProduct);
      renderBasketIndicator();
      // If on basket page, re-render
      if (document.getElementById('basketList')) renderBasket();
    }
    closeRequestModal();
  });
}

function openRequestModal(prefill) {
  createRequestModal();
  _editingIndex = null;
  document.getElementById('req-name').value = prefill && prefill.name ? prefill.name : '';
  document.getElementById('req-desc').value = prefill && prefill.description ? prefill.description : '';
  document.getElementById('req-link').value = prefill && prefill.link ? prefill.link : '';
  document.getElementById('requestModal').classList.add('open');
  document.getElementById('req-name').focus();
}

function openRequestModalForEdit(index) {
  const basket = getBasket();
  const item = basket[index];
  if (!item || typeof item !== 'object' || !item.requested) return;
  createRequestModal();
  _editingIndex = index;
  document.getElementById('req-name').value = item.name || '';
  document.getElementById('req-desc').value = item.description || '';
  document.getElementById('req-link').value = item.link || '';
  document.getElementById('requestModal').classList.add('open');
  document.getElementById('req-name').focus();
}

function closeRequestModal() {
  const modal = document.getElementById('requestModal');
  if (modal) modal.classList.remove('open');
}

// Floating request button
function createFloatingRequestButton() {
  if (document.getElementById('floatingRequestBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'floatingRequestBtn';
  btn.className = 'floating-request-btn';
  btn.setAttribute('aria-label', 'Request a product');
  btn.textContent = 'Request product';
  btn.addEventListener('click', () => openRequestModal());
  document.body.appendChild(btn);
}

if (document.readyState !== 'loading') {
  createFloatingRequestButton();
  createRequestModal();
} else {
  document.addEventListener('DOMContentLoaded', function () {
    createFloatingRequestButton();
    createRequestModal();
  });
}

function renderBasketIndicator() {
  const basket = getBasket();
  let indicator = document.querySelector(".basket-indicator");
  if (!indicator) {
    const basketLink = document.querySelector(".basket-link");
    if (!basketLink) return;
    indicator = document.createElement("span");
    indicator.className = "basket-indicator";
    basketLink.appendChild(indicator);
  }
  if (basket.length > 0) {
    indicator.textContent = basket.length;
    indicator.style.display = "flex";
  } else {
    indicator.style.display = "none";
  }
}

// Call this on page load and after basket changes
if (document.readyState !== "loading") {
  renderBasketIndicator();
} else {
  document.addEventListener("DOMContentLoaded", renderBasketIndicator);
}

// Toast/snackbar implementation
let _toastTimer = null;
let _currentUndo = null;
function showToast(message, actionLabel, onUndo) {
  // ensure container
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  // clear existing
  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="toast-message">${escapeHtml(message)}</div>
    <div class="toast-actions">
      ${actionLabel ? `<button class="toast-undo" aria-label="Undo last basket action">${escapeHtml(actionLabel)}</button>` : ''}
      <button class="toast-dismiss" aria-label="Dismiss notification">×</button>
    </div>`;
  container.appendChild(toast);

  const undoBtn = toast.querySelector('.toast-undo');
  const dismissBtn = toast.querySelector('.toast-dismiss');

  function clean() {
    if (container) container.innerHTML = '';
    if (_toastTimer) { clearTimeout(_toastTimer); _toastTimer = null; }
    _currentUndo = null;
  }

  if (undoBtn) {
    undoBtn.addEventListener('click', function () {
      if (typeof onUndo === 'function') onUndo();
      clean();
    });
  }
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      clean();
    });
  }

  // pause timer on interaction
  toast.addEventListener('mouseenter', function () { if (_toastTimer) clearTimeout(_toastTimer); });
  toast.addEventListener('mouseleave', function () { _toastTimer = setTimeout(clean, 4000); });
  if (undoBtn) undoBtn.addEventListener('focus', function () { if (_toastTimer) clearTimeout(_toastTimer); });
  if (dismissBtn) dismissBtn.addEventListener('focus', function () { if (_toastTimer) clearTimeout(_toastTimer); });

  _currentUndo = onUndo;
  _toastTimer = setTimeout(function () { clean(); }, 4000);
}

// Patch basket functions to update indicator and show toast with undo
const origAddToBasket = window.addToBasket;
window.addToBasket = function (product) {
  const prev = getBasket();
  const prevCopy = JSON.parse(JSON.stringify(prev));
  origAddToBasket(product);
  renderBasketIndicator();
  renderBasket();
  const name = (product && product.requested) ? product.name : (PRODUCTS[product] && PRODUCTS[product].name) || String(product);
  showToast(`${name} added to basket`, 'Undo', function () {
    localStorage.setItem('basket', JSON.stringify(prevCopy));
    renderBasket();
    renderBasketIndicator();
  });
};

const origClearBasket = window.clearBasket;
window.clearBasket = function () {
  const prev = getBasket();
  const prevCopy = JSON.parse(JSON.stringify(prev));
  origClearBasket();
  renderBasketIndicator();
  renderBasket();
  showToast(`Basket cleared`, 'Undo', function () {
    localStorage.setItem('basket', JSON.stringify(prevCopy));
    renderBasket();
    renderBasketIndicator();
  });
};
