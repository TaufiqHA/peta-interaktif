const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const multer = require("multer"); // Untuk meng-handle upload file gambar

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Konfigurasi untuk mengupload gambar
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/maps"); // Simpan di folder ini
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage: storage });

// Koneksi Database
const db = new sqlite3.Database("database.db");

// Buat tabel jika belum ada
db.run(`CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_name TEXT,
    pic_name TEXT,
    pic_image TEXT,  -- Gambar PIC dalam format base64
    shape TEXT
)`);

// Endpoint untuk menyimpan area dan gambar PIC
app.post("/api/simpan", upload.single("pic_image"), (req, res) => {
  const { area_name, pic_name, shape } = req.body;
  const pic_image = req.file ? `/uploads/maps/${req.file.filename}` : null; // Simpan path relatif

  db.run(
    `INSERT INTO areas (area_name, pic_name, pic_image, shape) VALUES (?, ?, ?, ?)`,
    [area_name, pic_name, pic_image, JSON.stringify(shape)],
    function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Data berhasil disimpan", id: this.lastID });
    }
  );
});

// Endpoint untuk mengambil semua area
app.get("/api/areas", (req, res) => {
  db.all(`SELECT * FROM areas`, [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post("/api/upload-map", upload.single("map_file"), (req, res) => {
  const { map_name } = req.body;
  const filePath = req.file ? `/uploads/maps/${req.file.filename}` : null;

  if (!map_name || !req.file) {
    return res.status(400).json({ error: "Nama peta dan file wajib diisi." });
  }

  res.json({ message: "Peta berhasil diupload", path: filePath });
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
