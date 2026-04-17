const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const { verifyFirebaseToken } = require("../middlewares/firebaseAuthMiddleware");
const certificateDownloadAccessMiddleware = require("../middlewares/certificateDownloadAccessMiddleware");
const certificateController = require("../controllers/certificateController");

// Release a batch (generate all PDFs)
router.post("/release/:id", authMiddleware, certificateController.releaseBatch);

// Preview a certificate in a batch (first entry)
router.get("/preview/:batch_id", authMiddleware, certificateController.previewCertificate);

// Preview a specific entry
router.get("/preview/:batch_id/:entry_id", authMiddleware, certificateController.previewCertificate);

// USER: List logged-in user's certificates by mapped MI number
router.get("/me", verifyFirebaseToken, certificateController.getMyCertificates);

// Download a single certificate for admin or logged-in user (generated on demand)
router.get(
	"/download/:entry_id",
	certificateDownloadAccessMiddleware,
	certificateController.downloadCertificate
);

// PUBLIC: Download by entry + MI number (for student portal)
router.get(
	"/public/download/:entry_id/:mi_no",
	certificateController.downloadCertificatePublic
);

// PUBLIC: Get certificates by MI number (for future student portal — no auth needed)
router.get("/public/:mi_no", certificateController.getCertificatesByMiNo);

module.exports = router;