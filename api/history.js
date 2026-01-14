import { getHistory } from "../lib/getHistory.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getHistory({ page, limit });
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Vercel /history error:", err.message);
    res.status(500).json({ error: "Failed to fetch classification history." });
  }
}
