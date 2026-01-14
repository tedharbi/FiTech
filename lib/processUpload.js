import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import { createCanvas, loadImage, registerFont } from "canvas";
import { v4 as uuidv4 } from "uuid";
import moment from "moment-timezone";
import cloudinary from "./cloudinaryConfig.js";
import { getAISuggestions } from "./getAISuggestions.js";
import { pool } from "./db.js";
import { cache } from "./cache.js";

// ✅ Register custom font to support Vercel (no Arial installed)
registerFont(path.join(process.cwd(), "fonts", "OpenSans-Regular.ttf"), {
  family: "OpenSans",
});

export async function processUpload({ file, base64 }) {
  let imagePath = file?.filepath || file?.path || null;

  try {
    let base64Image = base64;

    if (!base64Image && file) {
      const imageBuffer = fs.readFileSync(imagePath);
      base64Image = imageBuffer.toString("base64");
    }

    if (!base64Image) {
      throw new Error("Missing image data.");
    }

    // 🔁 Roboflow Prediction
    const roboflowRes = await axios({
      method: "POST",
      url: `https://serverless.roboflow.com/${process.env.ROBOFLOW_MODEL}/${process.env.ROBOFLOW_VERSION}`,
      params: { api_key: process.env.ROBOFLOW_API_KEY },
      data: base64Image,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const predictions = roboflowRes.data.predictions;

    const top = predictions
      .map((p) => ({
        label: p.class,
        score: p.confidence,
      }))
      .sort((a, b) => b.score - a.score)[0];

    // ✅ HEALTHY CASE
    if (!predictions?.length || top?.label.toLowerCase() === "healthy") {
      if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      return {
        disease_type: "Healthy",
        confidence_score: 100,
        description: "Image is healthy, no disease detected.",
        prescription: "No action needed.",
        mitigation_strategies: "Maintain healthy practices.",
        annotated_image_url: null,
        predictions: null,
      };
    }

    // ✅ Convert to PNG (for canvas support)
    const convertedBuffer = await sharp(Buffer.from(base64Image, "base64"))
      .toFormat("png")
      .toBuffer();

    // ✅ Annotate Image
    const img = await loadImage(convertedBuffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const base = Math.max(img.width, img.height);
    const scale = base / 300;
    ctx.strokeStyle = "#FF0000";
    ctx.lineWidth = Math.max(4, Math.min(8, 2.5 * scale));
    const fontSize = Math.max(12, Math.min(28, 14 * scale));
    ctx.font = `${fontSize}px OpenSans`; // ✅ Use registered font

    predictions.forEach((pred) => {
      const x = pred.x - pred.width / 2;
      const y = pred.y - pred.height / 2;
      const label = `${pred.class} (${(pred.confidence * 100).toFixed(1)}%)`;

      ctx.beginPath();
      ctx.rect(x, y, pred.width, pred.height);
      ctx.stroke();

      const textWidth = ctx.measureText(label).width;
      const textHeight = fontSize;

      ctx.fillStyle = "rgba(255, 0, 0, 0.85)";
      ctx.fillRect(x, y - textHeight - 4, textWidth + 6, textHeight + 4);

      ctx.fillStyle = "white";
      ctx.fillText(label, x + 3, y - 4);
    });

    // ✅ Upload to Cloudinary
    const annotatedBuffer = canvas.toBuffer("image/jpeg");
    const cloudinaryRes = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${annotatedBuffer.toString("base64")}`,
      { folder: "onion-leaf-detection" }
    );

    const annotatedImageUrl = cloudinaryRes.secure_url;
    const confidence = Math.round(Number(top.score) * 100);

    // ✅ AI Suggestion
    const ai = await getAISuggestions({
      disease: top.label,
      confidence: confidence,
      imageUrl: annotatedImageUrl,
    });

    const created_at = await getDate();

    const logData = {
      id: uuidv4(),
      disease_type: top.label,
      confidence_score: confidence,
      description: ai.summary,
      prescription: ai.prescription,
      mitigation_strategies: ai.mitigation,
      annotated_image_url: annotatedImageUrl,
      predictions: JSON.stringify(predictions),
      created_at,
    };

    await pool.query(
      `INSERT INTO "dbo"."logs"
       (id, disease_type, confidence_score, description, prescription, mitigation_strategies, annotated_image_url, predictions, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logData.id,
        logData.disease_type,
        logData.confidence_score,
        logData.description,
        logData.prescription,
        logData.mitigation_strategies,
        logData.annotated_image_url,
        logData.predictions,
        logData.created_at,
      ]
    );
    cache.del("disease_summary");
    cache.keys().forEach((key) => {
      if (key.startsWith("history_page_")) {
        cache.del(key);
      }
    });

    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    return logData;
  } catch (err) {
    cache.del("disease_summary");
    if (imagePath && fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    throw err;
  }
}

async function getDate() {
  const res = await pool.query("SELECT now() as timestamp");
  return moment.utc(res.rows[0].timestamp).tz("Asia/Manila").format();
}
