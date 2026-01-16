import fetch from "node-fetch"; // IMPORTANT: required in Vercel Node runtime

const INFERENCE_API_URL =
  process.env.INFERENCE_API_URL || "http://127.0.0.1:5000/predict";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const response = await fetch(process.env.INFERENCE_API_URL + "/analyze", {
    method: "POST",
    body: req,
    headers: {
      "Content-Type": req.headers["content-type"],
    },
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
