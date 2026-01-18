import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import { FormData } from "form-data";

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
      return res.status(400).json({ error: "Form parsing failed" });
    }

    const file = files.image;
    if (!file || !file.filepath) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    try {
      const formData = new FormData();
      formData.append(
        "image",
        fs.createReadStream(file.filepath),
        file.originalFilename,
      );

      const response = await fetch(`${process.env.INFERENCE_API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    } finally {
      // Clean up temporary file
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }
    }
  });
}