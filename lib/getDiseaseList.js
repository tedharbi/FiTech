import fetch from "node-fetch";
import { cache } from "./cache.js";
import dotenv from "dotenv";
dotenv.config();


const DISEASE_LIST_CACHE_KEY = "disease_list";
export async function getDiseaseList() {
  const cached = cache.get(DISEASE_LIST_CACHE_KEY);
  if (cached) return cached;

  const res = await fetch(process.env.DISEASE_LIST_URL);
  const data = await res.json();
  const diseaseList = data.stats.classes.map((cls) => cls.name);

  cache.set(DISEASE_LIST_CACHE_KEY, diseaseList);
  return diseaseList;
}
