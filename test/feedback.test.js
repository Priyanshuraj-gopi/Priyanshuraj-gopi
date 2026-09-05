const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyFeedbackText } = require('../src/feedback');

test('classifies category and positive sentiment', () => {
  const results = classifyFeedbackText('The room was clean and service was excellent.');
  assert.ok(results.length >= 1);
  assert.equal(results[0].category, 'room');
  assert.equal(results[0].sentiment, 'positive');
  assert.equal(results[0].quality, 'good');
});

test('flags negative billing issue', () => {
  const results = classifyFeedbackText('The billing process was terrible and expensive.');
  assert.equal(results[0].category, 'billing');
  assert.equal(results[0].sentiment, 'negative');
  assert.equal(results[0].quality, 'not good');
});
