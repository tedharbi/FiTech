import { IncomingForm } from "formidable";
import fs from "fs";
import fetch from "node-fetch";
import pkg from "form-data";
const { FormData } = pkg;

export const config = {
  api: {
    bodyParser: false,
  },
};

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
        formData.append(
          "image",
          fileStream,
          file.originalFilename || "image.jpg",
        );

        // Forward to Flask with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(`${inferenceApiUrl}/analyze`, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // Check content type to ensure it's JSON
        const contentType = response.headers.get("content-type") || "";
        let data;

        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          // If not JSON, read as text
          const text = await response.text();
          console.error("Flask returned non-JSON:", text.substring(0, 200));
          throw new Error(
            `Flask returned ${response.status}: ${text.substring(0, 100)}`,
          );
        }

        console.log(`Flask response: ${response.status}`);

        // Return response
        res.status(response.status).json(data);
      } catch (error) {
        console.error("Error in analyze.js:", error);

        if (error.name === "AbortError") {
          res
            .status(504)
            .json({
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