import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data"; // CHANGED: default import

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  const uploadDir = "/tmp/uploads";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new IncomingForm({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parsing error:", err);
        res.status(400).json({ error: "Failed to parse form data" });
        return resolve();
      }

      const file = files.image;
      if (!file || !file.filepath) {
        res.status(400).json({ error: "No image uploaded" });
        return resolve();
      }

      // NEW: Validate file type
      const filename = file.originalFilename || "image.jpg";
      if (!isAllowedFile(filename)) {
        fs.unlinkSync(file.filepath);
        return res.status(400).json({
          error: "Invalid file type",
          allowed: ALLOWED_EXTENSIONS,
        });
      }

      try {
        const inferenceApiUrl = process.env.INFERENCE_API_URL;
        if (!inferenceApiUrl) {
          console.error("INFERENCE_API_URL not set");
          res.status(500).json({ error: "Server configuration error" });
          return resolve();
        }

        console.log(`Forwarding to: ${inferenceApiUrl}/analyze`);

        // Create FormData
        const formData = new FormData();
        const fileStream = fs.createReadStream(file.filepath);
        formData.append("image", fileStream, filename);

        // FIXED: Add timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${inferenceApiUrl}/analyze`, {
          method: "POST",
          body: formData,
          headers: formData.getHeaders(), // ← ADD THIS LINE
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Handle response (JSON or error)
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          const data = await response.json();
          console.log(`Flask response: ${response.status}`);
          res.status(response.status).json(data);
        } else {
          // Flask returned HTML error page
          const text = await response.text();
          console.error("Flask returned HTML error:", text.substring(0, 200));

          // Try to extract error from HTML
          let errorMsg = `Server error (${response.status})`;
          const match = text.match(/<title>(.*?)<\/title>|<p[^>]*>(.*?)<\/p>/);
          if (match) {
            errorMsg = match[1] || match[2] || errorMsg;
          }

          res.status(response.status).json({
            error: errorMsg,
            details: "Flask server returned an error page",
          });
        }
      } catch (error) {
        console.error("Error in analyze.js:", error);

        if (error.name === "AbortError") {
          res.status(504).json({
            error: "Request timeout",
            details: "Flask server took too long to respond",
          });
        } else {
          res.status(500).json({
            error: "Failed to process image",
            details: error.message,
          });
        }
      } finally {
        // Clean up
        if (file && file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
        resolve();
      }
    });
  });
}