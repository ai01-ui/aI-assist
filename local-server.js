import http from "node:http";
import { createChatResponse } from "./lib/gemini.js";

const HOST = "127.0.0.1";
const PORT = 3001;
const MAX_BODY_BYTES = 1024 * 1024; // 요청 크기 제한: 1MB

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, status, body) {
  res.writeHead(status, { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("too large");
      error.tooLarge = true;
      throw error;
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${HOST}`);

  if (pathname !== "/api/chat") {
    return sendJson(res, 404, { error: "없는 주소입니다." });
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { error: "POST 요청만 사용할 수 있습니다." });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error.tooLarge) {
      res.setHeader("Connection", "close");
      return sendJson(res, 413, { error: "요청 내용이 너무 깁니다." });
    }
    return sendJson(res, 400, { error: "요청 형식이 올바르지 않습니다." });
  }

  const result = await createChatResponse(body);
  return sendJson(res, result.status, result.body);
});

server.listen(PORT, HOST, () => {
  console.log(`서버 실행 중: http://${HOST}:${PORT}/api/chat`);
});
