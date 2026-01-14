import { pool } from "./db.js";
import { getDiseaseInfo } from "./getDiseaseInfo.js";
import { cache } from "./cache.js";

const SUMMARY_CACHE_KEY = "disease_summary";

export async function getDiseaseSummary() {
  const cached = cache.get(SUMMARY_CACHE_KEY);
  if (cached) return cached;

  const [allDiseases, dbResult] = await Promise.all([
    getDiseaseInfo(),
    pool.query(`
      SELECT disease_type, COUNT(*) AS count
      FROM "dbo"."logs"
      GROUP BY disease_type
      ORDER BY count DESC;
    `),
  ]);

  const dbMap = new Map(
    dbResult.rows.map((row) => [row.disease_type, parseInt(row.count)])
  );

  const finalSummary = allDiseases.map((disease) => ({
    disease_type: disease.disease_type,
    image: disease.image || "",
    count: dbMap.get(disease.disease_type) || 0,
  }));

  cache.set(SUMMARY_CACHE_KEY, finalSummary);
  return finalSummary;
}
