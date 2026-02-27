export function startSSE(url, onMessage, onError) {
  const es = new EventSource(url);

  es.addEventListener("tick", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      onMessage(data);
    } catch (e) {
      console.error("SSE parse error", e);
    }
  });

  es.onerror = (err) => {
    console.warn("SSE error", err);
    if (onError) onError(err);
  };

  return () => {
    try { es.close(); } catch (_) {}
  };
}