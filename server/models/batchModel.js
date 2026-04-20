const db = require("../config/db");
const promiseDb = db.promise();

const createBatch = async (data) => {
  const [result] = await promiseDb.query(
    `INSERT INTO certificate_batches (name, department_id, template_id, status)
     VALUES (?, ?, ?, 'DRAFT')`,
    [data.name, data.department_id, data.template_id]
  );
  return result;
};

const createBatchEntries = async (entries) => {
  if (entries.length === 0) return;
  const values = entries.map((e) => [e.batch_id, e.mi_no, JSON.stringify(e.field_data)]);
  await promiseDb.query(
    "INSERT INTO batch_entries (batch_id, mi_no, field_data) VALUES ?",
    [values]
  );
};

const getBatchesByDept = async (department_id) => {
  const [rows] = await promiseDb.query(
    `SELECT cb.*, t.name AS template_name,
       (SELECT COUNT(*) FROM batch_entries WHERE batch_id = cb.id) AS entry_count
     FROM certificate_batches cb
     JOIN templates t ON cb.template_id = t.id
     WHERE cb.department_id = ?
     ORDER BY cb.created_at DESC`,
    [department_id]
  );
  return rows;
};

const getAllBatches = async () => {
  const [rows] = await promiseDb.query(
    `SELECT cb.*, t.name AS template_name, d.name AS department_name,
       (SELECT COUNT(*) FROM batch_entries WHERE batch_id = cb.id) AS entry_count
     FROM certificate_batches cb
     JOIN templates t ON cb.template_id = t.id
     JOIN departments d ON cb.department_id = d.id
     ORDER BY cb.created_at DESC`
  );
  return rows;
};

const getBatchById = async (id) => {
  const [rows] = await promiseDb.query(
    `SELECT cb.*, t.name AS template_name 
     FROM certificate_batches cb
     JOIN templates t ON cb.template_id = t.id
     WHERE cb.id = ?`,
    [id]
  );
  return rows[0] || null;
};

const getBatchEntries = async (batch_id) => {
  const [rows] = await promiseDb.query(
    "SELECT * FROM batch_entries WHERE batch_id = ? ORDER BY id",
    [batch_id]
  );
  return rows;
};

const getEntryWithBatch = async (entry_id) => {
  const [rows] = await promiseDb.query(
    `SELECT be.*, cb.id AS batch_id, cb.department_id, cb.status, cb.template_id
     FROM batch_entries be
     JOIN certificate_batches cb ON be.batch_id = cb.id
     WHERE be.id = ?`,
    [entry_id]
  );
  return rows[0] || null;
};

const updateBatchStatus = async (id, status) => {
  const released_at = status === "RELEASED" ? new Date() : null;
  const [result] = await promiseDb.query(
    "UPDATE certificate_batches SET status = ?, released_at = ? WHERE id = ?",
    [status, released_at, id]
  );
  return result;
};

const updateEntryUrl = async (entry_id, certificate_url) => {
  await promiseDb.query(
    "UPDATE batch_entries SET certificate_url = ? WHERE id = ?",
    [certificate_url, entry_id]
  );
};

const revokeEntryById = async (entry_id) => {
  const [result] = await promiseDb.query(
    "UPDATE batch_entries SET revoked_at = NOW() WHERE id = ?",
    [entry_id]
  );
  return result;
};

const revokeBatchEntriesByBatchId = async (batch_id) => {
  const [result] = await promiseDb.query(
    "UPDATE batch_entries SET revoked_at = NOW() WHERE batch_id = ? AND revoked_at IS NULL",
    [batch_id]
  );
  return result;
};

const countUnrevokedEntriesByBatchId = async (batch_id) => {
  const [rows] = await promiseDb.query(
    "SELECT COUNT(*) AS total FROM batch_entries WHERE batch_id = ? AND revoked_at IS NULL",
    [batch_id]
  );
  return rows[0]?.total || 0;
};

const deleteBatch = async (id) => {
  // batch_entries cascade-deleted via FK
  const [result] = await promiseDb.query(
    "DELETE FROM certificate_batches WHERE id = ?",
    [id]
  );
  return result;
};

// ─── For future student portal ───
const getReleasedCertsByMiNo = async (mi_no) => {
  const [rows] = await promiseDb.query(
    `SELECT be.*, cb.name AS batch_name, cb.status, cb.released_at,
            t.name AS template_name, t.background_url, t.fields_json,
            d.name AS department_name
     FROM batch_entries be
     JOIN certificate_batches cb ON be.batch_id = cb.id
     JOIN templates t ON cb.template_id = t.id
     JOIN departments d ON cb.department_id = d.id
     WHERE be.mi_no = ? AND cb.status = 'RELEASED' AND be.revoked_at IS NULL
     ORDER BY cb.released_at DESC`,
    [mi_no]
  );
  return rows;
};

module.exports = {
  createBatch,
  createBatchEntries,
  getBatchesByDept,
  getAllBatches,
  getBatchById,
  getBatchEntries,
  getEntryWithBatch,
  updateBatchStatus,
  updateEntryUrl,
  revokeEntryById,
  revokeBatchEntriesByBatchId,
  countUnrevokedEntriesByBatchId,
  deleteBatch,
  getReleasedCertsByMiNo,
};
