import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Message from './Message.jsx';
import './Chat.css';

const WELCOME = {
  role: 'assistant',
  text: 'こんにちは。何でも聞いてください。',
  citations: [],
};

export default function Chat() {
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError(null);
    setMessages((prev) => [...prev, { role: 'user', text, citations: [] }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, threadId }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API error ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      if (data.threadId) setThreadId(data.threadId);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply || '（応答が空でした）',
          citations: data.citations || [],
        },
      ]);
    } catch (err) {
      setError(err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `エラーが発生しました：${err.message}`,
          citations: [],
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <span className="chat-title">FOUNDRY AGENT</span>
        <span className="chat-sub">SUNSET TERMINAL ・ DEMO</span>
      </header>

      <div className="chat-window" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Message key={i} role={m.role} text={m.text} citations={m.citations} isError={m.isError} />
          ))}
          {loading && (
            <motion.div
              key="typing"
              className="typing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="bubble assistant typing-bubble">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="chat-input">
        <input
          type="text"
          placeholder="メッセージを入力..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
          aria-label="メッセージ入力"
        />
        <button onClick={send} disabled={loading || !input.trim()} className="send-btn">
          送信
        </button>
      </div>

      {error && <div className="error-banner">⚠ {error}</div>}
    </div>
  );
}
