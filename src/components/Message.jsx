import { motion } from 'framer-motion';
import './Message.css';

export default function Message({ role, text, citations, isError }) {
  const isUser = role === 'user';

  return (
    <motion.div
      className={`row ${isUser ? 'row-user' : 'row-assistant'}`}
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div className={`bubble ${isUser ? 'user' : 'assistant'} ${isError ? 'error' : ''}`}>
        <p className="bubble-text">{text}</p>

        {!isUser && citations && citations.length > 0 && (
          <div className="citations">
            <span className="citations-label">参照:</span>
            <ul>
              {citations.map((c, i) => (
                <li key={i}>{c.fileName || c.text || `引用 ${i + 1}`}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}
