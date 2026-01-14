import { getDiseaseInfo } from "../lib/getDiseaseInfo.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const diseaseInfo = await getDiseaseInfo();
    return res.status(200).json(diseaseInfo);
  } catch (error) {
    console.error("Error in /api/disease-info:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}
