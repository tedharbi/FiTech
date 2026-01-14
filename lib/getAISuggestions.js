import fetch from "node-fetch";
import dotenv from "dotenv";
import { cache } from "./cache.js";
dotenv.config();

export async function getAISuggestions({ disease, confidence, imageUrl }) {
  const cacheKey = `ai_${disease.toLowerCase().replace(/\s+/g, "_")}_${confidence}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `
You are an expert plant pathologist specialized in onion diseases.

You must return your answer strictly as a JSON object with the following keys:
{
  "summary": "Short explanation of the disease and its effects",
  "prescription": "Recommended treatment steps and fungicides",
  "mitigation": "Best practices to prevent recurrence"
}

Do not include any commentary, markdown, or additional text — only valid JSON.
`;

  const question = `Detected onion disease: ${disease}\nConfidence: ${confidence}%${imageUrl ? `\nImage: ${imageUrl}` : ""}`;

  const res = await fetch(process.env.GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Groq API failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(raw);
    const result = {
      summary: parsed.summary?.trim() || "",
      prescription: parsed.prescription?.trim() || "",
      mitigation: parsed.mitigation?.trim() || "",
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    throw new Error("Failed to parse AI JSON response: " + err.message + "\nRaw response: " + raw);
  }
}
