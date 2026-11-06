import { createChatResponse } from "../lib/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 사용할 수 있습니다." });
  }

  let body;
  try {
    body = req.body; // JSON 형식이 잘못되면 여기서 오류가 난다.
  } catch {
    return res.status(400).json({ error: "요청 형식이 올바르지 않습니다." });
  }

  const result = await createChatResponse(body);
  return res.status(result.status).json(result.body);
}
