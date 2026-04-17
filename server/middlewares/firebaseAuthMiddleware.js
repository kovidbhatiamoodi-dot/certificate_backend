const axios = require("axios");

const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY;
const FIREBASE_IDENTITY_TOOLKIT_URL = process.env.FIREBASE_IDENTITY_TOOLKIT_URL;

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return res.status(401).json({ message: "Missing auth token" });
    }

    if (!FIREBASE_WEB_API_KEY) {
      return res.status(500).json({ message: "Server Firebase API key is not configured" });
    }

    if (!FIREBASE_IDENTITY_TOOLKIT_URL) {
      return res.status(500).json({ message: "Server Firebase identity URL is not configured" });
    }

    const response = await axios.post(
      `${FIREBASE_IDENTITY_TOOLKIT_URL}?key=${FIREBASE_WEB_API_KEY}`,
      { idToken: token },
      { timeout: 15000 }
    );

    const user = response.data && response.data.users ? response.data.users[0] : null;
    if (!user || !user.email) {
      return res.status(401).json({ message: "Invalid auth token" });
    }

    req.user = {
      email: String(user.email).toLowerCase(),
      uid: user.localId,
    };

    return next();
  } catch (err) {
    const message = err.response && err.response.data && err.response.data.error
      ? err.response.data.error.message
      : "";

    if (message === "INVALID_ID_TOKEN" || message === "USER_NOT_FOUND") {
      return res.status(401).json({ message: "Invalid or expired auth token" });
    }

    return res.status(401).json({ message: "Authentication failed" });
  }
};

const tryAttachFirebaseUser = async (token) => {
  if (!token || !FIREBASE_WEB_API_KEY || !FIREBASE_IDENTITY_TOOLKIT_URL) {
    return null;
  }

  const response = await axios.post(
    `${FIREBASE_IDENTITY_TOOLKIT_URL}?key=${FIREBASE_WEB_API_KEY}`,
    { idToken: token },
    { timeout: 15000 }
  );

  const user = response.data && response.data.users ? response.data.users[0] : null;
  if (!user || !user.email) {
    return null;
  }

  return {
    email: String(user.email).toLowerCase(),
    uid: user.localId,
  };
};

module.exports = {
  verifyFirebaseToken,
  tryAttachFirebaseUser,
};
