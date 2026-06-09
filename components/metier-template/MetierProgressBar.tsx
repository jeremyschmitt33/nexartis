"use client";
import { useEffect, useState } from "react";

/**
 * MetierProgressBar — Reading progress bar fixed-top.
 *
 * Calcule scrollY / (scrollHeight - innerHeight) et affiche un dégradé orange
 * V4 (différent du blog qui mélange bleu/orange/mint — ici on reste sobre).
 */
export default function MetierProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const scrollMax = h.scrollHeight - h.clientHeight;
      const pct = scrollMax > 0 ? (h.scrollTop / scrollMax) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 h-[3px] bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full origin-left bg-gradient-to-r from-[#ff7a1a] to-[#ff9d4d] transition-[width] duration-150 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
