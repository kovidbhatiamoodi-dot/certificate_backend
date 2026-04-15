const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const authMiddleware = require("../middlewares/authMiddleware");
const templateController = require("../controllers/templateController");

// ─── Multer config for template images ───
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/templates/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// CRUD
router.post("/", authMiddleware, templateController.createTemplate);
router.get("/", authMiddleware, templateController.getTemplates);
router.get("/departments", authMiddleware, templateController.getDepartments);
router.get("/:id", authMiddleware, templateController.getTemplateById);
router.put("/:id", authMiddleware, templateController.updateTemplate);
router.delete("/:id", authMiddleware, templateController.deleteTemplate);

// Image upload
router.post(
  "/upload-image",
  authMiddleware,
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
      imageUrl: `/uploads/templates/${req.file.filename}`,
    });
  }
);

module.exports = router;