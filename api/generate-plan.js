export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const inferenceApiUrl = process.env.INFERENCE_API_URL;
    if (!inferenceApiUrl) {
      return res
        .status(500)
        .json({ error: "INFERENCE_API_URL not configured" });
    }

    console.log("Forwarding to:", inferenceApiUrl + "/generate-plan");
    console.log("Payload:", req.body);

    const response = await fetch(`${inferenceApiUrl}/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    console.log("Flask response status:", response.status);
    console.log("Flask response data:", data);

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error in generate-plan.js:", error);
    return res.status(500).json({ error: error.message });
  }
}