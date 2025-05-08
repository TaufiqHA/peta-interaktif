const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Tambahkan ini sebelum app.listen
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "_")),
});
const upload = multer({ storage });

const db = new sqlite3.Database("maps.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS maps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    image TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    map_id INTEGER,
    shape TEXT,
    pic_name TEXT,
    employee_name TEXT,
    pic_photo TEXT,
    FOREIGN KEY(map_id) REFERENCES maps(id)
  )`);
});

app.post("/api/upload-map", upload.single("map_file"), (req, res) => {
  const { map_name } = req.body;
  const filePath = `/uploads/${req.file.filename}`;

  db.run(
    "INSERT INTO maps (name, image) VALUES (?, ?)",
    [map_name, filePath],
    function (err) {
      if (err) return res.json({ error: err.message });
      res.json({ id: this.lastID, path: filePath });
    }
  );
});

app.get("/api/maps", (req, res) => {
  db.all("SELECT * FROM maps", (err, maps) => {
    if (err) return res.status(500).json({ error: err.message });

    const getAreas = (mapId) =>
      new Promise((resolve, reject) => {
        db.all(
          "SELECT * FROM areas WHERE map_id = ?",
          [mapId],
          (err, areas) => {
            if (err) reject(err);
            else
              resolve(
                areas.map((a) => ({
                  shape: JSON.parse(a.shape),
                  pic: {
                    name: a.pic_name,
                    employee: a.employee_name,
                    photo: a.pic_photo,
                  },
                }))
              );
          }
        );
      });

    Promise.all(
      maps.map(async (map) => ({
        name: map.name,
        image: map.image,
        areas: await getAreas(map.id),
      }))
    )
      .then((result) => res.json(result))
      .catch((err) => res.status(500).json({ error: err.message }));
  });
});

app.post("/api/save-areas", express.json(), (req, res) => {
  const { mapName, areas } = req.body;

  db.get("SELECT id FROM maps WHERE name = ?", [mapName], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Map not found" });

    const mapId = row.id;

    db.run("DELETE FROM areas WHERE map_id = ?", [mapId], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      const stmt = db.prepare(
        `INSERT INTO areas (map_id, shape, pic_name, employee_name, pic_photo)
         VALUES (?, ?, ?, ?, ?)`
      );

      areas.forEach((a) => {
        stmt.run(
          mapId,
          JSON.stringify(a.shape),
          a.pic?.name || "",
          a.pic?.employee || "",
          a.pic?.photo || ""
        );
      });

      stmt.finalize();
      res.json({ message: "Areas saved" });
    });
  });
});

app.delete("/api/delete-map/:name", (req, res) => {
  const mapName = req.params.name;
  db.get("SELECT id FROM maps WHERE name = ?", [mapName], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Map not found" });

    const mapId = row.id;
    db.run("DELETE FROM areas WHERE map_id = ?", [mapId]);
    db.run("DELETE FROM maps WHERE id = ?", [mapId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Map deleted" });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
