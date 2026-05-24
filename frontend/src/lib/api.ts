function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (typeof window === "undefined") return "http://localhost:8000";
  // 自动用当前浏览器访问的 hostname，后端端口 8000
  return `http://${window.location.hostname}:8000`;
}

const API_BASE = getApiBase();

export async function fetchStream(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone?: () => void,
) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        onDone?.();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // skip
      }
    }
  }
  onDone?.();
}
