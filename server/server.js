require("dotenv").config();
const app = require("./app");
const initDB = require("./config/initDb");

const PORT = process.env.PORT || 5051;

// Initialize DB then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});