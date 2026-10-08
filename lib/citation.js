/**
 * Multi-format Academic Citation Engine
 * Supports APA 7th, IEEE, MLA 9th, Chicago 17th, Harvard, BibTeX, and In-Text Citations.
 */

/**
 * Normalizes author strings or objects into { first, last, full }
 */
function parseAuthors(authorsList) {
  if (!authorsList || !Array.isArray(authorsList) || authorsList.length === 0) {
    return [{ first: '', last: 'Anonymous', full: 'Anonymous' }];
  }

  return authorsList.map(a => {
    if (typeof a === 'object' && a !== null) {
      const full = a.name || a.display_name || a.full || '';
      return parseName(full);
    }
    return parseName(String(a));
  });
}

function parseName(fullName) {
  const clean = fullName.trim().replace(/,/g, '');
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return { first: '', last: parts[0], full: parts[0], initials: parts[0][0] || '' };
  }
  const last = parts[parts.length - 1];
  const firstParts = parts.slice(0, parts.length - 1);
  const initials = firstParts.map(p => p[0].toUpperCase() + '.').join(' ');
  return {
    first: firstParts.join(' '),
    last,
    full: clean,
    initials
  };
}

/**
 * Format APA 7th Edition
 * Example: Smith, J. D., & Taylor, R. (2023). Machine learning in IoT. IEEE Access, 11(2), 123-130. https://doi.org/10.1109/ACCESS.2023.1234
 */
function formatAPA7(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';
  const title = paper.title ? paper.title.trim() : 'Untitled Work';
  const journal = paper.journal || paper.venue || '';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : '';

  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${authors[0].last}, ${authors[0].initials}`;
  } else if (authors.length === 2) {
    authorStr = `${authors[0].last}, ${authors[0].initials}, & ${authors[1].last}, ${authors[1].initials}`;
  } else if (authors.length <= 20) {
    const allExceptLast = authors.slice(0, -1).map(a => `${a.last}, ${a.initials}`).join(', ');
    const last = authors[authors.length - 1];
    authorStr = `${allExceptLast}, & ${last.last}, ${last.initials}`;
  } else {
    // APA 7: List first 19, then ellipsis, then last author
    const first19 = authors.slice(0, 19).map(a => `${a.last}, ${a.initials}`).join(', ');
    const last = authors[authors.length - 1];
    authorStr = `${first19}, ... ${last.last}, ${last.initials}`;
  }

  // Ensure sentence capitalization for title where appropriate, with period at end
  const cleanTitle = title.endsWith('.') ? title : `${title}.`;
  let ref = `${authorStr} (${year}). ${cleanTitle}`;
  if (journal) {
    ref += ` ${journal}.`;
  }
  if (doi) {
    ref += ` ${doi}`;
  }
  return ref.trim();
}

/**
 * Format IEEE Edition
 * Example: [1] J. D. Smith and R. Taylor, "Machine learning in IoT," IEEE Access, 2023, doi: 10.1109/ACCESS.2023.1234.
 */
function formatIEEE(paper, index = 1) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';
  const title = paper.title ? paper.title.trim() : 'Untitled Work';
  const journal = paper.journal || paper.venue || '';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi.replace('https://doi.org/', '') : paper.doi) : '';

  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${authors[0].initials} ${authors[0].last}`;
  } else if (authors.length === 2) {
    authorStr = `${authors[0].initials} ${authors[0].last} and ${authors[1].initials} ${authors[1].last}`;
  } else if (authors.length <= 6) {
    const list = authors.slice(0, -1).map(a => `${a.initials} ${a.last}`).join(', ');
    const last = authors[authors.length - 1];
    authorStr = `${list}, and ${last.initials} ${last.last}`;
  } else {
    authorStr = `${authors[0].initials} ${authors[0].last} et al.`;
  }

  let ref = `[${index}] ${authorStr}, "${title},"`;
  if (journal) ref += ` ${journal},`;
  ref += ` ${year}.`;
  if (doi) ref += ` doi: ${doi}.`;
  return ref.trim();
}

/**
 * Format MLA 9th Edition
 * Example: Smith, John D., and Rachel Taylor. "Machine Learning in IoT." IEEE Access, 2023, https://doi.org/10.1109/ACCESS.2023.1234.
 */
function formatMLA9(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';
  const title = paper.title ? paper.title.trim() : 'Untitled Work';
  const journal = paper.journal || paper.venue || '';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : '';

  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}`;
  } else if (authors.length === 2) {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}, and ${authors[1].first || authors[1].initials} ${authors[1].last}`;
  } else {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}, et al.`;
  }

  let ref = `${authorStr}. "${title}."`;
  if (journal) ref += ` ${journal},`;
  ref += ` ${year}.`;
  if (doi) ref += ` ${doi}.`;
  return ref.trim();
}

/**
 * Format Chicago 17th (Author-Date)
 * Example: Smith, John D., and Rachel Taylor. 2023. "Machine Learning in IoT." IEEE Access. https://doi.org/10.1109/ACCESS.2023.1234.
 */
function formatChicago(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';
  const title = paper.title ? paper.title.trim() : 'Untitled Work';
  const journal = paper.journal || paper.venue || '';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : '';

  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}`;
  } else if (authors.length === 2) {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}, and ${authors[1].first || authors[1].initials} ${authors[1].last}`;
  } else {
    authorStr = `${authors[0].last}, ${authors[0].first || authors[0].initials}, et al.`;
  }

  let ref = `${authorStr}. ${year}. "${title}."`;
  if (journal) ref += ` ${journal}.`;
  if (doi) ref += ` ${doi}.`;
  return ref.trim();
}

/**
 * Format Harvard Style
 * Example: Smith, J. and Taylor, R. (2023) 'Machine learning in IoT', IEEE Access. Available at: https://doi.org/10.1109/ACCESS.2023.1234.
 */
function formatHarvard(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';
  const title = paper.title ? paper.title.trim() : 'Untitled Work';
  const journal = paper.journal || paper.venue || '';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : '';

  let authorStr = '';
  if (authors.length === 1) {
    authorStr = `${authors[0].last}, ${authors[0].initials}`;
  } else if (authors.length === 2) {
    authorStr = `${authors[0].last}, ${authors[0].initials} and ${authors[1].last}, ${authors[1].initials}`;
  } else {
    authorStr = `${authors[0].last}, ${authors[0].initials} et al.`;
  }

  let ref = `${authorStr} (${year}) '${title}',`;
  if (journal) ref += ` ${journal}.`;
  if (doi) ref += ` Available at: ${doi}.`;
  return ref.trim();
}

/**
 * Format BibTeX
 */
function formatBibTeX(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || new Date().getFullYear();
  const firstAuthor = (authors[0]?.last || 'Author').replace(/[^a-zA-Z]/g, '');
  const titleWord = (paper.title || 'study').split(/\s+/)[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
  const citeKey = `${firstAuthor.toLowerCase()}${year}${titleWord}`;

  const authorBib = authors.map(a => `${a.last}, ${a.first || a.initials}`).join(' and ');
  const title = (paper.title || 'Untitled Work').replace(/{/g, '').replace(/}/g, '');
  const journal = paper.journal || paper.venue || 'Scholarly Publication';
  const doi = paper.doi ? (paper.doi.startsWith('http') ? paper.doi.replace('https://doi.org/', '') : paper.doi) : '';

  return `@article{${citeKey},
  author    = {${authorBib}},
  title     = {${title}},
  journal   = {${journal}},
  year      = {${year}},
  ${doi ? `doi       = {${doi}},` : ''}
  ${paper.url ? `url       = {${paper.url}}` : ''}
}`;
}

/**
 * Generates In-Text Citations
 * Returns parenthetical and narrative variants.
 */
function formatInText(paper) {
  const authors = parseAuthors(paper.authors);
  const year = paper.publicationYear || paper.year || 'n.d.';

  let parenthetical = '';
  let narrative = '';

  if (authors.length === 1) {
    parenthetical = `(${authors[0].last}, ${year})`;
    narrative = `${authors[0].last} (${year})`;
  } else if (authors.length === 2) {
    parenthetical = `(${authors[0].last} & ${authors[1].last}, ${year})`;
    narrative = `${authors[0].last} and ${authors[1].last} (${year})`;
  } else {
    parenthetical = `(${authors[0].last} et al., ${year})`;
    narrative = `${authors[0].last} et al. (${year})`;
  }

  return {
    parenthetical,
    narrative,
    ieee: `[1]`
  };
}

/**
 * Generate full citation bundle for a paper across all formats
 */
function generateCitations(paper, index = 1) {
  return {
    apa7: formatAPA7(paper),
    ieee: formatIEEE(paper, index),
    mla9: formatMLA9(paper),
    chicago: formatChicago(paper),
    harvard: formatHarvard(paper),
    bibtex: formatBibTeX(paper),
    inText: formatInText(paper)
  };
}

module.exports = {
  formatAPA7,
  formatIEEE,
  formatMLA9,
  formatChicago,
  formatHarvard,
  formatBibTeX,
  formatInText,
  generateCitations,
  parseAuthors
};
