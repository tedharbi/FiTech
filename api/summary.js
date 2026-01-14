import { getDiseaseSummary } from "../lib/summary.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const summary = await getDiseaseSummary();
    return res.status(200).json(summary);
  } catch (error) {
    console.error("Error in /api/analytics:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
