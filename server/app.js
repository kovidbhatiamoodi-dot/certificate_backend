const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

const normalizePath = (value, fallback) => {
  const raw = String(value || fallback || "").trim();
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
};

const API_BASE_PATH = normalizePath(process.env.API_BASE_PATH, "/api");
const API_AUTH_ROUTE = normalizePath(process.env.API_AUTH_ROUTE, "/auth");
const API_TEMPLATES_ROUTE = normalizePath(process.env.API_TEMPLATES_ROUTE, "/templates");
const API_BATCHES_ROUTE = normalizePath(process.env.API_BATCHES_ROUTE, "/batches");
const API_CERTIFICATES_ROUTE = normalizePath(process.env.API_CERTIFICATES_ROUTE, "/certificates");
const API_IDENTITY_MAPPING_ROUTE = normalizePath(
  process.env.API_IDENTITY_MAPPING_ROUTE,
  "/identity-mapping"
);

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

app.use(`${API_BASE_PATH}${API_AUTH_ROUTE}`, authRoutes);
app.use(`${API_BASE_PATH}${API_TEMPLATES_ROUTE}`, templateRoutes);
app.use(`${API_BASE_PATH}${API_BATCHES_ROUTE}`, batchRoutes);
app.use(`${API_BASE_PATH}${API_CERTIFICATES_ROUTE}`, certificateRoutes);
app.use(`${API_BASE_PATH}${API_IDENTITY_MAPPING_ROUTE}`, identityMappingRoutes);

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