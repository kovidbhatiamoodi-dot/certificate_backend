const fs = require("fs");
const path = require("path");

const explicitPath = process.env.USER_MI_MAPPING_CSV_PATH;
const defaultCsvPath = path.join(__dirname, "../../../user_backend/data/user_mi_mapping.csv");
const legacyLocalCsvPath = path.join(__dirname, "../../data/user_mi_mapping.csv");

const parseCsvLine = (line) => {
  const parts = line.split(",").map((value) => value.trim());
  return {
    email: (parts[0] || "").toLowerCase(),
    miNo: parts[1] || "",
  };
};

const resolvePath = (value) =>
  path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);

const getCsvPath = () => {
  if (explicitPath && explicitPath.trim()) {
    const resolvedExplicitPath = resolvePath(explicitPath.trim());

    // Prefer the admin-uploaded merged backend path if it exists.
    if (fs.existsSync(defaultCsvPath)) {
      return defaultCsvPath;
    }

    return resolvedExplicitPath;
  }

  if (fs.existsSync(defaultCsvPath)) {
    return defaultCsvPath;
  }

  return legacyLocalCsvPath;
};

const getMiNoByEmail = (email) => {
  const inputEmail = String(email || "").trim().toLowerCase();
  if (!inputEmail) {
    console.log("[getMiNoByEmail] No email provided");
    return null;
  }

  const csvPathResolved = getCsvPath();
  console.log("[getMiNoByEmail] Looking for email:", inputEmail);
  console.log("[getMiNoByEmail] CSV Path:", csvPathResolved);

  if (!fs.existsSync(csvPathResolved)) {
    console.log("[getMiNoByEmail] CSV file does not exist at:", csvPathResolved);
    return null;
  }

  const content = fs.readFileSync(csvPathResolved, "utf8");
  console.log("[getMiNoByEmail] CSV content preview:", content.split("\n").slice(0, 5).join(" | "));
  
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!lines.length) {
    console.log("[getMiNoByEmail] No lines found in CSV");
    return null;
  }

  const rows = lines[0].toLowerCase().includes("email") ? lines.slice(1) : lines;
  console.log("[getMiNoByEmail] Total rows to search:", rows.length);

  for (const row of rows) {
    const parsed = parseCsvLine(row);
    if (parsed.email === inputEmail) {
      console.log("[getMiNoByEmail] ✓ Found matching email:", inputEmail, "→ MI:", parsed.miNo);
      return parsed.miNo || null;
    }
  }

  console.log("[getMiNoByEmail] ✗ Email not found:", inputEmail);
  return null;
};

module.exports = {
  getMiNoByEmail,
};
