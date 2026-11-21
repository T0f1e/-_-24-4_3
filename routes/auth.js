const express = require('express');
const bcrypt = require('../.gitignore/node_modules/bcryptjs/umd');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = 'shift-planner-secret-key-2026';

// Карточка 1. Регистрация
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Укажите имя, email и пароль' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const hash = bcrypt.hashSync(password, 10);
  // Первый пользователь становится администратором
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const role = count === 0 ? 'admin' : 'employee';

  const result = db.prepare(
    'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
  ).run(name, email, hash, role);

  const user = { id: result.lastInsertRowid, name, email, role };
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({ token, user });
});

// Карточка 2. Авторизация
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный email или пароль' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Карточка 4. Восстановление пароля (упрощенно)
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  
  if (!user) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  const resetToken = Math.random().toString(36).substring(2, 15);
  db.prepare('UPDATE users SET reset_token = ? WHERE id = ?').run(resetToken, user.id);

  res.json({ message: 'Токен для сброса пароля', resetToken });
});

router.post('/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE reset_token = ?').get(token);

  if (!user) {
    return res.status(400).json({ error: 'Недействительный токен' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ?, reset_token = NULL WHERE id = ?').run(hash, user.id);

  res.json({ message: 'Пароль успешно изменен' });
});

// Карточка 5. Получение профиля
router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// Карточка 5. Редактирование профиля
router.put('/me', authRequired, (req, res) => {
  const { name, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Имя не может быть пустым' });
  }

  db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.user.id);
  const user = db.prepare('SELECT id, name, email, phone, role FROM users WHERE id = ?').get(req.user.id);
  
  res.json({ message: 'Профиль обновлен', user });
});

module.exports = router;