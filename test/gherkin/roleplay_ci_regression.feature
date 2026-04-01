Feature: Role Play Simulator deterministic behavior and scenario governance
  As a platform owner
  I want scenario routing, cueing, and session behavior to be deterministic
  So CI can block drift before release

  Background:
    Given the canonical scenario schema "schemas/roleplay-scenario.schema.json"
    And a scenario catalog validated against that schema

  @ci @routing
  Scenario: Dynamic routing uses multi-dimensional taxonomy instead of disease-only matching
    Given learner profile "new_rep_with_objection_gap"
    And candidate scenarios include at least two disease-identical scenarios with different stage/persona/pressure tags
    When the routing engine selects the next scenario
    Then the selected scenario must maximize relevance across Stage, Persona, Pressure, Difficulty, and Compliance mode
    And disease/topic must not be the only deciding dimension

  @ci @determinism
  Scenario Outline: Same session seed and same turn input always produce identical cue and score outputs
    Given scenario "<scenarioId>" and session "<sessionId>"
    And turn number "<turnNumber>"
    And rep utterance "<repInput>"
    When the simulator computes cues and metric outputs twice
    Then emitted HCP cues must be identical in both runs
    And active metric set must be identical in both runs
    And score values must be identical in both runs

    Examples:
      | scenarioId | sessionId    | turnNumber | repInput                                                                 |
      | adc_io_001 | seed-alpha-1 | 3          | Given your limited time, could we prioritize resistance risk first?      |
      | adc_io_001 | seed-alpha-1 | 4          | I heard your access concern; can we align on one next step for screening? |

  @ci @negativity
  Scenario: Generic lexical items do not trigger negativity bias
    Given a rep response containing "no", "not", "why", "busy", and "problem" without refusal or dismissal intent
    When negativity calibration is applied
    Then the response must not be classified as explicit resistance
    And no resistance escalation cue should be emitted solely from those lexical items

  @ci @negativity
  Scenario: Explicit refusal and dismissal patterns trigger negativity bias
    Given a rep response containing an explicit dismissal pattern "this is not worth my time"
    When negativity calibration is applied
    Then the response must be classified as explicit resistance
    And a resistance escalation cue should be emitted

  @ci @session_isolation
  Scenario: Reset rotates session identity and clears previous state
    Given session "session-A" has prior turns, cues, and derived state
    When the user resets and starts a new session
    Then a new session identifier must be generated
    And prior cues and state from "session-A" must not exist in the new session
    And deterministic seed inputs must include the new session identifier

  @ci @contract
  Scenario: Canonical metric IDs remain unchanged across scenario and scoring contracts
    Given canonical metrics are defined in the scenario contract
    When CI compares scenario contract metric IDs to scoring metric IDs
    Then the sets must be identical
    And any addition, removal, or rename must fail the build

  @ci @fixtures
  Scenario: Every active scenario supplies required strong and weak fixtures
    Given an active scenario in the catalog
    Then it must provide exactly 3 strong fixtures
    And it must provide exactly 3 weak fixtures
    And each fixture must define expected HCP reaction, metric activation, evidence tags, and score band
