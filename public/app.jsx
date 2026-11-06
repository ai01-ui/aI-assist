const { useEffect, useRef, useState } = React;

const isLocal = ["127.0.0.1", "localhost"].includes(window.location.hostname);
const API_URL = isLocal ? "http://127.0.0.1:3001/api/chat" : "/api/chat";

const MAX_TEXT_LENGTH = 2000;
const CONNECTION_ERROR = "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.";

let lastId = 0;
const nextId = () => ++lastId;

// 오류 안내와 전송에 실패한 질문은 다음 요청의 대화 기록에서 뺀다.
function toServerHistory(messages) {
  return messages
    .filter((message) => message.role !== "error" && !message.failed)
    .map(({ role, text }) => ({ role, text }));
}

function currentTime() {
  return new Date().toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" });
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
      <path d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.7l-.9 3.4c-.1.4.3.7.6.5l4-2.7c.6.1 1.1.1 1.7.1 5.5 0 10-3.6 10-8S17.5 3 12 3Z" />
    </svg>
  );
}

function CloseIcon({ size = 24 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Message({ role, text, time }) {
  const isUser = role === "user";
  return (
    <div className={`message-row ${isUser ? "message-row-user" : "message-row-ai"}`}>
      {!isUser && <div className="avatar" aria-hidden="true">AI</div>}
      <div className="message-body">
        {!isUser && <div className="sender-name">AI 비서</div>}
        <div className="bubble-line">
          <div className={`bubble bubble-${role}`}>{text}</div>
          {time && <span className="message-time">{time}</span>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const listRef = useRef(null);
  const launcherRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isLoading, isOpen]);

  // 창이 열려 있을 때 Esc로 닫고, 닫히면 아이콘으로 초점을 돌려준다.
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleEscape(event) {
      if (event.key === "Escape" && !event.isComposing) setIsOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      launcherRef.current?.focus();
    };
  }, [isOpen]);

  function showError(failedId, text) {
    setMessages((prev) => [
      ...prev.map((message) =>
        message.id === failedId ? { ...message, failed: true } : message
      ),
      { id: nextId(), role: "error", text, time: currentTime() },
    ]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage = { id: nextId(), role: "user", text, time: currentTime() };
    const history = toServerHistory([...messages, userMessage]);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.reply) {
        setMessages((prev) => [
          ...prev,
          { id: nextId(), role: "assistant", text: data.reply, time: currentTime() },
        ]);
      } else {
        showError(userMessage.id, data?.error || CONNECTION_ERROR);
      }
    } catch {
      showError(userMessage.id, CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(event) {
    // 한글 조합 중의 Enter는 글자 확정용이므로 전송하지 않는다.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage();
  }

  return (
    <>
      {isOpen && (
        <div className="chat-window" role="dialog" aria-label="품질경영실 AI 비서">
          <header className="app-header">
            <h1>품질경영실 AI 비서</h1>
            <div className="header-actions">
              <button
                type="button"
                className="clear-button"
                onClick={() => setMessages([])}
                disabled={isLoading || messages.length === 0}
              >
                대화 지우기
              </button>
              <button
                type="button"
                className="close-button"
                onClick={() => setIsOpen(false)}
                aria-label="채팅창 닫기"
              >
                <CloseIcon size={20} />
              </button>
            </div>
          </header>

          <main className="message-list" ref={listRef} aria-live="polite">
            {messages.length === 0 && !isLoading && (
              <p className="empty-message">무엇을 도와드릴까요?</p>
            )}
            {messages.map((message) => (
              <Message key={message.id} role={message.role} text={message.text} time={message.time} />
            ))}
            {isLoading && <Message role="loading" text="답변 작성 중..." />}
          </main>

          <footer className="composer">
            <form className="composer-form" onSubmit={handleSubmit}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="질문을 입력하세요"
                aria-label="질문 입력"
                maxLength={MAX_TEXT_LENGTH}
                rows={2}
                autoFocus
              />
              <button
                type="submit"
                className="send-button"
                disabled={isLoading || !input.trim()}
              >
                보내기
              </button>
            </form>
            <div className="composer-info">
              <p className="notice">실습용 챗봇입니다. 실제 회사 자료나 개인정보를 입력하지 마세요.</p>
              <span className="counter">
                {input.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()}
              </span>
            </div>
          </footer>
        </div>
      )}

      <button
        type="button"
        ref={launcherRef}
        className={`chat-launcher ${isOpen ? "chat-launcher-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "채팅창 닫기" : "채팅창 열기"}
        aria-expanded={isOpen}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
