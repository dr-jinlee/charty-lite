const express = require('express');
const router = express.Router();
const dbModule = require('../database/db');

// 차트 템플릿 목록
router.get('/templates', (req, res) => {
  try {
    const templates = dbModule.db.prepare('SELECT * FROM chart_templates ORDER BY is_default DESC').all();
    res.json(templates);
  } catch (err) {
    res.json([]);
  }
});

// 차트 템플릿 생성
router.post('/templates', (req, res) => {
  try {
    const { id, name, template_type, template_content, is_default } = req.body;
    dbModule.db.prepare(`
      INSERT INTO chart_templates (id, name, template_type, template_content, is_default)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, template_type, template_content, is_default ? 1 : 0);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 용어 사전 목록
router.get('/terminology', (req, res) => {
  try {
    const category = req.query.category;
    let terms;
    if (category) {
      terms = dbModule.db.prepare('SELECT * FROM terminology WHERE category = ?').all(category);
    } else {
      terms = dbModule.db.prepare('SELECT * FROM terminology').all();
    }
    res.json(terms);
  } catch (err) {
    res.json([]);
  }
});

module.exports = router;
