import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  color: string;
  barCount?: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, color, barCount = 5 }) => {
  const barsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    let animationFrameId: number;

    const animate = () => {
      if (isActive) {
        barsRef.current.forEach((bar, index) => {
          if (bar) {
            // Create a randomized "wave" effect
            const height = Math.max(15, Math.random() * 100); 
            bar.style.height = `${height}%`;
          }
        });
        // Slower update for smoother look
        setTimeout(() => {
            animationFrameId = requestAnimationFrame(animate);
        }, 100);
      } else {
        barsRef.current.forEach((bar) => {
          if (bar) bar.style.height = '10%';
        });
      }
    };

    if (isActive) {
      animate();
    } else {
       barsRef.current.forEach((bar) => {
          if (bar) bar.style.height = '10%';
        });
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isActive]);

  return (
    <div className="flex items-center justify-center space-x-1 h-16 w-16">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
             if (el) barsRef.current[i] = el;
          }}
          className={`w-2 rounded-full transition-all duration-150 ease-in-out ${color}`}
          style={{ height: '10%' }}
        />
      ))}
    </div>
  );
};

export default Visualizer;