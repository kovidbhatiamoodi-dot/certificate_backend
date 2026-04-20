const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const getTemplateCanvasConfig = (template) => {
  let fieldsConfig = template.fields_json;
  if (typeof fieldsConfig === "string") {
    fieldsConfig = JSON.parse(fieldsConfig);
  }

  return {
    canvasWidth: fieldsConfig.canvasWidth || 800,
    canvasHeight: fieldsConfig.canvasHeight || 565,
    fields: fieldsConfig.fields || [],
  };
};

/**
 * Generate a certificate PDF.
 * @param {Object} template - { background_url, fields_json: { canvasWidth, canvasHeight, fields: [...] } }
 * @param {Object} fieldData - { name: "Rahul", competition: "CodeWars", ... }
 * @param {string} outputPath - absolute path for the output PDF
 */
const generateCertificatePDF = (template, fieldData, outputPath) => {
  return new Promise((resolve, reject) => {
    const { canvasWidth, canvasHeight, fields } = getTemplateCanvasConfig(template);

    const doc = new PDFDocument({
      size: [canvasWidth, canvasHeight],
      layout: canvasWidth >= canvasHeight ? "landscape" : "portrait",
      margin: 0,
    });

    // Ensure output directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Background image
    if (template.background_url) {
      try {
        // Resolve from project root (where node process runs)
        const normalizedBg = String(template.background_url).replace(/^[/\\]+/, "");
        const bgPath = path.join(process.cwd(), normalizedBg);
        if (fs.existsSync(bgPath)) {
          doc.image(bgPath, 0, 0, {
            width: canvasWidth,
            height: canvasHeight,
          });
        } else {
          console.warn("⚠️ Background image not found:", bgPath);
        }
      } catch (err) {
        console.warn("⚠️ Failed to load background:", err.message);
      }
    }

    // Render text fields
    fields.forEach((field) => {
      const value = fieldData[field.key] || "";
      if (!value) return;

      const x = field.x;
      const y = field.y;
      const fontSize = field.fontSize || 24;
      const fontColor = field.fontColor || "#000000";

      doc.fontSize(fontSize).fillColor(fontColor).strokeColor(fontColor).lineWidth(0.35);

      const text = String(value);
      const isCenterAnchored =
        (field.originX || "center") === "center" &&
        (field.originY || "center") === "center";

      if (isCenterAnchored) {
        const textWidth = doc.widthOfString(text);
        const textHeight = doc.currentLineHeight();
        doc.text(text, x - textWidth / 2, y - textHeight / 2, {
          lineBreak: false,
          fill: true,
          stroke: true,
        });
      } else {
        doc.text(text, x, y, {
          lineBreak: false,
          fill: true,
          stroke: true,
        });
      }
    });

    doc.end();

    stream.on("finish", resolve);
    stream.on("error", reject);
  });
};

const generateCertificatePDFBuffer = (template, fieldData) => {
  return new Promise((resolve, reject) => {
    const { canvasWidth, canvasHeight, fields } = getTemplateCanvasConfig(template);

    const doc = new PDFDocument({
      size: [canvasWidth, canvasHeight],
      layout: canvasWidth >= canvasHeight ? "landscape" : "portrait",
      margin: 0,
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    if (template.background_url) {
      try {
        const normalizedBg = String(template.background_url).replace(/^[/\\]+/, "");
        const bgPath = path.join(process.cwd(), normalizedBg);
        if (fs.existsSync(bgPath)) {
          doc.image(bgPath, 0, 0, {
            width: canvasWidth,
            height: canvasHeight,
          });
        }
      } catch (err) {
        console.warn("⚠️ Failed to load background:", err.message);
      }
    }

    fields.forEach((field) => {
      const value = fieldData[field.key] || "";
      if (!value) return;

      const x = field.x;
      const y = field.y;
      const fontSize = field.fontSize || 24;
      const fontColor = field.fontColor || "#000000";

      doc.fontSize(fontSize).fillColor(fontColor).strokeColor(fontColor).lineWidth(0.35);

      const text = String(value);
      const isCenterAnchored =
        (field.originX || "center") === "center" &&
        (field.originY || "center") === "center";

      if (isCenterAnchored) {
        const textWidth = doc.widthOfString(text);
        const textHeight = doc.currentLineHeight();
        doc.text(text, x - textWidth / 2, y - textHeight / 2, {
          lineBreak: false,
          fill: true,
          stroke: true,
        });
      } else {
        doc.text(text, x, y, {
          lineBreak: false,
          fill: true,
          stroke: true,
        });
      }
    });

    doc.end();
  });
};

module.exports = { generateCertificatePDF, generateCertificatePDFBuffer };