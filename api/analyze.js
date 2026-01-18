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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm({
    multiples: false,
    keepExtensions: true,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(400).json({ error: "Invalid form data" });
    }

    const file = files.image;

    if (!file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    // ✅ THIS IS THE IMPORTANT PART
    const filepath = file.filepath;

    if (!filepath) {
      return res.status(400).json({
        error: "Upload temporary file missing",
      });
    }

    try {
      const formData = new FormData();
      formData.append("image", fs.createReadStream(filepath));

      const response = await fetch(`${INFERENCE_URL}/analyze`, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(500).json({
          error: "Invalid response from inference server",
          raw: text,
        });
      }

      return res.status(response.status).json(data);
    } catch (error) {
      console.error("Inference error:", error);
      return res.status(500).json({
        error: "Inference service failed",
        details: error.message,
      });
    } finally {
      // ✅ CLEANUP SAFELY
      try {
        fs.unlinkSync(filepath);
      } catch (_) {}
    }
  });
}