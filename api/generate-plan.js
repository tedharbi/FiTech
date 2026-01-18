export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the JSON body
    const body = req.body;

    console.log("Received request for plan generation:", body);

    const inferenceApiUrl = process.env.INFERENCE_API_URL;
    if (!inferenceApiUrl) {
      console.error("INFERENCE_API_URL not set");
      return res.status(500).json({ error: "Server configuration error" });
    }

    console.log(`Forwarding to: ${inferenceApiUrl}/generate-plan`);

    // Forward to Flask backend
    const response = await fetch(`${inferenceApiUrl}/generate-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log(`Flask response: ${response.status}`, data);

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error in generate-plan.js:", error);
    return res.status(500).json({
      error: "Failed to generate plan",
      details: error.message,
    });
  }
}