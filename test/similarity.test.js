const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenize, scorePaperSimilarity } = require('../lib/similarity');

test('Similarity: Tokenizer filters stop words and normalizes tokens', () => {
  const tokens = tokenize('The proposed system is an investigation of convolutional neural networks for edge computing');
  assert.ok(tokens.includes('convolutional'));
  assert.ok(tokens.includes('neural'));
  assert.ok(tokens.includes('networks'));
  assert.ok(tokens.includes('edge'));
  assert.ok(tokens.includes('computing'));
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('is'));
  assert.ok(!tokens.includes('an'));
});

test('Similarity: High semantic match yields high score and shared concepts', () => {
  const query = 'Automated Crop Disease Detection & Pest Classification Using Convolutional Neural Networks on Raspberry Pi';
  
  const relevantPaper = {
    title: 'Convolutional Neural Networks for Plant Leaf Disease Detection on Embedded Devices',
    abstract: 'We implement a lightweight CNN architecture on Raspberry Pi for automated leaf disease detection, achieving 96% accuracy on agricultural crops.',
    authors: ['Santos, M.']
  };

  const unrelatedPaper = {
    title: 'Macroeconomic Impact of Inflation Rates on Housing Markets in Western Europe',
    abstract: 'This paper examines econometric regressions of mortgage interest rates and macroeconomic volatility in residential real estate.',
    authors: ['Miller, J.']
  };

  const scoreRelevant = scorePaperSimilarity(query, relevantPaper);
  const scoreUnrelated = scorePaperSimilarity(query, unrelatedPaper);

  assert.ok(scoreRelevant.score > scoreUnrelated.score, `Relevant (${scoreRelevant.score}) should exceed Unrelated (${scoreUnrelated.score})`);
  assert.ok(scoreRelevant.score >= 50, `Expected score >= 50, got ${scoreRelevant.score}`);
  assert.ok(scoreRelevant.sharedTerms.length >= 2, `Expected shared terms, got: ${scoreRelevant.sharedTerms.join(', ')}`);
});
