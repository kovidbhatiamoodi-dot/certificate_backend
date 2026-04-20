const fs = require("fs");
const path = require("path");

const CENTRAL_MAPPING_PATH = path.join(__dirname, "../../../user_backend/data/user_mi_mapping.csv");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMiNo = (value) => String(value || "").trim().toUpperCase();

const getMiNo = (row) => row.mi_no || row.mi_no_ || row.mino || row.miNo;

const collectValidMappings = (rows) => {
  const emailToMi = new Map();
  const miToEmail = new Map();
  const skippedRows = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = normalizeEmail(row.email);
    const miNo = normalizeMiNo(getMiNo(row));
    const rowSnapshot = { ...row, email, mi_no: miNo };

    if (!email || !miNo) {
      skippedRows.push({
        rowNumber,
        reason: "Missing email or mi_no",
        row: rowSnapshot,
      });
      return;
    }

    const existingMiForEmail = emailToMi.get(email);
    if (existingMiForEmail && existingMiForEmail !== miNo) {
      skippedRows.push({
        rowNumber,
        reason: `Email '${email}' already mapped to MI number '${existingMiForEmail}'`,
        row: rowSnapshot,
      });
      return;
    }

    const existingEmailForMi = miToEmail.get(miNo);
    if (existingEmailForMi && existingEmailForMi !== email) {
      skippedRows.push({
        rowNumber,
        reason: `MI number '${miNo}' already mapped to email '${existingEmailForMi}'`,
        row: rowSnapshot,
      });
      return;
    }

    emailToMi.set(email, miNo);
    miToEmail.set(miNo, email);
  });

  return { emailToMi, skippedRows };
};

const replaceCentralMapping = (rows) => {
  const { emailToMi, skippedRows } = collectValidMappings(rows);

  if (emailToMi.size === 0) {
    return {
      total: 0,
      skippedRows,
      filePath: CENTRAL_MAPPING_PATH,
      message: "No valid rows found. CSV must contain email and mi_no values",
    };
  }

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
    skippedRows,
    filePath: CENTRAL_MAPPING_PATH,
  };
};

module.exports = {
  replaceCentralMapping,
};
