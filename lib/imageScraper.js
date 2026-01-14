// imageScraper.js

import axios from "axios";
import * as cheerio from "cheerio";
import { getDiseaseList } from "./getDiseaseList.js";
import { cache } from "./cache.js";
import dotenv from "dotenv";

dotenv.config();
const SOURCE_URL = process.env.DISEASE_INFO_URL;
const CACHE_KEY = "scraped_disease_image_map";

export async function scrapeDiseaseImages() {
  try {
    // Return cached version if available
    const cached = cache.get(CACHE_KEY);
    if (cached) {
      console.log("✅ Using cached image map");
      console.log(JSON.stringify(cached, null, 2));
      return cached;
    }

    // 1. Load page
    const { data: html } = await axios.get(SOURCE_URL);
    const $ = cheerio.load(html);

    // 2. Load all disease names from getDiseaseList()
    const diseaseNames = await getDiseaseList();
    const imageMap = {};

    // 3. Loop through each disease and find <a> with matching title
    for (const disease of diseaseNames.filter(name => name.toLowerCase() !== "healthy")) {
      const lower = disease.toLowerCase();
      let match = null;

      $("a[title]").each((_, el) => {
        const title = $(el).attr("title")?.toLowerCase();
        const href = $(el).attr("href");

        if (title && title.includes(lower) && href?.includes("plantvillage-production-new")) {
          match = href;
          return false; // stop once first match found
        }
      });

      if(!match || match === "") {
        if(lower.includes("botrytis leaf blight")) {
          match = "https://plantvillage-production-new.s3.amazonaws.com/image/1573/file/default-6fbf67db9e0e53022ae60780bce4da36.jpg";
        } else if(lower.includes("downy mildew")) {
            match = "https://plantvillage-production-new.s3.amazonaws.com/image/1575/file/default-66914755057a3adf3c3cb941859d4b17.jpg";
        } else if(lower.includes("purple blotch")) {
          match = "https://plantvillage-production-new.s3.amazonaws.com/image/1580/file/default-daa7a8b7491c9383132e0c13d0397864.jpg";
        } else if(lower.includes("rust")) {
          match = "https://plantvillage-production-new.s3.amazonaws.com/image/1595/file/default-e870be5164e107fb6c322638db51aa7b.jpg";
        } else if(lower.includes("xanthomonas leaf blight")) {
            match = "https://extension.usu.edu/planthealth/ipm/images/agricultural/vegetables/stemphylium-leaf-blight-3.jpg";
        } else {
            match = "https://www.plantdiseases.org/sites/default/files/plant_disease/images/0607.jpg";
        }
      }

      imageMap[disease] = match || "";
    }

    cache.set(CACHE_KEY, imageMap);
    return imageMap;
  } catch (err) {
    console.error("❌ Scraper error:", err);
  }
}