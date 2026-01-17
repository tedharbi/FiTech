import { IncomingForm } from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for file uploads
  },
};

// ML inference endpoint (Flask / FastAPI)
const INFERENCE_API_URL =
  process.env.INFERENCE_API_URL || "http://127.0.0.1:5000/predict";

// Allowed image types
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg"];

function isAllowedFile(filename) {
  if (!filename) return false;
  return ALLOWED_EXTENSIONS.includes(filename.split(".").pop().toLowerCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      return res.status(400).json({ error: "Invalid form data" });
    }

    const file = files.image;
    if (!file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const filepath = file.filepath || file.path;
    const filename = file.originalFilename || file.name;

    if (!isAllowedFile(filename)) {
      fs.unlink(filepath, () => {});
      return res.status(400).json({
        error: "Invalid file type",
        allowed: ALLOWED_EXTENSIONS,
      });
    }

    // Prepare request to ML service
    const formData = new FormData();
    formData.append("image", fs.createReadStream(filepath), filename);

    // Optional metadata (safe pass-through)
    ["goal", "duration", "user_id"].forEach((key) => {
      if (fields[key]) {
        formData.append(key, fields[key]);
      }
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(INFERENCE_API_URL, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
        signal: controller.signal,
        duplex: "half", // ✅ REQUIRED FOR NODE 18+
      });

      const raw = await response.text();

      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { error: "Invalid JSON from inference server" };
      }

      clearTimeout(timeout);
      fs.unlink(filepath, () => {});

      return res.status(response.status).json({
        predicted_body_type: parsed.predicted_body_type ?? "Unknown",
        confidence: parsed.confidence ?? 0,
        fallback_used: parsed.fallback_used ?? true,
        exercises: parsed.exercises ?? null,
        diet: parsed.diet ?? null,
      });
    } catch (error) {
      clearTimeout(timeout);
      fs.unlink(filepath, () => {});

      console.error("🔥 Inference error:", error);

      return res.status(502).json({
        error: "Inference service unavailable",
        details: error.message,
      });
    }
  });
}
