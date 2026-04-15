const batchModel = require("../models/batchModel");
const templateModel = require("../models/templateModel");
const { parseCSV } = require("../services/csvService");

// ─── CREATE BATCH (upload CSV → create batch + entries) ───
exports.createBatch = async (req, res) => {
  try {
    const { name, template_id } = req.body;
    const file = req.file;

    if (!name || !template_id || !file) {
      return res.status(400).json({ message: "Name, template, and CSV file are required" });
    }

    const department_id = req.admin.role === "superadmin"
      ? req.body.department_id
      : req.admin.department_id;

    if (!department_id) {
      return res.status(400).json({ message: "Department is required" });
    }

    // Verify template exists and belongs to this department
    const template = await templateModel.getTemplateById(template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }
    if (
      req.admin.role === "superadmin" &&
      Number(template.department_id) !== Number(department_id)
    ) {
      return res.status(400).json({
        message: "Selected template does not belong to selected department",
      });
    }
    if (req.admin.role !== "superadmin" && template.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Template belongs to another department" });
    }

    // Parse CSV
    const rows = await parseCSV(file.path);
    if (rows.length === 0) {
      return res.status(400).json({ message: "CSV file is empty" });
    }

    // Validate mi_no column exists
    const firstRow = rows[0];
    if (!firstRow.hasOwnProperty("mi_no") && !firstRow.hasOwnProperty("mi_no.")) {
      return res.status(400).json({
        message: "CSV must have a 'mi_no' column",
        columns_found: Object.keys(firstRow),
      });
    }

    // Create batch
    const batchResult = await batchModel.createBatch({
      name,
      department_id,
      template_id,
    });

    const batch_id = batchResult.insertId;

    // Create entries
    const entries = rows
      .filter((row) => row.mi_no || row["mi_no."])
      .map((row) => {
        const mi_no = row.mi_no || row["mi_no."];
        // Remove mi_no from field_data (it's stored separately)
        const field_data = { ...row };
        delete field_data.mi_no;
        delete field_data["mi_no."];

        return { batch_id, mi_no, field_data };
      });

    await batchModel.createBatchEntries(entries);

    res.json({
      message: "Batch created successfully",
      batch_id,
      entry_count: entries.length,
    });
  } catch (err) {
    console.error("Create batch error:", err);
    res.status(500).json({ message: "Failed to create batch" });
  }
};

// ─── GET ALL BATCHES (department-scoped) ───
exports.getBatches = async (req, res) => {
  try {
    let batches;
    if (req.admin.role === "superadmin") {
      batches = await batchModel.getAllBatches();
    } else {
      batches = await batchModel.getBatchesByDept(req.admin.department_id);
    }
    res.json(batches);
  } catch (err) {
    console.error("Get batches error:", err);
    res.status(500).json({ message: "Failed to fetch batches" });
  }
};

// ─── GET BATCH DETAIL ───
exports.getBatchDetail = async (req, res) => {
  try {
    const batch = await batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (req.admin.role !== "superadmin" && batch.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const entries = await batchModel.getBatchEntries(batch.id);

    // Parse field_data if string
    const parsedEntries = entries.map((e) => ({
      ...e,
      field_data: typeof e.field_data === "string" ? JSON.parse(e.field_data) : e.field_data,
    }));

    res.json({ ...batch, entries: parsedEntries });
  } catch (err) {
    console.error("Get batch detail error:", err);
    res.status(500).json({ message: "Failed to fetch batch" });
  }
};

// ─── DELETE BATCH ───
exports.deleteBatch = async (req, res) => {
  try {
    const batch = await batchModel.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (req.admin.role !== "superadmin" && batch.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (batch.status === "RELEASED") {
      return res.status(400).json({ message: "Cannot delete a released batch" });
    }

    await batchModel.deleteBatch(batch.id);
    res.json({ message: "Batch deleted" });
  } catch (err) {
    console.error("Delete batch error:", err);
    res.status(500).json({ message: "Failed to delete batch" });
  }
};
