/* -------------------------
   Firebase & LocalStorage helpers
   ------------------------- */
function firebaseAvailable() {
  return typeof firebase !== "undefined" && typeof db !== "undefined";
}

// Inventory
function getInventory(callback) {
  if (firebaseAvailable()) {
    db.ref("inventory").once("value", (snapshot) => {
      callback(snapshot.val() || []);
    });
  } else {
    callback(JSON.parse(localStorage.getItem("inventory")) || []);
  }
}
function saveInventory(items) {
  if (firebaseAvailable()) {
    db.ref("inventory").set(items);
  }
  localStorage.setItem("inventory", JSON.stringify(items));
}

// Orders
function getOrders(callback) {
  if (firebaseAvailable()) {
    db.ref("orders").once("value", (snapshot) => {
      callback(snapshot.val() || []);
    });
  } else {
    callback(JSON.parse(localStorage.getItem("orders")) || []);
  }
}
function saveOrders(orders) {
  if (firebaseAvailable()) {
    db.ref("orders").set(orders);
  }
  localStorage.setItem("orders", JSON.stringify(orders));
}

/* -------------------------
   Inventory functions
   ------------------------- */
// Add or update inventory item (restock if exists)
function addOrUpdateInventoryItem(item) {
  getInventory((items) => {
    const existingIndex = items.findIndex(i => i.name.toLowerCase() === item.name.toLowerCase());
    if (existingIndex >= 0) {
      // restock: add qty and update category/supplier
      items[existingIndex].qty = (items[existingIndex].qty || 0) + (item.qty || 0);
      items[existingIndex].category = item.category || items[existingIndex].category;
      items[existingIndex].supplier = item.supplier || items[existingIndex].supplier;
    } else {
      items.push({
        name: item.name,
        category: item.category,
        qty: item.qty || 0,
        supplier: item.supplier || ''
      });
    }
    saveInventory(items);
    if (typeof renderCategories === 'function') renderCategories();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof populateInventoryDropdown === 'function') populateInventoryDropdown();
    if (typeof updateSummary === 'function') updateSummary();
  });
}

// Simple restock
function restockItemByName(name, addQty) {
  getInventory((items) => {
    const idx = items.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      items[idx].qty = (items[idx].qty || 0) + Number(addQty);
      saveInventory(items);
      if (typeof renderInventory === 'function') renderInventory();
      if (typeof renderCategories === 'function') renderCategories();
      if (typeof populateInventoryDropdown === 'function') populateInventoryDropdown();
      if (typeof updateSummary === 'function') updateSummary();
      return true;
    }
    return false;
  });
}

// Delete inventory item
function deleteInventoryItem(name) {
  if (!confirm(`Delete item "${name}" from inventory? This cannot be undone.`)) return;
  getInventory((items) => {
    items = items.filter(i => i.name.toLowerCase() !== name.toLowerCase());
    saveInventory(items);
    if (typeof renderCategories === 'function') renderCategories();
    if (typeof renderInventory === 'function') renderInventory();
    if (typeof populateInventoryDropdown === 'function') populateInventoryDropdown();
    if (typeof updateSummary === 'function') updateSummary();
  });
}

/* -------------------------
   Inventory rendering & categories
   ------------------------- */
function renderCategories() {
  const sidebar = document.getElementById('categoryList');
  if (!sidebar) return;
  getInventory((items) => {
    const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    sidebar.innerHTML = '';

    // All items button
    const allBtn = document.createElement('button');
    allBtn.className = 'cat-btn';
    allBtn.textContent = 'All Items';
    allBtn.onclick = () => renderInventory(null);
    sidebar.appendChild(allBtn);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.textContent = cat;
      btn.onclick = () => renderInventory(cat);
      sidebar.appendChild(btn);
    });
  });
}

function renderInventory(category = null) {
  const list = document.getElementById('inventoryList');
  const title = document.getElementById('currentCategoryTitle');
  if (!list) return;
  getInventory((items) => {
    if (category) {
      title && (title.textContent = category);
      items = items.filter(i => i.category === category);
    } else {
      title && (title.textContent = 'All Items');
    }
    list.innerHTML = '';
    if (items.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No items found.';
      list.appendChild(li);
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'inventory-item';
      if (item.qty <= 10) li.classList.add('low-stock');
      li.innerHTML = `
        <div class="inventory-main">
          <strong class="item-name">${escapeHtml(item.name)}</strong>
          <div class="meta">
            <span class="cat">Category: ${escapeHtml(item.category)}</span>
            <span class="supplier">Supplier: ${escapeHtml(item.supplier)}</span>
          </div>
        </div>
        <div class="inventory-actions">
          <span class="qty">Qty: ${item.qty}</span>
          <button class="small-btn" onclick="promptRestock('${escapeJs(item.name)}')">➕ Restock</button>
          <button class="small-btn" onclick="promptEditItem('${escapeJs(item.name)}')">✏️ Edit</button>
          <button class="danger-btn" onclick="deleteInventoryItem('${escapeJs(item.name)}')">🗑 Delete</button>
        </div>
      `;
      list.appendChild(li);
    });
  });
}

// prompts
function promptRestock(name) {
  const q = prompt(`Add how many units to "${name}"? (enter a positive number)`);
  if (q === null) return;
  const add = parseInt(q, 10);
  if (isNaN(add) || add <= 0) { alert('Invalid number'); return; }
  restockItemByName(name, add);
}

function promptEditItem(name) {
  getInventory((items) => {
    const idx = items.findIndex(i => i.name.toLowerCase() === name.toLowerCase());
    if (idx < 0) { alert('Item not found'); return; }
    const item = items[idx];
    const newName = prompt('Edit name:', item.name);
    if (newName === null) return;
    const newCat = prompt('Edit category:', item.category || '');
    if (newCat === null) return;
    const newSupplier = prompt('Edit supplier:', item.supplier || '');
    if (newSupplier === null) return;
    const newQtyStr = prompt('Edit quantity (enter a number):', item.qty);
    if (newQtyStr === null) return;
    const newQty = parseInt(newQtyStr, 10);
    if (isNaN(newQty) || newQty < 0) { alert('Invalid qty'); return; }
    // apply changes
    items[idx].name = newName.trim();
    items[idx].category = newCat.trim();
    items[idx].supplier = newSupplier.trim();
    items[idx].qty = newQty;
    saveInventory(items);
    renderCategories();
    renderInventory();
    populateInventoryDropdown();
    updateSummary();
  });
}

/* -------------------------
   Order functions
   ------------------------- */
function renderOrders() {
  const list = document.getElementById('ordersList');
  if (!list) return;
  getOrders((orders) => {
    list.innerHTML = '';
    if (orders.length === 0) {
      const li = document.createElement('li');
      li.className = 'order-empty';
      li.textContent = 'No orders yet.';
      list.appendChild(li);
      return;
    }
    orders.forEach((ord, idx) => {
      const li = document.createElement('li');
      li.className = 'order-item';
      li.innerHTML = `
        <div class="order-main">
          <strong>${escapeHtml(ord.customer)}</strong> — ${escapeHtml(ord.qty)} × <em>${escapeHtml(ord.item)}</em>
          <div class="order-meta">Deadline: ${escapeHtml(ord.deadline)}</div>
        </div>
        <div class="order-actions">
          <button class="small-btn" onclick="markOrderDone(${idx})">✅ Mark as Done</button>
        </div>
      `;
      list.appendChild(li);
    });
  });
}

function markOrderDone(index) {
  getOrders((orders) => {
    if (!orders[index]) return;
    if (!confirm('Mark this order as done and remove it?')) return;
    orders.splice(index, 1);
    saveOrders(orders);
    renderOrders();
    updateSummary();
  });
}

/* -------------------------
   Add order handler
   ------------------------- */
function populateInventoryDropdown() {
  const sel = document.getElementById('orderItem');
  const notice = document.getElementById('noInventoryNotice');
  const submitBtn = document.getElementById('orderSubmit');
  if (!sel) return;
  getInventory((items) => {
    sel.innerHTML = '';
    if (items.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'No inventory items — add inventory first';
      opt.value = '';
      sel.appendChild(opt);
      sel.disabled = true;
      if (notice) notice.style.display = 'block';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }
    if (notice) notice.style.display = 'none';
    sel.disabled = false;
    if (submitBtn) submitBtn.disabled = false;

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select item --';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    sel.appendChild(defaultOpt);

    items.forEach(i => {
      const opt = document.createElement('option');
      opt.value = i.name;
      opt.textContent = `${i.name} (Stock: ${i.qty})`;
      sel.appendChild(opt);
    });
  });
}

function handleAddOrder(e) {
  e.preventDefault();
  const customer = document.getElementById('customerName').value.trim();
  const itemName = document.getElementById('orderItem').value;
  const qty = parseInt(document.getElementById('orderQty').value, 10);
  const deadline = document.getElementById('orderDeadline').value;

  if (!customer || !itemName || !qty || !deadline) { alert('Please fill required fields'); return; }

  getInventory((items) => {
    const target = items.find(i => i.name === itemName);

    if (!target) {
      if (!confirm('Item not found in inventory. Add order anyway? (no stock will be deducted)')) return;
      getOrders((orders) => {
        orders.push({ customer, item: itemName, qty, deadline });
        saveOrders(orders);
        alert('Order added (no inventory changes).');
        if (typeof populateInventoryDropdown === 'function') populateInventoryDropdown();
        if (typeof updateSummary === 'function') updateSummary();
        window.location.href = 'orders.html';
      });
      return;
    }

    if (target.qty < qty) {
      if (!confirm(`Not enough stock (have ${target.qty}). Proceed and allow negative stock?`)) return;
    }

    // deduct and save
    target.qty = (target.qty || 0) - qty;
    saveInventory(items);

    getOrders((orders) => {
      orders.push({ customer, item: itemName, qty, deadline });
      saveOrders(orders);

      alert('Order added and inventory updated.');
      if (typeof renderInventory === 'function') renderInventory();
      if (typeof renderCategories === 'function') renderCategories();
      if (typeof populateInventoryDropdown === 'function') populateInventoryDropdown();
      if (typeof updateSummary === 'function') updateSummary();

      window.location.href = 'orders.html';
    });
  });
}

/* -------------------------
   Add inventory form handler
   ------------------------- */
function handleAddInventory(e) {
  e.preventDefault && e.preventDefault();
  const name = (document.getElementById('invItemName') && document.getElementById('invItemName').value.trim()) || '';
  const category = (document.getElementById('invCategory') && document.getElementById('invCategory').value.trim()) || '';
  const qtyVal = document.getElementById('invQty') && document.getElementById('invQty').value;
  const qty = qtyVal !== undefined ? parseInt(qtyVal, 10) : 0;
  const supplier = (document.getElementById('invSupplier') && document.getElementById('invSupplier').value.trim()) || '';

  if (!name || !category || isNaN(qty) || qty < 0 || !supplier) { alert('Please complete all fields (qty must be 0 or more).'); return; }

  addOrUpdateInventoryItem({ name, category, qty, supplier });

  alert('Item saved (new or restocked).');
  const form = document.getElementById('inventoryForm');
  if (form) form.reset();
}

/* -------------------------
   Dashboard summary
   ------------------------- */
function updateSummary() {
  getOrders((orders) => {
    getInventory((inventory) => {
      const pendingCount = orders.length;
      const lowStockCount = inventory.filter(i => (i.qty || 0) <= 10).length;
      const pEl = document.getElementById('pendingCount');
      const lEl = document.getElementById('lowStockCount');
      if (pEl) pEl.textContent = pendingCount;
      if (lEl) lEl.textContent = lowStockCount;
    });
  });
}

/* -------------------------
   Utility escapes (safe inline)
   ------------------------- */
function escapeHtml(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function escapeJs(str) {
  if (!str && str !== 0) return '';
  return String(str).replace(/'/g, "\\'");
}

/* -------------------------
   Initialize on load for pages (safe)
   ------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  populateInventoryDropdown();

  if (document.getElementById('inventoryList')) {
    renderCategories();
    renderInventory();
  }
  if (document.getElementById('ordersList')) {
    renderOrders();
  }
  if (typeof updateSummary === 'function') updateSummary();

  // Optional: Real-time sync (if you want live updates)
  if (firebaseAvailable()) {
    db.ref("inventory").on("value", () => {
      if (typeof renderInventory === "function") renderInventory();
      if (typeof updateSummary === "function") updateSummary();
      if (typeof renderCategories === "function") renderCategories();
      if (typeof populateInventoryDropdown === "function") populateInventoryDropdown();
    });
    db.ref("orders").on("value", () => {
      if (typeof renderOrders === "function") renderOrders();
      if (typeof updateSummary === "function") updateSummary();
    });
  }
});
