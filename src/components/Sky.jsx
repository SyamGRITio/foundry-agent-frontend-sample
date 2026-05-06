import { motion } from 'framer-motion';
import './Sky.css';

// Pre-randomized but fixed star field for consistent re-renders
const STARS = Array.from({ length: 48 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280;
  const r1 = (seed % 1000) / 1000;
  const r2 = ((seed * 7) % 1000) / 1000;
  const r3 = ((seed * 13) % 1000) / 1000;
  return {
    id: i,
    left: r1 * 100,
    top: r2 * 55, // upper portion only
    delay: r3 * 4,
    size: r1 < 0.7 ? 3 : 5,
    duration: 2 + r2 * 2,
  };
});

const CLOUDS = [
  { top: '8%', duration: 95, delay: 0, scale: 1 },
  { top: '16%', duration: 130, delay: -40, scale: 0.85 },
  { top: '26%', duration: 110, delay: -70, scale: 1.1 },
  { top: '12%', duration: 150, delay: -110, scale: 0.7 },
  { top: '32%', duration: 100, delay: -25, scale: 0.95 },
];

function PixelCloud() {
  // 4-block pixel cloud silhouette (CSS box shadows for true pixel feel)
  return <div className="cloud-shape" />;
}

export default function Sky() {
  return (
    <div className="sky-layer">
      {/* twinkling stars */}
      {STARS.map((s) => (
        <motion.div
          key={s.id}
          className="star"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
          }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* drifting pixel clouds */}
      {CLOUDS.map((c, i) => (
        <motion.div
          key={i}
          className="cloud-wrap"
          style={{ top: c.top, transform: `scale(${c.scale})` }}
          animate={{ x: ['-15vw', '115vw'] }}
          transition={{
            duration: c.duration,
            delay: c.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <PixelCloud />
        </motion.div>
      ))}
    </div>
  );
}
