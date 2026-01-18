export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get the raw body as ArrayBuffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create FormData for Flask
    const formData = new FormData();
    formData.append("image", buffer, "image.jpg");

    // Get the ngrok URL from environment variable
    const inferenceApiUrl = process.env.INFERENCE_API_URL;
    if (!inferenceApiUrl) {
      return res
        .status(500)
        .json({ error: "INFERENCE_API_URL not configured" });
    }

    console.log("Forwarding to:", inferenceApiUrl + "/analyze");

    // Forward to Flask backend
    const response = await fetch(`${inferenceApiUrl}/analyze`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Log for debugging
    console.log("Flask response status:", response.status);
    console.log("Flask response data:", data);

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Error in analyze.js:", error);
    return res.status(500).json({ error: error.message });
  }
}