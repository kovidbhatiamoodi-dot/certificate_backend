const templateModel = require("../models/templateModel");

// ─── CREATE ───
exports.createTemplate = async (req, res) => {
  try {
    const { name, background_url, fields_json } = req.body;
    const department_id = req.admin.role === "superadmin"
      ? req.body.department_id
      : req.admin.department_id;

    if (!name || !department_id) {
      return res.status(400).json({ message: "Name and department are required" });
    }

    const result = await templateModel.createTemplate({
      name,
      department_id,
      background_url: background_url || "",
      fields_json: fields_json || { canvasWidth: 800, canvasHeight: 565, fields: [] },
    });

    res.json({ message: "Template created", id: result.insertId });
  } catch (err) {
    console.error("Create template error:", err);
    res.status(500).json({ message: "Failed to create template" });
  }
};

// ─── GET (department-scoped) ───
exports.getTemplates = async (req, res) => {
  try {
    let templates;
    if (req.admin.role === "superadmin") {
      templates = await templateModel.getAllTemplates();
    } else {
      templates = await templateModel.getTemplatesByDept(req.admin.department_id);
    }

    // Parse fields_json if stored as string
    templates = templates.map((t) => ({
      ...t,
      fields_json: typeof t.fields_json === "string" ? JSON.parse(t.fields_json) : t.fields_json,
    }));

    res.json(templates);
  } catch (err) {
    console.error("Get templates error:", err);
    res.status(500).json({ message: "Failed to fetch templates" });
  }
};

// ─── DEPARTMENTS (for superadmin template assignment) ───
exports.getDepartments = async (req, res) => {
  try {
    const departments = await templateModel.getDepartments();
    res.json(departments);
  } catch (err) {
    console.error("Get departments error:", err);
    res.status(500).json({ message: "Failed to fetch departments" });
  }
};

// ─── GET ONE ───
exports.getTemplateById = async (req, res) => {
  try {
    const template = await templateModel.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Check department access
    if (req.admin.role !== "superadmin" && template.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    template.fields_json = typeof template.fields_json === "string"
      ? JSON.parse(template.fields_json)
      : template.fields_json;

    res.json(template);
  } catch (err) {
    console.error("Get template error:", err);
    res.status(500).json({ message: "Failed to fetch template" });
  }
};

// ─── UPDATE ───
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, background_url, fields_json } = req.body;

    const existing = await templateModel.getTemplateById(id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Check department access
    if (req.admin.role !== "superadmin" && existing.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await templateModel.updateTemplate(id, {
      name: name || existing.name,
      background_url: background_url || existing.background_url,
      fields_json: fields_json || existing.fields_json,
    });

    res.json({ message: "Template updated" });
  } catch (err) {
    console.error("Update template error:", err);
    res.status(500).json({ message: "Failed to update template" });
  }
};

// ─── DELETE ───
exports.deleteTemplate = async (req, res) => {
  try {
    const existing = await templateModel.getTemplateById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (req.admin.role !== "superadmin" && existing.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    await templateModel.deleteTemplate(req.params.id);
    res.json({ message: "Template deleted" });
  } catch (err) {
    console.error("Delete template error:", err);
    res.status(500).json({ message: "Failed to delete template" });
  }
};