const fs = require("fs");
const path = require("path");

const explicitPath = process.env.USER_MI_MAPPING_CSV_PATH;
// Always read from user_backend/data (where admin portal uploads)
const csvPath = path.join(__dirname, "../../../user_backend/data/user_mi_mapping.csv");

const parseCsvLine = (line) => {
  const parts = line.split(",").map((value) => value.trim());
  return {
    email: (parts[0] || "").toLowerCase(),
    miNo: parts[1] || "",
  };
};

const getCsvPath = () => {
  if (explicitPath && explicitPath.trim()) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.resolve(process.cwd(), explicitPath);
  }

  return csvPath;
};

const getMiNoByEmail = (email) => {
  const inputEmail = String(email || "").trim().toLowerCase();
  if (!inputEmail) {
    return null;
  }

  const csvPath = getCsvPath();
  if (!fs.existsSync(csvPath)) {
    return null;
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  if (!lines.length) {
    return null;
  }

  const rows = lines[0].toLowerCase().includes("email") ? lines.slice(1) : lines;

  for (const row of rows) {
    const parsed = parseCsvLine(row);
    if (parsed.email === inputEmail) {
      return parsed.miNo || null;
    }
  }

  return null;
};

module.exports = {
  getMiNoByEmail,
};
