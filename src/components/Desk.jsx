import { motion } from 'framer-motion';
import './Desk.css';

export default function Desk() {
  return (
    <div className="desk-layer">
      {/* Wooden desk surface */}
      <div className="desk-surface" />

      {/* Decorative pixel objects on the desk */}
      <div className="desk-objects">
        {/* CRT monitor (left) */}
        <div className="crt">
          <div className="crt-frame">
            <div className="crt-screen">
              <span className="crt-prompt">C:\&gt; azure --help</span>
              <span className="crt-prompt">
                &gt; <motion.span
                  className="crt-cursor"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ▌
                </motion.span>
              </span>
            </div>
          </div>
          <div className="crt-base" />
        </div>

        {/* Coffee mug with steam */}
        <div className="mug-wrap">
          <motion.div
            className="steam"
            animate={{ y: [0, -16, -32], opacity: [0, 0.9, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: 0 }}
          />
          <motion.div
            className="steam steam-2"
            animate={{ y: [0, -16, -32], opacity: [0, 0.7, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: 0.8 }}
          />
          <div className="mug">
            <div className="mug-handle" />
          </div>
        </div>

        {/* Stack of books */}
        <div className="books">
          <div className="book book-1" />
          <div className="book book-2" />
          <div className="book book-3" />
        </div>

        {/* Cactus in pot */}
        <div className="cactus-wrap">
          <div className="cactus-body" />
          <div className="cactus-arm" />
          <div className="pot" />
        </div>
      </div>
    </div>
  );
}
