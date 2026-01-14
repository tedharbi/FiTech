import { pool } from "./db.js";
import { cache } from "./cache.js";

export async function getHistory({ page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  const cacheKey = `history_page_${page}_limit_${limit}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const totalQuery = await pool.query(`SELECT COUNT(*) FROM "dbo"."logs"`);
  const total = parseInt(totalQuery.rows[0].count);

  const result = await pool.query(
    `
    SELECT 
      id,
      disease_type,
      confidence_score,
      annotated_image_url,
      description,
      prescription,
      mitigation_strategies,
      created_at
    FROM "dbo"."logs"
    ORDER BY created_at DESC OFFSET $1 LIMIT $2;
  `,
    [offset, limit]
  );

  const response = { data: result.rows, total };
  cache.set(cacheKey, response);
  return response;
}
