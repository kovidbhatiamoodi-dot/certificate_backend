const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/authMiddleware");
const batchController = require("../controllers/batchController");

const upload = multer({ dest: "uploads/temp/" });

// Create batch (with CSV upload)
router.post("/", authMiddleware, upload.single("file"), batchController.createBatch);

// Get all batches (department-scoped)
router.get("/", authMiddleware, batchController.getBatches);

// Get batch detail with entries
router.get("/:id", authMiddleware, batchController.getBatchDetail);

// Delete batch (DRAFT only)
router.delete("/:id", authMiddleware, batchController.deleteBatch);

module.exports = router;
