const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/voice-to-chart.db');
const DATA_DIR = path.dirname(DB_PATH);

// 데이터 디렉토리 생성
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// WAL 모드 (동시 읽기/쓰기 성능 향상)
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// prepared statement 저장소 (initDatabase 후 초기화됨)
let customerQueries = {};
let traitQueries = {};
let safetyQueries = {};
let procedureQueries = {};
let consultationQueries = {};
let concernQueries = {};

// 스키마 초기화 + prepared statement 생성
function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
  console.log('[DB] 데이터베이스 초기화 완료:', DB_PATH);

  // 테이블 생성 후 prepared statement 생성
  customerQueries = {
    create: db.prepare(`
      INSERT INTO customers (id, name, gender, birth_year, phone, visit_source, occupation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getById: db.prepare('SELECT * FROM customers WHERE id = ?'),
    getByName: db.prepare('SELECT * FROM customers WHERE name LIKE ?'),
    getAll: db.prepare('SELECT * FROM customers ORDER BY updated_at DESC'),
    update: db.prepare(`
      UPDATE customers SET name=?, gender=?, birth_year=?, phone=?, visit_source=?, occupation=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `),
  };

  traitQueries = {
    upsert: db.prepare(`
      INSERT INTO customer_traits (id, customer_id, pain_sensitivity, personality, decision_style, complaint_history, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        pain_sensitivity=excluded.pain_sensitivity,
        personality=excluded.personality,
        decision_style=excluded.decision_style,
        complaint_history=excluded.complaint_history,
        notes=excluded.notes,
        updated_at=CURRENT_TIMESTAMP
    `),
    getByCustomer: db.prepare('SELECT * FROM customer_traits WHERE customer_id = ?'),
  };

  safetyQueries = {
    upsert: db.prepare(`
      INSERT INTO safety_info (id, customer_id, allergies, medications, conditions, pregnancy_status, keloid_tendency, anesthesia_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        allergies=excluded.allergies,
        medications=excluded.medications,
        conditions=excluded.conditions,
        pregnancy_status=excluded.pregnancy_status,
        keloid_tendency=excluded.keloid_tendency,
        anesthesia_notes=excluded.anesthesia_notes,
        updated_at=CURRENT_TIMESTAMP
    `),
    getByCustomer: db.prepare('SELECT * FROM safety_info WHERE customer_id = ?'),
  };

  procedureQueries = {
    create: db.prepare(`
      INSERT INTO procedure_history (id, customer_id, procedure_date, procedure_name, area, detail, clinic, practitioner, result, result_icon, problem_notes, is_warning, warning_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getByCustomer: db.prepare('SELECT * FROM procedure_history WHERE customer_id = ? ORDER BY procedure_date DESC'),
    getWarnings: db.prepare('SELECT * FROM procedure_history WHERE customer_id = ? AND is_warning = 1'),
  };

  consultationQueries = {
    create: db.prepare(`
      INSERT INTO consultations (id, customer_id, consultant, consultation_type, mode, target_lang, raw_transcript, chart_output, summary, recording_path, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getById: db.prepare('SELECT * FROM consultations WHERE id = ?'),
    getByCustomer: db.prepare('SELECT * FROM consultations WHERE customer_id = ? ORDER BY created_at DESC'),
    getRecent: db.prepare('SELECT * FROM consultations ORDER BY created_at DESC LIMIT ?'),
    updateChart: db.prepare('UPDATE consultations SET chart_output=?, summary=? WHERE id=?'),
  };

  concernQueries = {
    create: db.prepare(`
      INSERT INTO consultation_concerns (id, consultation_id, category, subcategory, customer_expression, current_status, desired_result, recommended_procedure, recommendation_detail, expected_effect, decision, decision_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    getByConsultation: db.prepare('SELECT * FROM consultation_concerns WHERE consultation_id = ?'),
  };

  console.log('[DB] Prepared statements 준비 완료');
}

// 고객 전체 프로필 조회
function getFullCustomerProfile(customerId) {
  const customer = customerQueries.getById.get(customerId);
  if (!customer) return null;

  return {
    ...customer,
    traits: traitQueries.getByCustomer.get(customerId) || null,
    safety: safetyQueries.getByCustomer.get(customerId) || null,
    procedures: procedureQueries.getByCustomer.all(customerId),
    warnings: procedureQueries.getWarnings.all(customerId),
    consultations: consultationQueries.getByCustomer.all(customerId),
  };
}

module.exports = {
  db,
  initDatabase,
  get customerQueries() { return customerQueries; },
  get traitQueries() { return traitQueries; },
  get safetyQueries() { return safetyQueries; },
  get procedureQueries() { return procedureQueries; },
  get consultationQueries() { return consultationQueries; },
  get concernQueries() { return concernQueries; },
  getFullCustomerProfile,
};
