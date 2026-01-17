import { IncomingForm } from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false,
  },
};

const INFERENCE_URL = process.env.INFERENCE_API_URL || "http://127.0.0.1:5000";

const ALLOWED_EXTENSIONS = ["png", "jpg", "jpeg"];

function isAllowedFile(filename) {
  return (
    filename &&
    ALLOWED_EXTENSIONS.includes(filename.split(".").pop().toLowerCase())
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(400).json({ error: "Invalid form data" });
    }

    const file = files.image;
    if (!file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const filepath = file.filepath || file.path || null;
    const filename = file.originalFilename || file.name || null;

    if (!filepath || !filename) {
      return res.status(400).json({
        error: "File upload failed (missing path or filename)",
      });
    }

    if (!isAllowedFile(filename)) {
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return res.status(400).json({ error: "Invalid file type" });
    }

    try {
      const formData = new FormData();
      formData.append("image", fs.createReadStream(filepath), filename);

      const response = await fetch(`${INFERENCE_URL}/analyze`, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      });

      const data = await response.json();

      return res.status(response.status).json(data);
    } catch (error) {
      console.error("Analyze error:", error);
      return res.status(500).json({
        error: "Inference service failed",
        details: error.message,
      });
    } finally {
      // ✅ SAFE CLEANUP
      if (filepath && fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    }
  });
}