import { ALL_SCENARIOS } from "@/lib/scenarioCatalog";
import {
  listWorkerScenarios,
  createWorkerScenario,
  updateWorkerScenario,
  deleteWorkerScenario,
} from "@/services/workerClient";

const CUSTOM_SCENARIOS_KEY = "signal-coach-custom-scenarios";
const WORKER_SCENARIO_LIST_TIMEOUT_MS = 1200;

function normalizeRuntimeTemperature(scenario) {
  const explicit = Number(scenario?.runtimeTemperature);
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 10) {
    return explicit;
  }

  const persona = String(scenario?.persona || "").toLowerCase();
  if (persona.includes("skeptical")) return 7;
  if (persona.includes("time_constrained")) return 6;
  if (persona.includes("cost_focused")) return 6;
  if (persona.includes("curious_uncertain")) return 4;
  return 5;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBuiltInScenario(scenario, index) {
  return {
    ...scenario,
    runtimeTemperature: normalizeRuntimeTemperature(scenario),
    id: scenario.id || `builtin-${slugify(scenario.title || `scenario-${index + 1}`)}`,
    isBuiltIn: true,
    isPublished: true,
  };
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readCustomScenarios() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(CUSTOM_SCENARIOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCustomScenarios(scenarios) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function normalizeCustomScenario(scenario) {
  return {
    ...scenario,
    isBuiltIn: false,
    isPublished: scenario?.isPublished ?? true,
  };
}

function sortScenariosByRecency(scenarios) {
  return [...scenarios].sort((left, right) => {
    const leftTime = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function dedupeById(scenarios) {
  const seen = new Set();
  return scenarios.filter((scenario) => {
    const id = scenario?.id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function withTimeout(promise, timeoutMs, fallbackValue) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallbackValue), timeoutMs)),
  ]);
}

async function loadWorkerCustomScenarios() {
  const cached = dedupeById(sortScenariosByRecency(readCustomScenarios().map(normalizeCustomScenario)));
  try {
    const scenarios = await withTimeout(
      listWorkerScenarios(),
      WORKER_SCENARIO_LIST_TIMEOUT_MS,
      cached,
    );
    if (Array.isArray(scenarios) && scenarios.length >= 0) {
      const normalized = dedupeById(sortScenariosByRecency(scenarios.map(normalizeCustomScenario)));
      writeCustomScenarios(normalized);
      return normalized;
    }
  } catch {
    return cached;
  }

  return cached;
}

export function listBuiltInScenarios() {
  return ALL_SCENARIOS.map(normalizeBuiltInScenario);
}

export async function listCustomScenarios() {
  return loadWorkerCustomScenarios();
}

export async function listAllScenarios() {
  const customScenarios = await listCustomScenarios();
  return dedupeById([...listBuiltInScenarios(), ...customScenarios]);
}

export async function listPublishedScenarios() {
  const scenarios = await listAllScenarios();
  return scenarios.filter((scenario) => scenario.isPublished !== false);
}

export async function getScenarioById(id) {
  const scenarios = await listAllScenarios();
  if (!id) return scenarios[0] || null;
  return scenarios.find((scenario) => scenario.id === id) || null;
}

export async function createCustomScenario(scenario) {
  const nextScenario = {
    ...scenario,
    id: scenario.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    isBuiltIn: false,
    isPublished: scenario.isPublished ?? true,
    createdAt: scenario.createdAt || new Date().toISOString(),
  };

  try {
    const saved = await createWorkerScenario(nextScenario);
    const next = dedupeById(sortScenariosByRecency([saved, ...readCustomScenarios().filter((item) => item.id !== saved.id)]));
    writeCustomScenarios(next);
    return saved;
  } catch {
    const scenarios = readCustomScenarios();
    writeCustomScenarios(dedupeById(sortScenariosByRecency([nextScenario, ...scenarios])));
    return nextScenario;
  }
}

export async function updateCustomScenario(id, patch) {
  try {
    const saved = await updateWorkerScenario(id, patch);
    const next = sortScenariosByRecency(readCustomScenarios().map((scenario) => (
      scenario.id === id ? saved : scenario
    )));
    writeCustomScenarios(next);
    return saved;
  } catch {
    const scenarios = readCustomScenarios();
    const next = sortScenariosByRecency(scenarios.map((scenario) => (
      scenario.id === id
        ? { ...scenario, ...patch, updatedAt: new Date().toISOString() }
        : scenario
    )));
    writeCustomScenarios(next);
    return next.find((scenario) => scenario.id === id) || null;
  }
}

export async function deleteCustomScenario(id) {
  try {
    await deleteWorkerScenario(id);
  } catch {
    // Fall back to local delete.
  }

  const next = readCustomScenarios().filter((scenario) => scenario.id !== id);
  writeCustomScenarios(next);
}
