import { IncomingForm } from "formidable"; // ✅ FIXED
import { processUpload } from "../lib/processUpload.js";

export const config = {
  api: { bodyParser: false },
};

export default function handler(req, res) {
  const form = new IncomingForm({
    multiples: false,
    keepExtensions: true,
    uploadDir: "/tmp", // required on Vercel
    filename: (name, ext, part) => `${Date.now()}-${part.originalFilename}`,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("❌ Formidable parse error:", err.message);
        return res.status(400).json({ error: "Form parsing failed", detail: err.message });
      }

      const file = Array.isArray(files.image) ? files.image[0] : files.image || null;
      const base64 = fields?.image || null;

      if (!file && !base64) {
        return res.status(400).json({ error: "Missing image file or base64 string." });
      }

      const result = await processUpload({ file, base64 });
      res.status(200).json(result);
    } catch (err) {
      console.error("❌ Upload handler error:", err.message);
      res.status(500).json({ error: "Upload failed", detail: err.message });
    }
  });
}
