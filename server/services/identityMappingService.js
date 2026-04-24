const db = require("../config/db");
const promiseDb = db.promise();
const fs = require("fs");
const path = require("path");

const SKIPPED_REPORTS_DIR = path.join(__dirname, "../../uploads/temp");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeMiNo = (value) => String(value || "").trim().toUpperCase();

const normalizeKey = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const pickByKeyAlias = (row, aliases) => {
  if (!row || typeof row !== "object") {
    return "";
  }

  const aliasSet = new Set(aliases.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (aliasSet.has(normalizeKey(key))) {
      return value;
    }
  }

  return "";
};

const getEmail = (row) =>
  pickByKeyAlias(row, ["email", "email_id", "mail", "mail_id", "emailid"]);

const getMiNo = (row) =>
  pickByKeyAlias(row, ["mi_no", "mi no", "mino", "miNo", "mi_number", "mi id", "mi_id"]);

const bumpReason = (summary, reason) => {
  summary[reason] = (summary[reason] || 0) + 1;
};

const csvEscape = (value) => {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const writeSkippedRowsReport = (skippedRows) => {
  if (!skippedRows.length) {
    return null;
  }

  if (!fs.existsSync(SKIPPED_REPORTS_DIR)) {
    fs.mkdirSync(SKIPPED_REPORTS_DIR, { recursive: true });
  }

  const fileName = `identity_mapping_skipped_${Date.now()}.csv`;
  const filePath = path.join(SKIPPED_REPORTS_DIR, fileName);
  const lines = ["row_number,reason,email,mi_no,row_json"];

  for (const skipped of skippedRows) {
    lines.push(
      [
        csvEscape(skipped.rowNumber),
        csvEscape(skipped.reason),
        csvEscape(skipped.row?.email || ""),
        csvEscape(skipped.row?.mi_no || ""),
        csvEscape(JSON.stringify(skipped.row || {})),
      ].join(",")
    );
  }

  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return {
    filePath,
    fileName,
    downloadUrl: `/uploads/temp/${fileName}`,
  };
};

const loadExistingMappings = async () => {
  const emailToMi = new Map();
  const miToEmail = new Map();

  const [rows] = await promiseDb.query("SELECT email, mi_no FROM identity_mappings");

  rows.forEach((row) => {
    const email = normalizeEmail(row.email);
    const miNo = normalizeMiNo(row.mi_no);

    if (!email || !miNo) {
      return;
    }

    emailToMi.set(email, miNo);
    miToEmail.set(miNo, email);
  });

  return { emailToMi, miToEmail };
};

const collectValidMappings = async (rows) => {
  const { emailToMi, miToEmail } = await loadExistingMappings();
  const skippedRows = [];
  const skippedReasonSummary = {};
  const newMappings = [];
  let addedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;

  const pushSkipped = (rowNumber, reason, rowSnapshot) => {
    skippedRows.push({
      rowNumber,
      reason,
      row: rowSnapshot,
    });
    skippedReasonSummary[reason] = (skippedReasonSummary[reason] || 0) + 1;
  };

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const email = normalizeEmail(getEmail(row));
    const miNo = normalizeMiNo(getMiNo(row));
    const rowSnapshot = { ...row, email, mi_no: miNo };

    if (!email || !miNo) {
      pushSkipped(rowNumber, "Missing email or mi_no", rowSnapshot);
      return;
    }

    const existingMiForEmail = emailToMi.get(email);
    if (existingMiForEmail && existingMiForEmail === miNo) {
      const reason = `Duplicate mapping: email '${email}' already mapped to MI number '${miNo}'`;
      pushSkipped(rowNumber, reason, rowSnapshot);
      return;
    }

    const existingEmailForMi = miToEmail.get(miNo);

    // Existing email should never be remapped by upload; skip and report.
    if (existingMiForEmail && existingMiForEmail !== miNo) {
      pushSkipped(
        rowNumber,
        `Email '${email}' is already mapped to MI number '${existingMiForEmail}'`,
        rowSnapshot
      );
      return;
    }

    if (existingEmailForMi && existingEmailForMi !== email) {
      pushSkipped(
        rowNumber,
        `MI number '${miNo}' already mapped to email '${existingEmailForMi}'`,
        rowSnapshot
      );
      return;
    }

    emailToMi.set(email, miNo);
    miToEmail.set(miNo, email);
    newMappings.push({ email, miNo, rowNumber, rowSnapshot });
    addedCount++;
  });

  return {
    emailToMi,
    newMappings,
    skippedRows,
    skippedReasonSummary,
    addedCount,
    updatedCount,
    unchangedCount,
  };
};

const replaceCentralMapping = async (rows) => {
  const {
    emailToMi,
    newMappings,
    skippedRows,
    skippedReasonSummary,
    addedCount,
    updatedCount,
    unchangedCount,
  } = await collectValidMappings(rows);

  if (emailToMi.size === 0) {
    return {
      total: 0,
      addedCount,
      updatedCount,
      unchangedCount,
      skippedRows,
      skippedReasonSummary,
      storage: "database",
      message: "No valid rows found. CSV must contain email and mi_no values",
    };
  }

  if (newMappings.length > 0) {
    for (const mapping of newMappings) {
      try {
        await promiseDb.query(
          "INSERT INTO identity_mappings (email, mi_no) VALUES (?, ?)",
          [mapping.email, mapping.miNo]
        );
      } catch (err) {
        addedCount--;
        const reason =
          err && err.code === "ER_DUP_ENTRY"
            ? `Duplicate mapping already exists in database for email '${mapping.email}' or MI number '${mapping.miNo}'`
            : `Insert failed: ${err.message}`;

        skippedRows.push({
          rowNumber: mapping.rowNumber,
          reason,
          row: mapping.rowSnapshot,
        });
        bumpReason(skippedReasonSummary, reason);
      }
    }
  }

  const [totalRows] = await promiseDb.query("SELECT COUNT(*) AS total FROM identity_mappings");
  const skippedReport = writeSkippedRowsReport(skippedRows);

  return {
    total: Number(totalRows[0]?.total || 0),
    addedCount,
    updatedCount,
    unchangedCount,
    skippedRows,
    skippedReasonSummary,
    skippedReport,
    storage: "database",
  };
};

module.exports = {
  replaceCentralMapping,
};
