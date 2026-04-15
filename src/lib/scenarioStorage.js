import { ALL_SCENARIOS } from "@/lib/scenarioCatalog";
import {
  listWorkerScenarios,
  createWorkerScenario,
  updateWorkerScenario,
  deleteWorkerScenario,
} from "@/services/workerClient";

const CUSTOM_SCENARIOS_KEY = "signal-coach-custom-scenarios";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBuiltInScenario(scenario, index) {
  return {
    ...scenario,
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

async function loadWorkerCustomScenarios() {
  try {
    const scenarios = await listWorkerScenarios();
    if (Array.isArray(scenarios) && scenarios.length >= 0) {
      writeCustomScenarios(scenarios);
      return scenarios.map(normalizeCustomScenario);
    }
  } catch {
    return readCustomScenarios().map(normalizeCustomScenario);
  }

  return readCustomScenarios().map(normalizeCustomScenario);
}

export function listBuiltInScenarios() {
  return ALL_SCENARIOS.map(normalizeBuiltInScenario);
}

export async function listCustomScenarios() {
  return loadWorkerCustomScenarios();
}

export async function listAllScenarios() {
  const customScenarios = await listCustomScenarios();
  return [...listBuiltInScenarios(), ...customScenarios];
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
    const next = [saved, ...readCustomScenarios().filter((item) => item.id !== saved.id)];
    writeCustomScenarios(next);
    return saved;
  } catch {
    const scenarios = readCustomScenarios();
    scenarios.unshift(nextScenario);
    writeCustomScenarios(scenarios);
    return nextScenario;
  }
}

export async function updateCustomScenario(id, patch) {
  try {
    const saved = await updateWorkerScenario(id, patch);
    const next = readCustomScenarios().map((scenario) => (
      scenario.id === id ? saved : scenario
    ));
    writeCustomScenarios(next);
    return saved;
  } catch {
    const scenarios = readCustomScenarios();
    const next = scenarios.map((scenario) => (
      scenario.id === id
        ? { ...scenario, ...patch, updatedAt: new Date().toISOString() }
        : scenario
    ));
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
