const db = require("../config/db");

const promiseDb = db.promise();

const getMiNoByEmail = async (email) => {
  const inputEmail = String(email || "").trim().toLowerCase();
  if (!inputEmail) {
    return null;
  }

  const [rows] = await promiseDb.query(
    "SELECT mi_no FROM identity_mappings WHERE LOWER(email) = LOWER(?) LIMIT 1",
    [inputEmail]
  );

  return rows[0]?.mi_no || null;
};

module.exports = {
  getMiNoByEmail,
};
