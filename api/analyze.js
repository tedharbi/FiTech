import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import FormData from "form-data";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = new IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parsing error:", err);
      return res.status(400).json({ error: "Failed to parse form data" });
    }

    // GET THE FILE - handle array case
    let file = files.image;

    // If formidable returns an array, take first element
    if (Array.isArray(file)) {
      file = file[0];
    }

    if (!file || !file.filepath) {
      console.error("File object:", file);
      return res.status(400).json({ error: "No image uploaded" });
    }

    try {
      const formData = new FormData();

      // Use the actual filepath from your logs
      const fileStream = fs.createReadStream(file.filepath);
      formData.append(
        "image",
        fileStream,
        file.originalFilename || "image.jpg",
      );

      const inferenceApiUrl = process.env.INFERENCE_API_URL;
      const response = await fetch(`${inferenceApiUrl}/analyze`, {
        method: "POST",
        body: formData,
        headers: formData.getHeaders(),
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } finally {
      // Clean up temporary file
      if (file && file.filepath && fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
    }
  });
}