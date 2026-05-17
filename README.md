# 📦 Inventory Management System

## Architecture
```
React Frontend (Vercel) ──► Express Backend (Railway) ──► MySQL (Railway)
```

---

## 🚀 Step 1: Backend — Railway pe Deploy Karo

### 1.1 Backend folder prepare karo
```
inventory-backend/
  server.js        ← Express API
  package.json
  railway.toml
  .env             ← Local only (Railway pe env vars set karo)
  .gitignore
```

### 1.2 GitHub repo banao
```bash
cd inventory-backend
git init
git add .
git commit -m "Initial backend"
git remote add origin https://github.com/TERA_USERNAME/inventory-backend.git
git push -u origin main
```

### 1.3 Railway Dashboard pe:
1. railway.app pe jao → New Project → Deploy from GitHub repo
2. Apna `inventory-backend` repo select karo
3. **Environment Variables** mein yeh add karo:
   ```
   DATABASE_URL = mysql://root:EOiyDJgfAHVbIlVPBpIOmRiDbuwsxaDx@autorack.proxy.rlwy.net:16212/railway
   PORT         = 3001
   ```
4. Deploy karo — Railway automatically `node server.js` chalayega

### 1.4 Backend URL copy karo
Deploy hone ke baad Railway tumhein URL dega jaise:
`https://inventory-backend-production-xxxx.railway.app`

**Yeh URL save karo — frontend ke liye chahiye hoga.**

---

## 🌐 Step 2: Frontend — Update karo

### 2.1 Existing React project mein `App.jsx` replace karo
`frontend-src/App.jsx` ka code apne React project ke `src/App.jsx` mein paste karo.

### 2.2 `.env` file banao (React project root mein)
```env
VITE_API_URL=https://inventory-backend-production-xxxx.railway.app
```
Railway backend ka actual URL daalo.

### 2.3 Vercel pe redeploy karo
```bash
git add .
git commit -m "Add database integration"
git push
```
Vercel automatically redeploy karega.

**Ya Vercel Dashboard mein:**
Settings → Environment Variables → `VITE_API_URL` add karo → Redeploy

---

## ✅ Test Karo

Backend live hai ya nahi check karo:
```
https://YOUR-BACKEND.railway.app/api/stats
```
Yeh response aana chahiye:
```json
{"total_products":0,"total_value":0,"low_stock":0,"categories":0}
```

---

## 📊 Database Tables (Auto-create hoti hain)

```sql
categories     → id, name, created_at
products       → id, name, sku, category_id, price, quantity, min_stock, created_at
stock_movements→ id, product_id, type(IN/OUT), quantity, note, created_at
```

---

## 🔗 API Endpoints

| Method | Endpoint              | Description           |
|--------|-----------------------|-----------------------|
| GET    | /api/stats            | Dashboard numbers     |
| GET    | /api/products         | All products (search) |
| POST   | /api/products         | Add product           |
| PUT    | /api/products/:id     | Edit product          |
| DELETE | /api/products/:id     | Delete product        |
| GET    | /api/categories       | All categories        |
| POST   | /api/categories       | Add category          |
| DELETE | /api/categories/:id   | Delete category       |
| POST   | /api/stock            | Stock IN/OUT          |
| GET    | /api/stock/:product_id| Product history       |

---

## ⚠️ IMPORTANT — Security

Production mein yeh karo:
1. `CORS` mein sirf apna Vercel domain allow karo:
   ```js
   app.use(cors({ origin: "https://sql-inventory-system.vercel.app" }));
   ```
2. Database credentials kabhi GitHub pe push mat karo (`.gitignore` mein `.env` hai)
