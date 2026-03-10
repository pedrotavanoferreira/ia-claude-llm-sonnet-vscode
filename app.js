/* ══════════════════════════════════════════════════════
   RestaurantOS — Application Logic
   Shared state via localStorage (multi-tab simulation)
══════════════════════════════════════════════════════ */

'use strict';

// ── Credenciais de demonstração ──────────────────────
const USERS = {
  garcom:     [{ user: 'mario',   pass: '1234', nome: 'Mario' },
               { user: 'joao',    pass: '1234', nome: 'João'  }],
  cozinheiro: [{ user: 'chef',    pass: '1234', nome: 'Chef Carlos' },
               { user: 'lucas',   pass: '1234', nome: 'Lucas'       }],
};

// ── Cardápio ─────────────────────────────────────────
const CARDAPIO = [
  // Entradas
  { id: 1,  cat: 'Entradas',   emoji: '🥗', nome: 'Salada Caesar',      desc: 'Alface, croutons, parmesão',   preco: 28.90 },
  { id: 2,  cat: 'Entradas',   emoji: '🦐', nome: 'Camarão ao ajillo',  desc: 'Com pão e azeite',             preco: 52.00 },
  { id: 3,  cat: 'Entradas',   emoji: '🧀', nome: 'Tábua de frios',     desc: 'Queijos e embutidos selecionados', preco: 68.00 },
  // Pratos Principais
  { id: 4,  cat: 'Principais', emoji: '🥩', nome: 'Picanha grelhada',   desc: '300g com arroz e fritas',      preco: 94.90 },
  { id: 5,  cat: 'Principais', emoji: '🍝', nome: 'Fettuccine Carbonara', desc: 'Bacon, ovo, parmesão',       preco: 58.00 },
  { id: 6,  cat: 'Principais', emoji: '🐟', nome: 'Salmão ao molho',    desc: 'Com legumes grelhados',        preco: 82.00 },
  { id: 7,  cat: 'Principais', emoji: '🍗', nome: 'Frango parmegiana',  desc: 'Molho de tomate e muçarela',   preco: 62.00 },
  // Bebidas
  { id: 8,  cat: 'Bebidas',    emoji: '🍺', nome: 'Cerveja artesanal',  desc: 'Lata 473ml',                   preco: 18.00 },
  { id: 9,  cat: 'Bebidas',    emoji: '🍷', nome: 'Vinho tinto',        desc: 'Taça 150ml',                   preco: 32.00 },
  { id: 10, cat: 'Bebidas',    emoji: '🥤', nome: 'Suco natural',       desc: 'Laranja, limão ou abacaxi',    preco: 16.00 },
  { id: 11, cat: 'Bebidas',    emoji: '🫗', nome: 'Água mineral',       desc: 'Com ou sem gás 500ml',         preco:  7.50 },
  // Sobremesas
  { id: 12, cat: 'Sobremesas', emoji: '🍰', nome: 'Cheesecake de frutas', desc: 'Com calda de morango',      preco: 26.00 },
  { id: 13, cat: 'Sobremesas', emoji: '🍮', nome: 'Pudim de leite',     desc: 'Clássico com calda de caramelo', preco: 20.00 },
  { id: 14, cat: 'Sobremesas', emoji: '🍫', nome: 'Petit gâteau',       desc: 'Com sorvete de baunilha',      preco: 34.00 },
];

const CATEGORIAS = ['Entradas', 'Principais', 'Bebidas', 'Sobremesas'];
const TOTAL_MESAS = 12;

// ── Estado da sessão ──────────────────────────────────
let currentUser   = null;   // { role, nome, user }
let selectedRole  = 'garcom';
let selectedMesa  = null;
let comanda       = [];     // [{ item, qty }]
let catAtiva      = 'Principais';
let orderCount    = 0;

// Fila de pedidos compartilhada (localStorage para "multi-aba")
const LS_KEY = 'restaurantOS_pedidos';

function getPedidos() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}
function savePedidos(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

// ════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════
function selectRole(role, btn) {
  selectedRole = role;
  document.querySelectorAll('.profile-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pass-hint').innerHTML =
    `Dica: <strong>1234</strong> (usuário: ${USERS[role][0].user})`;
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value.trim();
  const err = document.getElementById('login-error');
  err.textContent = '';

  if (!u || !p) { err.textContent = 'Preencha usuário e senha.'; return; }

  const match = USERS[selectedRole].find(x => x.user === u && x.pass === p);
  if (!match) { err.textContent = '❌ Usuário ou senha incorretos.'; return; }

  currentUser = { role: selectedRole, nome: match.nome, user: match.user };

  if (selectedRole === 'garcom') {
    showScreen('garcom');
    initGarcom();
  } else {
    showScreen('cozinha');
    initCozinha();
  }
}

// Permitir Enter nos inputs
document.addEventListener('DOMContentLoaded', () => {
  ['login-user', 'login-pass'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  });
  // Preenche hint inicial
  document.getElementById('pass-hint').innerHTML =
    `Dica: <strong>1234</strong> (usuário: ${USERS['garcom'][0].user})`;
});

function doLogout() {
  currentUser  = null;
  selectedMesa = null;
  comanda      = [];
  stopCozinhaPolling();
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').textContent = '';
  showScreen('login');
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

// ════════════════════════════════════════════════════
// GARÇOM
// ════════════════════════════════════════════════════
function initGarcom() {
  document.getElementById('garcom-welcome').textContent =
    `Olá, ${currentUser.nome}! 👋`;
  orderCount = 0;
  updateOrderBadge();
  buildMesaGrid();
  buildCategoryTabs();
  renderMenu();
  renderComanda();
  renderHistorico();
}

// Mesas
function buildMesaGrid() {
  const grid = document.getElementById('mesa-grid');
  grid.innerHTML = '';
  const pedidos = getPedidos();
  const mesasOcupadas = new Set(pedidos.filter(p => p.status !== 'pronto').map(p => p.mesa));

  for (let i = 1; i <= TOTAL_MESAS; i++) {
    const btn = document.createElement('button');
    btn.className = 'mesa-btn' + (mesasOcupadas.has(i) ? ' ocupada' : '') + (selectedMesa === i ? ' selected' : '');
    btn.onclick = () => selectMesa(i);
    btn.innerHTML = `<span class="mesa-num">${i}</span><span>${mesasOcupadas.has(i) ? 'ocupada' : 'livre'}</span>`;
    grid.appendChild(btn);
  }
}

function selectMesa(num) {
  selectedMesa = num;
  comanda = [];
  buildMesaGrid();
  document.getElementById('comanda-mesa-tag').textContent = `Mesa ${num}`;
  renderComanda();
}

// Categorias & Menu
function buildCategoryTabs() {
  const tabs = document.getElementById('category-tabs');
  tabs.innerHTML = '';
  CATEGORIAS.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-tab' + (cat === catAtiva ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => { catAtiva = cat; buildCategoryTabs(); renderMenu(); };
    tabs.appendChild(btn);
  });
}

function renderMenu() {
  const list = document.getElementById('menu-list');
  list.innerHTML = '';
  CARDAPIO.filter(i => i.cat === catAtiva).forEach(item => {
    const el = document.createElement('div');
    el.className = 'menu-item';
    el.onclick = () => addToComanda(item);
    el.innerHTML = `
      <span class="menu-item-emoji">${item.emoji}</span>
      <div class="menu-item-info">
        <div class="menu-item-name">${item.nome}</div>
        <div class="menu-item-desc">${item.desc}</div>
      </div>
      <span class="menu-item-price">R$ ${item.preco.toFixed(2)}</span>
      <div class="menu-item-add">+</div>`;
    list.appendChild(el);
  });
}

// Comanda
function addToComanda(item) {
  if (!selectedMesa) {
    flashError('Selecione uma mesa primeiro!');
    return;
  }
  const existing = comanda.find(c => c.item.id === item.id);
  if (existing) existing.qty++;
  else comanda.push({ item, qty: 1 });
  renderComanda();
}

function changeQty(id, delta) {
  const idx = comanda.findIndex(c => c.item.id === id);
  if (idx === -1) return;
  comanda[idx].qty += delta;
  if (comanda[idx].qty <= 0) comanda.splice(idx, 1);
  renderComanda();
}

function removeItem(id) {
  comanda = comanda.filter(c => c.item.id !== id);
  renderComanda();
}

function renderComanda() {
  const container = document.getElementById('comanda-items');
  const footer    = document.getElementById('comanda-footer');

  if (!comanda.length) {
    container.innerHTML = `<div class="comanda-empty"><span>🍴</span><p>Selecione uma mesa e<br/>adicione itens ao pedido</p></div>`;
    footer.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  comanda.forEach(({ item, qty }) => {
    const row = document.createElement('div');
    row.className = 'comanda-row';
    row.innerHTML = `
      <span class="comanda-row-emoji">${item.emoji}</span>
      <span class="comanda-row-name">${item.nome}</span>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id},  1)">+</button>
      </div>
      <span class="comanda-row-price">R$ ${(item.preco * qty).toFixed(2)}</span>
      <button class="btn-remove" onclick="removeItem(${item.id})">✕</button>`;
    container.appendChild(row);
  });

  const subtotal = comanda.reduce((s, c) => s + c.item.preco * c.qty, 0);
  const taxa     = subtotal * 0.10;
  const total    = subtotal + taxa;

  document.getElementById('subtotal-val').textContent = `R$ ${subtotal.toFixed(2)}`;
  document.getElementById('taxa-val').textContent     = `R$ ${taxa.toFixed(2)}`;
  document.getElementById('total-val').textContent    = `R$ ${total.toFixed(2)}`;

  footer.style.display = 'block';
}

function fecharPedido() {
  if (!selectedMesa)  { flashError('Selecione uma mesa!');      return; }
  if (!comanda.length){ flashError('Adicione itens ao pedido!'); return; }

  const obs      = document.getElementById('obs-pedido').value.trim();
  const subtotal = comanda.reduce((s, c) => s + c.item.preco * c.qty, 0);
  const total    = subtotal * 1.10;

  const pedido = {
    id:      Date.now(),
    mesa:    selectedMesa,
    garcom:  currentUser.nome,
    itens:   comanda.map(c => ({ emoji: c.item.emoji, nome: c.item.nome, qty: c.qty, preco: c.item.preco })),
    obs:     obs,
    total:   total,
    status:  'pendente',
    hora:    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    ts:      Date.now(),
  };

  const pedidos = getPedidos();
  pedidos.unshift(pedido);
  savePedidos(pedidos);

  // Dispara evento para aba da cozinha (se aberta)
  window.dispatchEvent(new StorageEvent('storage', {
    key: LS_KEY,
    newValue: JSON.stringify(pedidos),
  }));

  // Histórico local
  orderCount++;
  updateOrderBadge();
  addToHistorico(pedido);

  // Reset comanda
  const mesaFechada = selectedMesa;
  selectedMesa = null;
  comanda      = [];
  document.getElementById('obs-pedido').value = '';
  document.getElementById('comanda-mesa-tag').textContent = 'Nenhuma mesa';
  buildMesaGrid();
  renderComanda();

  showSuccessFlash(mesaFechada);
}

function addToHistorico(pedido) {
  const list = document.getElementById('historico-list');
  const empty = list.querySelector('.empty-hist');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = 'hist-item';
  el.innerHTML = `
    <span class="hist-badge">Mesa ${pedido.mesa}</span>
    <div class="hist-info">
      <div class="hist-title">${pedido.itens.length} ite${pedido.itens.length > 1 ? 'ns' : 'm'} — R$ ${pedido.total.toFixed(2)}</div>
      <div class="hist-details">${pedido.itens.map(i => `${i.qty}x ${i.nome}`).join(', ')}</div>
    </div>
    <span class="hist-time">${pedido.hora}</span>`;
  list.prepend(el);
}

function renderHistorico() {
  document.getElementById('historico-list').innerHTML = '<p class="empty-hist">Nenhum pedido enviado ainda.</p>';
}

function updateOrderBadge() {
  document.getElementById('order-count-badge').textContent = orderCount;
}

function flashError(msg) {
  const btn = document.getElementById('btn-fechar');
  const orig = btn.innerHTML;
  btn.innerHTML = `<span>⚠️ ${msg}</span>`;
  btn.style.background = 'linear-gradient(135deg, #7a0000, #c0392b)';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = '';
  }, 2000);
}

function showSuccessFlash(mesa) {
  const btn = document.getElementById('btn-fechar');
  const orig = btn.innerHTML;
  btn.innerHTML = `<span>🚀 Pedido Mesa ${mesa} enviado à cozinha!</span>`;
  btn.style.background = 'linear-gradient(135deg, #0a4020, var(--green-ok))';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.background = '';
  }, 2500);
}

// ════════════════════════════════════════════════════
// COZINHA
// ════════════════════════════════════════════════════
let cozinhaInterval  = null;
let lastSeenTs       = 0;  // timestamp do pedido mais recente já renderizado

function initCozinha() {
  document.getElementById('coz-welcome').textContent =
    `Cozinha — ${currentUser.nome}`;
  lastSeenTs = 0;
  renderKanban();
  startCozinhaPolling();
}

function startCozinhaPolling() {
  // Polling a cada 2s (simula real-time para a mesma aba ou multi-abas)
  cozinhaInterval = setInterval(renderKanban, 2000);
  // Escuta mudanças de storage de outras abas
  window.addEventListener('storage', onStorageChange);
}

function stopCozinhaPolling() {
  clearInterval(cozinhaInterval);
  window.removeEventListener('storage', onStorageChange);
}

function onStorageChange(e) {
  if (e.key === LS_KEY) renderKanban();
}

function renderKanban() {
  const pedidos = getPedidos();

  const pendentes  = pedidos.filter(p => p.status === 'pendente');
  const preparando = pedidos.filter(p => p.status === 'preparando');
  const prontos    = pedidos.filter(p => p.status === 'pronto');

  // Stats
  document.getElementById('stat-pendentes').textContent  = pendentes.length;
  document.getElementById('stat-preparando').textContent = preparando.length;
  document.getElementById('stat-prontos').textContent    = prontos.length;
  document.getElementById('stat-total-coz').textContent  = pedidos.length;
  document.getElementById('notif-count').textContent     = pedidos.length;
  document.getElementById('cnt-pendentes').textContent   = pendentes.length;
  document.getElementById('cnt-preparando').textContent  = preparando.length;
  document.getElementById('cnt-prontos').textContent     = prontos.length;

  // Detectar novos pedidos
  if (pedidos.length) {
    const newest = pedidos[0];
    if (newest.ts > lastSeenTs && lastSeenTs !== 0) {
      showToast(newest);
      notifyBrowser(newest);
    }
    lastSeenTs = Math.max(lastSeenTs, newest.ts);
  } else {
    lastSeenTs = 0;
  }

  renderColuna('cards-pendentes',  pendentes,  ['btn-iniciar', 'btn-pronto'], ['🟡 Iniciar preparo', '🟢 Pronto']);
  renderColuna('cards-preparando', preparando, ['btn-pronto'],                ['🟢 Marcar como pronto']);
  renderColuna('cards-prontos',    prontos,    [],                            []);
}

function renderColuna(containerId, pedidos, btnClasses, btnLabels) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!pedidos.length) {
    container.innerHTML = '<div class="kanban-empty">Nenhum pedido aqui</div>';
    return;
  }

  pedidos.forEach(pedido => {
    const card = document.createElement('div');
    card.className = 'pedido-card';
    card.id = `card-${pedido.id}`;

    let actionsHTML = '';
    if (btnClasses.length === 2) {
      actionsHTML = `<div class="pedido-actions">
        <button class="${btnClasses[0]}" onclick="moverPedido(${pedido.id}, 'preparando')">${btnLabels[0]}</button>
        <button class="${btnClasses[1]}" onclick="moverPedido(${pedido.id}, 'pronto')">${btnLabels[1]}</button>
      </div>`;
    } else if (btnClasses.length === 1) {
      actionsHTML = `<div class="pedido-actions">
        <button class="${btnClasses[0]}" onclick="moverPedido(${pedido.id}, 'pronto')">${btnLabels[0]}</button>
      </div>`;
    }

    card.innerHTML = `
      <div class="pedido-card-head">
        <span class="pedido-mesa">🪑 Mesa ${pedido.mesa}</span>
        <span class="pedido-time">${pedido.hora}</span>
      </div>
      <div class="pedido-garcom">🛎 Garçom: <strong>${pedido.garcom}</strong></div>
      <div class="pedido-itens">
        ${pedido.itens.map(i =>
          `<div class="pedido-item-row">
            <span class="pedido-item-qty">${i.qty}x</span>
            <span>${i.emoji} ${i.nome}</span>
          </div>`
        ).join('')}
      </div>
      ${pedido.obs ? `<div class="pedido-obs">📝 ${pedido.obs}</div>` : ''}
      <div class="pedido-total">
        <span>Total</span>
        <span>R$ ${pedido.total.toFixed(2)}</span>
      </div>
      ${actionsHTML}`;

    container.appendChild(card);
  });
}

function moverPedido(id, novoStatus) {
  const pedidos = getPedidos();
  const idx = pedidos.findIndex(p => p.id === id);
  if (idx === -1) return;
  pedidos[idx].status = novoStatus;
  savePedidos(pedidos);
  renderKanban();

  // Pulse
  const card = document.getElementById(`card-${id}`);
  if (card) card.classList.add('new-order-pulse');
}

// ── Toast visual ───────────────────────────────────
function showToast(pedido) {
  const toast = document.getElementById('notif-toast');
  document.getElementById('toast-title').textContent =
    `🔔 Novo Pedido — Mesa ${pedido.mesa}`;
  document.getElementById('toast-body').textContent =
    `${pedido.itens.length} item(ns) • Garçom: ${pedido.garcom} • R$ ${pedido.total.toFixed(2)}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// ── Browser Notification API ───────────────────────
function notifyBrowser(pedido) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(`🔔 Novo Pedido — Mesa ${pedido.mesa}`, {
      body: `${pedido.itens.map(i => `${i.qty}x ${i.nome}`).join(', ')}`,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="28" font-size="30">🍽</text></svg>',
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') notifyBrowser(pedido);
    });
  }
}

// ── Solicitar permissão ao iniciar cozinha ────────
function initCozinha() {
  document.getElementById('coz-welcome').textContent =
    `Cozinha — ${currentUser.nome}`;
  lastSeenTs = 0;

  // Pede permissão de notificação
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Marca ts inicial para não disparar toast em pedidos existentes
  const pedidos = getPedidos();
  if (pedidos.length) lastSeenTs = pedidos[0].ts;

  renderKanban();
  startCozinhaPolling();
}
