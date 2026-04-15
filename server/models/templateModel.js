const db = require("../config/db");
const promiseDb = db.promise();

const createTemplate = async (data) => {
  const [result] = await promiseDb.query(
    `INSERT INTO templates (name, department_id, background_url, fields_json) 
     VALUES (?, ?, ?, ?)`,
    [data.name, data.department_id, data.background_url, JSON.stringify(data.fields_json)]
  );
  return result;
};

const getTemplatesByDept = async (department_id) => {
  const [rows] = await promiseDb.query(
    "SELECT * FROM templates WHERE department_id = ? ORDER BY created_at DESC",
    [department_id]
  );
  return rows;
};

const getAllTemplates = async () => {
  const [rows] = await promiseDb.query(
    `SELECT t.*, d.name AS department_name 
     FROM templates t 
     JOIN departments d ON t.department_id = d.id 
     ORDER BY t.created_at DESC`
  );
  return rows;
};

const getTemplateById = async (id) => {
  const [rows] = await promiseDb.query("SELECT * FROM templates WHERE id = ?", [id]);
  return rows[0] || null;
};

const updateTemplate = async (id, data) => {
  const [result] = await promiseDb.query(
    `UPDATE templates SET name = ?, background_url = ?, fields_json = ? WHERE id = ?`,
    [data.name, data.background_url, JSON.stringify(data.fields_json), id]
  );
  return result;
};

const deleteTemplate = async (id) => {
  const [result] = await promiseDb.query("DELETE FROM templates WHERE id = ?", [id]);
  return result;
};

const getDepartments = async () => {
  const [rows] = await promiseDb.query(
    "SELECT id, name FROM departments ORDER BY name ASC"
  );
  return rows;
};

module.exports = {
  createTemplate,
  getTemplatesByDept,
  getAllTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  getDepartments,
};