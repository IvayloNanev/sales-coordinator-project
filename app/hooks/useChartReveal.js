import { useEffect, useRef } from "react";

export default function useChartReveal(active = true, options = {}) {
  const ref = useRef(null);
  const threshold = options.threshold ?? 0.18;
  const rootMargin = options.rootMargin ?? "0px";

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
    }, { threshold, rootMargin });

    observer.observe(element);
    return () => observer.disconnect();
  }, [active, rootMargin, threshold]);

  return ref;
}
