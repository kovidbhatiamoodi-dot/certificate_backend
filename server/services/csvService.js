const csv = require("csv-parser");
const fs = require("fs");

/**
 * Parse a CSV file and return rows as an array of objects.
 * Headers are trimmed and normalized.
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(
        csv({
          mapHeaders: ({ header }) => header.trim().toLowerCase().replace(/\s+/g, "_"),
        })
      )
      .on("data", (data) => {
        // Trim all values
        const cleaned = {};
        for (const key in data) {
          cleaned[key] = data[key]?.trim() || "";
        }
        results.push(cleaned);
      })
      .on("end", () => {
        // Clean up temp file
        fs.unlink(filePath, () => {});
        resolve(results);
      })
      .on("error", (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
  });
};

module.exports = { parseCSV };