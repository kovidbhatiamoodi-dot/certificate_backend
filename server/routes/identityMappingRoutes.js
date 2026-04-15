const express = require("express");
const multer = require("multer");

const authMiddleware = require("../middlewares/authMiddleware");
const identityMappingController = require("../controllers/identityMappingController");

const router = express.Router();
const upload = multer({ dest: "uploads/temp/" });

// Superadmin-only bulk upload for central email <-> MI mapping CSV.
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  identityMappingController.uploadIdentityMapping
);

module.exports = router;
