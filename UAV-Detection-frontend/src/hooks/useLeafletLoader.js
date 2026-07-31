import { useEffect, useState } from "react";

export function useLeafletLoader() {
  const [isLoaded, setIsLoaded] = useState(() => (
    typeof window !== "undefined" && Boolean(window.L)
  ));

  useEffect(() => {
    if (isLoaded) return undefined;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [isLoaded]);

  return isLoaded;
}
