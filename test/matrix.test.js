const test = require('node:test');
const assert = require('node:assert/strict');
const { extractMethodology, extractObjective, extractFindings, generateMatrixRow } = require('../lib/matrix');

test('Matrix: Detects technical methodologies correctly', () => {
  const method = extractMethodology(
    'YOLOv8 and Raspberry Pi Implementation for Real-Time Pest Detection',
    'We deployed a YOLO object detection model on a Raspberry Pi edge computer coupled with IoT sensors.'
  );
  assert.ok(method.includes('YOLO Object Detection') || method.includes('IoT & Embedded Hardware'), `Method: ${method}`);
});

test('Matrix: Extracts objective and key findings from paper', () => {
  const title = 'Automated Aquaponics Water Quality Controller';
  const abstract = 'This research develops a full-stack IoT monitoring system. Experimental results show 99.1% uptime and 38% reduction in fish mortality.';
  
  const obj = extractObjective(title, abstract);
  const findings = extractFindings(abstract);

  assert.ok(obj.length > 5, 'Expected objective');
  assert.ok(findings.includes('99.1%') || findings.includes('mortality'), `Findings: ${findings}`);
});

test('Matrix: Generates full matrix row structure', () => {
  const paper = {
    id: 'mat-test-1',
    title: 'Smart Agriculture Disease Classifier',
    publicationYear: 2024,
    authors: ['Gomez, C.', 'Ramos, D.'],
    journal: 'Computers and Electronics in Agriculture',
    doi: '10.1016/j.compag.2024.1001',
    abstract: 'This paper aims to build a deep learning classifier. The system achieved 98% accuracy on test leaves.'
  };

  const row = generateMatrixRow(paper, 'Crop disease detection');
  assert.equal(row.id, 'mat-test-1');
  assert.equal(row.authorYear, 'Gomez & Ramos (2024)');
  assert.ok(row.objective);
  assert.ok(row.methodology);
  assert.ok(row.findings);
  assert.ok(row.researchGap);
});
