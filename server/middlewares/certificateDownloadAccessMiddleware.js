const jwt = require("jsonwebtoken");
const { tryAttachFirebaseUser } = require("./firebaseAuthMiddleware");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

const certificateDownloadAccessMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.admin = decoded;
      return next();
    } catch (err) {
      // Token might belong to Firebase user flow, continue below.
    }

    try {
      const user = await tryAttachFirebaseUser(token);
      if (user) {
        req.user = user;
        return next();
      }
    } catch (err) {
      const message = err.response && err.response.data && err.response.data.error
        ? err.response.data.error.message
        : "";

      if (message === "INVALID_ID_TOKEN" || message === "USER_NOT_FOUND") {
        return res.status(401).json({ message: "Invalid or expired auth token" });
      }
    }

    return res.status(401).json({ message: "Invalid or expired auth token" });
  } catch (err) {
    return res.status(401).json({ message: "Authentication failed" });
  }
};

module.exports = certificateDownloadAccessMiddleware;
