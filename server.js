const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});

// ── Init Tables ──────────────────────────────────────────────────────────────
async function initDB() {
  const conn = await pool.getConnection();
  await conn.query("DROP TABLE IF EXISTS stock_movements");
  await conn.query("DROP TABLE IF EXISTS products");
  await conn.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      sku VARCHAR(100) UNIQUE,
      category_id INT,
      price DECIMAL(10,2) DEFAULT 0,
      quantity INT DEFAULT 0,
      min_stock INT DEFAULT 5,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      type ENUM('IN','OUT') NOT NULL,
      quantity INT NOT NULL,
      note VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  conn.release();
  console.log("✅ Tables ready");
}

// ── Dashboard Stats ──────────────────────────────────────────────────────────
app.get("/api/stats", async (req, res) => {
  try {
    const [[{ total_products }]] = await pool.query("SELECT COUNT(*) as total_products FROM products");
    const [[{ total_value }]] = await pool.query("SELECT SUM(price * quantity) as total_value FROM products");
    const [[{ low_stock }]] = await pool.query("SELECT COUNT(*) as low_stock FROM products WHERE quantity <= min_stock");
    const [[{ categories }]] = await pool.query("SELECT COUNT(*) as categories FROM categories");
    res.json({ total_products, total_value: total_value || 0, low_stock, categories });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Categories CRUD ──────────────────────────────────────────────────────────
app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM categories ORDER BY name");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/categories", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try {
    const [r] = await pool.query("INSERT INTO categories (name) VALUES (?)", [name]);
    res.json({ id: r.insertId, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM categories WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Products CRUD ────────────────────────────────────────────────────────────
app.get("/api/products", async (req, res) => {
  try {
    const { search, category } = req.query;
    let q = `
      SELECT p.*, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (search) { q += " AND (p.name LIKE ? OR p.sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
    if (category) { q += " AND p.category_id = ?"; params.push(category); }
    q += " ORDER BY p.created_at DESC";
    const [rows] = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/products", async (req, res) => {
  const { name, sku, category_id, price, quantity, min_stock } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });
  try {
    const [r] = await pool.query(
      "INSERT INTO products (name, sku, category_id, price, quantity, min_stock) VALUES (?,?,?,?,?,?)",
      [name, sku || null, category_id || null, price || 0, quantity || 0, min_stock || 5]
    );
    res.json({ id: r.insertId, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/products/:id", async (req, res) => {
  const { name, sku, category_id, price, min_stock } = req.body;
  try {
    await pool.query(
      "UPDATE products SET name=?, sku=?, category_id=?, price=?, min_stock=? WHERE id=?",
      [name, sku || null, category_id || null, price || 0, min_stock || 5, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock Movements ──────────────────────────────────────────────────────────
app.post("/api/stock", async (req, res) => {
  const { product_id, type, quantity, note } = req.body;
  if (!product_id || !type || !quantity) return res.status(400).json({ error: "product_id, type, quantity required" });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const delta = type === "IN" ? quantity : -quantity;
    const [[product]] = await conn.query("SELECT quantity FROM products WHERE id = ? FOR UPDATE", [product_id]);
    if (!product) throw new Error("Product not found");
    if (type === "OUT" && product.quantity < quantity) throw new Error("Insufficient stock");
    await conn.query("UPDATE products SET quantity = quantity + ? WHERE id = ?", [delta, product_id]);
    await conn.query("INSERT INTO stock_movements (product_id, type, quantity, note) VALUES (?,?,?,?)", [product_id, type, quantity, note || null]);
    await conn.commit();
    res.json({ success: true });
  } catch (e) {
    await conn.rollback();
    res.status(400).json({ error: e.message });
  } finally { conn.release(); }
});

app.get("/api/stock/:product_id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM stock_movements WHERE product_id = ? ORDER BY created_at DESC LIMIT 50",
      [req.params.product_id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "ok", message: "Inventory API running" }));

const PORT = process.env.PORT || 3001;
initDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}).catch(console.error);
