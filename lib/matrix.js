/**
 * Chapter 2 Literature Synthesis Matrix Generator
 * Automatically extracts Methodology, Objectives, Key Findings, and Research Gap.
 */

// Common methodology indicators in academic computer science / engineering / empirical papers
const METHOD_PATTERNS = [
  { name: 'Convolutional Neural Network (CNN)', regex: /\b(cnn|convolutional neural network|resnet|vgg|mobilenet|efficientnet)\b/i },
  { name: 'YOLO Object Detection', regex: /\b(yolo|yolov\d+|you only look once)\b/i },
  { name: 'Deep Learning', regex: /\b(deep learning|deep neural network|dnn)\b/i },
  { name: 'Machine Learning', regex: /\b(machine learning|random forest|support vector machine|svm|gradient boosting|xgboost)\b/i },
  { name: 'IoT & Embedded Hardware', regex: /\b(iot|internet of things|raspberry pi|arduino|esp32|microcontroller|sensors?|edge computing)\b/i },
  { name: 'Natural Language Processing', regex: /\b(nlp|natural language processing|bert|transformer|llm|large language model|tokenization)\b/i },
  { name: 'Computer Vision', regex: /\b(computer vision|image processing|opencv|segmentation|feature extraction)\b/i },
  { name: 'Mobile / Web Application', regex: /\b(mobile application|android|ios|flutter|web application|rest api|cloud architecture)\b/i },
  { name: 'Agile / System Development', regex: /\b(agile|scrum|waterfall|system development life cycle|sdlc|prototyping)\b/i },
  { name: 'Experimental / Empirical Evaluation', regex: /\b(experimental design|empirical evaluation|comparative analysis|benchmark|ablation study)\b/i },
  { name: 'Survey / Questionnaire', regex: /\b(survey|questionnaire|likert scale|user satisfaction|tam|sus|usability testing)\b/i }
];

/**
 * Extracts methodology keywords and algorithms from abstract and title
 */
function extractMethodology(title, abstract) {
  const text = `${title} ${abstract}`;
  const detected = [];

  for (const { name, regex } of METHOD_PATTERNS) {
    if (regex.test(text)) {
      detected.push(name);
    }
  }

  if (detected.length > 0) {
    return detected.slice(0, 3).join(', ');
  }

  // Fallback heuristic: check for words ending in -ing or generic methods
  const match = text.match(/\b(implemented using|evaluated using|developed with|methodology consists of|algorithm)\s+([^.,;\n]+)/i);
  if (match && match[2]) {
    return match[2].trim().slice(0, 60);
  }

  return 'Empirical Analysis & System Modeling';
}

/**
 * Extracts the primary objective from abstract
 */
function extractObjective(title, abstract) {
  if (!abstract) return `To examine and implement ${title.slice(0, 70)}...`;

  const objectiveMatch = abstract.match(/(?:this (?:paper|study|research|project|system) (?:aims to|presents|proposes|develops|investigates|focuses on|evaluates)|to address the|the objective of this study is to)\s+([^.]+?\.)/i);
  if (objectiveMatch && objectiveMatch[1]) {
    const raw = objectiveMatch[1].trim();
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // Fallback: take the first sentence
  const firstSentence = abstract.split(/[.!?]\s+/)[0];
  if (firstSentence && firstSentence.length > 20) {
    return `${firstSentence.slice(0, 150)}...`;
  }

  return `Investigation of ${title}`;
}

/**
 * Extracts key findings and measurable contribution from abstract
 */
function extractFindings(abstract) {
  if (!abstract) return 'Provided quantitative benchmarks and empirical implementation data.';

  // Split abstract into proper sentences, preserving decimals like 99.1%
  const sentences = abstract.match(/[^.!?]+(?:(?:\d+\.\d+|[.!?](?!\s|$))[^.!?]*)*[.!?]?/g) || [abstract];
  const cleaned = sentences.map(s => s.trim()).filter(s => s.length > 10);

  // Look for sentences mentioning results, accuracy, performance, or conclusion
  for (const s of cleaned) {
    if (/(results show|demonstrate|indicate|achieved|accuracy|uptime|reduction|improvement|conclusion)/i.test(s)) {
      return s.endsWith('.') ? s : `${s}.`;
    }
  }

  // Fallback to the last sentence
  if (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    return last.endsWith('.') ? last : `${last}.`;
  }

  return 'Demonstrated substantial operational feasibility and practical performance improvements.';
}

/**
 * Identifies potential research gap or relevance to current capstone
 */
function extractResearchGap(title, abstract, userCapstoneQuery = '') {
  const text = `${title} ${abstract}`.toLowerCase();
  
  if (text.includes('future work') || text.includes('limitation') || text.includes('however') || text.includes('remains challenging')) {
    const gapMatch = abstract.match(/(?:however|nonetheless|a limitation of|future work should|remains challenging|requires further investigation)\s+([^.]+?\.)/i);
    if (gapMatch && gapMatch[1]) {
      return `Gap identified: ${gapMatch[1].trim()}`;
    }
  }

  if (text.includes('gpu') || text.includes('cloud') || text.includes('high computational')) {
    return 'Primarily tested in high-resource server environments; opportunity exists for edge device / low-cost deployment in capstone.';
  }

  if (text.includes('simulation') || text.includes('synthetic')) {
    return 'Evaluated predominantly in synthetic/simulated conditions; gap remains for real-world field prototyping.';
  }

  return 'Provides a strong theoretical and algorithmic foundation that supports the capstone system architecture.';
}

/**
 * Classifies literature as Foreign or Local based on source or institution metadata
 */
function classifyCategory(paper) {
  const text = `${paper.journal} ${paper.institution || ''} ${paper.abstract}`.toLowerCase();
  
  if (text.includes('philippines') || text.includes('diliman') || text.includes('manila') || text.includes('ched') || text.includes('dost')) {
    return 'Local Study';
  }
  
  if (paper.journal && (paper.journal.toLowerCase().includes('journal') || paper.journal.toLowerCase().includes('transactions'))) {
    return 'Foreign Literature';
  }

  return 'Foreign Study';
}

function getSurname(name) {
  if (!name) return 'Anonymous';
  const clean = String(name).trim();
  if (clean.includes(',')) {
    return clean.split(',')[0].trim();
  }
  return clean.split(/\s+/).pop().trim();
}

/**
 * Generates the full Chapter 2 Matrix row for a paper
 */
function generateMatrixRow(paper, userCapstoneQuery = '') {
  const authorsList = paper.authors || [];
  let authorCitation = 'Anonymous';
  if (authorsList.length === 1) {
    authorCitation = getSurname(authorsList[0]);
  } else if (authorsList.length === 2) {
    authorCitation = `${getSurname(authorsList[0])} & ${getSurname(authorsList[1])}`;
  } else if (authorsList.length > 2) {
    authorCitation = `${getSurname(authorsList[0])} et al.`;
  }

  const year = paper.publicationYear || paper.year || 'n.d.';
  const authorYear = `${authorCitation} (${year})`;

  return {
    id: paper.id,
    authorYear,
    title: paper.title,
    doi: paper.doi || '',
    category: classifyCategory(paper),
    objective: extractObjective(paper.title, paper.abstract),
    methodology: extractMethodology(paper.title, paper.abstract),
    findings: extractFindings(paper.abstract),
    researchGap: extractResearchGap(paper.title, paper.abstract, userCapstoneQuery)
  };
}

module.exports = {
  extractMethodology,
  extractObjective,
  extractFindings,
  extractResearchGap,
  classifyCategory,
  generateMatrixRow
};
