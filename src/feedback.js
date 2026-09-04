const CATEGORY_RULES = [
  { category: 'room', terms: ['room', 'bed', 'ac', 'air conditioning', 'linen', 'housekeeping'] },
  { category: 'food', terms: ['food', 'breakfast', 'dinner', 'lunch', 'restaurant', 'taste'] },
  { category: 'service', terms: ['service', 'support', 'help', 'responsive', 'staff'] },
  { category: 'hygiene', terms: ['clean', 'dirty', 'hygiene', 'sanitary', 'smell'] },
  { category: 'billing', terms: ['bill', 'billing', 'invoice', 'charge', 'payment'] },
  { category: 'staff behavior', terms: ['rude', 'polite', 'courteous', 'behavior', 'attitude'] },
  { category: 'amenities', terms: ['pool', 'spa', 'gym', 'wifi', 'amenity', 'towel'] },
];

const POSITIVE_TERMS = [
  'good',
  'great',
  'excellent',
  'amazing',
  'clean',
  'friendly',
  'quick',
  'comfortable',
  'delicious',
  'helpful',
  'smooth',
  'satisfied',
  'happy',
];

const NEGATIVE_TERMS = [
  'bad',
  'poor',
  'dirty',
  'slow',
  'rude',
  'late',
  'noisy',
  'terrible',
  'unhappy',
  'issue',
  'problem',
  'expensive',
  'disappointed',
];

function splitFeedback(text) {
  return text
    .split(/[.!?]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => lower.includes(term))) {
      return rule.category;
    }
  }
  return 'general';
}

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const positiveScore = POSITIVE_TERMS.reduce(
    (total, term) => total + (lower.includes(term) ? 1 : 0),
    0,
  );
  const negativeScore = NEGATIVE_TERMS.reduce(
    (total, term) => total + (lower.includes(term) ? 1 : 0),
    0,
  );

  if (positiveScore > negativeScore) {
    return {
      sentiment: 'positive',
      quality: 'good',
      confidence: Math.min(0.55 + (positiveScore - negativeScore) * 0.1, 0.98),
    };
  }

  if (negativeScore > positiveScore) {
    return {
      sentiment: 'negative',
      quality: 'not good',
      confidence: Math.min(0.55 + (negativeScore - positiveScore) * 0.1, 0.98),
    };
  }

  return {
    sentiment: 'neutral',
    quality: 'not good',
    confidence: 0.5,
  };
}

function classifyFeedbackText(text) {
  const segments = splitFeedback(text);
  return segments.map((segment) => {
    const sentimentResult = analyzeSentiment(segment);
    return {
      text: segment,
      category: detectCategory(segment),
      ...sentimentResult,
    };
  });
}

module.exports = {
  classifyFeedbackText,
  analyzeSentiment,
  detectCategory,
  splitFeedback,
};
