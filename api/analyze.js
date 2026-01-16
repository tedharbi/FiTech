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