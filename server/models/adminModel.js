const db = require("../config/db");
const promiseDb = db.promise();

const findAdminByEmail = async (email) => {
  const [rows] = await promiseDb.query(
    `SELECT a.*, d.name AS department_name 
     FROM admins a 
     LEFT JOIN departments d ON a.department_id = d.id 
     WHERE a.email = ?`,
    [email]
  );
  return rows[0] || null;
};

module.exports = { findAdminByEmail };