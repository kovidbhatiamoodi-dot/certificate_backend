const { parseCSV } = require("../services/csvService");
const { replaceCentralMapping } = require("../services/identityMappingService");

exports.uploadIdentityMapping = async (req, res) => {
  try {
    if (req.admin?.role !== "superadmin") {
      return res.status(403).json({ message: "Only superadmin can upload identity mapping" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required" });
    }

    const rows = await parseCSV(req.file.path);
    const result = await replaceCentralMapping(rows);

    return res.json({
      message: result.message || "Central identity mapping updated successfully",
      total: result.total,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      unchangedCount: result.unchangedCount,
      skippedCount: result.skippedRows.length,
      skippedReasonSummary: result.skippedReasonSummary,
      skippedReport: result.skippedReport,
      skippedRows: result.skippedRows,
    });
  } catch (err) {
    return res.status(400).json({ message: err.message || "Failed to update mapping" });
  }
};
