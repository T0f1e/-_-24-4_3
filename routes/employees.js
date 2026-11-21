const express = require('express');
const bcrypt = require('../.gitignore/node_modules/bcryptjs/umd');
const db = require('../db');
const { authRequired, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired, adminOnly);

// Карточка 7. Список сотрудников
router.get('/', (req, res) => {
  const employees = db.prepare(
    "SELECT id, name, email, phone FROM users WHERE role = 'employee' ORDER BY name"
  ).all();
  res.json({ employees });
});

// Карточка 10. Поиск сотрудников
router.get('/search', (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json({ employees: [] });

  const employees = db.prepare(
    "SELECT id, name, email, phone FROM users WHERE role = 'employee' AND name LIKE ? ORDER BY name LIMIT 50"
  ).all(`%${q}%`);
  res.json({ employees });
});

// Карточка 6. Добавление сотрудника
router.post('/', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Имя обязательно' });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email обязателен' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  }

  const finalPassword = password && password.length >= 6 ? password : 'default123';
  const hash = bcrypt.hashSync(finalPassword, 10);

  const result = db.prepare(
    "INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'employee')"
  ).run(name, email, phone, hash);

  res.status(201).json({
    message: 'Сотрудник добавлен',
    employee: { id: result.lastInsertRowid, name, email, phone }
  });
});

// Карточка 9. Редактирование сотрудника
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { name, email, phone } = req.body;

  const target = db.prepare("SELECT id, email FROM users WHERE id = ? AND role = 'employee'").get(id);
  if (!target) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Имя не может быть пустым' });
  }

  if (email && email !== target.email) {
    const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
    if (dup) {
      return res.status(409).json({ error: 'Email уже используется' });
    }
  }

  db.prepare('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?')
    .run(name, email || target.email, phone, id);

  const updated = db.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').get(id);
  res.json({ message: 'Данные обновлены', employee: updated });
});

// Карточка 8. Удаление сотрудника
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  const target = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'employee'").get(id);
  
  if (!target) {
    return res.status(404).json({ error: 'Сотрудник не найден' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ message: 'Сотрудник удален' });
});

module.exports = router;