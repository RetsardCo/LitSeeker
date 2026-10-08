const test = require('node:test');
const assert = require('node:assert/strict');
const { formatAPA7, formatIEEE, formatBibTeX, formatInText, generateCitations } = require('../lib/citation');

const mockPaper = {
  id: 'test-p1',
  title: 'Automated Plant Disease Detection Using Convolutional Neural Networks and Edge Computing',
  publicationYear: 2023,
  authors: ['Arun K. Sharma', 'Maria V. Santos'],
  journal: 'IEEE Internet of Things Journal',
  doi: 'https://doi.org/10.1109/JIOT.2023.3289012',
  url: 'https://arxiv.org/pdf/2304.09812.pdf'
};

test('Citation: APA 7th Edition formats correctly with 2 authors and DOI', () => {
  const apa = formatAPA7(mockPaper);
  assert.ok(apa.includes('Sharma, A. K., & Santos, M. V.'), `Expected author format in: ${apa}`);
  assert.ok(apa.includes('(2023).'), `Expected year format in: ${apa}`);
  assert.ok(apa.includes('IEEE Internet of Things Journal.'), `Expected journal in: ${apa}`);
  assert.ok(apa.includes('https://doi.org/10.1109/JIOT.2023.3289012'), `Expected DOI link in: ${apa}`);
});

test('Citation: IEEE formats correctly with numbered format and quotes', () => {
  const ieee = formatIEEE(mockPaper, 1);
  assert.ok(ieee.startsWith('[1]'), `Expected starting [1] in: ${ieee}`);
  assert.ok(ieee.includes('A. K. Sharma and M. V. Santos'), `Expected IEEE author initials in: ${ieee}`);
  assert.ok(ieee.includes('"Automated Plant Disease Detection Using Convolutional Neural Networks and Edge Computing,"'), `Expected quoted title in: ${ieee}`);
  assert.ok(ieee.includes('doi: 10.1109/JIOT.2023.3289012.'), `Expected DOI in: ${ieee}`);
});

test('Citation: BibTeX produces valid article entry', () => {
  const bib = formatBibTeX(mockPaper);
  assert.ok(bib.startsWith('@article{'), `Expected @article in: ${bib}`);
  assert.ok(bib.includes('author    = {Sharma, Arun K. and Santos, Maria V.}'), `Expected author in: ${bib}`);
  assert.ok(bib.includes('year      = {2023}'), `Expected year in: ${bib}`);
  assert.ok(bib.includes('doi       = {10.1109/JIOT.2023.3289012}'), `Expected doi in: ${bib}`);
});

test('Citation: In-text citations produce parenthetical and narrative styles', () => {
  const inText = formatInText(mockPaper);
  assert.equal(inText.parenthetical, '(Sharma & Santos, 2023)');
  assert.equal(inText.narrative, 'Sharma and Santos (2023)');
});

test('Citation: generateCitations creates full bundle', () => {
  const bundle = generateCitations(mockPaper);
  assert.ok(bundle.apa7);
  assert.ok(bundle.ieee);
  assert.ok(bundle.mla9);
  assert.ok(bundle.chicago);
  assert.ok(bundle.harvard);
  assert.ok(bundle.bibtex);
  assert.ok(bundle.inText);
});
