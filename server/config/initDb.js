const db = require("./db");
const bcrypt = require("bcryptjs");

const initDB = async () => {
  const promiseDb = db.promise();
  const shouldDropLegacyTables = String(process.env.DB_DROP_LEGACY_TABLES || "false").toLowerCase() === "true";

  try {
    // Drop legacy tables only when explicitly enabled.
    if (shouldDropLegacyTables) {
      await promiseDb.query("DROP TABLE IF EXISTS certificate_fields");
      await promiseDb.query("DROP TABLE IF EXISTS participations");
      await promiseDb.query("DROP TABLE IF EXISTS events");
    }

    // ─── Departments ───
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      )
    `);

    // ─── Admins ───
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        department_id INT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'admin',
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    // ─── Templates ───
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        department_id INT NOT NULL,
        background_url VARCHAR(255),
        fields_json JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
      )
    `);

    // Backward-compatible migration for legacy template schema.
    // Keeps existing rows and only adds columns required by current code.
    const [templateColumns] = await promiseDb.query("SHOW COLUMNS FROM templates");
    const templateColumnSet = new Set(templateColumns.map((col) => col.Field));

    if (!templateColumnSet.has("background_url")) {
      await promiseDb.query("ALTER TABLE templates ADD COLUMN background_url VARCHAR(255) NULL");
    }

    if (!templateColumnSet.has("fields_json")) {
      await promiseDb.query("ALTER TABLE templates ADD COLUMN fields_json JSON NULL");
    }

    if (!templateColumnSet.has("created_at")) {
      await promiseDb.query(
        "ALTER TABLE templates ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP"
      );
    }

    // If legacy template_json exists, copy it into fields_json for old rows.
    if (templateColumnSet.has("template_json")) {
      await promiseDb.query(
        `UPDATE templates
         SET fields_json = template_json
         WHERE fields_json IS NULL AND template_json IS NOT NULL`
      );
    }

    // ─── Certificate Batches ───
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS certificate_batches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        department_id INT NOT NULL,
        template_id INT NOT NULL,
        status ENUM('DRAFT', 'RELEASED') DEFAULT 'DRAFT',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        released_at TIMESTAMP NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (template_id) REFERENCES templates(id)
      )
    `);

    // ─── Batch Entries ───
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS batch_entries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        batch_id INT NOT NULL,
        mi_no VARCHAR(30) NOT NULL,
        field_data JSON NOT NULL,
        certificate_url VARCHAR(255) NULL,
        FOREIGN KEY (batch_id) REFERENCES certificate_batches(id) ON DELETE CASCADE
      )
    `);

    // ─── Seed departments ───
    await promiseDb.query(`
      INSERT IGNORE INTO departments (name) VALUES 
      ('hospi'), ('compi'), ('informals'), ('pronites'), ('horizons')
    `);

    // ─── Seed admin accounts ───
    const hashIt = async (pwd) => await bcrypt.hash(pwd || "admin123", 10);

    // Get department IDs
    const [depts] = await promiseDb.query("SELECT id, name FROM departments");
    const deptMap = {};
    depts.forEach((d) => (deptMap[d.name] = d.id));

    // Web CG — superadmin
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, NULL, 'superadmin')`,
      ["Web CG", process.env.WEB_CG_EMAIL || "web@mi.com", await hashIt(process.env.WEB_CG_PASS)]
    );

    // Hospi CG
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, ?, 'admin')`,
      ["Hospi CG", process.env.HOSPI_CG_EMAIL || "hospi@mi.com", await hashIt(process.env.HOSPI_CG_PASS), deptMap["hospi"]]
    );

    // Compi CG
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, ?, 'admin')`,
      ["Compi CG", process.env.COMPI_CG_EMAIL || "compi@mi.com", await hashIt(process.env.COMPI_CG_PASS), deptMap["compi"]]
    );

    // Informals CG
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, ?, 'admin')`,
      ["Informals CG", process.env.INFORMAL_CG_EMAIL || "informal@mi.com", await hashIt(process.env.INFORMAL_CG_PASS), deptMap["informals"]]
    );

    // Pronites CG
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, ?, 'admin')`,
      ["Pronites CG", process.env.PRONITES_CG_EMAIL || "pronites@mi.com", await hashIt(process.env.PRONITES_CG_PASS), deptMap["pronites"]]
    );

    // Horizons CG
    await promiseDb.query(
      `INSERT IGNORE INTO admins (name, email, password, department_id, role) VALUES (?, ?, ?, ?, 'admin')`,
      ["Horizons CG", process.env.HORIZONS_CG_EMAIL || "horizons@mi.com", await hashIt(process.env.HORIZONS_CG_PASS), deptMap["horizons"]]
    );

    console.log("✅ Tables initialized & admins seeded with unique passwords from .env");
  } catch (err) {
    console.error("❌ DB Init Error:", err);
  }
};

module.exports = initDB;