const TELEMETRY_KEY = "reflectivai:roleplay-simulator-telemetry";
const MAX_EVENTS = 200;

function safeWindow() {
  return typeof window !== "undefined" ? window : null;
}

function readTelemetry(win) {
  try {
    const raw = win.sessionStorage.getItem(TELEMETRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTelemetry(win, events) {
  try {
    win.sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // no-op
  }
}

export function recordSimulatorTelemetry(eventType, payload = {}) {
  const win = safeWindow();
  if (!win) return;

  const event = {
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  const events = readTelemetry(win);
  events.push(event);
  writeTelemetry(win, events);
  win.dispatchEvent(new CustomEvent("roleplay-simulator-telemetry", { detail: event }));
  console.info("[SimulatorTelemetry]", eventType, payload);
}
