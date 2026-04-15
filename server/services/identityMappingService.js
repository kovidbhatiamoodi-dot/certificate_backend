const fs = require("fs");
const path = require("path");

const CENTRAL_MAPPING_PATH = path.join(__dirname, "../../../user_backend/data/user_mi_mapping.csv");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMiNo = (value) => String(value || "").trim().toUpperCase();

const ensureOneToOneMapping = (rows) => {
  const emailToMi = new Map();
  const miToEmail = new Map();

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    const miNo = normalizeMiNo(row.mi_no || row.mi_no_ || row.mino || row.miNo);

    if (!email || !miNo) {
      continue;
    }

    const existingMi = emailToMi.get(email);
    if (existingMi && existingMi !== miNo) {
      throw new Error(`Conflict: email '${email}' maps to multiple MI numbers`);
    }
    emailToMi.set(email, miNo);

    const existingEmail = miToEmail.get(miNo);
    if (existingEmail && existingEmail !== email) {
      throw new Error(`Conflict: MI number '${miNo}' maps to multiple emails`);
    }
    miToEmail.set(miNo, email);
  }

  if (emailToMi.size === 0) {
    throw new Error("No valid rows found. CSV must contain email and mi_no values");
  }

  return emailToMi;
};

const replaceCentralMapping = (rows) => {
  const emailToMi = ensureOneToOneMapping(rows);

  const dir = path.dirname(CENTRAL_MAPPING_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const lines = ["email,miNo"];
  for (const [email, miNo] of emailToMi.entries()) {
    lines.push(`${email},${miNo}`);
  }

  fs.writeFileSync(CENTRAL_MAPPING_PATH, `${lines.join("\n")}\n`, "utf8");

  return {
    total: emailToMi.size,
    filePath: CENTRAL_MAPPING_PATH,
  };
};

module.exports = {
  replaceCentralMapping,
};
