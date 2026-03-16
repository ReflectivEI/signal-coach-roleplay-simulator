import Ajv from 'ajv';

export const CANONICAL_METRICS_VERSION = 'SI-v2-locked-2026';

const METRIC_IDS = [
  'question_quality',
  'listening_responsiveness',
  'making_it_matter',
  'customer_engagement_cues',
  'objection_handling',
  'conversation_control',
  'adaptability',
  'commitment_gaining',
];

const metricResultSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'score', 'components', 'metricsVersion'],
  properties: {
    id: { enum: METRIC_IDS },
    score: { type: 'number', minimum: 1, maximum: 5 },
    components: {
      type: 'object',
      minProperties: 1,
      additionalProperties: { type: 'number', minimum: 1, maximum: 5 },
    },
    metricsVersion: { const: CANONICAL_METRICS_VERSION },
  },
};

const schema = {
  type: 'array',
  minItems: 8,
  maxItems: 8,
  uniqueItems: true,
  items: metricResultSchema,
  allOf: METRIC_IDS.map((id) => ({
    contains: {
      type: 'object',
      required: ['id'],
      properties: { id: { const: id } },
    },
  })),
};

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

export function validateMetricResults(metricResults) {
  const valid = validate(metricResults);
  if (!valid) {
    const details = ajv.errorsText(validate.errors, { separator: '; ' });
    throw new Error(`Signal Intelligence schema validation failed: ${details}`);
  }
  return true;
}
