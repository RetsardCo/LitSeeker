const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeResearchPaper } = require('../lib/research_intelligence');
const { compareStudyToProfile, generateSampleSizeJustificationReport, DEFAULT_SAMPLE_RESEARCH_PROFILE } = require('../lib/research_profile');

test('Research Intelligence: Extracts research design only when evidence exists', () => {
  const paper = {
    title: 'Controlled Experimental Evaluation of Low-Power Cryptographic Accelerators',
    abstract: 'This paper adopts an experimental evaluation of cryptographic throughput on custom ASICs.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  assert.ok(analysis.researchDesign.primary.toLowerCase().includes('experimental'));
  assert.ok(analysis.researchDesign.matchedDetails.length > 0);
  assert.ok(analysis.researchDesign.matchedDetails[0].confidence > 0.5);
});

test('Research Intelligence: Distinguishes sampling technique from study design', () => {
  const paper = {
    title: 'Entropy Harvesting Using Purposive Selection of Representative Hardware Endpoints',
    abstract: 'We employ purposive selection of representative hardware platforms with repeated restart sessions.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  assert.equal(analysis.samplingDesign.samplingTechnique.isProbability, false);
  assert.ok(analysis.samplingDesign.samplingTechnique.name.toLowerCase().includes('purposive') ||
            analysis.samplingDesign.samplingTechnique.name.toLowerCase().includes('representative'));
  assert.notEqual(analysis.samplingDesign.samplingTechnique.name, analysis.researchDesign.primary);
});

test('Research Intelligence: Separates independent physical devices from repeated measurements', () => {
  const paper = {
    title: 'Jitter Entropy Characterization on Hardware Endpoints',
    abstract: 'We evaluated 2 physical endpoints with 10 restart sessions collecting 1,000,000 raw measurements each, totaling 10,000,000 observations.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  const sampling = analysis.samplingDesign.sampleSize;

  assert.equal(sampling.independentDevices, 2);
  assert.equal(sampling.restartSessions, 10);
  assert.equal(sampling.observationsPerSession, 1000000);
  assert.equal(sampling.totalRawObservations, 10000000);

  // Warning must be generated for small hardware sample with repeated observations
  assert.ok(analysis.samplingDesign.hardwareGeneralizabilityWarning !== null);
  assert.ok(analysis.samplingDesign.hardwareGeneralizabilityWarning.message.includes('reflect repeated observations'));
});

test('Research Intelligence: Missing sample-size information is explicitly marked as Not Reported or Requires Review', () => {
  const paper = {
    title: 'Theoretical Notes on Algorithmic Entropy Bounds',
    abstract: 'This paper discusses mathematical properties of min-entropy without empirical data collection.'
  };
  const analysis = analyzeResearchPaper(paper, '', false);
  const sampling = analysis.samplingDesign.sampleSize;
  assert.equal(sampling.independentUnitsCount, null);
  assert.ok(sampling.status.includes('Partially Reported') || sampling.status.includes('Not Reported'));
});

test('Research Intelligence: Derived calculations show formula and inputs', () => {
  const paper = {
    title: 'Restart Testing Protocol for Entropy Validation',
    abstract: 'The experiment used 5 restarts and collected 20,000 samples per restart.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  const calc = analysis.samplingDesign.sampleSize.derivedCalculation;
  assert.ok(calc !== null);
  assert.equal(calc.calculatedValue, 100000);
  assert.ok(calc.formula.includes('Restart Sessions × Samples per Session'));
  assert.equal(calc.inputs.restartSessions, 5);
  assert.equal(calc.inputs.observationsPerSession, 20000);
});

test('Research Intelligence: Distinguishes author-reported limitations from inferred threats to validity', () => {
  const paper = {
    title: 'Evaluation of TPM 2.0 Chips',
    abstract: 'A limitation of our study is the lack of testing on ARM architectures. The prototype was evaluated on Intel.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  assert.ok(analysis.limitationsAndGaps.authorReportedLimitations.length > 0);
  assert.ok(analysis.limitationsAndGaps.authorReportedLimitations[0].source.includes('Author'));

  // Inferred threats to validity must be labeled as analytical observations
  assert.ok(analysis.limitationsAndGaps.threatsToValidity.length > 0);
  assert.ok(analysis.limitationsAndGaps.threatsToValidity[0].nature.includes('Analytical Observation'));
});

test('Research Intelligence: Abstract-only analysis does not fabricate full-text details', () => {
  const paper = {
    title: 'Preliminary Study on Random Noise',
    abstract: 'We present preliminary observations of noise sources.'
  };
  const analysis = analyzeResearchPaper(paper, '', false);
  assert.equal(analysis.analysisScope.isFullTextAvailable, false);
  assert.equal(analysis.analysisScope.scopeNotice, 'Abstract-only analysis; full-text examination required for complete protocol validation.');
});

test('Research Intelligence: NIST SP 800-90B validation protocols are extracted with specific standard requirements', () => {
  const paper = {
    title: 'Entropy Validation According to NIST SP 800-90B',
    abstract: 'We collected 1,000,000 samples and performed restart testing and initial entropy estimation per NIST SP 800-90B.'
  };
  const analysis = analyzeResearchPaper(paper, '');
  assert.ok(analysis.technicalProtocol.standardsCompliance !== null);
  assert.ok(analysis.technicalProtocol.standardsCompliance.standard.includes('800-90B'));
  assert.equal(analysis.technicalProtocol.standardsCompliance.restartTestingEvaluated, true);
});

test('Methodology Matcher: Ranks comparable studies by methodology, not just title keywords', () => {
  const profile = DEFAULT_SAMPLE_RESEARCH_PROFILE;

  // Study A: Exact methodological match (hardware endpoints, restart sessions, NIST SP 800-90B)
  const studyA = {
    id: 'study-a',
    title: 'Characterization of Hardware Noise on 2 Endpoints with NIST SP 800-90B Restart Testing',
    abstract: 'We evaluate 2 independent physical endpoints using purposive selection with 10 restart sessions and NIST SP 800-90B min-entropy estimators.'
  };

  // Study B: High title similarity but different methodology (human participant survey about security)
  const studyB = {
    id: 'study-b',
    title: 'Machine-Learning–Assisted Entropy Estimation and Fusion Survey of 500 Participants',
    abstract: 'We surveyed 500 IT administrators regarding their perception of entropy estimation and TPM-bound cryptographic key generation.'
  };

  const compA = compareStudyToProfile(profile, studyA);
  const compB = compareStudyToProfile(profile, studyB);

  assert.ok(compA.comparabilityScore > compB.comparabilityScore, 'Methodological match should score higher than survey with title keywords');
  assert.equal(compA.classification.level, 'Direct Methodological Match');
  assert.notEqual(compB.classification.level, 'Direct Methodological Match');
});

test('Sample-Size Justification: Does not claim sample size is adequate solely because previous study used it', () => {
  const profile = DEFAULT_SAMPLE_RESEARCH_PROFILE;
  const study = {
    id: 'study-1',
    title: 'Silicon Noise Measurement on Two Workstations',
    abstract: 'We purposively tested 2 physical endpoints across 10 restart runs.'
  };

  const report = generateSampleSizeJustificationReport(profile, [study]);
  assert.ok(report.draftRationale.includes('does NOT constitute statistical proof of generalizability'));
  assert.ok(report.whatEvidenceSupports.length > 0);
  assert.ok(report.whatEvidenceDoesNotEstablish.length > 0);
  assert.ok(report.whatEvidenceDoesNotEstablish.some(item => item.includes('generalization to all hardware')));
});
