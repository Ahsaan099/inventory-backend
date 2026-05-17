import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

function api(path, opts = {}) {
  return fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  }).then((r) => r.json());
}

const TABS = ["Dashboard", "Products", "Categories", "Stock"];

export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [modal, setModal] = useState(null);
  const [stockModal, setStockModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStats = useCallback(() =>
    api("/api/stats").then(setStats).catch(() => {}), []);

  const loadProducts = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterCat) params.set("category", filterCat);
    return api(`/api/products?${params}`).then(setProducts).catch(() => {});
  }, [search, filterCat]);

  const loadCategories = useCallback(() =>
    api("/api/categories").then(setCategories).catch(() => {}), []);

  useEffect(() => { loadStats(); loadCategories(); }, [loadStats, loadCategories]);
  useEffect(() => { if (tab === "Products") loadProducts(); }, [tab, loadProducts]);
  useEffect(() => { if (tab === "Dashboard") { loadStats(); loadProducts(); } }, [tab]);

  async function saveProduct(data) {
    setLoading(true);
    try {
      if (data.id) {
        await api(`/api/products/${data.id}`, { method: "PUT", body: JSON.stringify(data) });
        showToast("Product updated!");
      } else {
        await api("/api/products", { method: "POST", body: JSON.stringify(data) });
        showToast("Product added!");
      }
      setModal(null);
      loadProducts();
      loadStats();
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    await api(`/api/products/${id}`, { method: "DELETE" });
    showToast("Deleted!");
    loadProducts();
    loadStats();
  }

  async function saveCategory(name) {
    await api("/api/categories", { method: "POST", body: JSON.stringify({ name }) });
    showToast("Category added!");
    loadCategories();
    loadStats();
  }

  async function deleteCategory(id) {
    if (!confirm("Delete category?")) return;
    await api(`/api/categories/${id}`, { method: "DELETE" });
    showToast("Deleted!");
    loadCategories();
    loadStats();
  }

  async function doStockMovement(data) {
    setLoading(true);
    try {
      const res = await api("/api/stock", { method: "POST", body: JSON.stringify(data) });
      if (res.error) throw new Error(res.error);
      showToast(`Stock ${data.type === "IN" ? "added" : "removed"}!`);
      setStockModal(null);
      loadProducts();
      loadStats();
    } catch (e) { showToast(e.message, "error"); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#111", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid #e5e5e5", padding: "0 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, background: "#111", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 16 }}>📦</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>Inventory</span>
          </div>
          <nav style={{ display: "flex", gap: 4 }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500,
                background: tab === t ? "#111" : "transparent", color: tab === t ? "#fff" : "#555",
                transition: "all 0.15s"
              }}>{t}</button>
            ))}
          </nav>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "#fff", padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
        }}>{toast.msg}</div>
      )}

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>

        {/* ── DASHBOARD ─────────────────────────────────────────────── */}
        {tab === "Dashboard" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 1.5rem" }}>Dashboard</h1>
            {stats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
                {[
                  { label: "Total Products", value: stats.total_products, icon: "📦" },
                  { label: "Inventory Value", value: `$${Number(stats.total_value).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: "💰" },
                  { label: "Low Stock", value: stats.low_stock, icon: "⚠️", warn: stats.low_stock > 0 },
                  { label: "Categories", value: stats.categories, icon: "🗂️" },
                ].map((s) => (
                  <div key={s.label} style={{
                    border: `1px solid ${s.warn ? "#fca5a5" : "#e5e5e5"}`,
                    borderRadius: 10, padding: "1.25rem",
                    background: s.warn ? "#fff7f7" : "#fff"
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: s.warn ? "#dc2626" : "#111" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}
            <h2 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 1rem" }}>Low Stock Items</h2>
            <Table
              data={products.filter(p => p.quantity <= p.min_stock).slice(0, 10)}
              categories={categories}
              onEdit={() => {}} onDelete={() => {}} onStock={setStockModal}
              minimal
            />
          </div>
        )}

        {/* ── PRODUCTS ──────────────────────────────────────────────── */}
        {tab === "Products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Products</h1>
              <button onClick={() => setModal({})} style={btnStyle}>+ Add Product</button>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: "1.25rem" }}>
              <input
                placeholder="Search name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadProducts()}
                style={inputStyle}
              />
              <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }}>
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={loadProducts} style={{ ...btnStyle, background: "#fff", color: "#111", border: "1px solid #e5e5e5" }}>Search</button>
            </div>
            <Table data={products} categories={categories} onEdit={setModal} onDelete={deleteProduct} onStock={setStockModal} />
          </div>
        )}

        {/* ── CATEGORIES ────────────────────────────────────────────── */}
        {tab === "Categories" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 1.5rem" }}>Categories</h1>
            <CategoriesPanel categories={categories} onAdd={saveCategory} onDelete={deleteCategory} />
          </div>
        )}

        {/* ── STOCK ─────────────────────────────────────────────────── */}
        {tab === "Stock" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 1.5rem" }}>Stock Movement</h1>
            <p style={{ color: "#555", fontSize: 14 }}>Select a product from the Products tab to adjust stock. Quick select below:</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 16 }}>
              {products.map(p => (
                <div key={p.id} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: "1rem" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: "#888", margin: "4px 0" }}>{p.sku || "No SKU"}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0", color: p.quantity <= p.min_stock ? "#dc2626" : "#111" }}>
                    {p.quantity} units
                  </div>
                  <button onClick={() => setStockModal(p)} style={{ ...btnStyle, fontSize: 13, padding: "6px 14px" }}>
                    Adjust Stock
                  </button>
                </div>
              ))}
            </div>
            {products.length === 0 && (
              <div style={{ textAlign: "center", color: "#888", marginTop: 60 }}>
                No products yet. Add products first.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Product Modal */}
      {modal !== null && (
        <Modal title={modal.id ? "Edit Product" : "Add Product"} onClose={() => setModal(null)}>
          <ProductForm data={modal} categories={categories} onSave={saveProduct} loading={loading} />
        </Modal>
      )}

      {/* Stock Modal */}
      {stockModal && (
        <Modal title={`Adjust Stock — ${stockModal.name}`} onClose={() => setStockModal(null)}>
          <StockForm product={stockModal} onSave={doStockMovement} loading={loading} />
        </Modal>
      )}
    </div>
  );
}

function Table({ data, categories, onEdit, onDelete, onStock, minimal }) {
  if (data.length === 0) return (
    <div style={{ textAlign: "center", padding: "3rem", color: "#888", border: "1px dashed #e5e5e5", borderRadius: 8 }}>
      No products found.
    </div>
  );
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e5e5e5" }}>
            {["Name", "SKU", "Category", "Price", "Stock", "Min Stock", ...(minimal ? [] : ["Actions"])].map(h => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#555", fontSize: 13 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "10px 12px", fontWeight: 500 }}>{p.name}</td>
              <td style={{ padding: "10px 12px", color: "#888", fontFamily: "monospace" }}>{p.sku || "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                {p.category_name ? (
                  <span style={{ background: "#f4f4f4", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>{p.category_name}</span>
                ) : "—"}
              </td>
              <td style={{ padding: "10px 12px" }}>${Number(p.price).toFixed(2)}</td>
              <td style={{ padding: "10px 12px" }}>
                <span style={{
                  fontWeight: 700,
                  color: p.quantity <= p.min_stock ? "#dc2626" : "#16a34a"
                }}>{p.quantity}</span>
              </td>
              <td style={{ padding: "10px 12px", color: "#888" }}>{p.min_stock}</td>
              {!minimal && (
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onStock(p)} style={smallBtn("#2563eb", "#fff")}>Stock</button>
                    <button onClick={() => onEdit(p)} style={smallBtn("#f4f4f4", "#111")}>Edit</button>
                    <button onClick={() => onDelete(p.id)} style={smallBtn("#fee2e2", "#dc2626")}>Del</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CategoriesPanel({ categories, onAdd, onDelete }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
      <div>
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: "1.25rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: 15, fontWeight: 600 }}>Add Category</h3>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            style={{ ...inputStyle, marginBottom: 10 }}
            onKeyDown={(e) => { if (e.key === "Enter" && name) { onAdd(name); setName(""); } }}
          />
          <button style={{ ...btnStyle, width: "100%" }} onClick={() => { if (name) { onAdd(name); setName(""); } }}>
            Add Category
          </button>
        </div>
      </div>
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {categories.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", border: "1px solid #e5e5e5", borderRadius: 8 }}>
              <span style={{ fontWeight: 500 }}>{c.name}</span>
              <button onClick={() => onDelete(c.id)} style={smallBtn("#fee2e2", "#dc2626")}>Delete</button>
            </div>
          ))}
          {categories.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>No categories yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ProductForm({ data, categories, onSave, loading }) {
  const [form, setForm] = useState({
    name: data.name || "", sku: data.sku || "", category_id: data.category_id || "",
    price: data.price || "", quantity: data.quantity || 0, min_stock: data.min_stock || 5,
    ...(data.id ? { id: data.id } : {})
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={labelStyle}>Product Name *</label>
        <input value={form.name} onChange={set("name")} placeholder="e.g. iPhone 15 Pro" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>SKU</label>
          <input value={form.sku} onChange={set("sku")} placeholder="e.g. IPH-15P-256" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Category</label>
          <select value={form.category_id} onChange={set("category_id")} style={inputStyle}>
            <option value="">None</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Price ($)</label>
          <input type="number" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" style={inputStyle} />
        </div>
        {!data.id && (
          <div>
            <label style={labelStyle}>Initial Qty</label>
            <input type="number" value={form.quantity} onChange={set("quantity")} style={inputStyle} />
          </div>
        )}
        <div>
          <label style={labelStyle}>Min Stock</label>
          <input type="number" value={form.min_stock} onChange={set("min_stock")} style={inputStyle} />
        </div>
      </div>
      <button style={{ ...btnStyle, marginTop: 8 }} onClick={() => onSave(form)} disabled={loading || !form.name}>
        {loading ? "Saving..." : data.id ? "Update Product" : "Add Product"}
      </button>
    </div>
  );
}

function StockForm({ product, onSave, loading }) {
  const [form, setForm] = useState({ product_id: product.id, type: "IN", quantity: "", note: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#f9f9f9", borderRadius: 8, padding: "12px 16px", fontSize: 14 }}>
        Current stock: <strong>{product.quantity} units</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle}>Movement Type</label>
          <select value={form.type} onChange={set("type")} style={inputStyle}>
            <option value="IN">Stock IN (Add)</option>
            <option value="OUT">Stock OUT (Remove)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Quantity *</label>
          <input type="number" min="1" value={form.quantity} onChange={set("quantity")} placeholder="0" style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Note (optional)</label>
        <input value={form.note} onChange={set("note")} placeholder="e.g. Purchase order #123" style={inputStyle} />
      </div>
      <button
        style={{ ...btnStyle, background: form.type === "OUT" ? "#dc2626" : "#111", marginTop: 8 }}
        onClick={() => onSave({ ...form, quantity: Number(form.quantity) })}
        disabled={loading || !form.quantity}
      >
        {loading ? "Processing..." : form.type === "IN" ? "Add Stock" : "Remove Stock"}
      </button>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 520, padding: "1.5rem", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, color: "#888" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const btnStyle = { background: "#111", color: "#fff", border: "none", borderRadius: 7, padding: "8px 18px", cursor: "pointer", fontWeight: 600, fontSize: 14 };
const inputStyle = { width: "100%", padding: "9px 12px", border: "1px solid #e5e5e5", borderRadius: 7, fontSize: 14, outline: "none", boxSizing: "border-box", color: "#111", background: "#fff" };
const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" };
const smallBtn = (bg, color) => ({ background: bg, color, border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600 });
