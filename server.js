import express from "express";
import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import multer from "multer";
import cors from "cors";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { processUpload } from "./lib/processUpload.js";
import { getHistory } from "./lib/getHistory.js";
import { getDiseaseSummary } from "./lib/summary.js";
import { getDiseaseInfo } from "./lib/getDiseaseInfo.js";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const SSL_KEY = path.join(__dirname, "server.key");
const SSL_CERT = path.join(__dirname, "server.cert");
const ENV = process.env.NODE_ENV || "development";

// HTTPS logic for development
let server;
if (
  ENV === "development" &&
  fs.existsSync(SSL_KEY) &&
  fs.existsSync(SSL_CERT)
) {
  server = https.createServer(
    {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT),
    },
    app
  );
  console.log("✅ HTTPS enabled for development");
} else {
  server = http.createServer(app);
  console.log("✅ HTTP enabled for production");
}

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// File Upload Handling
const upload = multer({ dest: "uploads/" });
app.use("/uploads", express.static("uploads"));

// Redirect root "/" to "/home"
app.get("/", (req, res) => {
  res.redirect("/home");
});

if (ENV === "development") {
  // Home Page
  app.get("/home", (_, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
  // Analytics Page
  app.get("/analytics", (_, res) => {
    res.sendFile(path.join(__dirname, "public", "analytics.html"));
  });

  // Information Page
  app.get("/information", (_, res) => {
    res.sendFile(path.join(__dirname, "public", "information.html"));
  });

  // ✅ Unified Upload Endpoint with auto-delete
  app.post("/api/upload", upload.single("image"), async (req, res) => {
    const result = await processUpload({ file: req.file });
    res.json(result);
  });

  // GET /history?page=1&limit=10

  app.get("/api/history", async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await getHistory({ page, limit });
      res.json(result);
    } catch (err) {
      console.error("❌ Failed to fetch history:", err.message);
      res
        .status(500)
        .json({ error: "Failed to fetch classification history." });
    }
  });

  // Add the API route
  app.get("/api/summary", async (req, res) => {
    const result = await getDiseaseSummary();
    res.json(result);
  });

  app.get("/api/disease-info", async (req, res) => {
    try {
      const info = await getDiseaseInfo();
      res.json(info);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Clean uploads folder on startup
const uploadsPath = path.join(__dirname, "uploads");

if (fs.existsSync(uploadsPath)) {
  fs.readdirSync(uploadsPath).forEach((file) => {
    const filePath = path.join(uploadsPath, file);
    try {
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
        console.log(`🗑 Deleted: ${filePath}`);
      }
    } catch (err) {
      console.warn(`⚠️ Failed to delete ${filePath}:`, err.message);
    }
  });
} else {
  fs.mkdirSync(uploadsPath);
  console.log("📂 Created missing uploads/ directory");
}

// Start Server
server.listen(PORT, () => {
  console.log(
    `🚀 Server running at http${
      server instanceof https.Server ? "s" : ""
    }://localhost:${PORT}`
  );
});
