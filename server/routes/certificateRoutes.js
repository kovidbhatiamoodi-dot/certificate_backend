const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const certificateController = require("../controllers/certificateController");

// Release a batch (generate all PDFs)
router.post("/release/:id", authMiddleware, certificateController.releaseBatch);

// Preview a certificate in a batch (first entry)
router.get("/preview/:batch_id", authMiddleware, certificateController.previewCertificate);

// Preview a specific entry
router.get("/preview/:batch_id/:entry_id", authMiddleware, certificateController.previewCertificate);

// Download a single certificate (generated on demand, no file persistence)
router.get("/download/:entry_id", authMiddleware, certificateController.downloadCertificate);

// PUBLIC: Download by entry + MI number (for student portal)
router.get(
	"/public/download/:entry_id/:mi_no",
	certificateController.downloadCertificatePublic
);

// PUBLIC: Get certificates by MI number (for future student portal — no auth needed)
router.get("/public/:mi_no", certificateController.getCertificatesByMiNo);

module.exports = router;