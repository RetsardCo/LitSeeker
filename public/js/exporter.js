/**
 * Multi-format Literature Exporter for Chapter 2 Capstone Documentation
 * Generates CSV (Excel), BibTeX (.bib), RIS (.ris), and Formatted Markdown (.md)
 */

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Clean text for CSV cells
 */
function escapeCsv(cell) {
  if (cell === null || cell === undefined) return '""';
  const str = String(cell).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Export Literature List to CSV (Excel-compatible Matrix)
 */
function exportToCsv(papers, filename = 'LitSeeker_Literature_Synthesis_Matrix.csv') {
  if (!papers || papers.length === 0) return;

  const headers = [
    'Author & Year',
    'Study Title',
    'Verified DOI',
    'Category',
    'Research Design',
    'Sampling Unit',
    'Sampling Technique',
    'Independent Sample Size',
    'Repeated Sessions / Runs',
    'Total Observations',
    'Sample-Size Justification',
    'Core Objective',
    'Methodology / Tech Stack',
    'Key Findings & Results',
    'Research Gap / Relevance',
    'Evidence Status',
    'Journal / Venue',
    'Citation Count',
    'Open Access PDF Link'
  ];

  const rows = papers.map(p => {
    const matrix = p.matrix || {};
    return [
      escapeCsv(matrix.authorYear || p.authors?.[0] || 'Unknown'),
      escapeCsv(p.title),
      escapeCsv(p.doi || 'N/A'),
      escapeCsv(p.rrlCategory || matrix.category || 'Foreign Study'),
      escapeCsv(matrix.researchDesign || 'Quantitative Empirical'),
      escapeCsv(matrix.samplingUnit || 'N/A'),
      escapeCsv(matrix.samplingTechnique || 'N/A'),
      escapeCsv(matrix.independentSampleSize || 'N/A'),
      escapeCsv(matrix.repeatedSessions || 'N/A'),
      escapeCsv(matrix.totalObservations || 'N/A'),
      escapeCsv(matrix.sampleSizeJustification || 'N/A'),
      escapeCsv(matrix.objective || 'N/A'),
      escapeCsv(matrix.methodology || 'N/A'),
      escapeCsv(matrix.findings || 'N/A'),
      escapeCsv(matrix.researchGap || 'N/A'),
      escapeCsv(matrix.evidenceStatus || 'Reported / Inferred'),
      escapeCsv(p.journal || 'Academic Journal'),
      escapeCsv(p.citedByCount || 0),
      escapeCsv(p.openAccessUrl || 'N/A')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Export Literature List to BibTeX (.bib)
 */
function exportToBibTeX(papers, filename = 'capstone_references.bib') {
  if (!papers || papers.length === 0) return;

  const bibEntries = papers.map(p => {
    if (p.citations && p.citations.bibtex) {
      return p.citations.bibtex;
    }
    // Fallback generator
    const firstAuthor = (p.authors?.[0] || 'Author').split(/\s+/).pop().replace(/[^a-zA-Z]/g, '');
    const year = p.publicationYear || 2024;
    const citeKey = `${firstAuthor.toLowerCase()}${year}`;
    const authors = (p.authors || ['Anonymous']).join(' and ');
    return `@article{${citeKey},
  author = {${authors}},
  title = {${p.title}},
  journal = {${p.journal || 'Scholarly Publication'}},
  year = {${year}},
  ${p.doi ? `doi = {${p.doi.replace('https://doi.org/', '')}},` : ''}
  ${p.openAccessUrl ? `url = {${p.openAccessUrl}}` : ''}
}`;
  });

  const content = bibEntries.join('\n\n');
  downloadFile(content, filename, 'application/x-bibtex');
}

/**
 * Export Literature List to RIS (.ris for EndNote, Zotero, Mendeley)
 */
function exportToRIS(papers, filename = 'capstone_references.ris') {
  if (!papers || papers.length === 0) return;

  const risEntries = papers.map(p => {
    const lines = [
      'TY  - JOUR',
      `TI  - ${p.title}`,
      ...(p.authors || []).map(a => `AU  - ${a}`),
      `PY  - ${p.publicationYear || ''}`,
      `JO  - ${p.journal || ''}`,
      p.doi ? `DO  - ${p.doi.replace('https://doi.org/', '')}` : '',
      p.openAccessUrl ? `UR  - ${p.openAccessUrl}` : '',
      p.abstract ? `AB  - ${p.abstract.replace(/\r?\n/g, ' ')}` : '',
      'ER  - '
    ].filter(Boolean);

    return lines.join('\r\n');
  });

  const content = risEntries.join('\r\n\r\n');
  downloadFile(content, filename, 'application/x-research-info-systems');
}

/**
 * Export Pre-Formatted Chapter 2 Markdown Synthesis Document
 */
function exportToMarkdown(papers, capstoneTitle = 'Capstone Research', citationStyle = 'apa7') {
  if (!papers || papers.length === 0) return;

  const date = new Date().toLocaleDateString();
  let md = `# CHAPTER 2: REVIEW OF RELATED LITERATURE AND STUDIES\n\n`;
  md += `**Study Topic**: ${capstoneTitle}\n`;
  md += `**Generated Date**: ${date}\n`;
  md += `**Total Studies Reviewed**: ${papers.length}\n\n`;
  md += `---\n\n`;

  // Section 1: Synthesis Narrative
  md += `## 2.1 Synthesis of Reviewed Literature\n\n`;
  md += `This chapter presents the relevant literature and empirical studies gathered to provide foundational context and technical grounding for the study titled *"${capstoneTitle}"*. The selected literature explores core system variables, algorithmic methodologies, and empirical implementation benchmarks.\n\n`;

  // Group papers by category
  const categories = {
    'Foreign Literature': [],
    'Foreign Studies': [],
    'Local Studies': [],
    'Local Literature': []
  };

  papers.forEach(p => {
    const cat = p.rrlCategory || p.matrix?.category || 'Foreign Studies';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(p);
  });

  for (const [catName, catPapers] of Object.entries(categories)) {
    if (catPapers.length > 0) {
      md += `### ${catName}\n\n`;
      catPapers.forEach(p => {
        const matrix = p.matrix || {};
        const authorYear = matrix.authorYear || p.authors?.[0] || 'Unknown';
        md += `#### ${p.title}\n`;
        md += `- **Citation / Lead**: ${authorYear}\n`;
        md += `- **DOI**: ${p.doi ? `[${p.doi}](${p.doi})` : 'N/A'}\n`;
        md += `- **Core Objective**: ${matrix.objective || 'N/A'}\n`;
        md += `- **Methodology / Tech Stack**: ${matrix.methodology || 'N/A'}\n`;
        md += `- **Key Findings**: ${matrix.findings || 'N/A'}\n`;
        md += `- **Relevance / Research Gap**: ${matrix.researchGap || 'N/A'}\n\n`;
      });
    }
  }

  // Section 2: Synthesis Table Matrix
  md += `---\n\n## 2.2 Literature Review Synthesis Matrix\n\n`;
  md += `| Author & Year | Study Title | Methodology | Key Findings | Research Gap / Relevance |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  papers.forEach(p => {
    const m = p.matrix || {};
    const safeTitle = (p.title || '').replace(/\|/g, '-');
    const safeMeth = (m.methodology || '').replace(/\|/g, '-');
    const safeFind = (m.findings || '').replace(/\|/g, '-');
    const safeGap = (m.researchGap || '').replace(/\|/g, '-');
    md += `| ${m.authorYear || 'N/A'} | ${safeTitle} | ${safeMeth} | ${safeFind} | ${safeGap} |\n`;
  });

  // Section 3: References List
  md += `\n\n---\n\n## 2.3 References (${citationStyle.toUpperCase()})\n\n`;
  papers.forEach((p, idx) => {
    const formatted = p.citations?.[citationStyle] || p.citations?.apa7 || `${p.title} (${p.publicationYear})`;
    md += `${idx + 1}. ${formatted}\n\n`;
  });

  downloadFile(md, 'Chapter_2_Review_of_Related_Literature.md', 'text/markdown');
}

/**
 * Export Methodology Comparison Table to CSV
 */
function exportComparisonToCsv(comparisons, filename = 'LitSeeker_Methodology_Comparison_Matrix.csv') {
  if (!comparisons || comparisons.length === 0) return;

  const headers = [
    'Study Title',
    'Publication Year',
    'Verified DOI',
    'Comparability Classification',
    'Methodological Match Score (%)',
    'Proposed Sampling Unit',
    'Study Sampling Unit',
    'Proposed Independent N',
    'Study Independent N',
    'Proposed Repeated Structure',
    'Study Repeated Structure',
    'Author Sample-Size Justification',
    'Standards Compliance',
    'Key Similarities',
    'Key Differences'
  ];

  const rows = comparisons.map(c => {
    const summary = c.evidenceSummary || {};
    return [
      escapeCsv(c.title),
      escapeCsv(c.publicationYear || 'N/A'),
      escapeCsv(c.doi || 'N/A'),
      escapeCsv(c.classification || 'Contextual'),
      escapeCsv(`${c.comparabilityScore || 0}%`),
      escapeCsv(summary.proposedSamplingUnit || 'N/A'),
      escapeCsv(summary.studySamplingUnit || 'N/A'),
      escapeCsv(summary.proposedIndependentN || 'N/A'),
      escapeCsv(summary.studyIndependentN || 'N/A'),
      escapeCsv(summary.proposedRepeatedStructure || 'N/A'),
      escapeCsv(summary.studyRepeatedStructure || 'N/A'),
      escapeCsv(summary.authorJustification || 'Not reported'),
      escapeCsv(summary.standardsCompliance || 'N/A'),
      escapeCsv((c.similarities || []).join('; ')),
      escapeCsv((c.differences || []).join('; '))
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  downloadFile(csvContent, filename, 'text/csv');
}

/**
 * Export Sample-Size Justification Report to Markdown
 */
function exportJustificationReportToMarkdown(report, filename = 'LitSeeker_Sample_Size_Justification_Report.md') {
  if (!report || !report.sections) return;

  let md = `# SAMPLE-SIZE JUSTIFICATION & METHODOLOGICAL PRECEDENT REPORT\n\n`;
  md += `**Research Title**: ${report.profile?.title || 'Proposed Research Study'}\n`;
  md += `**Date of Evaluation**: ${new Date(report.generatedDate).toLocaleDateString()}\n`;
  md += `**Total Studies Evaluated**: ${report.totalStudiesAnalyzed || 0} (${report.comparableStudiesCount || 0} methodologically comparable)\n\n`;
  md += `---\n\n`;

  for (let i = 1; i <= 10; i++) {
    const section = report.sections[i];
    if (section) {
      md += `## ${i}. ${section.title}\n\n`;
      md += `${section.content}\n\n`;
    }
  }

  md += `---\n\n*Generated by LitSeeker Academic Research Intelligence Studio*\n`;
  downloadFile(md, filename, 'text/markdown');
}

window.literatureExporter = {
  exportToCsv,
  exportToBibTeX,
  exportToRIS,
  exportToMarkdown,
  exportComparisonToCsv,
  exportJustificationReportToMarkdown
};
