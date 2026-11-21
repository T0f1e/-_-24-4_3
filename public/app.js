const API = '/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

function showMsg(formId, text, type = 'error') {
  const el = document.querySelector(`[data-msg="${formId}"]`);
  if (!el) return;
  el.textContent = text;
  el.className = `msg ${type}`;
  setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 5000);
}

function setSession(t, u) {
  token = t; user = u;
  localStorage.setItem('token', t);
  localStorage.setItem('user', JSON.stringify(u));
}

function clearSession() {
  token = null; user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.main-tabs .tab').forEach(t => t.classList.remove('active'));
  document.getElementById(name + '-view').classList.add('active');
  const tab = document.querySelector(`.main-tabs [data-view="${name}"]`);
  if (tab) tab.classList.add('active');
}

// Вкладки авторизации
document.querySelectorAll('#auth-screen .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#auth-screen .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#auth-screen .tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-form').classList.add('active');
  });
});

// Вкладки главного экрана
document.querySelectorAll('.main-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => showView(tab.dataset.view));
});

// Регистрация
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), password: fd.get('password') }),
    });
    setSession(data.token, data.user);
    renderMain();
  } catch (err) { showMsg('register', err.message); }
});

// Вход
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: fd.get('email'), password: fd.get('password') }),
    });
    setSession(data.token, data.user);
    renderMain();
  } catch (err) { showMsg('login', err.message); }
});

// Восстановление пароля
document.getElementById('forgot-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = e.target.email.value;
  try {
    const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    showMsg('forgot', data.message + (data.resetToken ? ` (токен: ${data.resetToken})` : ''), 'success');
    if (data.resetToken) {
      document.getElementById('reset-block').style.display = 'block';
      document.getElementById('reset-token').value = data.resetToken;
    }
  } catch (err) { showMsg('forgot', err.message); }
});

document.getElementById('reset-submit').addEventListener('click', async () => {
  const t = document.getElementById('reset-token').value;
  const p = document.getElementById('reset-password').value;
  try {
    const data = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: t, newPassword: p }) });
    showMsg('reset', data.message, 'success');
  } catch (err) { showMsg('reset', err.message); }
});

// Выход
document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  showScreen('auth');
});

function renderMain() {
  if (!user) { showScreen('auth'); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('main-screen').classList.add('active');
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-role').textContent = user.role === 'admin' ? 'Руководитель' : 'Сотрудник';
  document.getElementById('employees-tab').style.display = user.role === 'admin' ? '' : 'none';
  loadProfile();
  if (user.role === 'admin') loadEmployees();
  showView('profile');
}

async function loadProfile() {
  try {
    const { user: u } = await api('/auth/me');
    const form = document.getElementById('profile-form');
    form.name.value = u.name;
    form.email.value = u.email;
    form.phone.value = u.phone || '';
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('Недействительный')) { clearSession(); showScreen('auth'); }
  }
}

document.getElementById('profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    const data = await api('/auth/me', { method: 'PUT', body: JSON.stringify({ name: fd.get('name'), phone: fd.get('phone') }) });
    user = data.user;
    localStorage.setItem('user', JSON.stringify(data.user));
    document.getElementById('user-name').textContent = data.user.name;
    showMsg('profile', 'Профиль сохранён', 'success');
  } catch (err) { showMsg('profile', err.message); }
});

let employeesCache = [];
let lastSearchQuery = '';

async function loadEmployees(query = '') {
  lastSearchQuery = query;
  try {
    const p = query ? `/employees/search?q=${encodeURIComponent(query)}` : '/employees';
    const { employees } = await api(p);
    employeesCache = employees;
    renderEmployees(employees, !!query);
  } catch (err) { showMsg('employees', err.message); }
}

function renderEmployees(list, isSearch) {
  const container = document.getElementById('emp-list');
  if (!list.length) {
    container.innerHTML = `<div class="empty">${isSearch ? 'Сотрудники не найдены' : 'Сотрудники ещё не добавлены'}</div>`;
    return;
  }
  container.innerHTML = list.map(emp => `
    <div class="list-item" data-id="${emp.id}">
      <div class="list-item-info">
        <strong>${escapeHtml(emp.name)}</strong>
        <small>${escapeHtml(emp.email)}${emp.phone ? ' · ' + escapeHtml(emp.phone) : ''}</small>
      </div>
      <div class="list-item-actions">
        <button type="button" class="btn secondary" data-action="edit">Изменить</button>
        <button type="button" class="btn danger" data-action="delete">Удалить</button>
      </div>
    </div>
  `).join('');
  container.querySelectorAll('.list-item').forEach(item => {
    const id = item.dataset.id;
    item.querySelector('[data-action="edit"]').addEventListener('click', () => openEmployeeModal(id));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => confirmDeleteEmployee(id));
  });
}

let searchTimer;
document.getElementById('emp-search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadEmployees(e.target.value), 300);
});

function openEmployeeModal(id = null) {
  const emp = id ? employeesCache.find(e => String(e.id) === String(id)) : null;
  document.getElementById('modal-title').textContent = emp ? 'Редактирование сотрудника' : 'Новый сотрудник';
  document.getElementById('modal-body').innerHTML = `
    <form id="emp-form" onsubmit="return false">
      <label>Имя<input type="text" name="name" required value="${escapeHtml(emp?.name || '')}"></label>
      <label>Email<input type="email" name="email" required value="${escapeHtml(emp?.email || '')}"></label>
      <label>Телефон<input type="text" name="phone" value="${escapeHtml(emp?.phone || '')}"></label>
      ${!emp ? '<label>Пароль (по умолчанию: default123)<input type="text" name="password"></label>' : ''}
      <div class="row" style="justify-content:flex-end;">
        <button type="button" class="btn secondary" data-close>Отмена</button>
        <button type="submit" class="btn primary">Сохранить</button>
      </div>
      <div class="msg" data-msg="emp-modal"></div>
    </form>`;
  openModal();
  document.getElementById('emp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = { name: fd.get('name'), email: fd.get('email'), phone: fd.get('phone') };
    if (!emp) body.password = fd.get('password');
    try {
      if (emp) await api(`/employees/${emp.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await api('/employees', { method: 'POST', body: JSON.stringify(body) });
      closeModal();
      loadEmployees(lastSearchQuery);
    } catch (err) { showMsg('emp-modal', err.message); }
  });
}

function confirmDeleteEmployee(id) {
  const emp = employeesCache.find(e => String(e.id) === String(id));
  if (!emp) return;
  document.getElementById('modal-title').textContent = 'Удалить сотрудника?';
  document.getElementById('modal-body').innerHTML = `
    <p>Вы действительно хотите удалить <strong>${escapeHtml(emp.name)}</strong>?</p>
    <div class="row" style="justify-content:flex-end;">
      <button type="button" class="btn secondary" data-close>Отмена</button>
      <button type="button" class="btn danger" id="confirm-delete">Удалить</button>
    </div>
    <div class="msg" data-msg="emp-modal"></div>`;
  openModal();
  document.getElementById('confirm-delete').addEventListener('click', async () => {
    try {
      await api(`/employees/${id}`, { method: 'DELETE' });
      closeModal();
      loadEmployees(lastSearchQuery);
    } catch (err) { showMsg('emp-modal', err.message); }
  });
}

document.getElementById('add-emp-btn').addEventListener('click', () => openEmployeeModal());

function openModal() { document.getElementById('modal').classList.remove('hidden'); }
function closeModal() { document.getElementById('modal').classList.add('hidden'); }
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.hasAttribute('data-close')) closeModal();
});

// Старт
if (token && user) renderMain();
else showScreen('auth');