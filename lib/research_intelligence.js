/**
 * Research Intelligence and Methodology Extraction Engine
 * Extracts deep methodology, sampling design, statistical methods, technical protocols,
 * findings, and limitations from academic papers with evidence traceability and provenance.
 */

// Controlled Vocabulary for Research Designs
const RESEARCH_DESIGNS = [
  { id: 'quantitative_experimental', label: 'Quantitative Experimental', regex: /\b(controlled experiment|experimental evaluation|experimental design|experimental study)\b/i },
  { id: 'quantitative_quasi_experimental', label: 'Quasi-Experimental', regex: /\b(quasi-experimental|non-equivalent control|pre-test post-test)\b/i },
  { id: 'benchmarking_evaluation', label: 'Benchmarking & Performance Evaluation', regex: /\b(benchmark(?:ing)?|performance evaluation|comparative evaluation|ablation study)\b/i },
  { id: 'entropy_validation', label: 'Entropy-Source Characterization & Validation', regex: /\b(entropy source|min-entropy|nist sp 800-90b|sp 800-90b|restart test|health test|true random)\b/i },
  { id: 'system_development', label: 'System Development & Design Science', regex: /\b(design science|system development life cycle|sdlc|prototype development|system architecture)\b/i },
  { id: 'computational_evaluation', label: 'Computational / Algorithmic Evaluation', regex: /\b(computational evaluation|algorithm evaluation|complexity analysis|simulation study)\b/i },
  { id: 'security_evaluation', label: 'Security & Vulnerability Evaluation', regex: /\b(security evaluation|vulnerability analysis|threat model|attack surface|penetration testing)\b/i },
  { id: 'survey_descriptive', label: 'Survey / Descriptive Research', regex: /\b(survey|questionnaire|cross-sectional|descriptive study|likert scale)\b/i },
  { id: 'observational_correlational', label: 'Observational / Correlational', regex: /\b(observational|correlational|regression analysis|longitudinal)\b/i },
  { id: 'qualitative_study', label: 'Qualitative Research / Case Study', regex: /\b(case study|qualitative|thematic analysis|grounded theory|phenomenological)\b/i }
];

// Sampling Unit Patterns
const SAMPLING_UNIT_PATTERNS = [
  { unit: 'Physical Hardware Devices / Endpoints', regex: /\b(\d+)\s*(?:independent\s+)?(?:physical\s+)?(?:devices|endpoints|machines|hardware units|platforms|nodes|laptops|microcontrollers|esp32|raspberry pi)\b/i },
  { unit: 'Hardware Models / Chips', regex: /\b(\d+)\s*(?:hardware\s+)?(?:models|chipsets|cpus|processors|tpm chips|sensors)\b/i },
  { unit: 'Human Participants', regex: /\b(\d+)\s*(?:participants|subjects|students|users|patients|respondents|individuals)\b/i },
  { unit: 'Datasets / Repositories', regex: /\b(\d+)\s*(?:benchmark\s+)?(?:datasets|data sets|corpora|code repositories|software projects)\b/i },
  { unit: 'Images / Video Frames', regex: /\b(\d+[\d,]*)\s*(?:images|photographs|frames|samples|video sequences)\b/i },
  { unit: 'Network Packets / Traffic Flows', regex: /\b(\d+[\d,]*)\s*(?:packets|network flows|sessions|requests|transactions)\b/i },
  { unit: 'Experimental Runs / Trials', regex: /\b(\d+)\s*(?:independent\s+)?(?:runs|trials|experimental repetitions|iterations)\b/i },
  { unit: 'Restart-Based Data Sessions', regex: /\b(\d+)\s*(?:restart(?:s)?|reboot sessions|power cycles|restart-based sessions)\b/i }
];

// Sampling Technique Patterns
const SAMPLING_TECHNIQUES = [
  { technique: 'Purposive / Judgmental Selection', regex: /\b(purposive|purposively selected|judgmental|selected to represent|representative endpoints|representative hardware)\b/i, isProbability: false },
  { technique: 'Selection of Representative Hardware Platforms', regex: /\b(representative (?:hardware|endpoints|platforms|test-bed|devices)|representative intel and amd)\b/i, isProbability: false },
  { technique: 'Convenience Sampling', regex: /\b(convenience sample|convenience sampling|readily available|available devices)\b/i, isProbability: false },
  { technique: 'Benchmark / Standardized Dataset Selection', regex: /\b(benchmark dataset|curated benchmark|standard dataset|public dataset|cifar|imagenet|nist)\b/i, isProbability: false },
  { technique: 'Simple Random Sampling', regex: /\b(simple random sampling|randomly sampled|random selection)\b/i, isProbability: true },
  { technique: 'Stratified Random Sampling', regex: /\b(stratified sampling|stratified random)\b/i, isProbability: true },
  { technique: 'Repeated-Measures / Repeated-Run Design', regex: /\b(repeated measures|repeated trials|repeated-run|within-subject|restart-based data collection)\b/i, isProbability: false }
];

/**
 * Extracts research design classifications from text
 */
function classifyResearchDesign(title, abstract, fullText = '') {
  const combined = `${title} ${abstract} ${fullText}`.toLowerCase();
  const matched = [];

  for (const item of RESEARCH_DESIGNS) {
    if (item.regex.test(combined)) {
      matched.push({
        id: item.id,
        label: item.label,
        evidence: `Identified by methodological indicators matching "${item.label}"`,
        confidence: item.id === 'entropy_validation' && combined.includes('nist') ? 0.95 : 0.82
      });
    }
  }

  if (matched.length === 0) {
    matched.push({
      id: 'quantitative_empirical',
      label: 'Quantitative Empirical Evaluation',
      evidence: 'Default classification based on empirical scientific structure',
      confidence: 0.65
    });
  }

  const primary = matched[0];
  const secondary = matched.slice(1);

  return {
    primary: primary.label,
    primaryId: primary.id,
    secondary: secondary.map(s => s.label),
    matchedDetails: matched,
    isExplicitlyReported: /this study adopts a|we employ a (quantitative|experimental|quasi-experimental) design/i.test(combined)
  };
}

/**
 * Extracts population, sampling units, sample size, and sampling technique
 */
function extractPopulationAndSampling(title, abstract, fullText = '', isFullTextAvailable = false) {
  const text = `${title} ${abstract} ${fullText}`;

  // 1. Identify Sampling Units
  const detectedUnits = [];
  for (const p of SAMPLING_UNIT_PATTERNS) {
    const match = text.match(p.regex);
    if (match) {
      const rawCount = match[1].replace(/,/g, '');
      const count = parseInt(rawCount, 10);
      detectedUnits.push({
        unit: p.unit,
        count: isNaN(count) ? null : count,
        rawMatch: match[0]
      });
    }
  }

  // 2. Identify Sampling Technique
  let detectedTechnique = {
    name: 'Not Explicitly Reported',
    category: 'Unknown',
    isProbability: false,
    status: isFullTextAvailable ? 'Not Reported' : 'Requires Full-Text Review',
    evidence: 'No explicit probability or non-probability sampling method stated in abstract.'
  };

  for (const st of SAMPLING_TECHNIQUES) {
    if (st.regex.test(text)) {
      detectedTechnique = {
        name: st.technique,
        category: st.isProbability ? 'Probability Sampling' : 'Non-Probability / Purposive Sampling',
        isProbability: st.isProbability,
        status: 'Explicitly Reported',
        evidence: `Matched sampling descriptor: "${st.technique}"`
      };
      break;
    }
  }

  // 3. Technical & Hardware Sample-Size Separation (Independent Units vs Repeated Measurements)
  let independentDevices = null;
  let hardwareModels = null;
  let restartSessions = null;
  let observationsPerSession = null;
  let totalRawObservations = null;
  let humanParticipants = null;

  // Search for devices
  const deviceMatch = text.match(/\b(\d+)\s*(?:independent\s+)?(?:physical\s+)?(?:endpoints|devices|hardware platforms|testbeds|machines)\b/i);
  if (deviceMatch) {
    independentDevices = parseInt(deviceMatch[1], 10);
  }

  // Search for restarts/sessions
  const sessionMatch = text.match(/\b(\d+)\s*(?:restart(?:s)?|sessions|data collection runs|repeated runs)\b/i);
  if (sessionMatch) {
    restartSessions = parseInt(sessionMatch[1], 10);
  }

  // Search for samples per restart or observation counts
  const samplesPerRunMatch = text.match(/\b(\d+[\d,]*)\s*(?:raw\s+)?(?:samples|bytes|measurements|observations)\s*(?:per|each|collected each)\b/i);
  if (samplesPerRunMatch) {
    observationsPerSession = parseInt(samplesPerRunMatch[1].replace(/,/g, ''), 10);
  }

  // Search for total observations
  const explicitTotalMatch = text.match(/\b(?:totaling|total of|combined total of|aggregate of)\s*(\d+[\d,]*)\s*(?:raw\s+)?(?:measurements|observations|samples)\b/i);
  if (explicitTotalMatch) {
    totalRawObservations = parseInt(explicitTotalMatch[1].replace(/,/g, ''), 10);
  } else {
    const totalObsMatch = text.match(/\b(\d+[\d,]*)\s*(?:total\s+)?(?:raw\s+)?(?:measurements|observations|samples|data points|events)\b/i);
    if (totalObsMatch) {
      totalRawObservations = parseInt(totalObsMatch[1].replace(/,/g, ''), 10);
    }
  }

  // Search for human participants
  const humanMatch = text.match(/\b(\d+)\s*(?:participants|subjects|students|respondents)\b/i);
  if (humanMatch) {
    humanParticipants = parseInt(humanMatch[1], 10);
  }

  // 4. Derived Calculation Check (Show formula and inputs when applicable)
  let derivedCalculation = null;
  if (restartSessions && observationsPerSession) {
    const calculatedTotal = restartSessions * observationsPerSession;
    derivedCalculation = {
      formula: 'Total Measurements = Restart Sessions × Samples per Session',
      inputs: {
        restartSessions,
        observationsPerSession
      },
      calculatedValue: calculatedTotal,
      matchesReported: totalRawObservations ? totalRawObservations === calculatedTotal : null,
      status: 'Calculated from Reported Values'
    };
  }

  // 5. Critical Technical Warning: Repeated measurements on few devices must not be confused with many independent units
  let hardwareGeneralizabilityWarning = null;
  if (independentDevices && independentDevices <= 4 && (totalRawObservations || restartSessions)) {
    hardwareGeneralizabilityWarning = {
      severity: 'High Caution',
      message: `The study utilizes ${independentDevices} physical hardware endpoint(s) with repeated data collection (${totalRawObservations ? totalRawObservations.toLocaleString() : 'numerous'} measurements). These measurements reflect repeated observations to evaluate within-device temporal stability/noise characteristics, NOT statistical representation across a broad hardware population. Results demonstrate feasibility on the selected endpoints rather than population-wide generalizability.`
    };
  }

  // 6. Target Population and Sampling Frame
  const targetPopMatch = text.match(/(?:target population|population of interest|evaluated on)\s*(?:is|was|comprises|consisted of)?\s*([^.;]+)/i);
  const targetPopulation = targetPopMatch 
    ? targetPopMatch[1].trim() 
    : (independentDevices ? 'Commercial Hardware Endpoints' : (humanParticipants ? 'Recruited Research Cohort' : (isFullTextAvailable ? 'Not Reported' : 'Requires Full-Text Review')));

  return {
    samplingUnit: detectedUnits.length > 0 ? detectedUnits[0].unit : (humanParticipants ? 'Human Participants' : (independentDevices ? 'Physical Hardware Devices' : 'System Evaluation Instances')),
    allDetectedUnits: detectedUnits,
    samplingTechnique: detectedTechnique,
    targetPopulation,
    sampleSize: {
      independentUnitsCount: independentDevices || humanParticipants || null,
      independentUnitsType: independentDevices ? 'Physical Devices' : (humanParticipants ? 'Human Participants' : 'Units'),
      humanParticipants,
      independentDevices,
      hardwareModels,
      restartSessions,
      observationsPerSession,
      totalRawObservations,
      derivedCalculation,
      status: (independentDevices || humanParticipants || totalRawObservations) ? 'Explicitly Reported' : (isFullTextAvailable ? 'Not Reported' : 'Partially Reported (Abstract Only)')
    },
    hardwareGeneralizabilityWarning
  };
}

/**
 * Extracts Sample-Size Justification and Rationale
 */
function extractSampleSizeJustification(title, abstract, fullText = '', isFullTextAvailable = false) {
  const text = `${title} ${abstract} ${fullText}`;

  const justifications = [];

  // 1. Power Analysis Check
  const powerMatch = text.match(/\b(power analysis|g\*power|statistical power of 0\.\d+|alpha\s*=\s*0\.\d+|effect size\s*(?:d|f|r)\s*=\s*0\.\d+)\b/i);
  if (powerMatch) {
    justifications.push({
      type: 'A Priori Statistical Power Analysis',
      explicit: true,
      evidence: powerMatch[0],
      description: 'Sample size determined via formal statistical power computation'
    });
  }

  // 2. Standards-Based Validation (e.g. NIST SP 800-90B)
  const nistMatch = text.match(/\b(nist sp 800-90b|sp 800-90b|1,000,000 samples|restart testing|initial entropy estimation)\b/i);
  if (nistMatch) {
    justifications.push({
      type: 'Standards-Based Validation Protocol',
      standard: 'NIST SP 800-90B Recommendation for the Entropy Sources Used for Random Bit Generation',
      explicit: true,
      evidence: nistMatch[0],
      description: 'Sample size structured to satisfy official national standards requirements (e.g. 1,000,000 raw samples per test run / restart testing)'
    });
  }

  // 3. Feasibility / Resource / Hardware Availability Constraints
  const resourceMatch = text.match(/\b(feasibility constraints|availability of hardware|limited availability|prototype constraints|resource constraints)\b/i);
  if (resourceMatch) {
    justifications.push({
      type: 'Resource & Feasibility Constraints',
      explicit: true,
      evidence: resourceMatch[0],
      description: 'Sample size constrained by hardware availability, development cost, or operational access'
    });
  }

  // 4. Repeated-Run Noise Characterization
  const noiseMatch = text.match(/\b(characterize (?:temporal|statistical|noise)? variability|multiple restarts|restart-based|across repeated sessions)\b/i);
  if (noiseMatch) {
    justifications.push({
      type: 'Variability & Noise Characterization Design',
      explicit: true,
      evidence: noiseMatch[0],
      description: 'Repeated measurements employed to assess temporal jitter stability rather than cross-device diversity'
    });
  }

  // If no rationale found
  if (justifications.length === 0) {
    return {
      hasExplicitRationale: false,
      status: isFullTextAvailable ? 'Not Reported' : 'Requires Full-Text Review',
      primaryRationale: 'No formal sample-size calculation or justification reported in abstract/methods',
      justifications: [],
      note: 'The researchers reported sample counts without publishing an a priori power calculation or formal justification methodology.'
    };
  }

  return {
    hasExplicitRationale: true,
    status: 'Explicitly Reported',
    primaryRationale: justifications[0].type,
    justifications,
    note: justifications[0].description
  };
}

/**
 * Extracts Technical Protocol, Instruments, and Standards Compliance
 */
function extractTechnicalProtocol(title, abstract, fullText = '', isFullTextAvailable = false) {
  const text = `${title} ${abstract} ${fullText}`;

  // Hardware / Architecture extraction
  const hwMatch = text.match(/\b(raspberry pi \d+|esp32|jetson (?:nano|orin)|arduino|intel [a-z0-9-]+|amd [a-z0-9-]+|tpm 2\.0|tpm|cortex-[a-z0-9]+)\b/gi);
  const hardwareStack = hwMatch ? Array.from(new Set(hwMatch.map(h => h.trim()))) : [];

  // Software / Library / OS extraction
  const swMatch = text.match(/\b(pytorch|tensorflow|opencv|tensorrt|linux|ubuntu|windows|ros|scikit-learn|python|yolov\d+)\b/gi);
  const softwareStack = swMatch ? Array.from(new Set(swMatch.map(s => s.trim()))) : [];

  // Standards compliance
  let standardsCompliance = null;
  if (/nist\s+sp\s*800-90b/i.test(text)) {
    standardsCompliance = {
      standard: 'NIST SP 800-90B',
      title: 'Recommendation for the Entropy Sources Used for Random Bit Generation',
      noiseSource: text.match(/\b(mouse movement|cpu jitter|timer jitter|keystroke|thermal noise|sram)\b/i)?.[0] || 'Hardware timing jitter',
      hasRestartTesting: /restart test/i.test(text),
      restartTestingEvaluated: /restart test/i.test(text),
      hasHealthTesting: /health test/i.test(text),
      hasMinEntropyEstimation: /min-entropy|entropy estimation/i.test(text),
      status: 'Evaluated against NIST SP 800-90B specifications',
      caveat: 'Merely citing NIST SP 800-90B or calculating entropy does not prove formal FIPS 140-3 validation without complete test harness logs.'
    };
  }

  return {
    hardwareStack,
    softwareStack,
    standardsCompliance,
    experimentalSetting: hardwareStack.length > 0 ? 'Embedded / Hardware Evaluation Testbed' : 'Computational Benchmark Environment',
    status: (hardwareStack.length > 0 || softwareStack.length > 0) ? 'Partially Reported' : (isFullTextAvailable ? 'Not Reported' : 'Requires Full-Text Review')
  };
}

/**
 * Extracts Key Findings with structured numerical outcomes and metrics
 */
function extractStructuredFindings(abstract, fullText = '') {
  const text = `${abstract} ${fullText}`;
  const findings = [];

  // Regex patterns for quantitative metrics: Accuracy, Latency, FPS, Power, Entropy, Uptime, Error rates
  const metricPatterns = [
    { type: 'Accuracy / Precision', regex: /(\d+(?:\.\d+)?%)\s*(?:classification\s+)?(?:accuracy|precision|f1-score|recall|mAP)/i, unit: '%' },
    { type: 'Latency / Execution Time', regex: /(\d+(?:\.\d+)?)\s*(ms|milliseconds|seconds|s)\s*(?:inference\s+)?(?:latency|execution time|delay)/i, unit: 'ms' },
    { type: 'Throughput / Speed', regex: /(\d+(?:\.\d+)?)\s*(fps|frames per second|req\/s)/i, unit: 'FPS' },
    { type: 'Reduction / Improvement', regex: /(\d+(?:\.\d+)?%)\s*(?:reduction|improvement|speedup|decrease)/i, unit: '%' },
    { type: 'Reliability / Uptime', regex: /(\d+(?:\.\d+)?%)\s*(?:uptime|availability|success rate)/i, unit: '%' },
    { type: 'Min-Entropy Estimate', regex: /(\d+(?:\.\d+)?)\s*(?:bits? per (?:sample|byte)|min-entropy)/i, unit: 'bits/sample' }
  ];

  for (const p of metricPatterns) {
    const match = text.match(p.regex);
    if (match) {
      findings.push({
        metricType: p.type,
        reportedValue: match[1],
        unit: p.unit,
        rawEvidence: match[0],
        status: 'Explicitly Reported'
      });
    }
  }

  return findings;
}

/**
 * Separates Author-Reported Limitations from Analytical Threats to Validity
 */
function extractLimitationsAndThreats(abstract, fullText = '') {
  const text = `${abstract} ${fullText}`;

  // 1. Author-Acknowledged Limitations
  const authorLimitations = [];
  const limitMatch = text.match(/(?:however|limitation|remains challenging|nonetheless|future work should|requires further investigation)\s+([^.;]+)/i);
  if (limitMatch && limitMatch[1]) {
    authorLimitations.push({
      statement: limitMatch[1].trim(),
      source: 'Author-Reported in Abstract/Discussion',
      status: 'Explicitly Reported'
    });
  }

  // 2. LitSeeker Analytical Threats to Validity (Explicitly labeled as AI analytical observation)
  const analyticalThreats = [];

  // Check limited device coverage
  if (/\b(two|2|single|one|1)\s*(?:endpoints|devices|platforms|machines)\b/i.test(text)) {
    analyticalThreats.push({
      threat: 'External Validity / Hardware Coverage Constraint',
      observation: 'Study tests on a very small set of physical endpoints. While suitable for proof-of-concept feasibility, variance across silicon batches, firmware revisions, and different system architectures remains uncharacterized.',
      type: 'LitSeeker Analytical Observation',
      nature: 'LitSeeker Analytical Observation'
    });
  }

  // Check simulated or synthetic testing
  if (/simulation|synthetic/i.test(text) && !/field test|real-world prototype/i.test(text)) {
    analyticalThreats.push({
      threat: 'Ecological Validity',
      observation: 'Evaluation relies substantially on simulated inputs or controlled synthetic models rather than noisy real-world operating environments.',
      type: 'LitSeeker Analytical Observation',
      nature: 'LitSeeker Analytical Observation'
    });
  }

  // Check lack of reported a priori power
  if (!/power analysis|g\*power/i.test(text)) {
    analyticalThreats.push({
      threat: 'Statistical Conclusion Validity',
      observation: 'No formal a priori statistical power computation reported to justify the chosen sample size or number of test sessions.',
      type: 'LitSeeker Analytical Observation',
      nature: 'LitSeeker Analytical Observation'
    });
  }

  const finalAuthorLimits = authorLimitations.length > 0 ? authorLimitations : [{ statement: 'None explicitly reported in abstract.', source: 'Requires Full-Text Review', status: 'Partially Reported' }];

  return {
    authorLimitations: finalAuthorLimits,
    authorReportedLimitations: finalAuthorLimits,
    analyticalThreats,
    threatsToValidity: analyticalThreats
  };
}

/**
 * Master Research Intelligence Analyzer for a Paper
 * Returns complete, structured data model with 9 sections
 */
function analyzeResearchPaper(paper, fullText = '') {
  const isFullTextAvailable = Boolean(fullText && fullText.length > 500);
  const title = paper.title || '';
  const abstract = paper.abstract || '';

  // Section 1: Study Overview
  const design = classifyResearchDesign(title, abstract, fullText);

  // Section 2: Population, Sampling, and Sample Size
  const sampling = extractPopulationAndSampling(title, abstract, fullText, isFullTextAvailable);

  // Section 3: Sample-Size Justification
  const justification = extractSampleSizeJustification(title, abstract, fullText, isFullTextAvailable);

  // Section 4: Technical Protocol & Standards
  const protocol = extractTechnicalProtocol(title, abstract, fullText, isFullTextAvailable);

  // Section 5: Structured Findings
  const findings = extractStructuredFindings(abstract, fullText);

  // Section 6: Limitations & Threats
  const limits = extractLimitationsAndThreats(abstract, fullText);

  return {
    paperId: paper.id,
    title,
    doi: paper.doi,
    authors: paper.authors || [],
    publicationYear: paper.publicationYear || paper.year,
    journal: paper.journal,
    isFullTextAvailable,
    analysisLevel: isFullTextAvailable ? 'Full-Text Comprehensive Analysis' : 'Abstract-Level Analysis (Requires Full-Text Review)',

    // 1. Study Overview
    studyOverview: {
      researchProblem: paper.abstract ? paper.abstract.slice(0, 180) + '...' : 'Problem statement in abstract unavailable.',
      researchType: design.primary,
      secondaryDesigns: design.secondary,
      discipline: paper.concepts?.[0] || 'Computer Science / Engineering'
    },

    // 2. Research Design
    researchDesign: design,

    // 3. Population & Sampling
    samplingDesign: sampling,

    // 4. Sample Size Details & Justification
    sampleSizeJustification: justification,

    // 5. Technical Protocol & Standards
    technicalProtocol: protocol,

    // 6. Data Analysis & Statistical Methods
    statisticalMethods: {
      hasQuantitativeAnalysis: true,
      methodsIdentified: [
        'Descriptive Benchmarking',
        ...(findings.length > 0 ? ['Performance Metric Evaluation'] : []),
        ...(protocol.standardsCompliance ? ['NIST SP 800-90B Entropy Estimation'] : [])
      ],
      status: isFullTextAvailable ? 'Explicitly Reported' : 'Inferred from Abstract'
    },

    // 7. Structured Findings
    findings,

    // 8. Limitations, Threats & Gaps
    limitations: limits,
    limitationsAndGaps: limits,

    // Scope & Provenance
    analysisScope: {
      isFullTextAvailable: Boolean(isFullTextAvailable),
      scopeNotice: isFullTextAvailable 
        ? 'Comprehensive full-text methodology analysis.' 
        : 'Abstract-only analysis; full-text examination required for complete protocol validation.'
    },

    // 9. Source Evidence & Traceability
    evidenceProvenance: {
      sourceType: isFullTextAvailable ? 'Full Text Article' : 'Abstract Only',
      url: paper.openAccessUrl || paper.doi,
      confidenceScore: isFullTextAvailable ? 0.95 : 0.78,
      verifiedDate: new Date().toISOString()
    }
  };
}

module.exports = {
  analyzeResearchPaper,
  classifyResearchDesign,
  extractPopulationAndSampling,
  extractSampleSizeJustification,
  extractTechnicalProtocol,
  extractStructuredFindings,
  extractLimitationsAndThreats,
  RESEARCH_DESIGNS,
  SAMPLING_UNIT_PATTERNS,
  SAMPLING_TECHNIQUES
};
