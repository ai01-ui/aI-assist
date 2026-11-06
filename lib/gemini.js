import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const KNOWLEDGE_DIR = path.join(process.cwd(), "knowledge");
const MAX_TEXT_LENGTH = 2000;
const MAX_MESSAGES = 20;

const KEY_ERROR = "API 키를 확인하세요.";
const KNOWLEDGE_ERROR = "품질 문서를 불러오지 못했습니다. 관리자에게 문의해 주세요.";

const ANSWER_RULES = `한국어로 간결하게 답한다.

[답변 규칙]
1. 너는 신진엠텍 품질경영실의 AI 비서다.
2. 제공된 문서에 있는 내용만 근거로 답한다.
3. 답변 끝에 근거를 [시방서 5.2], [검사기준서 No.8], [표준서 4], [계약서 제10조] 형식으로 표시한다.
4. 문서에 없으면 추측하지 말고 "제공된 문서에서 확인되지 않습니다"라고 답한다.
5. 사내 기준서(검사기준서, 작업표준서)의 값이 시방서 최신본과 다르면 양쪽 값을 모두 보여주고, 시방서 값을 기준으로 안내하며 해당 기준서의 개정 검토가 필요하다고 알린다. 개정 이력으로 설명되는 차이인지, 문서만으로 원인을 알 수 없는 차이인지도 구분한다.
6. 계약서와 시방서가 다르면 계약서 제3조 제2항의 우선순위(특수조건 → 계약서 본문 → 시방서)를 따른다.
7. 단위만 다른 값은 환산식을 보여주고, 불일치가 아니라 "단위만 다름"으로 구분한다.
8. 시방서의 기준이 사내 기준서에 없으면 "누락"이라고 분명히 알린다.
9. 최종 합격·불합격 판정과 기준서 개정은 품질 담당자가 결정한다고 안내한다.

[규칙 적용 방법]
- 사내 기준서에 해당 항목이 있는지 묻거나 항목을 찾지 못했다면, 먼저 시방서를 확인한다. 시방서에 기준이 있고 그 기준서에 항목이 없으면 규칙 4를 쓰지 말고 규칙 8로 답한다. 규칙 4는 어느 문서에도 내용이 없을 때만 쓴다.
- "누락"은 항목 자체가 없을 때만 쓴다. 항목이 있는데 값이 다르면 "값 불일치"다.
- 값 불일치의 원인을 쓰기 전에 반드시 시방서 개정 이력 표를 확인한다. 표의 변경 내용에 그 항목이 있으면 "개정 이력으로 설명되는 차이"로 쓰고 해당 개정 번호와 변경 전후 값을 밝힌다. 표에 그 항목이 없을 때만 "문서만으로는 원인을 알 수 없는 차이"로 쓴다.
- 계약서와 시방서가 다르면 우선순위에 따라 적용할 값을 안내한다. 이 경우 기준서 개정 안내와 품질 담당자 안내는 붙이지 않는다.
- 시방서의 표뿐 아니라 문장으로 쓴 요구사항(예: 6장 안전 요구사항)도 시방서 기준이다. 항목이 있는지 답하기 전에 시방서 전체를 확인한다.
- 측정값의 합격 여부를 물으면 "합격", "불합격"이라고 단정하지 않는다. 시방서와 사내 기준서의 값을 모두 보여 주고, 기준별 허용 범위를 계산해 측정값이 범위 안인지 밖인지 각각 쓴 뒤, 값이 다르면 규칙 5를 함께 적용하고 최종 판정은 품질 담당자가 결정한다고 안내한다.
- 근거의 문서 이름은 시방서, 검사기준서, 표준서, 계약서로만 쓴다. 특수조건은 [계약서 특수조건 제3조]처럼 쓴다.
- 규칙 7의 환산식은 계산 과정을 숫자로 쓴다. 단위 환산 계수는 표준 값을 쓸 수 있다. 단위만 다르면 "값이 다르다"고 쓰지 않는다.
- 근거는 본문에 넣지 말고 답변 마지막 줄에만 모아서 표시한다. 규칙 4로 답할 때는 근거를 표시하지 않는다.
- 규칙 9의 안내는 합격 여부, 기준 불일치, 누락, 기준서 개정과 관련된 답변에만 붙인다.
- 답변에 규칙 번호를 쓰지 않는다.
- 화면은 일반 텍스트만 표시한다. 별표(**), 샵(#), 달러 기호($), 수식 문법 같은 서식 기호를 쓰지 않는다. 목록은 "- "로 쓴다.

[답변 형식 예시] 아래 항목명과 값은 형식을 보여 주기 위한 가상의 예이며 근거로 쓰지 않는다.

예시 1) 기준서에 항목이 없는 경우
- 시방서: 항목A 10 이하
- 검사기준서: 항목A 없음
구분: 누락. 시방서의 기준이 검사기준서에 없으므로 기준서 개정 검토가 필요합니다.
최종 합격·불합격 판정과 기준서 개정은 품질 담당자가 결정합니다.
[시방서 3]

예시 2-1) 값이 다르고 시방서 개정 이력에 그 항목의 변경이 있는 경우
- 시방서: 항목E 7개
- 작업표준서: 항목E 9개
구분: 값 불일치. 시방서 값 7개를 기준으로 안내하며, 작업표준서의 개정 검토가 필요합니다. 시방서 Rev.X에서 9개가 7개로 변경된 내용이 작업표준서에 반영되지 않은 것으로, 개정 이력으로 설명되는 차이입니다.
최종 합격·불합격 판정과 기준서 개정은 품질 담당자가 결정합니다.
[시방서 개정 이력], [시방서 5.1], [표준서 2]

예시 2-2) 값이 다르고 시방서 개정 이력에 그 항목의 변경이 없는 경우
- 시방서: 항목B 5 이하
- 작업표준서: 항목B 10 이하
구분: 값 불일치. 시방서 값 5 이하를 기준으로 안내하며, 작업표준서의 개정 검토가 필요합니다. 시방서 개정 이력에 이 항목의 변경이 없어, 문서만으로는 원인을 알 수 없는 차이입니다.
최종 합격·불합격 판정과 기준서 개정은 품질 담당자가 결정합니다.
[시방서 5.1], [표준서 2]

예시 3) 단위만 다른 경우
- 시방서: 항목C 100 kPa
- 검사기준서: 항목C 1.02 kgf/cm²
환산식: 100 kPa ÷ 98.0665 = 1.02 kgf/cm²
구분: 단위만 다름. 불일치가 아닙니다.
[시방서 4], [검사기준서 No.1]

예시 4) 단순 사실을 묻는 경우
항목D는 최종 검수일로부터 12개월입니다.
[계약서 제1조]

예시 5) 계약서와 시방서가 다른 경우
- 시방서: 항목F 10일 이내
- 계약서 본문: 항목F 20일 이내
적용: 계약서 제3조 제2항의 우선순위(특수조건 → 계약서 본문 → 시방서)에 따라 계약서 본문의 20일 이내를 적용합니다.
[시방서 9.9], [계약서 제3조], [계약서 제9조]`;

// knowledge 폴더의 .md 문서를 모두 읽어 시스템 지시문을 만든다.
// 요청마다 읽으므로 문서를 고쳐도 서버를 다시 시작할 필요가 없다.
async function buildSystemInstruction() {
  const names = await fs.readdir(KNOWLEDGE_DIR, { recursive: true });
  const mdNames = names.filter((name) => /\.md$/i.test(name)).sort();
  if (mdNames.length === 0) {
    throw new Error("no knowledge documents");
  }

  const documents = await Promise.all(
    mdNames.map(async (name) => {
      const content = await fs.readFile(path.join(KNOWLEDGE_DIR, name), "utf8");
      return `<document name="${name}">\n${content}\n</document>`;
    })
  );

  return `${ANSWER_RULES}\n\n[제공된 문서]\n${documents.join("\n\n")}`;
}

function findInputError(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "메시지를 입력해 주세요.";
  }
  for (const message of messages) {
    const validRole = message?.role === "user" || message?.role === "assistant";
    if (!validRole || typeof message.text !== "string" || !message.text.trim()) {
      return "메시지 형식이 올바르지 않습니다.";
    }
    if (message.text.length > MAX_TEXT_LENGTH) {
      return `메시지는 ${MAX_TEXT_LENGTH.toLocaleString()}자까지 입력할 수 있습니다.`;
    }
  }
  return null;
}

// 최근 메시지만 남기고 Gemini 형식으로 바꾼다. (assistant → model)
// Gemini 대화는 사용자 메시지로 시작해야 하므로, 잘린 뒤 맨 앞의 비서 답변은 뺀다.
export function toGeminiContents(messages) {
  const recent = messages.slice(-MAX_MESSAGES);
  const firstUser = recent.findIndex((message) => message.role === "user");
  if (firstUser === -1) return [];
  return recent.slice(firstUser).map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.text }],
  }));
}

// 오류 원문과 키 값은 화면으로 보내지 않고, 쉬운 안내 문구로 바꾼다.
export function toErrorResponse(error) {
  const status = error?.status;
  if (status === 429) {
    return { status: 429, body: { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." } };
  }
  const invalidKey = status === 400 && /api[ _]?key/i.test(String(error?.message));
  if (status === 401 || status === 403 || invalidKey) {
    return { status: 500, body: { error: KEY_ERROR } };
  }
  return { status: 500, body: { error: "답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." } };
}

// api/chat.js와 local-server.js가 함께 쓰는 공통 처리 함수
export async function createChatResponse(body) {
  const inputError = findInputError(body?.messages);
  if (inputError) {
    return { status: 400, body: { error: inputError } };
  }

  const contents = toGeminiContents(body.messages);
  if (contents.length === 0) {
    return { status: 400, body: { error: "메시지 형식이 올바르지 않습니다." } };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: KEY_ERROR } };
  }

  // 문서를 못 읽으면 일반 지식으로 답하지 않도록 여기서 멈춘다.
  let systemInstruction;
  try {
    systemInstruction = await buildSystemInstruction();
  } catch {
    console.error("품질 문서 읽기 실패");
    return { status: 500, body: { error: KNOWLEDGE_ERROR } };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
      contents,
      config: { systemInstruction, temperature: 0 },
    });
    if (!response.text) {
      return { status: 502, body: { error: "답변을 만들지 못했습니다. 질문을 바꿔 다시 시도해 주세요." } };
    }
    return { status: 200, body: { reply: response.text } };
  } catch (error) {
    // 서버 기록에도 오류 원문은 남기지 않고 상태 코드만 남긴다.
    console.error(`Gemini 호출 실패 (상태 코드: ${error?.status ?? "없음"})`);
    return toErrorResponse(error);
  }
}
