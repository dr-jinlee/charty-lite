const express = require('express');
const router = express.Router();
// getter로 접근해야 하므로 모듈 자체를 가져옴
const dbModule = require('../database/db');

// 최근 상담 목록
router.get('/consultations', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  try {
    const consultations = dbModule.consultationQueries.getRecent.all(limit);
    res.json(consultations);
  } catch (err) {
    res.json([]);
  }
});

// 특정 상담 상세
router.get('/consultations/:id', (req, res) => {
  try {
    const consultation = dbModule.consultationQueries.getById.get(req.params.id);
    if (!consultation) {
      return res.status(404).json({ error: '상담 기록 없음' });
    }
    const concerns = dbModule.concernQueries.getByConsultation.all(req.params.id);
    res.json({ ...consultation, concerns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 고객별 상담 이력
router.get('/customers/:customerId/consultations', (req, res) => {
  try {
    const consultations = dbModule.consultationQueries.getByCustomer.all(req.params.customerId);
    res.json(consultations);
  } catch (err) {
    res.json([]);
  }
});

// 고객 전체 프로필
router.get('/customers/:customerId/profile', (req, res) => {
  try {
    const profile = dbModule.getFullCustomerProfile(req.params.customerId);
    if (!profile) {
      return res.status(404).json({ error: '고객 정보 없음' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
