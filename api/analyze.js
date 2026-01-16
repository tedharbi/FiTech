import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch"; // IMPORTANT: required in Vercel Node runtime

export const config = {
  api: {
    bodyParser: false, // Required for multipart uploads
  },
};

// This points to your LOCAL backend via ngrok or env var
const INFERENCE_URL =
  process.env.INFERENCE_API_URL || "http://127.0.0.1:5000/analyze";

// Only allow formats your ML model can handle
const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg"];

function isAllowedFile(filename) {
  if (!filename) return false;
  const ext = filename.split(".").pop().toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("❌ Form parse error:", err);
      return res.status(400).json({ error: "File parsing failed" });
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

    // Prepare multipart request for inference server
    const formData = new FormData();
    formData.append("image", fs.createReadStream(filepath), filename);

    // Optional metadata (safe forwarding)
    ["user_id"].forEach((key) => {
      if (fields[key]) {
        formData.append(key, fields[key]);
      }
    });

    // Timeout protection (20s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
      const response = await fetch(INFERENCE_URL, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
        signal: controller.signal,
        duplex: "half", // ✅ avoids duplex error in Node fetch
      });

      const rawText = await response.text();
      let parsed;

      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { error: "Invalid JSON from inference service" };
      }

      clearTimeout(timeout);
      fs.unlink(filepath, () => {});

      // Normalize response for frontend (focused on analysis)
      return res.status(response.status).json({
        analysis_result: parsed.analysis_result ?? null,
        confidence: parsed.confidence ?? 0,
        details: parsed.details ?? null,
      });
    } catch (error) {
      clearTimeout(timeout);
      fs.unlink(filepath, () => {});
      console.error("🔥 Inference service error:", error);

      return res.status(502).json({
        error: "Inference service unavailable",
        details: error.message,
      });
    }
  });
}
