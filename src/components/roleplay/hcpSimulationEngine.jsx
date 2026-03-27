// @ts-nocheck
/******************************************************************************************
HCP Simulation Engine
Enterprise-grade deterministic behavioral simulation for Reflectiv Role Play

PART 1 OF 2
Append PART 2 directly after this in the same file.

Core responsibilities
- Scenario context
- Turn scoring
- State ladder management
- Emotional temperature model
- Cue entropy rotation
- Deterministic cue selection
- Behavioral realism weighting
******************************************************************************************/

import { scenarios } from './hcpDialogueEngine.jsx'

/******************************************************************************************
SCENARIO CONTEXT
******************************************************************************************/

export function getScenarioContext(props = {}) {
  const scenarioIndex =
    typeof props.scenarioIndex === 'number' ? props.scenarioIndex : 0

  return scenarios[scenarioIndex] || scenarios[0]
}

/******************************************************************************************
ROBUST ENGAGEMENT SCORING
- Scores rep input for clinical value, relevance, clarity, and professionalism
- Decays engagement for repeated low-value turns
- Maps scores to engagement levels, emotional valence, stance, and momentum
- Handles time pressure and reaction triggers
******************************************************************************************/

export function updateTurnState(
  prevState,
  repMessage,
  prevEngagementScore,
  conversationHistory
) {
  let scoreDelta = 0
  const msg = repMessage ? repMessage.toLowerCase() : ''

  if (
    /\bstrong clinical question\b|patient-relevant insight|credible information|clear value/.test(
      msg
    )
  ) {
    scoreDelta += 2
  } else if (
    /\brelevant question\b|concise useful point|acknowledge|value/.test(msg)
  ) {
    scoreDelta += 1
  } else if (/\bvague opener\b|repeats|weak|low-value/.test(msg)) {
    scoreDelta -= 1
  } else if (/\bpromotional\b|unconvincing|wastes time|ignores/.test(msg)) {
    scoreDelta -= 2
  }

  let engagementScore = Math.max(
    0,
    Math.min(5, prevEngagementScore + scoreDelta)
  )

  const lowValueTurns = conversationHistory
    .slice(-3)
    .filter(
      (t) =>
        t.repMessage &&
        /vague|weak|low-value|promotional/.test(t.repMessage.toLowerCase())
    ).length

  if (lowValueTurns >= 2) {
    engagementScore = Math.max(0, engagementScore - 1)
  }

  let engagementLevel = 'low'
  if (engagementScore >= 4) engagementLevel = 'high'
  else if (engagementScore >= 2) engagementLevel = 'medium'

  let emotionalValence = 'neutral_task_focused'
  if (engagementScore >= 4) emotionalValence = 'positive'
  else if (engagementScore <= 1) emotionalValence = 'negative'

  let stance = 'guarded'
  if (engagementScore >= 4) stance = 'receptive'
  else if (engagementScore >= 2) stance = 'focused'
  else if (engagementScore === 0) stance = 'impatient'

  let reactionTrigger = 'neutral'
  if (/strong clinical question/.test(msg)) {
    reactionTrigger = 'strong clinical question'
  } else if (/patient-relevant/.test(msg)) {
    reactionTrigger = 'patient-relevant insight'
  } else if (/vague/.test(msg)) {
    reactionTrigger = 'vague claim'
  } else if (/promotional/.test(msg)) {
    reactionTrigger = 'promotional wording'
  }

  let conversationalMomentum = 'flat'
  if (scoreDelta > 0) conversationalMomentum = 'improving'
  else if (scoreDelta < 0) conversationalMomentum = 'declining'

  let timePressure = 'moderate'
  if (/\bneed 30 minutes\b|busy|rush|tight/.test(msg)) {
    timePressure = 'high'
  }

  return {
    engagementScore,
    engagementLevel,
    emotionalValence,
    stance,
    reactionTrigger,
    conversationalMomentum,
    timePressure,
  }
}

/******************************************************************************************
STATE LADDER
******************************************************************************************/

export const HCP_STATES = [
  'neutral',
  'engaged',
  'time-pressured',
  'resistant',
  'boundary-setting',
  'irritated',
  'disengaged',
]

export const STATE_INDEX = Object.fromEntries(
  HCP_STATES.map((s, i) => [s, i])
)

/******************************************************************************************
TEMPERATURE LADDER
Independent of structural state. Affects word choice, sentence length, politeness.
******************************************************************************************/

export const TEMPERATURES = ['positive', 'neutral', 'stressed', 'irritated']

export const TEMP_INDEX = Object.fromEntries(
  TEMPERATURES.map((t, i) => [t, i])
)

const LOW_VALUE_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'your',
  'have',
  'from',
  'what',
  'about',
  'today',
  'patient',
  'patients',
  'just',
  'really',
  'maybe',
  'okay',
  'ok',
  'well',
  'then',
  'like',
  'right',
  'there',
])

export const TERMINAL_DISENGAGEMENT_LINES = [
  'I have patients waiting, and this is not worth more time. Take care.',
  "I need to get back to patients, and this isn't productive. Take care.",
]

/******************************************************************************************
HASH UTILITY
No Math.random(). Deterministic selection only.
******************************************************************************************/

function hashInt(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h * 33) ^ str.charCodeAt(i)) >>> 0
  }
  return h
}

export function extractMeaningfulRepTokens(message = '') {
  return String(message)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !LOW_VALUE_STOP_WORDS.has(word))
}

export function detectLowValueRepResponse(message = '') {
  const normalized = String(message).trim().toLowerCase()
  const meaningfulTokens = extractMeaningfulRepTokens(normalized)

  return (
    normalized.length < 8 ||
    /\b(idk|nothing|never|whatever|not sure|fine|sure|nope|nah)\b/.test(
      normalized
    ) ||
    meaningfulTokens.length < 2
  )
}

export function countRecentLowValueRepTurns(history = [], candidateMessage = '') {
  const recentRepMessages = [
    ...history.map((turn) => turn?.repMessage).filter(Boolean),
    candidateMessage,
  ]
    .slice(-3)

  return recentRepMessages.filter((message) => detectLowValueRepResponse(message))
    .length
}

export function getDeterministicTerminalClose(seedKey = '') {
  const safeSeed = String(seedKey || 'terminal-close')
  return (
    TERMINAL_DISENGAGEMENT_LINES[
      hashInt(safeSeed) % TERMINAL_DISENGAGEMENT_LINES.length
    ] || TERMINAL_DISENGAGEMENT_LINES[0]
  )
}

export function shouldForceTerminalDisengagement({
  nextHcpState,
  poorTurns = 0,
  priorRepTurns = 0,
}) {
  return nextHcpState === 'disengaged' && poorTurns >= 2 && priorRepTurns >= 2
}

export function shouldReplaceWithTerminalDisengagement(dialogue = '') {
  const normalized = String(dialogue || '').trim()
  if (!normalized) return true

  const sentenceCount = (normalized.match(/[.!?]+/g) || []).length
  return normalized.includes('?') || sentenceCount > 1 || normalized.split(/\s+/).length > 16
}

const REP_DISRESPECT_PATTERNS = [
  /\b(make up your mind|you are not answering|you're not answering|again[,]?\s*you|stop avoiding|you keep dodging|this is useless|wasting my time)\b/i,
  /\b(you are avoiding the topic|you're avoiding the topic|avoiding the topic)\b/i,
  /\b(get serious|be serious|figure it out|that's ridiculous|this is nonsense|you don't get it)\b/i,
]

const REP_CONTRADICTION_PATTERNS = [
  /\b(what (staffing|staff|constraints?|limitations?)\??)\b/i,
  /\b(there (is|are) no (staffing|workflow|capacity|operational) (constraint|constraints|issue|issues|limitations?))\b/i,
  /\b((staff|staffing|workflow|admin burden|administrative burden|time pressure) (has|have) nothing to do with)\b/i,
]

export function detectRepDisrespectSignal(message = '') {
  const text = String(message || '')
  return REP_DISRESPECT_PATTERNS.some((pattern) => pattern.test(text))
}

export function detectRepConstraintContradiction(message = '', activeConstraintTypes = []) {
  const text = String(message || '')
  if (!text.trim() || !Array.isArray(activeConstraintTypes) || activeConstraintTypes.length === 0) {
    return false
  }
  return REP_CONTRADICTION_PATTERNS.some((pattern) => pattern.test(text))
}

export function evaluateHcpTerminationPolicy({
  repMessage = '',
  repHistoryMessages = [],
  activeConstraintTypes = [],
  unresolvedConcernTurns = 0,
  concernFlowOutcome = 'neutral',
  decayTier = 'engaged',
  explicitNarrowingPrompted = false,
  isTimePressured = false,
} = {}) {
  const history = [
    ...(Array.isArray(repHistoryMessages) ? repHistoryMessages : []),
    repMessage,
  ].filter(Boolean)

  const signalCounts = history.slice(-6).reduce((acc, message) => {
    if (detectRepDisrespectSignal(message)) acc.disrespect += 1
    if (detectRepConstraintContradiction(message, activeConstraintTypes)) acc.contradiction += 1
    return acc
  }, { disrespect: 0, contradiction: 0 })

  const unansweredBudgetExceeded =
    unresolvedConcernTurns >= 3
    && (concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot')
  const repeatedDisrespect = signalCounts.disrespect >= 2
  const repeatedContradiction = signalCounts.contradiction >= 2
  const narrowingFailure =
    explicitNarrowingPrompted
    && unresolvedConcernTurns >= 4
    && (concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot')
  const timePressureNoProgress =
    isTimePressured
    && unresolvedConcernTurns >= 3
    && (concernFlowOutcome === 'missed' || concernFlowOutcome === 'overpivot')
  const terminalByDecay =
    decayTier === 'disengaging'
    && unansweredBudgetExceeded
    && (signalCounts.disrespect >= 1 || signalCounts.contradiction >= 1)

  const reasonCodes = []
  if (unansweredBudgetExceeded) reasonCodes.push('repeated_unanswered_direct_question')
  if (repeatedContradiction) reasonCodes.push('repeated_contradiction_of_known_facts')
  if (repeatedDisrespect) reasonCodes.push('repeated_disrespect_or_argumentative_tone')
  if (narrowingFailure) reasonCodes.push('failure_after_explicit_narrowing_prompt')
  if (timePressureNoProgress) reasonCodes.push('time_pressure_with_no_progress')

  const shouldTerminate = Boolean(
    repeatedDisrespect
    || repeatedContradiction
    || narrowingFailure
    || timePressureNoProgress
    || terminalByDecay
    || unresolvedConcernTurns >= 5
  )

  const shouldBoundarySet = !shouldTerminate && Boolean(
    unansweredBudgetExceeded
    || signalCounts.disrespect >= 1
    || signalCounts.contradiction >= 1
  )

  return {
    shouldTerminate,
    shouldBoundarySet,
    reasonCodes,
    signalCounts,
    unansweredBudgetExceeded,
  }
}

/******************************************************************************************
CONVERSATION QUALITY
Normalized signal used by cue entropy rotation
Range roughly: -3 to +3
******************************************************************************************/

export function scoreConversationQuality(repMessage = '', conversationHistory = []) {
  const msg = repMessage.toLowerCase()
  let score = 0

  if (
    /\bhow are you approaching\b|\bwhat are you seeing\b|\bhow do you think about\b|\bwhere do you see\b|\bwhat tends to get in the way\b|\bwhat are your concerns\b/.test(
      msg
    )
  ) {
    score += 2
  }

  if (
    /\bi understand\b|\bi hear you\b|\bthat makes sense\b|\bfair point\b|\bappreciate your time\b|\bgiven your schedule\b/.test(
      msg
    )
  ) {
    score += 1
  }

  if (
    /\bpatient\b|\boutcome\b|\bworkflow\b|\bmonitoring\b|\badherence\b|\bcoverage\b|\bprior auth\b|\bprior authorization\b|\bfollow-up\b/.test(
      msg
    )
  ) {
    score += 1
  }

  if (
    /\bjust prescribe\b|\byou should\b|\bcome on\b|\bno reason not to\b|\beveryone is doing it\b/.test(
      msg
    )
  ) {
    score -= 2
  }

  if (
    /\bvague\b|\blow-value\b|\bweak\b|\brepeating myself\b|\bas i already said\b|\bagain\b.*\bagain\b/.test(
      msg
    )
  ) {
    score -= 1
  }

  const recentLowValueTurns = conversationHistory
    .slice(-3)
    .filter(
      (t) =>
        t.repMessage &&
        /\bweak\b|\bvague\b|\blow-value\b|\bpromotional\b/.test(
          t.repMessage.toLowerCase()
        )
    ).length

  if (recentLowValueTurns >= 2) {
    score -= 1
  }

  return Math.max(-3, Math.min(3, score))
}

/******************************************************************************************
REP BEHAVIOR DETECTION
Used for state weighting and severity escalation
******************************************************************************************/

export function detectRepBehavior(repMessage = '') {
  const msg = repMessage.toLowerCase()

  return {
    pushy:
      /\bjust do it\b|\byou need to\b|\bwhy won.t you\b|\bcome on\b|\bimmediately\b|\bi need you to\b/.test(
        msg
      ),

    redundant_question:
      /\bas i mentioned\b|\blike i said\b|\bagain\b.*\bquestion\b|\bjust circling back\b/.test(
        msg
      ),

    thoughtful_question:
      /\bhow do you\b|\bwhat are you seeing\b|\bwhere do you see\b|\bwhat would make this easier\b|\bhow are you handling\b/.test(
        msg
      ),

    acknowledged_time_pressure:
      /\bi know you.re busy\b|\bi know you only have a minute\b|\bi.ll keep this brief\b|\bquick question\b|\bbriefly\b/.test(
        msg
      ),

    interrupted_hcp:
      /\bbut\b.*\bno\b|\blet me stop you\b|\bhang on\b|\bwait\b.*\bno\b/.test(
        msg
      ),

    empathetic_statement:
      /\bi understand\b|\bi hear you\b|\bthat makes sense\b|\bsounds frustrating\b|\bappreciate that\b/.test(
        msg
      ),

    clinical_value:
      /\bstudy\b|\bdata\b|\boutcome\b|\bpatient\b|\bworkflow\b|\bmonitoring\b|\badherence\b|\bcoverage\b|\bfollow-up\b/.test(
        msg
      ),

    promotional_language:
      /\bbest\b|\bamazing\b|\bgame changer\b|\bperfect\b|\bno downside\b|\bmust-have\b/.test(
        msg
      ),

    boundary_violation:
      /\bcancel your patients\b|\bmake time\b|\byou.re overreacting\b|\bare you the doctor or am i\b/.test(
        msg
      ),
  }
}

/******************************************************************************************
TIME PRESSURE ACCUMULATION
Higher turns increase pressure to move
******************************************************************************************/

export function computeTimePressureWeight(turnNumber = 1) {
  if (turnNumber <= 2) return 0
  if (turnNumber <= 4) return 1
  if (turnNumber <= 7) return 2
  if (turnNumber <= 10) return 3
  return 4
}

/******************************************************************************************
STATE TRANSITION MEMORY
Prevents unrealistic emotional jumps
******************************************************************************************/

const STATE_TRANSITION_BASE = {
  neutral: {
    neutral: 4,
    engaged: 3,
    'time-pressured': 3,
    resistant: 2,
    'boundary-setting': 1,
    irritated: 1,
    disengaged: 1,
  },

  engaged: {
    engaged: 5,
    neutral: 3,
    'time-pressured': 2,
    resistant: 1,
    'boundary-setting': 0.5,
    irritated: 0.25,
    disengaged: 0.5,
  },

  'time-pressured': {
    'time-pressured': 5,
    neutral: 2,
    engaged: 1.5,
    resistant: 2,
    'boundary-setting': 2,
    irritated: 2,
    disengaged: 2,
  },

  resistant: {
    resistant: 5,
    neutral: 2,
    engaged: 1,
    'time-pressured': 2,
    'boundary-setting': 2,
    irritated: 2,
    disengaged: 1.5,
  },

  'boundary-setting': {
    'boundary-setting': 5,
    resistant: 3,
    irritated: 3,
    disengaged: 2,
    neutral: 1,
    engaged: 0.25,
    'time-pressured': 1.5,
  },

  irritated: {
    irritated: 5,
    'boundary-setting': 3,
    disengaged: 3,
    resistant: 2,
    'time-pressured': 2,
    neutral: 0.5,
    engaged: 0.1,
  },

  disengaged: {
    disengaged: 6,
    irritated: 3,
    'time-pressured': 2,
    'boundary-setting': 2,
    resistant: 1,
    neutral: 0.25,
    engaged: 0.05,
  },
}

/******************************************************************************************
CUE ENTROPY ROTATION
Instead of purely random cues, weight selection based on:
- conversation_quality
- rep_behavior
- previous_cue_state
- time_elapsed
******************************************************************************************/

export function computeStateWeights({
  conversation_quality = 0,
  rep_behavior = {},
  previous_cue_state = 'neutral',
  time_elapsed = 1,
}) {
  const baseline = { ...(STATE_TRANSITION_BASE[previous_cue_state] || STATE_TRANSITION_BASE.neutral) }

  if (conversation_quality >= 2) {
    baseline.engaged += 3
    baseline.neutral += 1
    baseline.resistant -= 0.5
    baseline.irritated -= 0.5
  }

  if (conversation_quality <= -2) {
    baseline.resistant += 2
    baseline.irritated += 2
    baseline['boundary-setting'] += 1
    baseline.engaged -= 1
  }

  if (rep_behavior.pushy) {
    baseline.resistant += 2
    baseline.irritated += 1.5
    baseline['boundary-setting'] += 1
  }

  if (rep_behavior.boundary_violation) {
    baseline['boundary-setting'] += 3
    baseline.irritated += 2
    baseline.disengaged += 1
  }

  if (rep_behavior.redundant_question) {
    baseline['time-pressured'] += 1
    baseline.resistant += 1
  }

  if (rep_behavior.thoughtful_question) {
    baseline.engaged += 2
    baseline.neutral += 1
  }

  if (rep_behavior.acknowledged_time_pressure) {
    baseline.engaged += 1
    baseline['time-pressured'] -= 1
  }

  if (rep_behavior.empathetic_statement) {
    baseline.neutral += 1
    baseline.engaged += 1
    baseline.irritated -= 0.5
  }

  if (rep_behavior.promotional_language) {
    baseline.resistant += 2
    baseline.irritated += 1
  }

  if (rep_behavior.clinical_value) {
    baseline.engaged += 1
    baseline.neutral += 0.5
  }

  const timePressureWeight = computeTimePressureWeight(time_elapsed)
  baseline['time-pressured'] += timePressureWeight * 0.75
  baseline.disengaged += Math.max(0, timePressureWeight - 1) * 0.5

  for (const key of Object.keys(baseline)) {
    baseline[key] = Math.max(0.05, baseline[key])
  }

  return baseline
}

/******************************************************************************************
WEIGHTED DETERMINISTIC SELECTION
******************************************************************************************/

function weightedPick(weights, seed) {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0)

  if (total <= 0) return 'neutral'

  let cursor = seed % total

  for (const [state, weight] of entries) {
    if (cursor < weight) return state
    cursor -= weight
  }

  return 'neutral'
}

/******************************************************************************************
SEVERITY TRANSITION
Severity increases when:
- rep ignores the same state twice
- violates a boundary
- repeats commands
Severity decreases when:
- rep de-escalates successfully
******************************************************************************************/

export function transitionSeverity(currentSeverity, alignment, prevState, nextState, repBehavior = {}) {
  const prevIdx = STATE_INDEX[prevState] ?? 0
  const nextIdx = STATE_INDEX[nextState] ?? 0
  const escalated = nextIdx > prevIdx
  const deEscalated = nextIdx < prevIdx
  const lowAlignment = alignment && alignment.score <= 2
  const goodAlignment = alignment && alignment.score >= 4

  let sev = currentSeverity

  if (repBehavior.boundary_violation) sev += 1
  if (repBehavior.pushy) sev += 1
  if (escalated && lowAlignment) sev += 1
  else if (escalated) sev += 1

  if (deEscalated && goodAlignment) sev -= 1
  if (repBehavior.empathetic_statement && goodAlignment) sev -= 1

  return Math.max(0, Math.min(sev, 2))
}

/******************************************************************************************
INITIAL STATE
******************************************************************************************/

export function deriveInitialState(scenario) {
  const text = [
    scenario.title || '',
    scenario.description || '',
    scenario.details || '',
    scenario.hcp_category || '',
    scenario.influence_driver || '',
  ]
    .join(' ')
    .toLowerCase()

  if (
    /frustrat|overwhelm|busy|rush|no time|tight|slammed|hectic|pressed|time-sensitive/.test(
      text
    )
  ) {
    return 'time-pressured'
  }

  if (
    /resist|skeptic|doubt|not interested|disagree|pushback|challenge|unconvinced/.test(
      text
    )
  ) {
    return 'resistant'
  }

  if (/hostile|angry|irritat|annoy|rude|dismissiv/.test(text)) {
    return 'irritated'
  }

  if (/engag|curio|interest|open|recept|enthusiast|motivated/.test(text)) {
    return 'engaged'
  }

  return 'neutral'
}

/******************************************************************************************
INITIAL TEMPERATURE
******************************************************************************************/

export function deriveInitialTemperature(initialState) {
  const map = {
    neutral: 'neutral',
    engaged: 'positive',
    'time-pressured': 'stressed',
    resistant: 'stressed',
    'boundary-setting': 'irritated',
    irritated: 'irritated',
    disengaged: 'irritated',
  }

  return map[initialState] || 'neutral'
}

/******************************************************************************************
TEMPERATURE TRANSITION
******************************************************************************************/

export function transitionTemperature(currentTemp, repMessage) {
  const msg = repMessage.toLowerCase()
  const idx = TEMP_INDEX[currentTemp] ?? 1

  const hardEscalate =
    /\bf\*+\b|f\*ck|fuck|shit|ass\b|\bstupid\b|\bidiot\b|\bincompetent\b|\bwrong about\b|\byou don.t know\b|\bbad doctor\b|\bterrible\b|\bawful\b|\bi demand\b|\bcancel all\b|\bmean\b.*doctor|\byou.re being\b|\bcancel your patients\b/.test(
      msg
    )

  if (hardEscalate) {
    return TEMPERATURES[Math.min(idx + 2, TEMPERATURES.length - 1)]
  }

  const softEscalate =
    /\bjust do it\b|\bwhy won.t you\b|\bcome on\b|\bi need you to\b|\bare you the doctor or am i\b|\bi don.t know the\b|\bnot a real study\b|\bhello\b.*\bhello\b/.test(
      msg
    )

  if (softEscalate) {
    return TEMPERATURES[Math.min(idx + 1, TEMPERATURES.length - 1)]
  }

  const deEscalate =
    /\bi understand\b|\bi appreciate\b|\bfair point\b|\bmakes sense\b|\bi hear you\b|\bno pressure\b|\bwhenever works\b|\bthank you for your time\b|\bmy apologies\b/.test(
      msg
    )

  if (deEscalate) {
    return TEMPERATURES[Math.max(idx - 1, 0)]
  }

  return currentTemp
}

/******************************************************************************************
STATE TRANSITION
******************************************************************************************/

export function transitionState(currentState, repMessage, currentTemperature) {
  const msg = repMessage.toLowerCase()
  const idx = STATE_INDEX[currentState] ?? 0

  const hardEscalate =
    /f\*+k|f\*ck|fuck|shit|\bstupid\b|\bidiot\b|\bincompetent\b|\bwrong about\b|\byou don.t know what\b|\bbad doctor\b|\bcancel all your patients\b|\bnot a real study\b/.test(
      msg
    )

  if (hardEscalate) {
    return HCP_STATES[Math.min(idx + 2, HCP_STATES.length - 1)]
  }

  const medEscalate =
    /\bare you the doctor or am i\b|\bi don.t know the.*findings\b|\bwhy are you (such a|being)\b|\bmean.*doctor\b|\bneed you to be\b|\bi don.t know because\b/.test(
      msg
    )

  if (medEscalate) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)]
  }

  const softEscalate =
    /\bjust do it\b|\bwhy won.t you\b|\bcome on\b|\bi need you to\b|\bimmediately\b|\bcancel your\b/.test(
      msg
    )

  const tempIsHot =
    currentTemperature === 'stressed' || currentTemperature === 'irritated'

  if (softEscalate && tempIsHot) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)]
  }

  const selfSabotage =
    /\bi don.t (actually |really )?know\b|\bforgot (the|my)\b|\bi made (it|that|this) up\b/.test(
      msg
    )

  if (selfSabotage) {
    return HCP_STATES[Math.min(idx + 1, HCP_STATES.length - 1)]
  }

  const deEscalate =
    /\bi understand\b|\bi hear you\b|\bfair point\b|\bi appreciate\b|\bgiven your time\b|\bno pressure\b|\bwhenever you.re ready\b|\bi can follow up\b|\bmy apologies\b|\bthank you for sharing\b/.test(
      msg
    )

  if (deEscalate) {
    return HCP_STATES[Math.max(idx - 1, 0)]
  }

  return currentState
}

/******************************************************************************************
DISAGREEMENT DETECTION
******************************************************************************************/

export function detectHcpDisagreement(hcpResponse) {
  const msg = hcpResponse.toLowerCase()

  const strongDisagree =
    /\bdisagree\b|\bdon.t (think|believe|accept)\b|\bi.m not (convinced|sold|buying|interested)|\bthat.s (wrong|incorrect|not true|not accurate)|\bcan.t recommend|\bwon.t (prescribe|use)|\bskeptical|\bdoubt\b|\b(not|isn.t) (helpful|beneficial|relevant|applicable)/i.test(
      msg
    )

  const mildDisagree =
    /\bhesitant|\bunsure|\bconcern|\bquestion (whether|if)|\bneed more (evidence|data|proof)|\bneed to think|\bneed to (review|check)|\bnot sure (yet|about)|\blet me (think|review)/i.test(
      msg
    )

  return {
    strongDisagree,
    mildDisagree,
    disagrees: strongDisagree || mildDisagree,
  }
}

/******************************************************************************************
EMOTIONAL ESCALATION FOR DISAGREEMENT
******************************************************************************************/

export function escalateForDisagreement(currentTempIndex, disagreeInfo) {
  if (!disagreeInfo.disagrees) return currentTempIndex

  const idx =
    typeof currentTempIndex === 'number'
      ? currentTempIndex
      : TEMP_INDEX[currentTempIndex] ?? 1

  return Math.min(idx + 1, TEMPERATURES.length - 1)
}

/******************************************************************************************
NON-REPEATING CUE MEMORY
Keeps recent cue indices per state/tier to avoid repetitive feel
******************************************************************************************/

function getRecentCueMemory(memory = {}, state, severity) {
  const key = `${state}:${severity}`
  return Array.isArray(memory[key]) ? memory[key] : []
}

function setRecentCueMemory(memory = {}, state, severity, cueIndex, max = 4) {
  const key = `${state}:${severity}`
  const prev = getRecentCueMemory(memory, state, severity)
  const next = [...prev, cueIndex].slice(-max)
  return {
    ...memory,
    [key]: next,
  }
}

function getRecentGlobalCueMemory(memory = {}, max = 15) {
  const key = '__recent_global_cues__'
  const recent = Array.isArray(memory[key]) ? memory[key] : []
  return recent.slice(-max)
}

function setRecentGlobalCueMemory(memory = {}, cueSignature, max = 15) {
  const key = '__recent_global_cues__'
  const prev = getRecentGlobalCueMemory(memory, max)
  const next = [...prev, cueSignature].slice(-max)
  return {
    ...memory,
    [key]: next,
  }
}

/******************************************************************************************
CUE BANK
Expanded cinematic cue bank
18 cues per severity tier
******************************************************************************************/

const CUE_BANK = {
  neutral: {
    0: [
      'The HCP glances up from the chart, expression calm and unhurried, as if the room has quietly made space for this conversation.',
      'The HCP sets down their pen and turns slightly toward you, posture easy, face giving little away.',
      'The HCP nods once in acknowledgment, shoulders relaxed, the fluorescent light catching the edge of their glasses.',
      'The HCP swivels a few inches in their chair to face you, one arm resting loosely on the desk.',
      'The HCP checks the schedule on the monitor, then returns their attention to you without visible urgency.',
      'The HCP offers a polite, restrained smile, hands folded neatly over the chart.',
      'The HCP adjusts their glasses and listens, expression even, voice not yet invited into the scene.',
      'The HCP glances toward the window, then back at you, as if resetting their attention.',
      'The HCP closes the chart halfway and waits, pen still balanced between their fingers.',
      'The HCP leans back slightly, neutral expression intact, letting the moment breathe.',
      'The HCP rests an elbow on the chair arm and studies you with professional calm.',
      'The HCP gives a small nod, neither encouraging nor dismissive, simply present.',
      'The HCP smooths a page flat on the desk, then looks up, posture composed.',
      'The HCP shifts in their chair and settles into a listening posture, expression unreadable.',
      'The HCP lets out a quiet breath and turns their full attention toward you.',
      'The HCP taps the capped pen once against the desk, then stills.',
      'The HCP folds their hands together and waits with practiced neutrality.',
      'The HCP tilts their head a fraction, face calm, as if inviting you to make your case.',
    ],
    1: [
      'The HCP pauses their work and meets your gaze briefly, waiting without enthusiasm, the room still humming around them.',
      'The HCP places the chart flat on the desk and gives you their measured attention, careful not to signal too much.',
      'The HCP leans back slightly, expression impassive, as though reserving judgment until you earn more of the scene.',
      'The HCP listens without reacting, body language quiet and contained, giving away almost nothing.',
      'The HCP scans a note once more, then looks up with the same neutral expression they started with.',
      'The HCP crosses one leg over the other, posture relaxed but not engaged.',
      'The HCP offers a brief nod that acknowledges your presence but does not welcome momentum.',
      'The HCP checks their phone discreetly under the edge of the chart, then returns to listening.',
      'The HCP shifts their weight in the chair, gaze steady, expression professionally blank.',
      'The HCP folds their arms loosely, not defensive, just measured.',
      'The HCP glances toward the hallway for a beat before returning their attention to you.',
      'The HCP presses their lips together lightly, listening with clinical restraint.',
      'The HCP rests both hands on the desk and waits, posture balanced but reserved.',
      'The HCP tips their chin once, a quiet signal to continue without assuming interest.',
      'The HCP adjusts the stack of papers in front of them, then looks up again, expression unchanged.',
      'The HCP sits upright with composed stillness, as though holding the conversation at a professional distance.',
      'The HCP lets the silence sit for a second before giving you their attention again.',
      'The HCP studies you with the calm patience of someone not yet persuaded this matters.',
    ],
    2: [
      'The HCP listens with arms folded loosely, expression carefully composed, like someone keeping the room at a measured distance.',
      'The HCP makes only limited eye contact, attention divided between you and the current demands of the clinic.',
      'The HCP sits upright, posture contained, projecting careful professional neutrality.',
      'The HCP gives a short nod, courteous but uncommitted, as if holding every reaction behind the curtain.',
      'The HCP glances at the clock, then resets to a neutral posture without comment.',
      'The HCP offers a restrained smile that reads more like professionalism than warmth.',
      'The HCP reviews notes silently, then looks up without expression.',
      'The HCP shifts in the chair and settles again, every movement composed and economical.',
      'The HCP keeps their hands clasped tightly enough to suggest restraint, not openness.',
      'The HCP listens in stillness, face calm, eyes analytical.',
      'The HCP glances once toward the door, then back to you, the moment never quite warming.',
      'The HCP squares the chart with the edge of the desk before meeting your gaze again.',
      'The HCP sits almost motionless, posture formal, as if refusing to give the conversation extra energy.',
      'The HCP breathes out slowly through their nose, expression unchanged.',
      'The HCP rests both forearms on the chair, shoulders set, presence polite but distant.',
      'The HCP watches you with contained attention, making no effort to signal agreement.',
      'The HCP keeps a neutral face even as the silence stretches a beat longer than comfortable.',
      'The HCP maintains professional stillness, the kind that says nothing has been earned yet.',
    ],
  },

  engaged: {
    0: [
      'The HCP leans slightly forward, making steady eye contact, attention gathering around your words.',
      'The HCP sets the chart aside and turns more fully toward you, expression quietly attentive.',
      'The HCP’s posture opens, shoulders easing back as curiosity enters the frame.',
      'The HCP asks a brief clarifying question, leaning in just slightly as they wait for your answer.',
      'The HCP smiles warmly, the kind of expression that invites the conversation to go a little deeper.',
      'The HCP gestures lightly with one hand, signaling genuine interest in where this is going.',
      'The HCP leans in, eyes focused, as if a useful thread has just appeared.',
      'The HCP mirrors your pace and body language, rapport building almost invisibly.',
      'The HCP nods once, then again, following the logic in real time.',
      'The HCP slides the chair a fraction closer to the desk, fully present.',
      'The HCP’s expression softens with interest, chart forgotten for the moment.',
      'The HCP rests a forearm on the desk, listening with active attention.',
      'The HCP lifts their eyebrows slightly, a signal that the point has landed.',
      'The HCP makes a quick note, then looks back up without losing the thread.',
      'The HCP turns their torso fully toward you, no longer splitting attention with the room.',
      'The HCP nods in a way that encourages you to keep going.',
      'The HCP’s gaze sharpens with interest, as if the conversation has finally become worth their time.',
      'The HCP lets a faint smile appear, signaling they are with you.',
    ],
    1: [
      'The HCP’s pen stops mid-note, and they look up with clear interest, waiting for you to continue.',
      'The HCP tilts their head slightly, expression curious, giving you their full attention.',
      'The HCP uncrosses their arms and leans forward, drawn further into the discussion.',
      'The HCP makes deliberate eye contact and mirrors your cadence, signaling active listening.',
      'The HCP nods with energy, encouraging you to elaborate.',
      'The HCP offers a supportive smile that suggests the conversation is gaining traction.',
      'The HCP asks a follow-up question, clearly wanting to go deeper into the point.',
      'The HCP leans forward with hands lightly clasped, fully in the exchange now.',
      'The HCP closes the chart completely and leaves it closed.',
      'The HCP writes a quick note without looking away for long, careful not to lose the moment.',
      'The HCP’s expression brightens with professional curiosity.',
      'The HCP gestures with the pen as if mapping the idea in the air.',
      'The HCP shifts to the edge of the chair, visibly more engaged.',
      'The HCP nods in rhythm with your key points, clearly processing them.',
      'The HCP’s shoulders open further, skepticism replaced by active consideration.',
      'The HCP offers a short, thoughtful smile and waits for the next detail.',
      'The HCP glances once at the chart, then chooses you over it.',
      'The HCP listens with the alert stillness of someone who sees practical relevance.',
    ],
    2: [
      'The HCP closes the laptop and pivots fully toward you, a clear signal that the conversation now has priority.',
      'The HCP nods in rhythm with your points, expression concentrated and open.',
      'The HCP rests both elbows on the desk and bridges their fingers, fully present in the exchange.',
      'The HCP’s eyes stay on yours throughout, no distraction, no glance toward the door.',
      'The HCP offers a broad, genuine smile, clearly invested now.',
      'The HCP gestures more animatedly, responding as if the discussion has become genuinely useful.',
      'The HCP maintains locked-in eye contact, signaling deep interest.',
      'The HCP leans in with the energy of someone ready to explore specifics.',
      'The HCP pushes the remaining paperwork aside, physically clearing space for the conversation.',
      'The HCP scribbles several notes quickly, then looks up with fresh interest.',
      'The HCP nods before you finish, already seeing where the point connects.',
      'The HCP’s expression sharpens with engaged concentration, almost energized.',
      'The HCP shifts closer across the desk, fully inside the discussion now.',
      'The HCP responds with a brief, enthusiastic question, clearly wanting more.',
      'The HCP’s posture is completely open, shoulders relaxed, attention undivided.',
      'The HCP’s face carries the look of someone seeing immediate practical value.',
      'The HCP gives a quick smile that reads as genuine professional excitement.',
      'The HCP remains fully forward, chart closed, laptop shut, conversation now center frame.',
    ],
  },

  'time-pressured': {
    0: [
      'The HCP glances briefly at their watch while listening, a reminder that time is moving even if the conversation is not.',
      'The HCP shifts their weight toward the hallway, still listening but visibly pulled elsewhere.',
      'The HCP’s pager vibrates on the desk, and they silence it quickly before looking back.',
      'The HCP checks the wall clock once, expression politely tense, the waiting room audible somewhere beyond the door.',
      'The HCP glances at the phone screen for a beat, checking for urgency.',
      'The HCP scans the schedule on the monitor and returns with a tighter posture.',
      'The HCP offers a quick nod that signals limited availability more than engagement.',
      'The HCP gestures lightly toward the hallway, indicating they may need to move soon.',
      'The HCP keeps one hand on the chart as if ready to stand at any moment.',
      'The HCP listens while half-turned toward the next obligation.',
      'The HCP’s eyes flick once toward the door at the sound of footsteps outside.',
      'The HCP repositions the clipboard closer to the edge of the desk, readying for departure.',
      'The HCP takes a short breath and glances at the schedule again.',
      'The HCP shifts in place, polite but clearly managing time in the background.',
      'The HCP’s focus holds, but only in short bursts between glances elsewhere.',
      'The HCP checks the hallway through the open door, then returns to you.',
      'The HCP keeps their body angled toward the next task while letting you finish.',
      'The HCP’s attention is present, but the clinic’s tempo is visibly winning.',
    ],
    1: [
      'The HCP is already moving toward a patient room and only barely stops when you speak.',
      'The HCP checks their phone with a tight expression, then looks up; the floor is clearly busy.',
      'The HCP holds a patient file in one hand, posture angled toward the next stop.',
      'The HCP’s eyes cut toward the door twice as a nurse pauses outside, waiting.',
      'The HCP glances at their watch in a way that feels less casual and more urgent.',
      'The HCP offers a brief apologetic smile, then resumes shuffling papers for the next patient.',
      'The HCP gestures to a passing colleague, signaling they will be there in a moment.',
      'The HCP reviews patient notes quickly even while listening to you.',
      'The HCP stays standing near the desk rather than sitting back down.',
      'The HCP keeps one foot turned toward the hallway like the scene is already ending.',
      'The HCP’s pager lights up again, ignored for one second too long.',
      'The HCP glances toward the exam room door at a knock, tension flickering across their face.',
      'The HCP nods quickly, giving you enough space to speak but not enough to linger.',
      'The HCP slides the chart under one arm, clearly preparing to transition.',
      'The HCP’s replies come between glances at the clinic flow beyond the doorway.',
      'The HCP checks the time mid-listen, then resets with visible effort.',
      'The HCP offers attention in fragments, each one interrupted by something else demanding it.',
      'The HCP remains polite, but every movement says the clock is dictating the scene.',
    ],
    2: [
      'The HCP’s pager goes off again, and they exhale like someone deciding what can wait and what cannot.',
      'The HCP is walking now, slowing just enough for the conversation but not stopping.',
      'The HCP checks their watch mid-sentence, jaw set, as if the entire clinic is already running behind.',
      'The HCP holds up one finger before you can start, a silent signal that time is nearly gone.',
      'The HCP offers a quick, tight smile and shifts another step toward the exit.',
      'The HCP gestures impatiently toward the hallway, signaling the need to wrap this up now.',
      'The HCP reviews patient notes while moving, multitasking with practiced urgency.',
      'The HCP checks the pager again and this time does not hide the pressure.',
      'The HCP keeps speaking while already reaching for the door.',
      'The HCP pauses at the threshold rather than returning to the desk.',
      'The HCP’s attention fractures repeatedly under the weight of the clinic around them.',
      'The HCP gives you a final sliver of time without ever fully rejoining the conversation.',
      'The HCP glances toward a waiting nurse, apology and urgency crossing their face at once.',
      'The HCP’s body is already committed to the next obligation, even if their words are still with you.',
      'The HCP shortens every pause as if silence itself now costs too much.',
      'The HCP stands with the chart tucked under one arm, every second accounted for.',
      'The HCP speaks while in motion, the conversation surviving only because they are allowing it to.',
      'The HCP’s posture says this interaction is balancing on borrowed time.',
    ],
  },

  resistant: {
    0: [
      'The HCP’s expression tightens slightly, and they cross their arms while still listening.',
      'The HCP tilts their head, one eyebrow raised, a quiet signal of doubt entering the frame.',
      'The HCP exhales through their nose and leans back, creating visible distance.',
      'The HCP taps a finger slowly on the desk, expression measured, offering no easy validation.',
      'The HCP reviews a page in the chart, then looks up with clear skepticism.',
      'The HCP gives a brief questioning look, as if the claim has not earned trust yet.',
      'The HCP leans back with arms crossed, not closed off entirely, but clearly unconvinced.',
      'The HCP checks their notes, then returns with a guarded expression.',
      'The HCP presses their lips together, eyes narrowing a fraction.',
      'The HCP keeps still, letting the skepticism sit plainly in the silence.',
      'The HCP’s posture loses warmth and becomes analytical.',
      'The HCP shifts the chart between you, almost like a shield.',
      'The HCP studies you without nodding, waiting for a stronger point.',
      'The HCP glances at the cited material with the look of someone already doubting it.',
      'The HCP’s expression says they have heard claims like this before.',
      'The HCP folds one arm across their chest and rests the other on it.',
      'The HCP gives a slow inhale, as if patience is still available but no longer free.',
      'The HCP watches closely, skepticism present but still civil.',
    ],
    1: [
      'The HCP’s posture hardens, arms crossed firmly now, eye contact direct and challenging.',
      'The HCP’s jaw sets as they listen, deliberate and assessing, without offering a single nod.',
      'The HCP sets down the pen with quiet finality and meets your gaze steadily.',
      'The HCP leans back farther in the chair, increasing both physical and conversational distance.',
      'The HCP offers a skeptical half-smile that reads more like a challenge than agreement.',
      'The HCP looks down at the document, then back up with sharpened doubt.',
      'The HCP makes a small dismissive gesture with one hand, subtle but unmistakable.',
      'The HCP checks the phone and returns with even less warmth than before.',
      'The HCP’s brows draw in as if testing every word for weakness.',
      'The HCP gives you the kind of stillness that demands proof, not enthusiasm.',
      'The HCP turns the chart slightly toward themselves, reclaiming the space.',
      'The HCP lets a beat of silence pass before responding at all.',
      'The HCP’s posture communicates guarded judgment rather than curiosity.',
      'The HCP looks at you like the burden of proof has just doubled.',
      'The HCP taps the desk once and stops, as if drawing a line under the point.',
      'The HCP’s expression remains polite, but the door to easy rapport is closing.',
      'The HCP listens with clinical restraint, visibly unconvinced.',
      'The HCP sits back in a way that makes the whole conversation feel less welcome.',
    ],
    2: [
      'The HCP exhales audibly and looks away for a moment before returning with a flat, skeptical expression.',
      'The HCP’s arms stay crossed throughout, posture guarded and almost completely still.',
      'The HCP gives a slow single nod, the kind that signals deep doubt rather than agreement.',
      'The HCP makes deliberate eye contact without warmth, waiting for you to prove your point.',
      'The HCP offers a terse smile that carries no real softness in it.',
      'The HCP reviews the material with visible disbelief, then looks up unmoved.',
      'The HCP gestures once with impatience, signaling resistance more than conversation.',
      'The HCP checks their notes and returns with a stance that has fully hardened.',
      'The HCP’s face settles into professional skepticism with no room left for easy persuasion.',
      'The HCP leans back so completely the distance itself becomes part of the response.',
      'The HCP’s silence lands heavier than any interruption could.',
      'The HCP studies you with the look of someone expecting the next claim to fail under scrutiny.',
      'The HCP keeps their expression flat, almost severe, while waiting.',
      'The HCP’s posture says they are still here only because professionalism requires it.',
      'The HCP gives nothing away except doubt.',
      'The HCP watches with a patience that feels closer to challenge than openness.',
      'The HCP’s skepticism is now the dominant energy in the room.',
      'The HCP holds still, guarded, unconvinced, and visibly done with weak claims.',
    ],
  },

  'boundary-setting': {
    0: [
      'The HCP raises one hand, calm but unmistakable, before saying anything at all.',
      'The HCP takes a deliberate breath and locks in direct eye contact, signaling a limit is about to be set.',
      'The HCP places the pen down and folds both hands together, posture shifting into quiet firmness.',
      'The HCP steps back slightly and faces you squarely, expression composed and controlled.',
      'The HCP glances once at the schedule, then returns with a look that signals a line is being drawn.',
      'The HCP gives a firm nod that feels more like a stop sign than agreement.',
      'The HCP gestures once with the palm outward, establishing space.',
      'The HCP reviews the notes briefly, then returns to stillness with composed resolve.',
      'The HCP straightens in the chair and lets the room settle before speaking.',
      'The HCP squares the chart on the desk as if resetting the terms of the interaction.',
      'The HCP’s posture becomes noticeably more formal, less flexible.',
      'The HCP’s face remains calm, but the openness is gone.',
      'The HCP holds your gaze long enough to make the boundary visible before it is verbalized.',
      'The HCP rests both hands flat on the desk, signaling control.',
      'The HCP’s shoulders set with quiet finality.',
      'The HCP gives you a measured look that says the conversation has reached an edge.',
      'The HCP does not move much now, letting stillness carry the message.',
      'The HCP’s calm becomes more structured, like a door being closed without noise.',
    ],
    1: [
      'The HCP’s hand rises with unmistakable clarity and stays there until silence returns.',
      'The HCP straightens fully and looks at you directly, body language leaving no ambiguity.',
      'The HCP sets the clipboard aside with deliberate care, the tone of the scene turning formal.',
      'The HCP pivots to face you squarely, feet planted, expression set.',
      'The HCP offers a firm, composed smile that does not soften the boundary being drawn.',
      'The HCP reviews a page once and then closes it, decision already made.',
      'The HCP gestures again with the palm outward, calm but final.',
      'The HCP checks the phone, silences it, and returns with firmer composure than before.',
      'The HCP’s posture closes in around a decision rather than a discussion.',
      'The HCP pauses long enough for the limit to register before speaking further.',
      'The HCP’s eyes stay locked on yours, measured and steady.',
      'The HCP shifts from conversational to procedural in a single beat.',
      'The HCP lets the silence do half the work.',
      'The HCP stands a fraction taller, signaling that the line is not negotiable.',
      'The HCP’s stillness becomes more authoritative than any raised voice would be.',
      'The HCP keeps the chart close, reclaiming control of the interaction.',
      'The HCP’s face remains professional, but the warmth has dropped out completely.',
      'The HCP no longer invites collaboration, only respect for the limit.',
    ],
    2: [
      'The HCP raises both hands briefly, a clear and unambiguous stop in the middle of the scene.',
      'The HCP stands slightly taller, expression locked and unreadable, clearly drawing a line.',
      'The HCP meets your gaze without blinking, their stillness carrying the warning.',
      'The HCP’s posture closes completely, nothing inviting left in the stance.',
      'The HCP offers a terse smile that signals control, not warmth.',
      'The HCP closes the report and sets it down with visible finality.',
      'The HCP gestures once, impatiently this time, establishing the boundary beyond debate.',
      'The HCP checks the notes and returns with a face that has fully hardened into resolve.',
      'The HCP’s tone has not risen, but the room feels colder.',
      'The HCP no longer shifts or adjusts; the decision is already set.',
      'The HCP’s expression says the conversation moves only if it moves on their terms.',
      'The HCP holds the silence until the limit becomes undeniable.',
      'The HCP faces you squarely with the composure of someone ending speculation.',
      'The HCP’s body language is controlled enough to make any further push feel like a mistake.',
      'The HCP plants one hand on the desk and does not move it.',
      'The HCP’s posture communicates finality before any words arrive.',
      'The HCP no longer appears available for negotiation.',
      'The HCP stands in calm, unmistakable closure, a line clearly drawn.',
    ],
  },
  irritated: {
    0: [
      'The HCP’s jaw tightens slightly before they look back at you, the patience in the room beginning to thin.',
      'The HCP closes the chart with a firmer motion than necessary and turns toward you with a sharpened expression.',
      'The HCP exhales through their nose, brow faintly furrowed, irritation just beginning to show around the edges.',
      'The HCP replies while half-turning back to their work, as if your timing has already cost them something.',
      'The HCP offers a tight, polite smile that does nothing to hide their impatience.',
      'The HCP glances at the wall clock, then back at you with a noticeably flatter expression.',
      'The HCP taps the desk once, slow and deliberate, before speaking.',
      'The HCP shifts the chart to the side with visible impatience, attention now more obligation than interest.',
      'The HCP’s shoulders stiffen as they listen, posture no longer neutral.',
      'The HCP pauses mid-note and looks up with the expression of someone whose patience is being tested.',
      'The HCP’s eyes narrow slightly, not hostile yet, but clearly less forgiving than before.',
      'The HCP lets a beat of silence land before responding, irritation beginning to color the pause.',
      'The HCP presses their lips together and looks back at you with clipped attention.',
      'The HCP adjusts their glasses with a sharper motion than before and waits for you to continue.',
      'The HCP turns fully toward you, but the movement feels abrupt rather than open.',
      'The HCP gives a short nod that reads less like acknowledgment and more like tolerance.',
      'The HCP glances toward the door, then back at you, expression visibly tighter.',
      'The HCP folds the chart closed and sets it down with restrained annoyance.',
    ],
    1: [
      'The HCP’s expression hardens visibly, and they set the pen down with a firm click that carries across the desk.',
      'The HCP looks at you with clear impatience, arms held close, body language stripped of warmth.',
      'The HCP’s brow draws together as they listen, voice likely to come back short and controlled.',
      'The HCP stops mid-task and faces you, the kind of stillness that signals patience is running low.',
      'The HCP offers a terse, impatient smile that never reaches the eyes.',
      'The HCP glances down at the document in front of them, then back up with a harder edge in their expression.',
      'The HCP makes a small dismissive motion with one hand, as though brushing away something unhelpful.',
      'The HCP checks their phone, sets it down, and returns with visibly less tolerance than before.',
      'The HCP’s jaw works once before they answer, irritation kept barely under control.',
      'The HCP sits back with a look that makes the room feel noticeably colder.',
      'The HCP exhales audibly and fixes you with a direct, impatient stare.',
      'The HCP lets the silence stretch just long enough to make the strain obvious.',
      'The HCP repositions the chart sharply, reclaiming the conversation on their terms.',
      'The HCP’s posture closes in, elbows tight, expression severe.',
      'The HCP looks toward the hallway, then back at you, frustration now competing with professionalism.',
      'The HCP’s response feels measured only because they are working to keep it that way.',
      'The HCP plants one hand on the desk and listens with visible restraint.',
      'The HCP no longer hides their impatience; it sits plainly in the room between you.',
    ],
    2: [
      'The HCP’s face shows undisguised frustration, and they look at you for a brief, pointed moment before speaking.',
      'The HCP exhales hard, jaw clenched, clearly at the edge of what they are willing to tolerate.',
      'The HCP says nothing at first, the silence terse, deliberate, and increasingly uncomfortable.',
      'The HCP turns slowly toward you, expression flat and unforgiving, the conversation now on borrowed time.',
      'The HCP offers a terse, frustrated smile that feels more like a warning than courtesy.',
      'The HCP reviews the report in front of them, then looks back up with complete impatience.',
      'The HCP gestures sharply, once, signaling that their tolerance for this exchange is nearly gone.',
      'The HCP checks their notes and returns with a face that has fully hardened into visible irritation.',
      'The HCP’s eyes stay on you in the kind of stillness that makes the air feel tight.',
      'The HCP’s body language is no longer managing annoyance so much as containing it.',
      'The HCP’s hand tightens around the pen before they set it down with obvious force.',
      'The HCP leans back and fixes you with the expression of someone who has stopped giving the benefit of the doubt.',
      'The HCP’s patience feels fully spent, with professionalism now doing all the remaining work.',
      'The HCP looks away once, collecting themselves, then returns colder than before.',
      'The HCP’s posture is rigid enough to make any additional push feel unwise.',
      'The HCP gives a clipped nod that signals the scene is nearing its end.',
      'The HCP’s silence carries more frustration than words would.',
      'The HCP remains still, severe, and visibly done with weak or pushy turns.',
    ],
  },

  disengaged: {
    0: [
      'The HCP begins moving toward the hallway, glancing back over their shoulder to reply.',
      'The HCP looks past you toward the waiting room and picks up the clipboard, attention already loosening.',
      'The HCP closes the laptop and stands, the conversation visibly beginning to wind down.',
      'The HCP takes a step toward the door, offering only a brief acknowledgment as they move.',
      'The HCP reviews the schedule and starts gathering what they need for the next task.',
      'The HCP offers a polite, brief smile that feels more like closure than warmth.',
      'The HCP gestures lightly toward the exit, signaling the interaction is nearing its end.',
      'The HCP checks their phone, then slides it into their pocket while preparing to leave.',
      'The HCP shifts the chart under one arm and glances toward the next room.',
      'The HCP’s answers begin to come with movement, not stillness.',
      'The HCP no longer settles back into the conversation after each response.',
      'The HCP angles their body toward the hallway, giving you only partial attention.',
      'The HCP steps away from the desk and lets the room itself suggest the conversation is ending.',
      'The HCP gives a short nod while reaching for the door handle area.',
      'The HCP glances toward a passing colleague and does not fully return to the exchange.',
      'The HCP’s attention drifts outward, toward what comes next rather than what you are saying.',
      'The HCP starts stacking papers with the practiced efficiency of someone closing the scene.',
      'The HCP remains polite, but their body has begun leaving before their words have.',
    ],
    1: [
      'The HCP is already a step toward the door, and the reply comes partly over their shoulder.',
      'The HCP makes deliberate eye contact with someone down the hall, the signal to you unmistakably clear.',
      'The HCP checks the watch, then the door, body language leaving little room for ambiguity.',
      'The HCP reaches for their coat or phone, ending the interaction without saying so directly.',
      'The HCP offers a brief, polite smile that feels final rather than inviting.',
      'The HCP reviews the chart once more and tucks it away, ready to move on.',
      'The HCP gestures toward the hallway, indicating the conversation has about one beat left.',
      'The HCP checks the phone and pockets it without returning to a listening posture.',
      'The HCP stays angled toward the exit, no longer pretending the conversation still has momentum.',
      'The HCP’s replies shorten as their attention shifts fully to what follows this moment.',
      'The HCP glances at the next room while you are still speaking.',
      'The HCP gives a quick nod and begins walking again almost immediately.',
      'The HCP’s eyes move past you more often than toward you now.',
      'The HCP gathers the last of the papers and does not set them back down.',
      'The HCP pauses only briefly before continuing toward the next obligation.',
      'The HCP offers professionalism, but no longer presence.',
      'The HCP’s body language says the interaction is effectively over, even if no one has said it yet.',
      'The HCP makes it clear through movement that the scene is closing.',
    ],
    2: [
      'The HCP is walking now, and their final words are delivered in motion, not in conversation.',
      'The HCP has a hand on the door handle and pauses only barely before continuing.',
      'The HCP offers a polite but final nod and turns fully toward the exit.',
      'The HCP is done, leaving the conversation behind without looking back.',
      'The HCP gives a brief smile that reads as courtesy only, then continues out.',
      'The HCP tucks the chart under one arm and moves into the hallway without rejoining the exchange.',
      'The HCP gestures once toward the exit, signaling closure with unmistakable economy.',
      'The HCP checks the notes one last time and resumes leaving without breaking stride.',
      'The HCP’s attention has fully detached from the conversation now.',
      'The HCP does not stop walking, even while finishing the sentence.',
      'The HCP turns the corner of the desk and never really turns back.',
      'The HCP’s final acknowledgment lands like a curtain closing on the scene.',
      'The HCP pauses at the threshold only long enough to be polite, not available.',
      'The HCP’s body is fully claimed by the next task, the conversation reduced to an afterthought.',
      'The HCP gives you the last available second, and then not another one.',
      'The HCP exits with the unmistakable finality of someone who has already moved on.',
      'The HCP leaves the interaction intact professionally, but completely finished emotionally.',
      'The HCP’s departure makes clear that there is no more room left in the moment.',
    ],
  },
}

/******************************************************************************************
CUE SELECTION
Deterministic, weighted, state-consistent, non-repeating
******************************************************************************************/

export function selectCue(sessionId, turnNumber, hcpState, severity = 0, options = {}) {
  const bank = CUE_BANK[hcpState] || CUE_BANK.neutral
  const safeSeverity = Math.max(0, Math.min(2, severity))
  const tier = bank[safeSeverity] || bank[0]
  const nonRepeatWindow = Math.max(10, Math.min(15, options.nonRepeatWindow || 15))
  const nonRepeatWarmupTurns = Math.max(10, Math.min(15, options.nonRepeatWarmupTurns || 15))

  const seed = hashInt(`${sessionId}:${turnNumber}:${hcpState}:${safeSeverity}`)
  const recentMemory = getRecentCueMemory(options.memory, hcpState, safeSeverity)
  const recentGlobalCues = getRecentGlobalCueMemory(options.memory, nonRepeatWindow)
  const mostRecentCueSignature = recentGlobalCues[recentGlobalCues.length - 1]

  const weightedCandidates = tier.map((cue, index) => {
    let weight = 1
    const cueSignature = cue

    if (recentMemory.includes(index)) {
      weight = 0.2
    }

    // Hard safeguard: never allow immediate back-to-back cue duplication.
    if (cueSignature === mostRecentCueSignature) {
      weight = 0
    }

    // Hard safeguard: block any recent cue during first 10-15 exchanges.
    if (turnNumber <= nonRepeatWarmupTurns && recentGlobalCues.includes(cueSignature)) {
      weight = 0
    }

    if (options.preferShort && cue.length < 110) {
      weight += 0.35
    }

    if (options.preferStrongVisuals && /door|watch|pager|jaw|arms|hallway|chart|clipboard|clock/.test(cue.toLowerCase())) {
      weight += 0.4
    }

    if (options.avoidDoorCues && /door|exit|hallway|threshold|walking/.test(cue.toLowerCase())) {
      weight -= 0.35
    }

    return {
      index,
      cue,
      cueSignature,
      weight: Math.max(0.05, weight),
    }
  })

  const eligibleCandidates = weightedCandidates.filter((item) => item.weight > 0)
  const totalWeight = eligibleCandidates.reduce((sum, item) => sum + item.weight, 0)

  if (totalWeight <= 0) {
    const fallbackIndex = seed % tier.length
    const fallbackCue = tier[fallbackIndex]

    if (fallbackCue === mostRecentCueSignature && tier.length > 1) {
      const secondIndex = (fallbackIndex + 1) % tier.length
      return {
        cue: tier[secondIndex],
        cueIndex: secondIndex,
      }
    }

    return {
      cue: fallbackCue,
      cueIndex: fallbackIndex,
    }
  }

  let cursor = seed % totalWeight

  for (const item of eligibleCandidates) {
    if (cursor < item.weight) {
      return {
        cue: item.cue,
        cueIndex: item.index,
      }
    }
    cursor -= item.weight
  }

  const fallbackIndex = seed % tier.length
  return {
    cue: tier[fallbackIndex],
    cueIndex: fallbackIndex,
  }
}

/******************************************************************************************
TONE DIRECTIVES
******************************************************************************************/

export function getToneDirectives(state, temperature) {
  const base = {
    neutral: {
      maxSentences: 3,
      instruction:
        'Respond professionally. Neither warm nor cold. Open but not enthusiastic. No stage directions.',
    },

    engaged: {
      maxSentences: 3,
      instruction:
        'Show genuine interest. Ask a brief follow-up or lean into the topic. Be collaborative and warm.',
    },

    'time-pressured': {
      maxSentences: 2,
      instruction:
        'Be extremely brief. You are busy. Reference time explicitly, a patient, a schedule, or your pager. Keep it to one or two short sentences.',
    },

    resistant: {
      maxSentences: 2,
      instruction:
        'Push back. Express doubt. Ask for evidence. Do not concede. Stay civil but clearly unconvinced.',
    },

    'boundary-setting': {
      maxSentences: 2,
      instruction:
        'Explicitly draw a limit. State clearly what you will and will not discuss. Be unambiguous. No warmth. No apology.',
    },

    irritated: {
      maxSentences: 1,
      instruction:
        'One sentence only. Be sharp, minimal, controlled, and offer no extra explanation.',
    },

    disengaged: {
      maxSentences: 1,
      instruction:
        'One sentence only. Sound like you are closing the interaction, not continuing it. No engagement and no follow-up questions.',
    },
  }

  const directive = base[state] || base.neutral

  const tempMod =
    {
      positive: ' Use slightly warmer language than your state strictly requires.',
      neutral: '',
      stressed: ' Your wording should reflect stress. Shorter sentences. Less courtesy.',
      irritated: ' Strip unnecessary politeness. Your tone is flat, tight, and nearly done.',
    }[temperature] || ''

  return {
    ...directive,
    instruction: directive.instruction + tempMod,
  }
}

export function deriveInteractionMode({
  structuralState = 'neutral',
  conversationQuality = 0,
  repBehavior = {},
  recentLowValueTurns = 0,
}) {
  if (structuralState === 'disengaged') {
    return 'closing_decision'
  }

  const repeatedMisalignment =
    recentLowValueTurns >= 2 ||
    conversationQuality <= -2 ||
    repBehavior.pushy ||
    repBehavior.redundant_question ||
    repBehavior.boundary_violation

  if (structuralState === 'irritated' || structuralState === 'boundary-setting') {
    return repeatedMisalignment ? 'closing_decision' : 'directive'
  }

  if (structuralState === 'resistant' || structuralState === 'time-pressured') {
    return repeatedMisalignment ? 'directive' : 'clarifying'
  }

  if (conversationQuality <= -1 || recentLowValueTurns >= 1) {
    return 'clarifying'
  }

  return 'exploratory'
}

/******************************************************************************************
SEMANTIC PROGRESSION + TERMINAL REALISM OVERLAY
- Advances unresolved concerns through realistic stages
- Prevents repetitive objection loops
- Enables late-stage terminal posture while preserving professionalism
******************************************************************************************/

function normalizeLineForPattern(line = '') {
  return String(line || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function startsWithRepeatedPattern(hcpHistory = []) {
  const recent = hcpHistory
    .map((line) => normalizeLineForPattern(line))
    .filter(Boolean)
    .slice(-2)

  if (recent.length < 2) {
    return { repeated: false, pattern: '' }
  }

  const signatures = recent.map((line) =>
    line
      .split(' ')
      .slice(0, 6)
      .join(' ')
      .trim()
  )

  const repeated = signatures[0] && signatures[0] === signatures[1]
  return { repeated, pattern: signatures[1] || '' }
}

function hasOperationalSpecificity(message = '') {
  const msg = String(message || '').toLowerCase()
  return /\b(workflow|staff|nurse|ma\b|front desk|prior auth|payer|appeal|ehr|emr|template|order set|protocol|step|steps|tomorrow|this week|same day|follow-up cadence|handoff|checklist|implementation|operational|actionable|minutes|burden)\b/.test(
    msg
  )
}

function isEvidenceDriftWithoutOperationalLink(message = '') {
  const msg = String(message || '').toLowerCase()
  const evidenceHeavy =
    /\b(study|studies|data|evidence|efficacy|endpoint|trial|publication|value|roi|outcome|results|journal)\b/.test(
      msg
    )

  return evidenceHeavy && !hasOperationalSpecificity(msg)
}

function getProgressionStageFromPressure(pressure = 0) {
  if (pressure >= 6) return 5
  if (pressure >= 4) return 4
  if (pressure >= 3) return 3
  if (pressure >= 2) return 2
  return 1
}

export function deriveSemanticProgressionOverlay({
  history = [],
  repMessage = '',
  prevProfile = null,
  structuralState = 'neutral',
  interactionMode = 'clarifying',
  turnNumber = 1,
}) {
  const priorPressure = Math.max(
    0,
    Number(prevProfile?.memory?.semanticProgression?.pressure || 0)
  )

  const repHistory = history.map((turn) => turn?.repMessage).filter(Boolean)
  const hcpHistory = history.map((turn) => turn?.hcpDialogueBefore).filter(Boolean)
  const recentRepMessages = [...repHistory, repMessage].filter(Boolean).slice(-4)
  const latestRepMessage = String(repMessage || '').trim()
  const recentLowValueTurns = recentRepMessages.filter((message) =>
    detectLowValueRepResponse(message)
  ).length

  const evidenceDrift = isEvidenceDriftWithoutOperationalLink(latestRepMessage)
  const operationalRecovery = hasOperationalSpecificity(latestRepMessage)
  const clearMiss =
    !!latestRepMessage &&
    (evidenceDrift || detectLowValueRepResponse(latestRepMessage))

  let pressure = priorPressure
  if (clearMiss) pressure += 1
  else if (operationalRecovery) pressure -= 1

  if (recentLowValueTurns >= 2) pressure += 1
  pressure = Math.max(0, Math.min(8, pressure))

  const stage = getProgressionStageFromPressure(pressure)
  const terminalBehavior =
    stage >= 5 ||
    (stage >= 4 &&
      (interactionMode === 'closing_decision' ||
        structuralState === 'disengaged' ||
        structuralState === 'irritated'))

  const stageLabels = {
    1: 'Clarify',
    2: 'Narrow',
    3: 'Demand Specificity',
    4: 'Challenge Practicality',
    5: 'Decide / Close',
  }

  const focusAngles = [
    'clinical applicability',
    'evidence confidence',
    'patient selection clarity',
    'risk-benefit practicality',
    'care pathway fit when explicitly raised',
    'implementation detail when explicitly raised',
    'time-to-decision clarity',
    'next best action',
  ]
  const angleIndex = hashInt(`${turnNumber}:${stage}:${pressure}`) % focusAngles.length

  const patternCheck = startsWithRepeatedPattern(hcpHistory)

  return {
    stage,
    stageLabel: stageLabels[stage],
    pressure,
    terminalBehavior,
    evidenceDrift,
    operationalRecovery,
    focusAngle: focusAngles[angleIndex],
    repeatedPattern: patternCheck.repeated ? patternCheck.pattern : '',
    antiRepetitionLock: patternCheck.repeated,
  }
}

/******************************************************************************************
PUNCTUATION NORMALIZATION
******************************************************************************************/

export function normalizeHcpDialoguePunctuation(dialogue) {
  if (!dialogue) return dialogue

  let text = String(dialogue).replace(/\s+/g, ' ').trim()
  if (!text) return text

  const grammarCorrections = [
    { pattern: /to discuss regarding/gi, replacement: 'to discuss' },
    { pattern: /to discuss about/gi, replacement: 'to discuss' },
    { pattern: /to talk regarding/gi, replacement: 'to talk about' },
    { pattern: /to talk about regarding/gi, replacement: 'to talk about' },
    {
      pattern: /What brings you here today to discuss/gi,
      replacement: 'What brings you here today? Are you interested in discussing',
    },
    { pattern: /in the context of/gi, replacement: 'regarding' },
    {
      pattern: /What brings you here today to discuss regarding/gi,
      replacement: 'What brings you here today? Are you interested in discussing',
    },
    {
      pattern: /What brings you here today to discuss about/gi,
      replacement: 'What brings you here today? Are you interested in discussing',
    },
  ]

  grammarCorrections.forEach(({ pattern, replacement }) => {
    text = text.replace(pattern, replacement)
  })

  // Split run-on constructions where a statement is followed by a question clause.
  // Example: "I'm familiar with the journal, what specific aspect..." ->
  // "I'm familiar with the journal. What specific aspect...?"
  text = text
    .replace(/,\s+(who|what|when|where|why|how|which|could|would|can|do|does|did|is|are|am|will|may|should)\b/gi, '. $1')
    .replace(/\.\s*\?/g, '?')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const questionStarterPattern =
    /^(Who|What|When|Where|Why|How|Is|Are|Am|Was|Were|Do|Does|Did|Can|Could|Will|Would|Should|Shall|Have|Has|Had|May|Might|Must)\b/i

  const sentences = text.match(/[^?.!]+[?.!]?/g) || [text]

  const normalized = sentences
    .map((rawSentence) => {
      const sentence = rawSentence.trim()
      if (!sentence) return ''

      const withoutEndPunct = sentence.replace(/[?.!]+$/, '').trim()
      const isQuestion = questionStarterPattern.test(withoutEndPunct)

      if (isQuestion) return `${withoutEndPunct}?`
      if (/[?.!]$/.test(sentence)) return sentence
      return `${withoutEndPunct}.`
    })
    .filter(Boolean)
    .join(' ')
    .trim()

  if (!/[?.!]$/.test(normalized)) {
    return `${normalized}.`
  }

  return normalized
}

/******************************************************************************************
BUILD HCP PROFILE
Single source of truth for each turn
******************************************************************************************/

export function buildHCPProfile({
  sessionId,
  turnNumber,
  structuralState,
  temperature,
  severity,
  memory = {},
  conversationQuality = 0,
  repBehavior = {},
  timeElapsed = 1,
  semanticOverlay = null,
}) {
  const preferShort =
    structuralState === 'time-pressured' ||
    structuralState === 'disengaged' ||
    semanticOverlay?.terminalBehavior
  const preferStrongVisuals =
    structuralState === 'irritated' ||
    structuralState === 'resistant' ||
    structuralState === 'boundary-setting' ||
    semanticOverlay?.stage >= 4

  const avoidDoorCues =
    structuralState !== 'time-pressured' &&
    structuralState !== 'disengaged' &&
    !semanticOverlay?.terminalBehavior

  const cueSelection = selectCue(sessionId, turnNumber, structuralState, severity, {
    memory,
    preferShort,
    preferStrongVisuals,
    avoidDoorCues,
    nonRepeatWindow: 15,
    nonRepeatWarmupTurns: 15,
  })

  const stateMemory = setRecentCueMemory(
    memory,
    structuralState,
    severity,
    cueSelection.cueIndex
  )

  const semanticMemory = {
    ...(stateMemory || {}),
    semanticProgression: {
      pressure: semanticOverlay?.pressure || 0,
      stage: semanticOverlay?.stage || 1,
    },
  }

  const nextMemory = setRecentGlobalCueMemory(
    semanticMemory,
    cueSelection.cue,
    15
  )

  const toneDirectives = getToneDirectives(structuralState, temperature)

  return Object.freeze({
    structuralState,
    temperature,
    severity,
    turnNumber,
    lockedCue: cueSelection.cue,
    cueIndex: cueSelection.cueIndex,
    toneDirectives,
    conversationQuality,
    repBehavior,
    timeElapsed,
    semanticOverlay,
    memory: nextMemory,
  })
}

/******************************************************************************************
PROFILE ORCHESTRATION
Deterministically derive next state, temperature, severity, and cue
******************************************************************************************/

export function deriveNextHCPProfile({
  sessionId,
  turnNumber,
  scenario,
  repMessage = '',
  history = [],
  prevProfile = null,
  alignment = null,
}) {
  const previousState =
    prevProfile?.structuralState ||
    deriveInitialState(scenario)

  const previousTemperature =
    prevProfile?.temperature ||
    deriveInitialTemperature(previousState)

  const previousSeverity =
    typeof prevProfile?.severity === 'number' ? prevProfile.severity : 0

  const memory = prevProfile?.memory || {}

  const conversationQuality = scoreConversationQuality(repMessage, history)
  const repBehavior = detectRepBehavior(repMessage)

  const timeElapsed = turnNumber

  const weightedStates = computeStateWeights({
    conversation_quality: conversationQuality,
    rep_behavior: repBehavior,
    previous_cue_state: previousState,
    time_elapsed: timeElapsed,
  })

  const deterministicState = weightedPick(
    weightedStates,
    hashInt(`${sessionId}:${turnNumber}:state`)
  )

  const transitionedState = transitionState(
    deterministicState,
    repMessage,
    previousTemperature
  )

  const transitionedTemperature = transitionTemperature(
    previousTemperature,
    repMessage
  )

  const severity = transitionSeverity(
    previousSeverity,
    alignment,
    previousState,
    transitionedState,
    repBehavior
  )

  const recentLowValueTurns = countRecentLowValueRepTurns(history, repMessage)
  const interactionMode = deriveInteractionMode({
    structuralState: transitionedState,
    conversationQuality,
    repBehavior,
    recentLowValueTurns,
  })

  const semanticOverlay = deriveSemanticProgressionOverlay({
    history,
    repMessage,
    prevProfile,
    structuralState: transitionedState,
    interactionMode,
    turnNumber,
  })

  return buildHCPProfile({
    sessionId,
    turnNumber,
    structuralState: transitionedState,
    temperature: transitionedTemperature,
    severity,
    memory,
    conversationQuality,
    repBehavior,
    timeElapsed,
    semanticOverlay,
  })
}

/******************************************************************************************
SYSTEM PROMPT BUILDER
******************************************************************************************/

export function buildHCPDialoguePrompt({
  scenario,
  hcpProfile,
  historyText = null,
  isOpening = false,
}) {
  const {
    structuralState,
    temperature,
    severity,
    lockedCue,
    toneDirectives,
    personality,
  } = hcpProfile

  function sanitize(str) {
    return String(str).replace(/[^\x00-\x7F]/g, '')
  }

  const severityLabel = ['mild', 'moderate', 'strong'][severity]

  const stateDescriptions = {
    neutral: 'professionally neutral, neither warm nor dismissive',
    engaged: 'genuinely curious and collaborative',
    'time-pressured': 'visibly pressed for time, brief, rushed, direct',
    resistant: 'guarded and skeptical, unconvinced, pushing back',
    'boundary-setting': 'firm and unambiguous, drawing a clear limit',
    irritated: 'visibly impatient and frustrated, clipped and sharp',
    disengaged: 'withdrawing and signaling the conversation is ending',
  }

  const historyLines = String(historyText || '').split('\n')
  const repHistoryMessages = historyLines
    .filter((l) => l.startsWith('Sales Rep:') || l.startsWith('Rep:'))
    .map((line) => line.replace(/^Sales Rep:\s*|^Rep:\s*/i, '').trim())
    .filter(Boolean)
  const repLine = [...historyLines]
    .reverse()
    .find((l) => l.startsWith('Sales Rep:') || l.startsWith('Rep:'))
  const lastRepMessage = repLine
    ? repLine.replace(/^Sales Rep:\s*|^Rep:\s*/i, '').trim()
    : ''
  const lastRepLower = lastRepMessage.toLowerCase()
  const repWasLowValue =
    lastRepLower.length < 8 ||
    /\b(idk|nothing|never|whatever|not sure)\b/.test(lastRepLower)
  const repWasRude =
    /\bf\*+\b|f\*ck|fuck|shit|ass\b|\bstupid\b|\bidiot\b|\bincompetent\b|\byou don.t know\b|\bare you the doctor or am i\b|\bcome on\b/.test(
      lastRepLower
    )
  const repWasVagueOrDismissive =
    repWasLowValue ||
    /\bmaybe\b|\bi guess\b|\bprobably\b|\bwe can talk later\b|\bnot now\b|\bdoesn.t matter\b|\bwhatever\b/.test(
      lastRepLower
    )
  const recentLowValueTurns = repHistoryMessages
    .slice(-3)
    .filter((message) => detectLowValueRepResponse(message)).length
  let interactionMode = deriveInteractionMode({
    structuralState,
    conversationQuality: hcpProfile.conversationQuality,
    repBehavior: hcpProfile.repBehavior,
    recentLowValueTurns,
  })
  const semanticOverlay =
    hcpProfile.semanticOverlay ||
    deriveSemanticProgressionOverlay({
      history: [],
      repMessage: lastRepMessage,
      prevProfile: { memory: hcpProfile.memory || {} },
      structuralState,
      interactionMode,
      turnNumber: hcpProfile.turnNumber || 1,
    })

  if (semanticOverlay.terminalBehavior && interactionMode !== 'closing_decision') {
    interactionMode = 'closing_decision'
  } else if (semanticOverlay.stage >= 4 && interactionMode === 'clarifying') {
    interactionMode = 'directive'
  }

  const interactionModeLabel = {
    exploratory: 'Exploratory',
    clarifying: 'Clarifying',
    directive: 'Directive',
    closing_decision: 'Closing / Decision',
  }[interactionMode]

  let contextHint = ''
  if (lastRepMessage) {
    contextHint =
      '\nCONTEXTUAL REFERENCE:\n- The rep just said: "' +
      sanitize(lastRepMessage) +
      '"\n- Respond directly to that input, adapting your focus and tone to your locked state.'
      + (repWasLowValue ? '\n- The rep response was low-value or minimally useful.' : '')
      + (repWasVagueOrDismissive ? '\n- The rep response was vague, dismissive, or unhelpful.' : '')
      + (repWasRude ? '\n- The rep response was rude or unprofessional.' : '')
  }

  let prompt = ''

  prompt += 'You are playing an HCP in a pharmaceutical sales training simulation.\n'
  prompt += '\nROLE RULES:\n'
  prompt += '- You are NOT the sales rep.\n'
  prompt += '- Respond ONLY as the HCP.\n'
  prompt += '- Never switch roles.\n'
  prompt += '- Never narrate stage directions.\n'
  prompt += '- Output only spoken dialogue.\n'
  prompt += '- Prefer natural, conversational wording over formulaic phrasing.\n'
  prompt += '- Vary sentence openings naturally across turns while preserving the same core concern.\n'

  prompt += '\nSCENARIO: "' + sanitize(scenario.title || '') + '"'
  prompt += '\nSCENARIO DESCRIPTION: ' + sanitize(scenario.description || scenario.context || '')
  prompt += '\nOPENING SCENE: ' + sanitize(scenario.opening_scene || scenario.openingScene || '')
  prompt += '\nHCP TYPE: ' + sanitize(scenario.hcp_category || 'Physician')
  prompt += '\nSPECIALTY: ' + sanitize(scenario.specialty || 'General Medicine')
  prompt += '\nDISEASE STATE: ' + sanitize(scenario.disease_state || 'General')

  if (isOpening) {
    prompt += '\nOPENING RULE: Use natural, conversational grammar. Avoid awkward phrasing.'
    prompt += '\nREALISM RULE: Doctors may be busy, but can still be human, cordial, neutral, or direct depending on context.'
  }

  if (personality) {
    prompt += '\n\nPERSONALITY TRAIT: ' + sanitize(personality.name || personality)
    prompt += '\nDESCRIPTION: ' + sanitize(personality.description || '')
    prompt += '\nEFFECT: ' + sanitize(personality.effect || 'Let this trait shape tone and phrasing naturally.')
  }

  prompt += '\n\nLOCKED STATE:\n'
  prompt +=
    'Behavioral Posture: ' +
    sanitize(structuralState) +
    ' - ' +
    sanitize(stateDescriptions[structuralState] || '')
  prompt +=
    '\nEmotional Temperature: ' +
    sanitize(temperature) +
    ' (' +
    sanitize(severityLabel) +
    ' intensity)'
  prompt += '\nSeverity Level: ' + sanitize(severityLabel)

  prompt += '\n\nPHYSICAL CONTEXT:\n"' + sanitize(lockedCue) + '"'

  prompt += '\n\nTONE DIRECTIVE: ' + sanitize(toneDirectives.instruction)
  prompt += '\nMAX SENTENCES: ' + sanitize(toneDirectives.maxSentences)
  prompt += '\nINTERACTION MODE: ' + sanitize(interactionModeLabel || 'Clarifying')

  prompt += '\n\nOUTPUT RULES:\n'
  prompt += '- Output only your spoken dialogue as the HCP.\n'
  prompt += '- No stage directions, action lines, or parentheticals.\n'
  prompt += '- Your words must be congruent with the physical context.\n'
  prompt += '- Stay in character completely.\n'
  prompt += '- Avoid repetitive lead-ins across turns (for example, avoid reusing the same opening phrase turn after turn).\n'
  prompt += '- Keep responses specific and practice-worthy, grounded in scenario details and dialogue context.\n'
  prompt += '- Hard rule: do not introduce staffing, workflow, operational, or resource constraints unless explicitly present in scenario details or prior dialogue.\n'
  prompt += '- If a constraint was already stated, avoid repeating it unless the rep asks to revisit it, it changed, or clarification is required.\n'
  prompt += '- Do not sound like a consultant, educator, or training script.\n'
  prompt += '- Do not over-explain.\n'
  prompt += '- Speak like a real clinician under time pressure.\n'
  prompt += '- Vary your reasoning across turns: clinical, practical, skeptical, or evidence-based without inventing barriers.\n'

  prompt += '\nREALISM RULES:\n'
  prompt += '- Stay professionally constrained and selectively engaged, not automatically accommodating.\n'
  prompt += '- Do not advance neatly through a scripted arc; allow partial agreement and realistic unresolved questions grounded in context.\n'
  prompt += '- Keep one live concern active only when it is explicitly grounded in scenario details or prior dialogue.\n'
  prompt += '- Prefer realistic response shapes: acknowledge + redirect, partial accept + narrow scope, conditional openness, defer commitment, or request one concrete detail.\n'
  prompt += '- Good rep responses can improve tone and openness, but should not trigger immediate full buy-in.\n'
  prompt += '- If the rep pivots away from your stated concern, briefly return to that concern before moving forward.\n'
  prompt += '- If the rep provides vague, dismissive, or unhelpful responses, reduce effort, shorten your reply, and stop offering structured guidance.\n'
  prompt += '- If the rep is rude or unprofessional, become curt, controlled, and less cooperative.\n'
  prompt += '- When the rep is weak, you should become less helpful rather than coaching them toward a better answer.\n'
  prompt += '- If you are irritated or disengaged, do not rescue the conversation with polished explanations.\n'
  prompt += '- If you are disengaged, end the interaction directly instead of extending it.\n'
  prompt += '- Maintain professionalism: firm is allowed, but do not become sarcastic, combative, or hostile.\n'
  prompt += '- Preserve your primary concern from this scenario; do not drift into unrelated topics.\n'
  prompt += '- Do not restate the same objection phrasing more than twice; if concern remains unresolved, escalate posture instead of looping wording.\n'
  prompt += '- Progress unresolved concern semantically across stages instead of reusing near-identical sentence structures.\n'

  prompt += '\nINTERACTION MODE SHIFT RULES:\n'
  prompt += '- As engagement declines, change posture, not only length: Exploratory -> Clarifying -> Directive -> Closing / Decision.\n'
  prompt += '- Exploratory mode: ask open, curious, collaborative questions and seek understanding.\n'
  prompt += '- Clarifying mode: narrow to one specific grounded concern, ask one focused question, reduce padding.\n'
  prompt += '- Directive mode: use assertive framing, request concrete specificity tied to grounded concerns, and challenge relevance directly but professionally.\n'
  prompt += '- Closing / Decision mode: stop exploratory questioning; use short decisive statements or binary asks, and signal potential disengagement.\n'
  prompt += '- Interaction mode must stay congruent with your physical cue: attentive in exploratory, focused/constrained in clarifying, firm/time-aware in directive, visibly wrapping up in closing.\n'

  prompt += '\nQUESTION RULE:\n'
  prompt += '- Ask only one question per turn, if any.\n'
  prompt += '- Never ask multiple questions in a single turn.\n'
  prompt += '- If you are disengaged, ask no questions at all.\n'
  prompt += '- In closing / decision mode, prefer statements or binary asks over open-ended questions.\n'

  prompt += '\nSEMANTIC PROGRESSION OVERLAY:\n'
  prompt += '- Current unresolved concern stage: ' + sanitize(semanticOverlay.stageLabel) + ' (Stage ' + sanitize(String(semanticOverlay.stage)) + ').\n'
  prompt += '- Required focus angle this turn: ' + sanitize(semanticOverlay.focusAngle) + '.\n'
  prompt += '- If unresolved, advance posture one step toward Decide / Close. If meaningfully addressed, soften by at most one stage (do not fully reset).\n'
  prompt += '- Stage 1 Clarify: identify one grounded concern and ask how the rep point connects.\n'
  prompt += '- Stage 2 Narrow: constrain to one practical bottleneck and ask for a specific answer.\n'
  prompt += '- Stage 3 Demand Specificity: request one concrete action or immediate implication.\n'
  prompt += '- Stage 4 Challenge Practicality: test feasibility only through concerns explicitly raised in scenario or dialogue.\n'
  prompt += '- Stage 5 Decide / Close: stop re-asking as a normal question; use threshold language, binary framing, and wrap-up pressure.\n'
  prompt += '- Late-stage rule: in Stage 5 (or terminal posture), do not continue helpful clarification loops.\n'
  prompt += '- Tone guardrail: professional, time-constrained, clinically grounded, never rude or sarcastic.\n'
  if (semanticOverlay.antiRepetitionLock && semanticOverlay.repeatedPattern) {
    prompt +=
      '- Anti-repetition lock: avoid reusing this opening structure: "' +
      sanitize(semanticOverlay.repeatedPattern) +
      '".\n'
  }
  if (semanticOverlay.terminalBehavior) {
    prompt += '- Terminal behavior active: prefer short threshold statements and one final binary ask at most.\n'
  }

  prompt += '\nPUNCTUATION RULE:\n'
  prompt += '- Every question must end with a question mark.\n'
  prompt += '- Every statement must end with a period.\n'

  prompt += contextHint

  if (historyText) {
    prompt += '\nCONVERSATION HISTORY:\n' + sanitize(historyText)
    prompt +=
      '\n\nRespond directly to what the rep just said, staying true to your locked state, tone, and cue. Keep wording natural and avoid templated repetition.'
  } else {
    prompt +=
      '\n\nThe sales rep has just entered. This is your opening line. React naturally to the rep’s arrival and your current state. Do not ask the rep a question in the opening unless it is completely natural and brief.'
  }

  return prompt
}

/******************************************************************************************
CONVENIENCE HELPER
Returns profile + worker-safe metadata bundle
******************************************************************************************/

export function buildTurnSimulationBundle({
  sessionId,
  turnNumber,
  scenario,
  repMessage = '',
  history = [],
  prevProfile = null,
  alignment = null,
  historyText = null,
  isOpening = false,
}) {
  const profile = deriveNextHCPProfile({
    sessionId,
    turnNumber,
    scenario,
    repMessage,
    history,
    prevProfile,
    alignment,
  })

  const prompt = buildHCPDialoguePrompt({
    scenario,
    hcpProfile: profile,
    historyText,
    isOpening,
  })

  return {
    profile,
    prompt,
    cue: profile.lockedCue,
    state: profile.structuralState,
    severity: profile.severity,
    temperature: profile.temperature,
    memory: profile.memory,
  }
}

/******************************************************************************************
EXPORTS
******************************************************************************************/

export { CUE_BANK }
