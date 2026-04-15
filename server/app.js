const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// ─── Middleware ───
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// ─── Ensure upload directories exist ───
const uploadDirs = ["uploads/templates", "uploads/certificates", "uploads/temp"];
uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ─── Static files ───
app.use("/uploads", express.static("uploads"));

// ─── Routes ───
const authRoutes = require("./routes/authRoutes");
const templateRoutes = require("./routes/templateRoutes");
const batchRoutes = require("./routes/batchRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const identityMappingRoutes = require("./routes/identityMappingRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/batches", batchRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/identity-mapping", identityMappingRoutes);

// ─── Health check ───
app.get("/", (req, res) => {
  res.json({ status: "API Running", version: "2.0" });
});

// ─── Global error handler ───
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: err.message || "Internal server error" });
});

module.exports = app;