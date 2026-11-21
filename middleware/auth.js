const jwt = require('jsonwebtoken');

const JWT_SECRET = 'shift-planner-secret-key-2026';

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Требуется авторизация' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Неверный формат токена' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Недействительный токен' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Доступно только руководителю' });
  }
  next();
}

module.exports = { authRequired, adminOnly };