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

const getAnchoredTextPosition = (doc, text, x, y, originX, originY, fontSize) => {
  const textWidth = doc.widthOfString(text);
  const textHeight = Number(fontSize) || doc.currentLineHeight();
  const numericX = Number(x) || 0;
  const numericY = Number(y) || 0;

  let anchoredX = numericX;
  if (originX === "center") anchoredX = numericX - textWidth / 2;
  if (originX === "right") anchoredX = numericX - textWidth;

  let anchoredY = numericY;
  if (originY === "center") anchoredY = numericY - textHeight / 2;
  if (originY === "bottom") anchoredY = numericY - textHeight;

  return { x: anchoredX, y: anchoredY };
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

      const x = field.centerX ?? field.x;
      const y = field.centerY ?? field.y;
      const fontSize = field.fontSize || 24;
      const fontColor = field.fontColor || "#000000";
      // Use center anchoring for certificate text placement to avoid legacy top-left drift.
      const originX = "center";
      const originY = "center";

      doc.fontSize(fontSize).fillColor(fontColor).strokeColor(fontColor).lineWidth(0.35);

      const text = String(value);
      const anchored = getAnchoredTextPosition(doc, text, x, y, originX, originY, fontSize);

      doc.text(text, anchored.x, anchored.y, {
        lineBreak: false,
        fill: true,
        stroke: true,
      });
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

      const x = field.centerX ?? field.x;
      const y = field.centerY ?? field.y;
      const fontSize = field.fontSize || 24;
      const fontColor = field.fontColor || "#000000";
      // Use center anchoring for certificate text placement to avoid legacy top-left drift.
      const originX = "center";
      const originY = "center";

      doc.fontSize(fontSize).fillColor(fontColor).strokeColor(fontColor).lineWidth(0.35);

      const text = String(value);
      const anchored = getAnchoredTextPosition(doc, text, x, y, originX, originY, fontSize);

      doc.text(text, anchored.x, anchored.y, {
        lineBreak: false,
        fill: true,
        stroke: true,
      });
    });

    doc.end();
  });
};

module.exports = { generateCertificatePDF, generateCertificatePDFBuffer };