"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    // V4 (2026-06-08) : threshold 0.12 + rootMargin -8%
    // pour révéler plus tôt au scroll (recommandation du handoff design).
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return null;
}
