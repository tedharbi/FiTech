// getDiseaseInfo.js

import dotenv from "dotenv";
import fetch from "node-fetch";
import axios from "axios";
import * as cheerio from "cheerio";
import { getDiseaseList } from "./getDiseaseList.js";
import { cache } from "./cache.js";

dotenv.config();

const MODEL = "llama3-70b-8192";
const GROQ_URL = process.env.GROQ_API_URL;
const GROQ_KEY = process.env.GROQ_API_KEY;
const SOURCE_URL = process.env.DISEASE_INFO_URL;
const COMBINED_CACHE_KEY = "combined_disease_info";

const slug = (name) => name.toLowerCase().replace(/\s+/g, "_");

const FALLBACK_IMAGES = {
  "botrytis leaf blight": "https://plantvillage-production-new.s3.amazonaws.com/image/1573/file/default-6fbf67db9e0e53022ae60780bce4da36.jpg",
  "downy mildew": "https://plantvillage-production-new.s3.amazonaws.com/image/1575/file/default-66914755057a3adf3c3cb941859d4b17.jpg",
  "purple blotch": "https://plantvillage-production-new.s3.amazonaws.com/image/1580/file/default-daa7a8b7491c9383132e0c13d0397864.jpg",
  "rust": "https://plantvillage-production-new.s3.amazonaws.com/image/1595/file/default-e870be5164e107fb6c322638db51aa7b.jpg",
  "xanthomonas leaf blight": "https://extension.usu.edu/planthealth/ipm/images/agricultural/vegetables/stemphylium-leaf-blight-3.jpg",
  "stemphylium leaf blight": "https://www.plantdiseases.org/sites/default/files/plant_disease/images/0607.jpg"
};

async function scrapeDiseaseImages() {
  const CACHE_KEY = "scraped_disease_image_map";
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const { data: html } = await axios.get(SOURCE_URL);
  const $ = cheerio.load(html);
  const diseaseNames = await getDiseaseList();
  const imageMap = {};

  for (const disease of diseaseNames.filter(name => name.toLowerCase() !== "healthy")) {
    const lower = disease.toLowerCase();
    let match = null;

    $("a[title]").each((_, el) => {
      const title = $(el).attr("title")?.toLowerCase();
      const href = $(el).attr("href");

      if (title && title.includes(lower) && href?.includes("plantvillage-production-new")) {
        match = href;
        return false;
      }
    });

    if (!match) {
      match = Object.entries(FALLBACK_IMAGES).find(([key]) => lower.includes(key))?.[1] || FALLBACK_IMAGES["stemphylium leaf blight"];
    }

    imageMap[disease] = match;
  }

  cache.set(CACHE_KEY, imageMap);
  return imageMap;
}

async function getDiseaseText(disease) {
  const cacheKey = `disease_info_${slug(disease)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `
You are an expert plant pathologist specializing in onion diseases.

Use this knowledge base as a guide:
📚 ${SOURCE_URL}

Return strictly a valid JSON with this structure:
{
  "description": "How the disease affects onions.",
  "prescription": "Treatment and control strategies (avoid % values).",
  "mitigation": "How to prevent it in the future.",
  "source": "${SOURCE_URL}"
}
Do not add extra text, markdown, commentary, or image links.`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `Give general info for onion disease: ${disease}` },
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Groq API failed for "${disease}": ${res.status} - ${error}`);
    }

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(raw);

    const result = {
      disease_type: disease,
      description: parsed.description?.trim() || "",
      prescription: parsed.prescription?.trim() || "",
      mitigation: parsed.mitigation?.trim() || "",
      source: parsed.source?.trim() || SOURCE_URL,
    };

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error(`[Groq Error: ${disease}] ${err.message}`);
    return {
      disease_type: disease,
      description: "Error generating description.",
      prescription: "Error generating prescription.",
      mitigation: "Error generating mitigation.",
      source: SOURCE_URL,
      error: true,
    };
  }
}

export async function getDiseaseInfo() {
  const cached = cache.get(COMBINED_CACHE_KEY);
  if (cached) return cached;

  const [diseases, imageMap] = await Promise.all([
    getDiseaseList(),
    scrapeDiseaseImages(),
  ]);

  const results = await Promise.all(
    diseases.filter(d => slug(d) !== "healthy").map(async (disease) => {
      const text = await getDiseaseText(disease);
      const image = imageMap[disease] || "";
      return { ...text, image };
    })
  );

  cache.set(COMBINED_CACHE_KEY, results);
  return results;
}
