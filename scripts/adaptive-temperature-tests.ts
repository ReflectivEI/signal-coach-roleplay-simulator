/**
 * Comprehensive test suite for adaptive temperature model
 * Validates mapping, state updates, payload integration, and UI behavior
 */

import {
    createScenarioTemperatureState,
    applyLiveTemperatureUpdate,
    mapTemperatureToBehaviorModifiers,
    deriveInitialTemperatureFromScenario
} from '../src/lib/temperatureModel';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(message);
    }
}

function test(name: string, fn: () => void) {
    try {
        fn();
        results.push({ name, passed: true });
        console.log(`✓ ${name}`);
    } catch (error) {
        results.push({ name, passed: false, error: (error as Error).message });
        console.error(`✗ ${name}: ${(error as Error).message}`);
    }
}

// Test 1: Temperature mapping (1-3: collaborative, 4-7: skeptical, 8-10: resistant)
test('Temperature mapping: Low temp (1-3) → collaborative', () => {
    const modifiers1 = mapTemperatureToBehaviorModifiers(1);
    assert(modifiers1.skepticism_level === 'low', 'Temp 1 should have low skepticism');
    assert(modifiers1.openness_to_evidence === 'high', 'Temp 1 should have high openness');

    const modifiers3 = mapTemperatureToBehaviorModifiers(3);
    assert(modifiers3.skepticism_level === 'low', 'Temp 3 should have low skepticism');
    assert(modifiers3.emotional_intensity === 'calm', 'Temp 3 should be calm');
});

test('Temperature mapping: Mid temp (4-7) → skeptical', () => {
    const modifiers5 = mapTemperatureToBehaviorModifiers(5);
    assert(modifiers5.skepticism_level === 'moderate', 'Temp 5 should have moderate skepticism');
    assert(modifiers5.emotional_intensity === 'neutral', 'Temp 5 should be neutral');
    assert(modifiers5.dialogue_friction === 'moderate', 'Temp 5 should have moderate friction');
});

test('Temperature mapping: High temp (8-10) → resistant', () => {
    const modifiers9 = mapTemperatureToBehaviorModifiers(9);
    assert(modifiers9.skepticism_level === 'high', 'Temp 9 should have high skepticism');
    assert(modifiers9.emotional_intensity === 'heightened', 'Temp 9 should be heightened');
    assert(modifiers9.challenge_likelihood === 'high', 'Temp 9 should have high challenge likelihood');
});

// Test 2: State creation with proper initialization
test('State creation: Initialize temperature context', () => {
    const context = createScenarioTemperatureState(5, 'profile_default');
    assert(context.initial_temperature === 5, 'Initial temperature should be 5');
    assert(context.live_temperature === 5, 'Live temperature should start equal to initial');
    assert(context.source === 'profile_default', 'Source should be tracked');
    assert(Array.isArray(context.shift_history), 'Shift history should be an array');
    assert(context.shift_history.length === 0, 'Shift history should start empty');
});

// Test 3: Live temperature update without scenario reset
test('Live update: Apply temperature change and track shift', () => {
    let context = createScenarioTemperatureState(5, 'profile_default');
    const before = context;

    context = applyLiveTemperatureUpdate(context, 8);
    assert(context.live_temperature === 8, 'Live temperature should be 8 after update');
    assert(context.initial_temperature === 5, 'Initial temperature should remain unchanged');
    assert(context.shift_history.length === 1, 'Shift history should record 1 change');
    assert(context.shift_history[0].from === 5, 'Shift should record from temperature');
    assert(context.shift_history[0].to === 8, 'Shift should record to temperature');
});

// Test 4: Multiple temperature shifts accumulate in history
test('Shift tracking: Multiple updates accumulate history', () => {
    let context = createScenarioTemperatureState(5, 'profile_default');

    context = applyLiveTemperatureUpdate(context, 3);
    context = applyLiveTemperatureUpdate(context, 7);
    context = applyLiveTemperatureUpdate(context, 9);

    assert(context.shift_history.length === 3, 'Should have 3 shifts recorded');
    assert(context.live_temperature === 9, 'Final temperature should be 9');
    assert(context.shift_history[0].from === 5 && context.shift_history[0].to === 3, 'First shift: 5 → 3');
    assert(context.shift_history[1].from === 3 && context.shift_history[1].to === 7, 'Second shift: 3 → 7');
    assert(context.shift_history[2].from === 7 && context.shift_history[2].to === 9, 'Third shift: 7 → 9');
});

// Test 5: Behavior modifiers update when temperature changes
test('Modifiers update: Behavior changes with temperature', () => {
    let context = createScenarioTemperatureState(2, 'profile_default');
    const lowTempModifiers = context.behavior_modifiers;
    assert(lowTempModifiers.skepticism_level === 'low', 'Low temp: low skepticism');

    context = applyLiveTemperatureUpdate(context, 9);
    const highTempModifiers = context.behavior_modifiers;
    assert(highTempModifiers.skepticism_level === 'high', 'High temp: high skepticism');
    assert(highTempModifiers.challenge_likelihood !== lowTempModifiers.challenge_likelihood, 'Challenge likelihood should differ');
});

// Test 6: Payload structure includes temperature context
test('Payload structure: Temperature context fields present', () => {
    const context = createScenarioTemperatureState(5, 'profile_default');

    // Verify all required fields exist
    assert('initial_temperature' in context, 'Payload should have initial_temperature');
    assert('live_temperature' in context, 'Payload should have live_temperature');
    assert('source' in context, 'Payload should have source');
    assert('label' in context, 'Payload should have label');
    assert('behavior_modifiers' in context, 'Payload should have behavior_modifiers');
    assert('shift_history' in context, 'Payload should have shift_history');
});

// Test 7: Temperature label matches range (UI affordance)
test('UI labels: Temperature range labels are consistent', () => {
    const temp1 = createScenarioTemperatureState(1, 'profile_default');
    const temp5 = createScenarioTemperatureState(5, 'profile_default');
    const temp9 = createScenarioTemperatureState(9, 'profile_default');

    assert(temp1.label !== temp5.label, 'Low and mid temp should have different labels');
    assert(temp5.label !== temp9.label, 'Mid and high temp should have different labels');
    assert(temp1.label !== temp9.label, 'Low and high temp should have different labels');
});

// Test 8: Temperature persistence fields for session save
test('Session persistence: All required fields for save', () => {
    let context = createScenarioTemperatureState(4, 'profile_default');
    context = applyLiveTemperatureUpdate(context, 7);

    // These fields should be saveable to backend session record
    const savePayload = {
        temperature: context.live_temperature,
        initial_temperature: context.initial_temperature,
        shift_history: context.shift_history,
        behavior_modifiers: context.behavior_modifiers
    };

    assert(savePayload.temperature === 7, 'Save payload should include live temperature');
    assert(savePayload.initial_temperature === 4, 'Save payload should include initial temperature');
    assert(Array.isArray(savePayload.shift_history), 'Save payload should include shift history');
    assert(Boolean(savePayload.behavior_modifiers), 'Save payload should include behavior modifiers');
});

// Test 9: Outcome detection adjusted by temperature
test('Outcome expectations: High temp reduces threshold', () => {
    const lowTempModifiers = mapTemperatureToBehaviorModifiers(2);
    const highTempModifiers = mapTemperatureToBehaviorModifiers(9);

    // At low temp (collaborative), commitment should be expected
    // At high temp (resistant), reduced resistance is success
    assert(lowTempModifiers.commitment_threshold > highTempModifiers.commitment_threshold,
        'High temp should have lower commitment threshold (reduced resistance is good outcome)');
});

// Test 10: Cue category mapping reflects temperature
test('Cue generation: Temperature affects category selection', () => {
    const lowTemp = mapTemperatureToBehaviorModifiers(1);
    const midTemp = mapTemperatureToBehaviorModifiers(5);
    const highTemp = mapTemperatureToBehaviorModifiers(9);

    assert(lowTemp.emotional_intensity === 'calm', 'Low temp: calm');
    assert(midTemp.emotional_intensity === 'neutral', 'Mid temp: neutral');
    assert(highTemp.emotional_intensity === 'heightened', 'High temp: heightened');
});

// Summary
console.log('\n' + '='.repeat(60));
const passed = results.filter(r => r.passed).length;
const total = results.length;
const allPassed = passed === total;

console.log(`Test Results: ${passed}/${total} passed`);

if (allPassed) {
    console.log('✓ All adaptive-temperature tests passed!');
    process.exit(0);
} else {
    console.log('✗ Some tests failed:');
    results.filter(r => !r.passed).forEach(r => {
        console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
}
