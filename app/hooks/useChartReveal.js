import { useEffect, useRef } from "react";

export default function useChartReveal(active = true) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const element = ref.current;
    if (!element) return undefined;

    if (!("IntersectionObserver" in window)) {
      element.classList.add("is-visible");
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0.18 });

    observer.observe(element);
    return () => observer.disconnect();
  }, [active]);

  return ref;
}
