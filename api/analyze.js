// api/analyze.js
import formidable from "formidable";
import fs from "fs";
import path from "path";
import FormData from "form-data"; // default import (do NOT use named import)
import fetch from "node-fetch"; // ensure this is in package.json dependencies

export const config = {
  api: {
    bodyParser: false, // required for multipart uploads
  },
};

const INFERENCE_API_URL = process.env.INFERENCE_API_URL; // e.g. https://<your-ngrok>.ngrok-free.dev
const ALLOWED_EXT = ["png", "jpg", "jpeg"];

function isAllowedFile(filename) {
  if (!filename) return false;
  const ext = filename.split(".").pop().toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  if (!INFERENCE_API_URL)
    return res
      .status(500)
      .json({ error: "INFERENCE_API_URL is not set in environment" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(400).json({ error: "File parsing failed" });
    }

    const file = files?.image;
    if (!file)
      return res
        .status(400)
        .json({ error: "No image uploaded (field 'image')" });

    // Support different formidable versions: file.filepath (new)
    const filepath = file.filepath || file.tempFilePath;
    const filename =
      file.originalFilename || file.name || path.basename(filepath || "");

    if (!filepath) {
      console.error("No temporary filepath found on uploaded file:", file);
      return res.status(400).json({ error: "Upload temporary file missing" });
    }

    if (!isAllowedFile(filename)) {
      try {
        fs.unlinkSync(filepath);
      } catch (e) {}
      return res
        .status(400)
        .json({ error: "Invalid file type", allowed: ALLOWED_EXT });
    }

    // Build multipart body to forward to Flask
    const forwardForm = new FormData();
    forwardForm.append("image", fs.createReadStream(filepath), filename);

    // forward safe optional fields if present
    ["goal", "duration", "user_id"].forEach((k) => {
      if (fields?.[k]) forwardForm.append(k, fields[k]);
    });

    // Forward to backend /analyze
    try {
      const inferenceRes = await fetch(
        `${INFERENCE_API_URL.replace(/\/$/, "")}/analyze`,
        {
          method: "POST",
          body: forwardForm,
          headers: forwardForm.getHeaders(), // required for node-fetch + form-data
        },
      );

      const text = await inferenceRes.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        // backend returned non-JSON (likely HTML error page); pass raw text
        json = { raw: text };
      }

      // cleanup temp file
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (e) {
        console.warn("cleanup failed", e);
      }

      // forward status and body
      return res.status(inferenceRes.status).json(json);
    } catch (error) {
      // cleanup and return 502
      try {
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      } catch (e) {}
      console.error("Error calling inference backend:", error);
      return res
        .status(502)
        .json({
          error: "Inference service unavailable",
          details: error.message,
        });
    }
  });
}