/**
 * Research Profile, Methodological Comparability Matcher & Sample-Size Justification Engine
 * Supports structured methodology comparison and evidence-linked sample-size justification reports.
 */

const { analyzeResearchPaper } = require('./research_intelligence');

/**
 * Benchmark Example Research Profile for Cryptographic Hardware / Entropy Research
 */
const DEFAULT_SAMPLE_RESEARCH_PROFILE = {
  id: 'profile-tpm-entropy-01',
  title: 'Machine-Learning–Assisted Entropy Estimation and Fusion for TPM-Bound Cryptographic Key Generation on Representative Intel and AMD Endpoints',
  researchProblem: 'Hardware-based entropy sources exhibit silicon-specific jitter variations and temporal drift, making deterministic key derivation insecure without empirical characterization across distinct CPU architectures.',
  researchObjectives: 'To evaluate entropy extraction efficiency and restart-test stability on Intel and AMD physical endpoints using NIST SP 800-90B validation protocols.',
  discipline: 'Cybersecurity / Cryptographic Engineering / Embedded Systems',
  researchDesign: 'Quantitative, Controlled Technical Evaluation and Entropy-Source Characterization',
  targetDomain: 'Commercial PC/Server Endpoints with Discrete TPM 2.0',
  samplingUnit: 'Physical Hardware Devices / Endpoints',
  samplingTechnique: 'Purposive Selection of Representative Hardware Endpoints',
  independentUnitsCount: 2,
  independentUnitsDescription: 'Two TPM 2.0-supported physical endpoints: one Intel-based and one AMD-based',
  repeatedSessionsCount: 10,
  observationsPerSession: 1000000,
  dataCollectionMethod: 'Restart-based raw measurement collection from mouse movement and CPU timing jitter',
  variablesAndOutcomes: 'Min-entropy estimate (bits/sample), restart test pass/fail, inference latency, key generation throughput',
  analysisMethods: 'NIST SP 800-90B entropy estimators (most common value, collision, Markov, t-tuple), ML feature fusion, health testing',
  validationStandards: 'NIST SP 800-90B Recommendation for the Entropy Sources Used for Random Bit Generation',
  sampleSizeQuestion: 'What published studies use similarly small numbers of physical hardware endpoints while performing repeated measurements or restart-based validation, and what evidence do they provide for their sampling and validation design?'
};

/**
 * Evaluates methodological comparability between a user profile and an analyzed paper
 */
function compareStudyToProfile(profile, paper, fullText = '') {
  const analysis = analyzeResearchPaper(paper, fullText);
  const pSampling = analysis.samplingDesign;
  const pProtocol = analysis.technicalProtocol;

  const similarities = [];
  const differences = [];
  let matchPoints = 0;
  let maxPoints = 0;

  // 1. Compare Sampling Unit (Weight: 25%)
  maxPoints += 25;
  const profileUnit = (profile.samplingUnit || '').toLowerCase();
  const studyUnit = (pSampling.samplingUnit || '').toLowerCase();

  const isBothHardware = profileUnit.includes('hardware') || profileUnit.includes('device') || profileUnit.includes('endpoint');
  const studyIsHardware = studyUnit.includes('hardware') || studyUnit.includes('device') || studyUnit.includes('endpoint') || pSampling.sampleSize.independentDevices !== null;

  if (isBothHardware && studyIsHardware) {
    similarities.push('Both studies investigate physical hardware/endpoint sampling units rather than human cohorts');
    matchPoints += 25;
  } else if (!isBothHardware && !studyIsHardware) {
    similarities.push(`Both studies utilize ${pSampling.samplingUnit} as the primary sampling unit`);
    matchPoints += 20;
  } else {
    differences.push(`Sampling unit divergence: Proposed study samples "${profile.samplingUnit}" while published study samples "${pSampling.samplingUnit}"`);
    matchPoints += 0;
  }

  // 2. Compare Independent Sample Size (Weight: 25%)
  maxPoints += 25;
  const targetN = profile.independentUnitsCount ? parseInt(profile.independentUnitsCount, 10) : null;
  const studyN = pSampling.sampleSize.independentUnitsCount;

  if (targetN !== null && studyN !== null) {
    if (studyN === targetN) {
      similarities.push(`Exact independent sample size alignment: Both utilize N = ${studyN} independent unit(s)`);
      matchPoints += 25;
    } else if (studyN <= 5 && targetN <= 5) {
      similarities.push(`Small-sample technical evaluation: Both employ limited independent endpoints (N = ${studyN} vs proposed N = ${targetN})`);
      matchPoints += 20;
    } else {
      differences.push(`Sample size difference: Published study evaluated N = ${studyN} units; proposed study evaluates N = ${targetN} units`);
      matchPoints += 8;
    }
  } else {
    differences.push('Published study did not explicitly quantify total independent physical units in abstract');
    matchPoints += 10;
  }

  // 3. Compare Repeated Measurement / Session Structure (Weight: 20%)
  maxPoints += 20;
  const profileHasRepeated = Boolean(profile.repeatedSessionsCount || profile.observationsPerSession);
  const studyHasRepeated = Boolean(pSampling.sampleSize.restartSessions || pSampling.sampleSize.totalRawObservations);

  if (profileHasRepeated && studyHasRepeated) {
    similarities.push('Both utilize repeated measurement / session-based observation to evaluate temporal stability and variability');
    matchPoints += 20;
  } else if (profileHasRepeated && !studyHasRepeated) {
    differences.push('Proposed design employs repeated restart sessions, whereas the published study does not detail a repeated-run protocol');
    matchPoints += 5;
  } else {
    matchPoints += 10;
  }

  // 4. Compare Validation Standards (e.g. NIST SP 800-90B) (Weight: 15%)
  maxPoints += 15;
  const profileStandards = (profile.validationStandards || '').toLowerCase();
  const hasSp800 = profileStandards.includes('800-90b') || profileStandards.includes('nist');
  const studyHasSp800 = Boolean(pProtocol.standardsCompliance);

  if (hasSp800 && studyHasSp800) {
    similarities.push('Both evaluate entropy and random data against the NIST SP 800-90B validation framework');
    matchPoints += 15;
  } else if (hasSp800 && !studyHasSp800) {
    differences.push('Published paper does not explicitly cite NIST SP 800-90B restart/health testing protocols');
    matchPoints += 3;
  } else {
    matchPoints += 10;
  }

  // 5. Compare Research Design & Domain (Weight: 15%)
  maxPoints += 15;
  const profileDesign = (profile.researchDesign || '').toLowerCase();
  const studyDesign = (analysis.researchDesign.primary || '').toLowerCase();

  if (profileDesign.includes('experimental') && studyDesign.includes('experimental')) {
    similarities.push('Both adopt a controlled quantitative experimental evaluation framework');
    matchPoints += 15;
  } else if (studyDesign.includes('benchmark') || studyDesign.includes('evaluation')) {
    similarities.push('Both perform empirical benchmark and system performance characterization');
    matchPoints += 12;
  } else {
    differences.push(`Research design differs: "${analysis.researchDesign.primary}" vs proposed "${profile.researchDesign}"`);
    matchPoints += 5;
  }

  // Calculate Comparability Classification
  const scorePercent = Math.round((matchPoints / maxPoints) * 100);

  let classification = 'Not Comparable';
  let badgeColor = 'bg-rose-950/60 text-rose-300 border-rose-800';

  if (scorePercent >= 80) {
    classification = 'Direct Methodological Match';
    badgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
  } else if (scorePercent >= 65) {
    classification = 'Strong Partial Match';
    badgeColor = 'bg-indigo-950/60 text-indigo-300 border-indigo-800';
  } else if (scorePercent >= 50) {
    classification = 'Contextual Supporting Study';
    badgeColor = 'bg-sky-950/60 text-sky-300 border-sky-800';
  } else if (scorePercent >= 35) {
    classification = 'Weak Match';
    badgeColor = 'bg-amber-950/60 text-amber-300 border-amber-800';
  }

  const classificationStr = classification;
  const classificationObj = Object.assign(new String(classificationStr), {
    level: classificationStr,
    badgeColor,
    toString: () => classificationStr
  });

  return {
    paperId: paper.id,
    title: paper.title,
    doi: paper.doi,
    publicationYear: paper.publicationYear || paper.year,
    authors: paper.authors || [],
    analysis,
    comparabilityScore: scorePercent,
    classification: classificationObj,
    badgeColor,
    similarities,
    differences,
    evidenceSummary: {
      proposedSamplingUnit: profile.samplingUnit,
      studySamplingUnit: pSampling.samplingUnit,
      proposedIndependentN: profile.independentUnitsCount,
      studyIndependentN: pSampling.sampleSize.independentUnitsCount || 'Not reported',
      proposedRepeatedStructure: `${profile.repeatedSessionsCount || 'N/A'} sessions × ${profile.observationsPerSession || 'N/A'} samples`,
      studyRepeatedStructure: pSampling.sampleSize.derivedCalculation 
        ? `${pSampling.sampleSize.restartSessions} sessions × ${pSampling.sampleSize.observationsPerSession} samples` 
        : (pSampling.sampleSize.totalRawObservations ? `${pSampling.sampleSize.totalRawObservations.toLocaleString()} total raw obs` : 'Not reported'),
      authorJustification: analysis.sampleSizeJustification.primaryRationale,
      standardsCompliance: pProtocol.standardsCompliance ? pProtocol.standardsCompliance.standard : 'None explicitly cited'
    }
  };
}

/**
 * Generates Comprehensive Sample-Size Justification Report
 */
function generateSampleSizeJustificationReport(profile, comparedStudies) {
  const topMatches = comparedStudies
    .filter(s => s.comparabilityScore >= 50)
    .sort((a, b) => b.comparabilityScore - a.comparabilityScore);

  const bestStudy = topMatches[0] || null;

  return {
    generatedDate: new Date().toISOString(),
    profile: {
      title: profile.title,
      samplingUnit: profile.samplingUnit,
      independentUnitsCount: profile.independentUnitsCount,
      independentUnitsDescription: profile.independentUnitsDescription,
      samplingTechnique: profile.samplingTechnique,
      repeatedSessions: profile.repeatedSessionsCount,
      observationsPerSession: profile.observationsPerSession,
      validationStandards: profile.validationStandards
    },
    totalStudiesAnalyzed: comparedStudies.length,
    comparableStudiesCount: topMatches.length,
    topStudies: topMatches.slice(0, 5),

    // 10 Key Analytical Sections
    sections: {
      1: {
        title: 'Proposed Sampling Design',
        content: `The proposed study evaluates ${profile.independentUnitsCount} independent physical unit(s) (${profile.independentUnitsDescription || profile.samplingUnit}) selected via ${profile.samplingTechnique}. To characterize temporal noise and statistical stability, the study executes ${profile.repeatedSessionsCount || 'multiple'} restart-based sessions, each capturing ${profile.observationsPerSession ? profile.observationsPerSession.toLocaleString() : 'numerous'} measurements.`
      },
      2: {
        title: 'Most Relevant Comparable Published Studies',
        content: topMatches.length > 0 
          ? topMatches.slice(0, 3).map(s => `• "${s.title}" (${s.publicationYear}) — [${s.classification}, ${s.comparabilityScore}% methodological alignment]`).join('\n')
          : 'No directly comparable published studies were identified matching the combined sampling and protocol criteria.'
      },
      3: {
        title: 'Reported Sample Sizes and Sampling Procedures in Literature',
        content: topMatches.map(s => {
          const ss = s.analysis.samplingDesign.sampleSize;
          return `• ${s.title}: Utilized N = ${ss.independentUnitsCount || 'unspecified'} physical units with ${ss.totalRawObservations ? ss.totalRawObservations.toLocaleString() : 'repeated'} measurements. Sampling technique: ${s.analysis.samplingDesign.samplingTechnique.name}.`;
        }).join('\n')
      },
      4: {
        title: 'How Comparable Studies Justified Their Sample Sizes',
        content: topMatches.map(s => {
          const just = s.analysis.sampleSizeJustification;
          return `• ${s.title}: ${just.hasExplicitRationale ? just.primaryRationale : 'Sample size rationale not explicitly reported in abstract/methods; structured by empirical hardware availability.'}`;
        }).join('\n')
      },
      5: {
        title: 'Key Similarities to Proposed Research',
        content: bestStudy 
          ? bestStudy.similarities.map(sim => `• ${sim}`).join('\n')
          : 'General thematic alignment with embedded experimental testing.'
      },
      6: {
        title: 'Important Methodological Differences & Nuances',
        content: bestStudy 
          ? bestStudy.differences.map(diff => `• ${diff}`).join('\n')
          : 'Published studies differ substantially in sampling frame or evaluation metrics.'
      },
      7: {
        title: 'What the Literature Evidence Supports',
        content: `The literature strongly establishes precedent for evaluating proof-of-concept feasibility and entropy estimation on a small number of physical testbeds (e.g. N = 1 to 4 endpoints) when combined with high-volume repeated observations (e.g. 10^6 samples per restart) to satisfy NIST SP 800-90B requirements.`
      },
      8: {
        title: 'What the Literature Evidence Does NOT Establish (Critical Limitations)',
        content: `Precedent does NOT establish that N = ${profile.independentUnitsCount} endpoints are statistically representative of the global population of Intel or AMD silicon. Silicon process variance, microcode differences, and motherboard trace capacitance require that findings be framed as feasibility characterization on representative testbeds, NOT as an inferential population census.`
      },
      9: {
        title: 'Additional Methodological Evidence Needed',
        content: `To defend the sample size in thesis defense: (1) Formally distinguish independent units from repeated runs; (2) Cite NIST SP 800-90B Section 3.1.1 requirements specifying sample length (1M bits) rather than device counts; (3) Explicitly scope the research boundary as architectural feasibility rather than population generalization.`
      },
      10: {
        title: 'Draft Evidence-Linked Justification Rationale (For Thesis / Chapter 2)',
        content: `The selection of ${profile.independentUnitsCount} physical hardware endpoints (${profile.independentUnitsDescription}) is grounded in the methodological precedent established by ${bestStudy ? `comparable empirical evaluations such as ${bestStudy.title}` : 'embedded hardware literature'}. Because the research objective focuses on the physical characterization and restart-stability of entropy extraction under NIST SP 800-90B rather than broad demographic survey generalization, sampling focuses on representative architectural coverage (Intel vs. AMD) under controlled laboratory conditions. Statistical rigor is achieved via ${profile.repeatedSessionsCount || 10} independent restart cycles comprising ${profile.observationsPerSession ? profile.observationsPerSession.toLocaleString() : '1,000,000'} raw measurements per run to satisfy the minimum sample size requirements mandated by NIST SP 800-90B for min-entropy estimation.`
      }
    },
    draftRationale: `The selection of ${profile.independentUnitsCount} physical hardware endpoints (${profile.independentUnitsDescription}) is grounded in the methodological precedent established by ${bestStudy ? `comparable empirical evaluations such as ${bestStudy.title}` : 'embedded hardware literature'}. Precedent does NOT constitute statistical proof of generalizability to all hardware silicon; it validates controlled architectural feasibility and restart stability under NIST SP 800-90B.`,
    whatEvidenceSupports: [
      `The literature strongly establishes precedent for evaluating proof-of-concept feasibility and entropy estimation on a small number of physical testbeds (e.g. N = 1 to 4 endpoints) when combined with high-volume repeated observations (e.g. 10^6 samples per restart) to satisfy NIST SP 800-90B requirements.`
    ],
    whatEvidenceDoesNotEstablish: [
      `Precedent does NOT establish that N = ${profile.independentUnitsCount} endpoints are statistically representative of the global population of Intel or AMD silicon. It does not establish generalization to all hardware populations without independent multi-vendor replication.`
    ]
  };
}

module.exports = {
  DEFAULT_SAMPLE_RESEARCH_PROFILE,
  compareStudyToProfile,
  generateSampleSizeJustificationReport
};
