const batchModel = require("../models/batchModel");
const templateModel = require("../models/templateModel");
const { generateCertificatePDFBuffer } = require("../services/pdfService");
const { getMiNoByEmail } = require("../services/userMiMappingService");

const normalizePath = (value, fallback) => {
  const raw = String(value || fallback || "").trim();
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
};

const API_BASE_PATH = normalizePath(process.env.API_BASE_PATH, "/api");
const API_CERTIFICATES_ROUTE = normalizePath(process.env.API_CERTIFICATES_ROUTE, "/certificates");
const CERTIFICATE_DOWNLOAD_BASE = `${API_BASE_PATH}${API_CERTIFICATES_ROUTE}/download`;

// ─── RELEASE BATCH (no local file storage; use on-demand generation) ───
exports.releaseBatch = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await batchModel.getBatchById(id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (req.admin.role !== "superadmin" && batch.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (batch.status === "RELEASED") {
      return res.status(400).json({ message: "Batch already released" });
    }

    // Get entries
    const entries = await batchModel.getBatchEntries(id);
    if (entries.length === 0) {
      return res.status(400).json({ message: "No entries in this batch" });
    }

    let successCount = 0;
    let errorCount = 0;

    // Save dynamic certificate URLs; PDFs are generated per-download in memory.
    for (const entry of entries) {
      try {
        const certUrl = `${CERTIFICATE_DOWNLOAD_BASE}/${entry.id}`;
        await batchModel.updateEntryUrl(entry.id, certUrl);
        successCount++;
      } catch (err) {
        console.error(`Failed to prepare cert URL for entry ${entry.id}:`, err.message);
        errorCount++;
      }
    }

    // Mark batch as released
    await batchModel.updateBatchStatus(id, "RELEASED");

    res.json({
      message: "Batch released successfully ✅ (PDFs generated on download)",
      successCount,
      errorCount,
      total: entries.length,
    });
  } catch (err) {
    console.error("Release batch error:", err);
    res.status(500).json({ message: "Failed to release batch" });
  }
};

// ─── USER: Get certificates for logged-in user via email-to-MI mapping ───
exports.getMyCertificates = async (req, res) => {
  try {
    const email = req.user?.email;
    const miNo = getMiNoByEmail(email);

    if (!miNo) {
      return res.status(403).json({
        message: "No MI number mapped for this email. Contact admin.",
      });
    }

    const certs = await batchModel.getReleasedCertsByMiNo(miNo);
    const certificates = certs.map((item) => ({
      id: item.id,
      batch_name: item.batch_name,
      department_name: item.department_name,
      template_name: item.template_name,
      released_at: item.released_at,
      field_data: typeof item.field_data === "string" ? JSON.parse(item.field_data) : item.field_data,
      download_url: `${CERTIFICATE_DOWNLOAD_BASE}/${item.id}`,
    }));

    return res.json({
      email,
      miNo,
      certificates,
    });
  } catch (err) {
    console.error("Get my certificates error:", err);
    return res.status(500).json({ message: "Failed to fetch certificates" });
  }
};

// ─── DOWNLOAD (admin or user; generate one PDF on demand, no local file write) ───
exports.downloadCertificate = async (req, res) => {
  try {
    const { entry_id } = req.params;

    const entry = await batchModel.getEntryWithBatch(entry_id);
    if (!entry) {
      return res.status(404).json({ message: "Certificate entry not found" });
    }

    if (entry.status !== "RELEASED") {
      return res.status(400).json({ message: "Batch is not released yet" });
    }

    if (req.admin) {
      if (
        req.admin.role !== "superadmin" &&
        Number(entry.department_id) !== Number(req.admin.department_id)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
    } else if (req.user) {
      const miNo = getMiNoByEmail(req.user.email);
      if (!miNo) {
        return res.status(403).json({
          message: "No MI number mapped for this email. Contact admin.",
        });
      }

      if (String(entry.mi_no).toLowerCase() !== String(miNo).toLowerCase()) {
        return res.status(403).json({ message: "Certificate does not belong to this user" });
      }
    } else {
      return res.status(401).json({ message: "Authentication required" });
    }

    const template = await templateModel.getTemplateById(entry.template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const fieldData =
      typeof entry.field_data === "string"
        ? JSON.parse(entry.field_data)
        : entry.field_data;

    const pdfBuffer = await generateCertificatePDFBuffer(template, fieldData);
    const safeMiNo = String(entry.mi_no || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `certificate_${safeMiNo}_${entry.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Download certificate error:", err);
    return res.status(500).json({ message: "Failed to generate certificate" });
  }
};

// ─── PUBLIC DOWNLOAD (for student portal) ───
// Allows downloading without admin auth but only when entry belongs to given MI number.
exports.downloadCertificatePublic = async (req, res) => {
  try {
    const { entry_id, mi_no } = req.params;

    const entry = await batchModel.getEntryWithBatch(entry_id);
    if (!entry) {
      return res.status(404).json({ message: "Certificate entry not found" });
    }

    if (entry.status !== "RELEASED") {
      return res.status(400).json({ message: "Batch is not released yet" });
    }

    if (String(entry.mi_no).toLowerCase() !== String(mi_no).toLowerCase()) {
      return res.status(403).json({ message: "Certificate does not belong to this MI number" });
    }

    const template = await templateModel.getTemplateById(entry.template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const fieldData =
      typeof entry.field_data === "string"
        ? JSON.parse(entry.field_data)
        : entry.field_data;

    const pdfBuffer = await generateCertificatePDFBuffer(template, fieldData);
    const safeMiNo = String(entry.mi_no || "certificate").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `certificate_${safeMiNo}_${entry.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("Public download certificate error:", err);
    return res.status(500).json({ message: "Failed to generate certificate" });
  }
};

// ─── PREVIEW (render one certificate preview data) ───
exports.previewCertificate = async (req, res) => {
  try {
    const { batch_id, entry_id } = req.params;

    const batch = await batchModel.getBatchById(batch_id);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    if (req.admin.role !== "superadmin" && batch.department_id !== req.admin.department_id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const template = await templateModel.getTemplateById(batch.template_id);
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    const entries = await batchModel.getBatchEntries(batch_id);
    const entry = entry_id
      ? entries.find((e) => e.id === parseInt(entry_id))
      : entries[0];

    if (!entry) {
      return res.status(404).json({ message: "Entry not found" });
    }

    const fieldData = typeof entry.field_data === "string"
      ? JSON.parse(entry.field_data)
      : entry.field_data;

    const fieldsConfig = typeof template.fields_json === "string"
      ? JSON.parse(template.fields_json)
      : template.fields_json;

    res.json({
      background_url: template.background_url,
      fields: fieldsConfig.fields || [],
      canvasWidth: fieldsConfig.canvasWidth || 800,
      canvasHeight: fieldsConfig.canvasHeight || 565,
      fieldData,
      mi_no: entry.mi_no,
    });
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ message: "Failed to generate preview" });
  }
};

// ─── PUBLIC: Get certificates by MI number (for future student portal) ───
exports.getCertificatesByMiNo = async (req, res) => {
  try {
    const { mi_no } = req.params;
    const certs = await batchModel.getReleasedCertsByMiNo(mi_no);

    const results = certs.map((c) => ({
      id: c.id,
      batch_name: c.batch_name,
      department_name: c.department_name,
      template_name: c.template_name,
      released_at: c.released_at,
      certificate_url: c.certificate_url,
      public_download_url: `/api/certificates/public/download/${c.id}/${encodeURIComponent(c.mi_no)}`,
      field_data: typeof c.field_data === "string" ? JSON.parse(c.field_data) : c.field_data,
    }));

    res.json(results);
  } catch (err) {
    console.error("Get certs by MI error:", err);
    res.status(500).json({ message: "Failed to fetch certificates" });
  }
};