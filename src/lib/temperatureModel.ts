/**
 * Temperature Model - Centralized state management for adaptive HCP temperature
 * Manages initial, live, and shift history for scenario-based temperature context
 */

export interface TemperatureBehaviorModifiers {
    skepticism_level: 'low' | 'moderate' | 'high';
    emotional_intensity: 'calm' | 'neutral' | 'heightened';
    openness_to_evidence: 'high' | 'moderate' | 'low';
    patience: 'high' | 'moderate' | 'low';
    interruption_likelihood: 'low' | 'moderate' | 'high';
    challenge_likelihood: 'low' | 'moderate' | 'high';
    receptivity_to_rep_framing: 'high' | 'moderate' | 'low';
    commitment_threshold: number;
    dialogue_friction: 'low' | 'moderate' | 'high';
    coaching_difficulty: 'low' | 'moderate' | 'high';
}

export interface TemperatureShift {
    from: number;
    to: number;
    timestamp?: string;
}

export interface ScenarioTemperatureContext {
    initial_temperature: number;
    live_temperature: number;
    source: 'profile_default' | 'rep_override' | 'live_adjustment';
    label: string;
    behavior_modifiers: TemperatureBehaviorModifiers;
    shift_history: TemperatureShift[];
}

/**
 * Map temperature (1-10) to behavior modifier labels and values
 * 1-3: Collaborative/Open, 4-7: Selective/Skeptical, 8-10: Resistant/Challenging
 */
export function mapTemperatureToBehaviorModifiers(temperature: number): TemperatureBehaviorModifiers {
    const temp = Math.max(1, Math.min(10, temperature));

    if (temp <= 3) {
        // Collaborative range
        return {
            skepticism_level: 'low',
            emotional_intensity: 'calm',
            openness_to_evidence: 'high',
            patience: 'high',
            interruption_likelihood: 'low',
            challenge_likelihood: 'low',
            receptivity_to_rep_framing: 'high',
            commitment_threshold: 0.8, // High expectation for full commitment
            dialogue_friction: 'low',
            coaching_difficulty: 'low',
        };
    } else if (temp >= 8) {
        // Resistant range
        return {
            skepticism_level: 'high',
            emotional_intensity: 'heightened',
            openness_to_evidence: 'low',
            patience: 'low',
            interruption_likelihood: 'high',
            challenge_likelihood: 'high',
            receptivity_to_rep_framing: 'low',
            commitment_threshold: 0.3, // Lower expectation: reduced resistance is good outcome
            dialogue_friction: 'high',
            coaching_difficulty: 'high',
        };
    } else {
        // Skeptical range (4-7)
        const scaleFactor = (temp - 4) / 3; // 0 to 1
        return {
            skepticism_level: 'moderate',
            emotional_intensity: 'neutral',
            openness_to_evidence: 'moderate',
            patience: 'moderate',
            interruption_likelihood: 'moderate',
            challenge_likelihood: 'moderate',
            receptivity_to_rep_framing: 'moderate',
            commitment_threshold: 0.5 + scaleFactor * 0.15,
            dialogue_friction: 'moderate',
            coaching_difficulty: 'moderate',
        };
    }
}

/**
 * Derive initial temperature label based on numeric value
 */
export function deriveTemperatureLabel(temperature: number): string {
    const temp = Math.max(1, Math.min(10, temperature));
    if (temp <= 3) return 'Collaborative/Open';
    if (temp >= 8) return 'Resistant/Challenging';
    return 'Selective/Skeptical';
}

/**
 * Create a new temperature context for a scenario
 */
export function createScenarioTemperatureState(
    baseTemp: number,
    source: 'profile_default' | 'rep_override' | 'live_adjustment' = 'profile_default'
): ScenarioTemperatureContext {
    const temp = Math.max(1, Math.min(10, baseTemp));

    return {
        initial_temperature: temp,
        live_temperature: temp,
        source,
        label: deriveTemperatureLabel(temp),
        behavior_modifiers: mapTemperatureToBehaviorModifiers(temp),
        shift_history: [],
    };
}

/**
 * Apply a live temperature update to an existing context
 * Records the shift in history and updates behavior modifiers
 */
export function applyLiveTemperatureUpdate(
    context: ScenarioTemperatureContext,
    newTemperature: number
): ScenarioTemperatureContext {
    const temp = Math.max(1, Math.min(10, newTemperature));

    if (temp === context.live_temperature) {
        // No change
        return context;
    }

    const shift: TemperatureShift = {
        from: context.live_temperature,
        to: temp,
        timestamp: new Date().toISOString(),
    };

    return {
        ...context,
        live_temperature: temp,
        label: deriveTemperatureLabel(temp),
        behavior_modifiers: mapTemperatureToBehaviorModifiers(temp),
        shift_history: [...context.shift_history, shift],
    };
}

/**
 * Derive initial temperature from scenario defaults
 * If scenario has no temperature preference, default to 5 (balanced)
 */
export function deriveInitialTemperatureFromScenario(scenario: any): number {
    if (scenario?.initialTemperature !== undefined) {
        return Math.max(1, Math.min(10, scenario.initialTemperature));
    }
    // Default to balanced temperature
    return 5;
}
