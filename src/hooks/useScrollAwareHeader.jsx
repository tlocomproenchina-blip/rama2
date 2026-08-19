import { useState, useEffect } from 'react';

/**
 * Tracks scroll direction to show/hide a sticky mobile header.
 * Hides when scrolling down (past topThreshold), shows when scrolling up
 * or when near the top of the page.
 */
export default function useScrollAwareHeader({ threshold = 8, topThreshold = 80 } = {}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    const update = () => {
      const currentScrollY = window.scrollY;
      const diff = currentScrollY - lastScrollY;

      if (Math.abs(diff) >= threshold) {
        if (currentScrollY <= topThreshold) {
          setVisible(true);
        } else if (diff > 0) {
          setVisible(false);
        } else if (diff < 0) {
          setVisible(true);
        }
        lastScrollY = currentScrollY;
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold, topThreshold]);

  return visible;
}