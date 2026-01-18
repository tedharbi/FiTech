import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import { FormData } from "form-data";

export const config = {
  api: {
    bodyParser: false, // Disable Vercel's default body parsing
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Create a temporary directory for uploads
  const uploadDir = "/tmp/uploads";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new IncomingForm({
    uploadDir: uploadDir,
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024, // 5MB limit
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

      try {
        // Get the ngrok URL from environment variable
        const inferenceApiUrl = process.env.INFERENCE_API_URL;
        if (!inferenceApiUrl) {
          console.error("INFERENCE_API_URL not set");
          res.status(500).json({ error: "Server configuration error" });
          return resolve();
        }

        console.log(`Forwarding to: ${inferenceApiUrl}/analyze`);
        console.log(`File: ${file.originalFilename}, Size: ${file.size}`);

        // Create FormData for the Flask backend
        const formData = new FormData();

        // Read the file and append it
        const fileStream = fs.createReadStream(file.filepath);
        formData.append("image", fileStream, file.originalFilename);

        // Forward to Flask backend
        const response = await fetch(`${inferenceApiUrl}/analyze`, {
          method: "POST",
          body: formData,
          // Note: FormData will set its own headers with boundary
        });

        // Get the response from Flask
        const data = await response.json();

        console.log(`Flask response: ${response.status}`, data);

        // Return the Flask response to the frontend
        res.status(response.status).json(data);
      } catch (error) {
        console.error("Error forwarding to Flask:", error);
        res.status(500).json({
          error: "Failed to process image",
          details: error.message,
        });
      } finally {
        // Clean up the uploaded file
        if (file && file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath);
        }
        resolve();
      }
    });
  });
}