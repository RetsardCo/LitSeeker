/**
 * Main Frontend Application Logic for LitFinder Capstone Studio
 */

let currentPapers = [];
let currentCapstoneTitle = '';
let currentView = 'cards'; // 'cards' | 'matrix' | 'binder'
let activeCitationStyle = 'apa7';
let activeModalPaper = null;

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
  updateBinderBadge();

  // Subscribe to binder changes
  window.binder.subscribe(() => {
    updateBinderBadge();
    if (currentView === 'binder') {
      renderCurrentView();
    }
  });

  // Render initial welcome state
  renderWelcomeHero();
});

function updateBinderBadge() {
  const count = window.binder.count();
  const counterEl = document.getElementById('binderCounter');
  const viewCounterEl = document.getElementById('viewBinderCount');
  if (counterEl) counterEl.textContent = count;
  if (viewCounterEl) viewCounterEl.textContent = count;
}

/**
 * Curated Capstone Sample Queries for 1-Click Exploration
 */
const SAMPLE_QUERIES = [
  'Automated Crop Disease Detection & Pest Classification Using Convolutional Neural Networks on Embedded Raspberry Pi',
  'IoT-Based Smart Aquaponics Telemetry and Autonomous Water Quality Control Using Machine Learning',
  'Real-Time Facial Emotion Recognition for Intelligent Student Engagement Monitoring in E-Learning',
  'Blockchain-Enabled Decentralized Electronic Medical Records with Zero-Knowledge Privacy Preservation',
  'Vision-Based Autonomous Drone Navigation and Obstacle Avoidance in GPS-Denied Indoor Environments'
];

window.fillSample = function(index) {
  const query = SAMPLE_QUERIES[index];
  if (query) {
    const input = document.getElementById('searchQueryInput');
    input.value = query;
    handleSearchSubmit(new Event('submit'));
  }
};

/**
 * Handle Search Form Submit
 */
window.handleSearchSubmit = async function(event) {
  if (event) event.preventDefault();

  const queryInput = document.getElementById('searchQueryInput');
  const query = (queryInput.value || '').trim();
  if (!query) {
    showToast('Please enter your research topic or capstone title.', 'warning');
    return;
  }

  currentCapstoneTitle = query;
  await performSearch();
};

/**
 * Executes API Search
 */
async function performSearch() {
  const btn = document.getElementById('btnSubmitSearch');
  const originalBtnHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Searching...</span>`;
  lucide.createIcons();

  renderLoadingSkeleton();

  const filterRecent = document.getElementById('filterRecentYears').checked;
  const filterOA = document.getElementById('filterOpenAccessOnly').checked;
  const source = document.getElementById('filterSource').value;
  const sort = document.getElementById('filterSort').value;

  const currentYear = new Date().getFullYear();
  const minYear = filterRecent ? (currentYear - 5) : '';

  const params = new URLSearchParams({
    q: currentCapstoneTitle,
    capstone_title: currentCapstoneTitle,
    limit: '20',
    source,
    sort,
    is_oa: filterOA ? 'true' : 'false'
  });
  if (minYear) params.append('min_year', minYear);

  try {
    const response = await fetch(`/api/search?${params.toString()}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    currentPapers = data.papers || [];

    updateResultsStatusBar(currentPapers.length);
    renderCurrentView();

    showToast(`Found ${currentPapers.length} relevant studies!`, 'success');
  } catch (err) {
    console.error('Search error:', err);
    showToast('Failed to retrieve literature. Please try again.', 'error');
    renderErrorState(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalBtnHtml;
    lucide.createIcons();
  }
}

window.triggerRefilter = function() {
  if (currentPapers.length > 0 || currentCapstoneTitle) {
    performSearch();
  }
};

/**
 * View Switcher: Cards vs Matrix vs Binder
 */
window.switchView = function(viewName) {
  currentView = viewName;

  const tabs = {
    cards: document.getElementById('tabCards'),
    matrix: document.getElementById('tabMatrix'),
    binder: document.getElementById('tabBinder'),
    comparable: document.getElementById('tabComparable')
  };

  Object.entries(tabs).forEach(([name, el]) => {
    if (!el) return;
    if (name === viewName) {
      el.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all bg-indigo-600 text-white shadow-sm';
    } else {
      el.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all text-slate-400 hover:text-slate-200 hover:bg-slate-900';
    }
  });

  renderCurrentView();
};

function renderCurrentView() {
  const container = document.getElementById('mainDisplayArea');
  if (!container) return;

  if (currentView === 'cards') {
    renderCardsView(container, currentPapers);
  } else if (currentView === 'matrix') {
    window.renderMatrixTable(container, currentPapers);
  } else if (currentView === 'binder') {
    const saved = window.binder.getAll();
    renderCardsView(container, saved, true);
  } else if (currentView === 'comparable') {
    renderComparableView(container);
  }
  lucide.createIcons();
}

/**
 * Renders the Cards View
 */
function renderCardsView(container, papers, isBinderView = false) {
  if (!papers || papers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-slate-800">
        <i data-lucide="${isBinderView ? 'bookmark-x' : 'search-x'}" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
        <h3 class="text-base font-semibold text-slate-200">
          ${isBinderView ? 'Your RRL Binder is Empty' : 'No research papers found'}
        </h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          ${isBinderView 
            ? 'Pin candidate papers from search results to organize and export your Chapter 2 references in bulk.' 
            : 'Try adjusting your filters, expanding your search terms, or checking Open Access options.'}
        </p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const cardsHtml = `
    <div class="grid grid-cols-1 gap-4">
      ${papers.map((p, idx) => {
        const isSaved = window.binder.has(p.id);
        const sim = p.similarity || { score: 75, tier: 'Relevant', badgeColor: 'bg-emerald-100 text-emerald-800' };
        const matrix = p.matrix || {};
        const doi = p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : null;
        const currentCat = p.rrlCategory || matrix.category || 'Foreign Study';

        return `
          <article class="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800/80 transition-all space-y-3.5 relative" id="card-${p.id}">
            
            <!-- Top Badges Row -->
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs">
              
              <div class="flex flex-wrap items-center gap-2">
                <!-- Similarity Badge -->
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[11px] ${sim.badgeColor}">
                  <i data-lucide="target" class="w-3 h-3"></i>
                  <span>${sim.score}% Similarity</span>
                </span>

                <!-- Year Chip -->
                <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold text-[11px] border border-slate-700">
                  ${p.publicationYear}
                </span>

                <!-- Citations Chip -->
                <span class="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[11px] border border-slate-700 flex items-center gap-1">
                  <i data-lucide="award" class="w-3 h-3 text-amber-400"></i>
                  <span>${p.citedByCount || 0} citations</span>
                </span>

                <!-- Category Badge -->
                <span class="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 text-[11px] border border-indigo-800/50 font-medium">
                  ${currentCat}
                </span>
              </div>

              <!-- Pin / Bookmark Button -->
              <button onclick="window.handleToggleBinder('${p.id}')"
                class="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold transition-all ${
                  isSaved 
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' 
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800'
                }">
                <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-3.5 h-3.5"></i>
                <span>${isSaved ? 'Saved in Binder' : 'Save to Binder'}</span>
              </button>

            </div>

            <!-- Title & Authors -->
            <div>
              <h2 class="text-base sm:text-lg font-bold text-white tracking-tight hover:text-indigo-300 transition-colors">
                ${p.title}
              </h2>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                <span class="text-slate-300 font-medium">${(p.authors || []).slice(0, 4).join(', ')}${(p.authors || []).length > 4 ? ' et al.' : ''}</span>
                <span>•</span>
                <span class="italic text-slate-400">${p.journal || 'Academic Publication'}</span>
              </div>
            </div>

            <!-- Abstract Paragraph -->
            <div class="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans line-clamp-3 hover:line-clamp-none transition-all cursor-pointer bg-slate-950/40 p-3 rounded-lg border border-slate-900"
              title="Click to expand/collapse abstract">
              <span class="font-semibold text-slate-400">Abstract: </span>
              ${p.abstract}
            </div>

            <!-- Methodology & Key Findings Highlights -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div class="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-900/40">
                <div class="font-semibold text-indigo-300 flex items-center gap-1 mb-0.5">
                  <i data-lucide="cpu" class="w-3 h-3"></i>
                  <span>Methodology / Tech:</span>
                </div>
                <div class="text-slate-300 text-[11px]">${matrix.methodology || 'Empirical Architecture'}</div>
              </div>

              <div class="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
                <div class="font-semibold text-emerald-300 flex items-center gap-1 mb-0.5">
                  <i data-lucide="check-circle" class="w-3 h-3"></i>
                  <span>Key Findings:</span>
                </div>
                <div class="text-slate-300 text-[11px] line-clamp-2">${matrix.findings || 'Reported quantitative benchmarks.'}</div>
              </div>
            </div>

            <!-- Action Toolbar (DOI, PDF, Cite, Copy) -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              
              <!-- DOI Link -->
              <div class="flex items-center gap-2">
                ${doi ? `
                  <a href="${doi}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-1 text-xs font-mono text-indigo-400 hover:text-indigo-300 hover:underline">
                    <i data-lucide="link" class="w-3 h-3"></i>
                    <span>${doi.replace('https://doi.org/', 'doi: ')}</span>
                  </a>
                ` : '<span class="text-xs text-slate-600 font-mono">No DOI</span>'}
              </div>

              <!-- Buttons -->
              <div class="flex flex-wrap items-center gap-2">
                
                <!-- Find Free Version Action -->
                <button onclick="window.openOaModal('${p.id}')"
                  class="px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-700/70 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Search Unpaywall, OpenAlex, arXiv, & Europe PMC for verified free copy">
                  <i data-lucide="unlock" class="w-3.5 h-3.5 text-emerald-400"></i>
                  <span>Find Free Version</span>
                </button>

                <!-- Research Intelligence Action -->
                <button onclick="window.openResearchModal('${p.id}')"
                  class="px-3 py-1.5 rounded-lg bg-violet-950/80 hover:bg-violet-900 text-violet-300 hover:text-white border border-violet-700/70 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  title="Analyze study design, population, sampling unit, and methodology">
                  <i data-lucide="brain" class="w-3.5 h-3.5 text-violet-400"></i>
                  <span>Research Intelligence</span>
                </button>

                <!-- Cite Button -->
                <button onclick="window.openCiteModal('${p.id}')"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <i data-lucide="quote" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span>Cite</span>
                </button>

                <!-- PDF Download Button or Publisher Link -->
                ${p.isOpenAccess && p.openAccessUrl ? `
                  <button type="button"
                    onclick="window.downloadPaperPdf(event, '${p.id}', '${encodeURIComponent(p.openAccessUrl)}', '${encodeURIComponent((p.authors?.[0] || 'Paper') + '_' + p.publicationYear + '.pdf')}', '${p.doi ? encodeURIComponent(p.doi) : ''}', '${encodeURIComponent((p.title || '').replace(/'/g, ''))}')"
                    class="px-3 py-1.5 rounded-lg ${p.hasDirectPdf !== false ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20' : 'bg-teal-700 hover:bg-teal-600 text-teal-100 shadow-teal-700/20'} text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
                    title="${p.hasDirectPdf !== false ? 'Download Verified Open-Access PDF' : 'Open / Resolve Open-Access Paper'}">
                    <i data-lucide="${p.hasDirectPdf !== false ? 'file-down' : 'book-open'}" class="w-3.5 h-3.5"></i>
                    <span>${p.hasDirectPdf !== false ? 'Download PDF' : 'Read Free Text'}</span>
                  </button>
                ` : `
                  <a href="${doi || 'https://scholar.google.com/scholar?q=' + encodeURIComponent(p.title)}" target="_blank" rel="noopener noreferrer"
                    class="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
                    title="Paywalled or subscription required">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    <span>Publisher Link</span>
                  </a>
                `}

              </div>

            </div>

          </article>
        `;
      }).join('')}
    </div>
  `;

  container.innerHTML = cardsHtml;
  lucide.createIcons();
}

/**
 * Toggle Binder for a Paper
 */
window.handleToggleBinder = function(paperId) {
  const paper = currentPapers.find(p => p.id === paperId) || window.binder.getAll().find(p => p.id === paperId);
  if (!paper) return;

  const added = window.binder.toggle(paper);
  showToast(added ? 'Added to My RRL Binder' : 'Removed from Binder', added ? 'success' : 'info');
  renderCurrentView();
};

window.handleCategoryChange = function(paperId, newCat) {
  window.binder.updateCategory(paperId, newCat);
  const paper = currentPapers.find(p => p.id === paperId);
  if (paper) {
    paper.rrlCategory = newCat;
  }
  showToast(`Updated to ${newCat}`, 'info');
};

/**
 * Citation Modal Management
 */
window.openCiteModal = function(paperId) {
  const paper = currentPapers.find(p => p.id === paperId) || window.binder.getAll().find(p => p.id === paperId);
  if (!paper) return;

  activeModalPaper = paper;
  document.getElementById('modalPaperTitle').textContent = paper.title;
  switchModalCiteStyle(activeCitationStyle);

  const modal = document.getElementById('citationModal');
  modal.classList.remove('hidden');
  lucide.createIcons();
};

window.closeCiteModal = function() {
  document.getElementById('citationModal').classList.add('hidden');
  activeModalPaper = null;
};

window.switchModalCiteStyle = function(style) {
  activeCitationStyle = style;
  if (!activeModalPaper) return;

  const styles = ['apa7', 'ieee', 'mla9', 'chicago', 'harvard', 'bibtex'];
  styles.forEach(s => {
    const tab = document.getElementById(`citeTab_${s}`);
    if (tab) {
      if (s === style) {
        tab.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-600 text-white shadow-sm';
      } else {
        tab.className = 'px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700';
      }
    }
  });

  const citations = activeModalPaper.citations || {};
  const refText = citations[style] || 'Formatting citation...';
  document.getElementById('modalCiteContent').textContent = refText;

  const inText = citations.inText || {};
  document.getElementById('modalInTextParenthetical').textContent = inText.parenthetical || '(Author, Year)';
  document.getElementById('modalInTextNarrative').textContent = inText.narrative || 'Author (Year)';
};

window.handleGlobalCitationStyleChange = function(style) {
  activeCitationStyle = style;
  showToast(`Switched active citation format to ${style.toUpperCase()}`, 'info');
};

/**
 * Clipboard Copy
 */
window.copyToClipboard = function(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
};

/**
 * Export Dropdown & Trigger
 */
window.toggleExportDropdown = function() {
  const menu = document.getElementById('exportDropdownMenu');
  menu.classList.toggle('hidden');
};

document.addEventListener('click', (e) => {
  const btn = document.getElementById('btnExportMenu');
  const menu = document.getElementById('exportDropdownMenu');
  if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

window.triggerExport = function(format) {
  const menu = document.getElementById('exportDropdownMenu');
  if (menu) menu.classList.add('hidden');

  // If in binder view or binder has items, give preference to binder if user saved papers
  const saved = window.binder.getAll();
  const papersToExport = (currentView === 'binder' || (saved.length > 0 && currentPapers.length === 0))
    ? saved 
    : (currentPapers.length > 0 ? currentPapers : saved);

  if (!papersToExport || papersToExport.length === 0) {
    showToast('No papers available to export. Search or save papers first.', 'warning');
    return;
  }

  const title = currentCapstoneTitle || 'Capstone Research';

  if (format === 'csv') {
    window.literatureExporter.exportToCsv(papersToExport);
    showToast('Exported Literature Matrix (CSV)!', 'success');
  } else if (format === 'comparison_csv') {
    const profile = getStoredResearchProfile();
    fetch('/api/research/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, papers: papersToExport })
    })
    .then(r => r.json())
    .then(data => {
      window.literatureExporter.exportComparisonToCsv(data.comparisons || []);
      showToast('Exported Methodology Comparison (CSV)!', 'success');
    })
    .catch(() => showToast('Failed to export comparison table', 'error'));
  } else if (format === 'justification_md') {
    const profile = getStoredResearchProfile();
    fetch('/api/research/justification-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, papers: papersToExport })
    })
    .then(r => r.json())
    .then(data => {
      window.literatureExporter.exportJustificationReportToMarkdown(data.report);
      showToast('Exported Justification Report (.md)!', 'success');
    })
    .catch(() => showToast('Failed to export justification report', 'error'));
  } else if (format === 'bibtex') {
    window.literatureExporter.exportToBibTeX(papersToExport);
    showToast('Exported BibTeX references (.bib)!', 'success');
  } else if (format === 'ris') {
    window.literatureExporter.exportToRIS(papersToExport);
    showToast('Exported RIS references (.ris)!', 'success');
  } else if (format === 'markdown') {
    window.literatureExporter.exportToMarkdown(papersToExport, title, activeCitationStyle);
    showToast('Exported Chapter 2 Draft (.md)!', 'success');
  }
};

window.toggleBinderDrawer = function() {
  window.switchView('binder');
};

/**
 * Status bar helper
 */
function updateResultsStatusBar(count) {
  const bar = document.getElementById('resultsStatusBar');
  const countText = document.getElementById('resultsCountText');
  const summaryText = document.getElementById('resultsRelevanceSummary');

  if (bar) bar.classList.remove('hidden');
  if (countText) countText.textContent = `Displaying ${count} scholarly studies`;
  if (summaryText) summaryText.textContent = `Ranked by similarity to capstone title`;
}

/**
 * Skeleton Loader
 */
function renderLoadingSkeleton() {
  const container = document.getElementById('mainDisplayArea');
  container.innerHTML = `
    <div class="space-y-4">
      ${[1, 2, 3].map(() => `
        <div class="glass-panel rounded-xl p-5 border border-slate-800 space-y-3 animate-pulse">
          <div class="flex items-center gap-2">
            <div class="h-5 w-24 bg-slate-800 rounded-full"></div>
            <div class="h-5 w-16 bg-slate-800 rounded-md"></div>
          </div>
          <div class="h-6 w-3/4 bg-slate-800 rounded"></div>
          <div class="h-4 w-1/2 bg-slate-800 rounded"></div>
          <div class="h-16 w-full bg-slate-800/60 rounded-lg"></div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Welcome Hero View
 */
function renderWelcomeHero() {
  const container = document.getElementById('mainDisplayArea');
  container.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
      
      <div class="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">1</div>
        <h3 class="text-sm font-bold text-white">Paste Capstone Title</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Input your capstone or thesis problem statement. The NLP engine extracts technical variables and ranks papers by semantic similarity.
        </p>
      </div>

      <div class="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">2</div>
        <h3 class="text-sm font-bold text-white">Synthesis Matrix & DOIs</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Instantly view the Chapter 2 matrix breakdown: Author/Year, Verified DOI, Methodology, Findings, and Research Gaps.
        </p>
      </div>

      <div class="glass-panel p-5 rounded-xl border border-slate-800 space-y-2">
        <div class="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">3</div>
        <h3 class="text-sm font-bold text-white">1-Click Citations & PDFs</h3>
        <p class="text-xs text-slate-400 leading-relaxed">
          Download open-access PDFs directly and export citations in APA 7th, IEEE, MLA, BibTeX, or pre-formatted Chapter 2 Markdown drafts.
        </p>
      </div>

    </div>
  `;
  lucide.createIcons();
}

function renderErrorState(message) {
  const container = document.getElementById('mainDisplayArea');
  container.innerHTML = `
    <div class="p-6 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs space-y-2 text-center">
      <i data-lucide="alert-triangle" class="w-8 h-8 mx-auto text-red-400"></i>
      <div class="font-bold text-sm">Failed to search literature</div>
      <div>${message}</div>
    </div>
  `;
  lucide.createIcons();
}

/**
 * Toast Notification System
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600 text-white' :
             type === 'warning' ? 'bg-amber-600 text-white' :
             type === 'error' ? 'bg-red-600 text-white' :
             'bg-slate-800 text-slate-200 border border-slate-700';

  toast.className = `px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl toast-slide-in pointer-events-auto flex items-center gap-2 ${bg}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ==========================================
// OPEN-ACCESS FINDER MODAL CONTROLLER
// ==========================================
let activeOaPaper = null;

window.openOaModal = async function(paperId) {
  const paper = currentPapers.find(p => p.id === paperId) || window.binder.getAll().find(p => p.id === paperId);
  if (!paper) return;

  activeOaPaper = paper;
  document.getElementById('oaModalPaperTitle').textContent = paper.title;
  document.getElementById('oaModalAuthors').textContent = (paper.authors || []).join(', ') || 'Anonymous Researcher';
  document.getElementById('oaModalYear').textContent = paper.publicationYear || 'n.d.';
  document.getElementById('oaModalDoi').textContent = paper.doi ? paper.doi.replace('https://doi.org/', 'doi: ') : 'No DOI listed';

  const modal = document.getElementById('oaFinderModal');
  const contentArea = document.getElementById('oaModalContentArea');

  // Loading skeleton
  contentArea.innerHTML = `
    <div class="space-y-4 py-6 text-center">
      <i data-lucide="loader-2" class="w-8 h-8 text-indigo-400 animate-spin mx-auto"></i>
      <div class="space-y-1">
        <div class="text-sm font-semibold text-slate-200">Querying Academic Providers...</div>
        <p class="text-xs text-slate-500">Searching Unpaywall, OpenAlex (250M+ works), arXiv preprints, & Europe PMC repositories</p>
      </div>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();

  try {
    const params = new URLSearchParams({
      doi: paper.doi || '',
      title: paper.title || '',
      authors: (paper.authors || []).join(','),
      year: paper.publicationYear || ''
    });

    const res = await fetch(`/api/open-access/find?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    renderOaDiscoveryResults(contentArea, data, paper);
  } catch (err) {
    console.error('OA Discovery Error:', err);
    contentArea.innerHTML = `
      <div class="p-5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs text-center space-y-2">
        <i data-lucide="alert-triangle" class="w-6 h-6 mx-auto text-red-400"></i>
        <div class="font-bold">Failed to complete open-access discovery</div>
        <div>${err.message}</div>
      </div>
    `;
    lucide.createIcons();
  }
};

window.closeOaModal = function() {
  document.getElementById('oaFinderModal').classList.add('hidden');
  activeOaPaper = null;
};

function renderOaDiscoveryResults(container, data, targetPaper) {
  const versions = data.versions || [];
  const alternatives = data.alternatives || [];

  if (versions.length === 0) {
    // Render lawful alternatives
    container.innerHTML = `
      <div class="space-y-4">
        
        <div class="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-3">
          <i data-lucide="info" class="w-5 h-5 text-amber-400 shrink-0 mt-0.5"></i>
          <div class="space-y-1">
            <div class="font-bold text-sm text-amber-100">No Verified Open-Access Version Located</div>
            <p class="text-slate-300 leading-relaxed">
              We checked Unpaywall, OpenAlex, arXiv, and Europe PMC repositories. No confirmed free PDF or authorized open-access repository manuscript was found for this specific paper.
            </p>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Legitimate & Lawful Alternative Access Pathways:
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${alternatives.map(alt => `
              <div class="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div class="font-bold text-slate-200 text-xs">${alt.title}</div>
                  <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${alt.description}</p>
                </div>
                <a href="${alt.url}" target="_blank" rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold mt-2">
                  <span>${alt.actionText}</span>
                  <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Render discovered versions
  const versionsHtml = `
    <div class="space-y-4">
      
      <div class="flex items-center justify-between text-xs text-slate-400 px-1">
        <span class="font-semibold text-slate-200">Discovered ${versions.length} Legitimate Open-Access Cop${versions.length === 1 ? 'y' : 'ies'}:</span>
        <span class="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
          <i data-lucide="check-circle" class="w-3 h-3"></i>
          <span>Exact-Paper Matching Verified</span>
        </span>
      </div>

      <div class="space-y-3">
        ${versions.map((v, idx) => {
          const isPdf = v.hasVerifiedPdf || Boolean(v.pdfUrl);
          const badgeBg = 
            v.accessClassification === 'Open Access PDF' ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700' :
            v.accessClassification === 'Preprint' ? 'bg-violet-950/80 text-violet-300 border-violet-700' :
            v.accessClassification === 'Repository Copy' ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700' :
            v.accessClassification === 'Free Publisher Version' ? 'bg-teal-950/80 text-teal-300 border-teal-700' :
            v.accessClassification === 'Free Full Text' ? 'bg-sky-950/80 text-sky-300 border-sky-700' :
            'bg-slate-800 text-slate-300 border-slate-700';

          const downloadFilename = (targetPaper.authors?.[0] || 'Paper') + '_' + (targetPaper.publicationYear || '2024') + '.pdf';

          return `
            <div class="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3">
              
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-200 text-xs">${idx + 1}. ${v.providerName}</span>
                  <span class="px-2 py-0.5 rounded-full border text-[10px] font-bold ${badgeBg}">
                    ${v.accessClassification}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500 font-mono">
                  ${v.version}
                </div>
              </div>

              <div class="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><span class="text-slate-500">Source Database:</span> ${v.source}</span>
                <span><span class="text-slate-500">License:</span> ${v.license || 'Open Access'}</span>
                ${v.confidence ? `<span><span class="text-slate-500">Identity Match:</span> ${Math.round(v.confidence * 100)}%</span>` : ''}
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                <a href="${v.url || v.landingPageUrl || v.pdfUrl}" target="_blank" rel="noopener noreferrer"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                  <span>Open Source Page</span>
                </a>

                ${isPdf && v.pdfUrl ? `
                  <button type="button"
                    onclick="window.downloadPaperPdf(event, '${targetPaper.id}', '${encodeURIComponent(v.pdfUrl)}', '${encodeURIComponent(downloadFilename)}', '${targetPaper.doi ? encodeURIComponent(targetPaper.doi) : ''}', '${encodeURIComponent((targetPaper.title || '').replace(/'/g, ''))}')"
                    class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all">
                    <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
                    <span>Download PDF</span>
                  </button>
                ` : ''}
              </div>

            </div>
          `;
        }).join('')}
      </div>

    </div>
  `;

  container.innerHTML = versionsHtml;
  lucide.createIcons();
}

// ==========================================
// RESEARCH INTELLIGENCE MODAL CONTROLLER
// ==========================================
let activeRiAnalysis = null;
let activeRiTab = 'overview';

window.openResearchModal = async function(paperId) {
  const paper = currentPapers.find(p => p.id === paperId) || window.binder.getAll().find(p => p.id === paperId);
  if (!paper) return;

  document.getElementById('riModalPaperTitle').textContent = paper.title;
  const modal = document.getElementById('researchIntelligenceModal');
  const body = document.getElementById('riModalBody');

  body.innerHTML = `
    <div class="space-y-4 py-8 text-center">
      <i data-lucide="loader-2" class="w-8 h-8 text-violet-400 animate-spin mx-auto"></i>
      <div class="text-sm font-semibold text-slate-200">Extracting Research Intelligence & Methodology...</div>
      <p class="text-xs text-slate-500">Analyzing study design, sampling units, sample size justification, and empirical metrics</p>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();

  try {
    const res = await fetch('/api/research/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    activeRiAnalysis = data.analysis;
    
    // Set badge
    const badge = document.getElementById('riModalAnalysisBadge');
    badge.textContent = activeRiAnalysis.analysisLevel;
    if (activeRiAnalysis.isFullTextAvailable) {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }

    switchRiTab('overview');
  } catch (err) {
    console.error('RI Error:', err);
    body.innerHTML = `
      <div class="p-5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs text-center space-y-2">
        <i data-lucide="alert-triangle" class="w-6 h-6 mx-auto text-red-400"></i>
        <div class="font-bold">Failed to analyze research intelligence</div>
        <div>${err.message}</div>
      </div>
    `;
    lucide.createIcons();
  }
};

window.closeResearchModal = function() {
  document.getElementById('researchIntelligenceModal').classList.add('hidden');
  activeRiAnalysis = null;
};

window.switchRiTab = function(tabName) {
  activeRiTab = tabName;
  const tabs = ['overview', 'design', 'sampling', 'protocol', 'statistics', 'findings', 'limitations', 'samplesize', 'evidence'];
  tabs.forEach(t => {
    const btn = document.getElementById(`riTab_${t}`);
    if (btn) {
      if (t === tabName) {
        btn.className = 'px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap bg-indigo-600 text-white shadow-sm';
      } else {
        btn.className = 'px-3 py-1.5 rounded-lg font-medium whitespace-nowrap text-slate-400 hover:text-white hover:bg-slate-800';
      }
    }
  });

  const body = document.getElementById('riModalBody');
  if (!activeRiAnalysis) return;

  const a = activeRiAnalysis;

  if (tabName === 'overview') {
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Research Problem & Context</div>
          <p class="text-xs text-slate-200 leading-relaxed">${a.studyOverview.researchProblem}</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Primary Research Type</div>
            <div class="font-bold text-slate-100 text-sm">${a.studyOverview.researchType}</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Discipline</div>
            <div class="font-bold text-slate-100 text-sm">${a.studyOverview.discipline}</div>
          </div>
        </div>

        ${a.studyOverview.secondaryDesigns.length > 0 ? `
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Secondary Design Classifications</div>
            <div class="flex flex-wrap gap-2">
              ${a.studyOverview.secondaryDesigns.map(s => `
                <span class="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs font-medium">${s}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (tabName === 'design') {
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50 space-y-2">
          <div class="font-bold text-indigo-300 text-sm">Classification: ${a.researchDesign.primary}</div>
          <div class="text-xs text-slate-300">
            Methodological status: <span class="font-semibold text-white">${a.researchDesign.isExplicitlyReported ? 'Explicitly Stated by Authors' : 'Inferred from Methodological Context'}</span>
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-xs font-bold text-slate-300">Classifications & Evidentiary Grounding:</div>
          <div class="space-y-2">
            ${a.researchDesign.matchedDetails.map(m => `
              <div class="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <div class="font-semibold text-slate-200">${m.label}</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">${m.evidence}</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 text-[10px] font-mono font-bold">
                  ${Math.round(m.confidence * 100)}% match
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (tabName === 'sampling') {
    const s = a.samplingDesign;
    body.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sampling Unit (Exact Entity)</div>
            <div class="text-sm font-bold text-indigo-300">${s.samplingUnit}</div>
          </div>
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sampling Technique</div>
            <div class="text-sm font-bold text-slate-200">${s.samplingTechnique.name}</div>
            <div class="text-[10px] text-slate-400">${s.samplingTechnique.category}</div>
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Population / Scope</div>
          <p class="text-xs text-slate-200">${s.targetPopulation}</p>
        </div>

        ${s.allDetectedUnits.length > 0 ? `
          <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Detected Quantitative Counts in Source</div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${s.allDetectedUnits.map(u => `
                <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div class="text-[10px] text-slate-400">${u.unit}</div>
                  <div class="font-bold text-slate-100 text-sm mt-0.5">${u.count !== null ? u.count.toLocaleString() : 'Count noted'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (tabName === 'protocol') {
    const p = a.technicalProtocol;
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hardware & Embedded Stack</div>
          <div class="flex flex-wrap gap-2">
            ${p.hardwareStack.length > 0 ? p.hardwareStack.map(h => `
              <span class="px-2.5 py-1 rounded-md bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 font-medium">${h}</span>
            `).join('') : '<span class="text-slate-500 italic">No specific hardware chips identified in abstract (Requires Full-Text Review)</span>'}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Software Stack & Libraries</div>
          <div class="flex flex-wrap gap-2">
            ${p.softwareStack.length > 0 ? p.softwareStack.map(sw => `
              <span class="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-medium">${sw}</span>
            `).join('') : '<span class="text-slate-500 italic">General software stack (Requires Full-Text Review)</span>'}
          </div>
        </div>

        ${p.standardsCompliance ? `
          <div class="p-4 rounded-xl bg-violet-950/40 border border-violet-800/60 space-y-2">
            <div class="text-[11px] font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="shield-check" class="w-4 h-4 text-violet-400"></i>
              <span>Standards Compliance: ${p.standardsCompliance.standard}</span>
            </div>
            <div class="text-xs text-slate-200">${p.standardsCompliance.title}</div>
            <div class="text-[11px] text-slate-400 mt-1">Noise source: <span class="text-slate-200 font-medium">${p.standardsCompliance.noiseSource}</span></div>
            <p class="text-[11px] text-amber-300/90 italic pt-1 border-t border-violet-900/60">${p.standardsCompliance.caveat}</p>
          </div>
        ` : ''}
      </div>
    `;
  } else if (tabName === 'statistics') {
    const st = a.statisticalMethods;
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statistical Analysis Framework</div>
          <div class="space-y-1.5 pt-1">
            ${st.methodsIdentified.map(m => `
              <div class="flex items-center gap-2 text-slate-200 text-xs">
                <i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>
                <span>${m}</span>
              </div>
            `).join('')}
          </div>
          <div class="text-[10px] text-slate-500 pt-2 border-t border-slate-900">Provenance: ${st.status}</div>
        </div>
      </div>
    `;
  } else if (tabName === 'findings') {
    const f = a.findings;
    body.innerHTML = `
      <div class="space-y-4">
        ${f.length > 0 ? `
          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-300">Structured Empirical Outcomes & Metrics:</div>
            <div class="space-y-2">
              ${f.map(item => `
                <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div class="font-bold text-emerald-300 text-xs">${item.metricType}</div>
                    <div class="text-[11px] text-slate-400 mt-0.5">Reported snippet: "${item.rawEvidence}"</div>
                  </div>
                  <span class="px-3 py-1 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-bold text-xs">
                    ${item.reportedValue}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="p-6 rounded-xl bg-slate-950/50 border border-slate-800 text-center text-slate-400 text-xs">
            No isolated quantitative percentages or numerical metrics parsed from abstract text. Check full text tables for exact benchmark numbers.
          </div>
        `}
      </div>
    `;
  } else if (tabName === 'limitations') {
    const lim = a.limitations;
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="alert-circle" class="w-4 h-4"></i>
            <span>Author-Reported Limitations</span>
          </div>
          <div class="space-y-2 pt-1">
            ${lim.authorLimitations.map(al => `
              <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 leading-relaxed">
                ${al.statement}
                <div class="text-[10px] text-slate-500 mt-1">${al.source}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="microscope" class="w-4 h-4"></i>
            <span>LitFinder Analytical Threats to Validity (Observation)</span>
          </div>
          <div class="space-y-2 pt-1">
            ${lim.analyticalThreats.map(at => `
              <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                <div class="font-bold text-slate-200 text-xs">${at.threat}</div>
                <p class="text-[11px] text-slate-400 leading-relaxed">${at.observation}</p>
                <div class="text-[10px] text-indigo-400 font-medium">${at.type}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } else if (tabName === 'samplesize') {
    const ss = a.samplingDesign.sampleSize;
    const just = a.sampleSizeJustification;
    const warn = a.samplingDesign.hardwareGeneralizabilityWarning;

    body.innerHTML = `
      <div class="space-y-4">
        
        ${warn ? `
          <div class="p-4 rounded-xl bg-amber-950/40 border border-amber-800/80 text-amber-200 space-y-2">
            <div class="font-bold text-xs flex items-center gap-1.5 text-amber-300">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400"></i>
              <span>CRITICAL SAMPLING DISTINCTION: Independent Units vs Repeated Measurements</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">${warn.message}</p>
          </div>
        ` : ''}

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Independent Units (N)</div>
            <div class="text-base font-extrabold text-emerald-300">
              ${ss.independentUnitsCount !== null ? ss.independentUnitsCount : 'Not explicitly reported'}
            </div>
            <div class="text-[10px] text-slate-500">${ss.independentUnitsType}</div>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Repeated Sessions / Restarts</div>
            <div class="text-base font-extrabold text-indigo-300">
              ${ss.restartSessions !== null ? ss.restartSessions : 'Not reported'}
            </div>
            <div class="text-[10px] text-slate-500">Repeated measurement cycles</div>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Raw Observations</div>
            <div class="text-base font-extrabold text-violet-300">
              ${ss.totalRawObservations ? ss.totalRawObservations.toLocaleString() : (ss.derivedCalculation ? ss.derivedCalculation.calculatedValue.toLocaleString() : 'Not reported')}
            </div>
            <div class="text-[10px] text-slate-500">Data points / samples</div>
          </div>
        </div>

        ${ss.derivedCalculation ? `
          <div class="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div class="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <i data-lucide="calculator" class="w-3.5 h-3.5 text-indigo-400"></i>
              <span>Derived Observation Computation:</span>
            </div>
            <div class="font-mono text-xs text-indigo-300 bg-slate-900 p-2 rounded-lg">
              ${ss.derivedCalculation.formula}
            </div>
            <div class="text-[11px] text-slate-400">
              Inputs: ${ss.derivedCalculation.inputs.restartSessions} restart sessions × ${ss.derivedCalculation.inputs.observationsPerSession.toLocaleString()} samples = <span class="font-bold text-white">${ss.derivedCalculation.calculatedValue.toLocaleString()}</span>
            </div>
          </div>
        ` : ''}

        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Sample-Size Justification Rationale</div>
          <div class="font-semibold text-slate-200 text-xs">${just.primaryRationale}</div>
          <p class="text-[11px] text-slate-400 leading-relaxed">${just.note}</p>
        </div>

      </div>
    `;
  } else if (tabName === 'evidence') {
    const ev = a.evidenceProvenance;
    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
          <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Extraction Reliability & Provenance</div>
          <div class="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div class="text-[10px] text-slate-500">Analyzed Source Material</div>
              <div class="font-bold text-slate-200 text-xs mt-0.5">${ev.sourceType}</div>
            </div>
            <div>
              <div class="text-[10px] text-slate-500">Extraction Confidence</div>
              <div class="font-bold text-emerald-400 text-xs mt-0.5">${Math.round(ev.confidenceScore * 100)}%</div>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-900 text-[11px] text-slate-500">
            Rule verification: LitFinder does NOT manufacture page numbers, tables, or unstated sample sizes when analyzing abstract records.
          </div>
        </div>
      </div>
    `;
  }

  lucide.createIcons();
};

// ==========================================
// RESEARCH PROFILE CONTROLLER
// ==========================================
const PROFILE_STORAGE_KEY = 'litfinder_research_profile_v1';

function getStoredResearchProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    title: 'Machine-Learning–Assisted Entropy Estimation and Fusion for TPM-Bound Cryptographic Key Generation on Representative Intel and AMD Endpoints',
    discipline: 'Cybersecurity / Cryptographic Engineering',
    researchDesign: 'Quantitative, Controlled Technical Evaluation and Entropy-Source Characterization',
    samplingUnit: 'Physical Hardware Devices / Endpoints',
    samplingTechnique: 'Purposive Selection of Representative Hardware Endpoints',
    independentUnitsCount: 2,
    independentUnitsDescription: 'Two TPM 2.0-supported physical endpoints: one Intel-based and one AMD-based',
    repeatedSessionsCount: 10,
    observationsPerSession: 1000000,
    dataCollectionMethod: 'Restart-based raw measurement collection from mouse movement and CPU timing jitter',
    validationStandards: 'NIST SP 800-90B Recommendation for the Entropy Sources Used for Random Bit Generation',
    sampleSizeQuestion: 'What published studies use similarly small numbers of physical hardware endpoints while performing repeated measurements or restart-based validation?'
  };
}

window.openProfileModal = function() {
  const profile = getStoredResearchProfile();
  document.getElementById('profTitle').value = profile.title || '';
  document.getElementById('profDiscipline').value = profile.discipline || '';
  document.getElementById('profDesign').value = profile.researchDesign || '';
  document.getElementById('profSamplingUnit').value = profile.samplingUnit || '';
  document.getElementById('profSamplingTechnique').value = profile.samplingTechnique || '';
  document.getElementById('profIndependentN').value = profile.independentUnitsCount || 2;
  document.getElementById('profIndependentDesc').value = profile.independentUnitsDescription || '';
  document.getElementById('profRepeatedSessions').value = profile.repeatedSessionsCount || 10;
  document.getElementById('profObservationsPerSession').value = profile.observationsPerSession || 1000000;
  document.getElementById('profDataCollection').value = profile.dataCollectionMethod || '';
  document.getElementById('profValidationStandards').value = profile.validationStandards || '';
  document.getElementById('profSampleQuestion').value = profile.sampleSizeQuestion || '';

  document.getElementById('researchProfileModal').classList.remove('hidden');
  lucide.createIcons();
};

window.closeProfileModal = function() {
  document.getElementById('researchProfileModal').classList.add('hidden');
};

window.loadTpmEntropyPreset = function() {
  fetch('/api/research/sample-profile')
    .then(r => r.json())
    .then(data => {
      const p = data.profile;
      document.getElementById('profTitle').value = p.title;
      document.getElementById('profDiscipline').value = p.discipline;
      document.getElementById('profDesign').value = p.researchDesign;
      document.getElementById('profSamplingUnit').value = p.samplingUnit;
      document.getElementById('profSamplingTechnique').value = p.samplingTechnique;
      document.getElementById('profIndependentN').value = p.independentUnitsCount;
      document.getElementById('profIndependentDesc').value = p.independentUnitsDescription;
      document.getElementById('profRepeatedSessions').value = p.repeatedSessionsCount;
      document.getElementById('profObservationsPerSession').value = p.observationsPerSession;
      document.getElementById('profDataCollection').value = p.dataCollectionMethod;
      document.getElementById('profValidationStandards').value = p.validationStandards;
      document.getElementById('profSampleQuestion').value = p.sampleSizeQuestion;
      showToast('Loaded TPM Entropy Benchmark Profile Preset', 'success');
    });
};

window.saveResearchProfile = function(event) {
  if (event) event.preventDefault();

  const profile = {
    title: document.getElementById('profTitle').value.trim(),
    discipline: document.getElementById('profDiscipline').value.trim(),
    researchDesign: document.getElementById('profDesign').value.trim(),
    samplingUnit: document.getElementById('profSamplingUnit').value.trim(),
    samplingTechnique: document.getElementById('profSamplingTechnique').value.trim(),
    independentUnitsCount: parseInt(document.getElementById('profIndependentN').value, 10) || 2,
    independentUnitsDescription: document.getElementById('profIndependentDesc').value.trim(),
    repeatedSessionsCount: parseInt(document.getElementById('profRepeatedSessions').value, 10) || 10,
    observationsPerSession: parseInt(document.getElementById('profObservationsPerSession').value, 10) || 1000000,
    dataCollectionMethod: document.getElementById('profDataCollection').value.trim(),
    validationStandards: document.getElementById('profValidationStandards').value.trim(),
    sampleSizeQuestion: document.getElementById('profSampleQuestion').value.trim()
  };

  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  showToast('Research Profile saved successfully!', 'success');
  closeProfileModal();

  if (currentView === 'comparable') {
    renderCurrentView();
  }
};

// ==========================================
// COMPARABLE SAMPLING STUDIES VIEW
// ==========================================
let currentComparisons = [];

async function renderComparableView(container) {
  const profile = getStoredResearchProfile();
  const papers = currentPapers.length > 0 ? currentPapers : window.binder.getAll();

  if (papers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-slate-800">
        <i data-lucide="git-compare" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
        <h3 class="text-base font-semibold text-slate-200">No literature available to compare</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Perform a search or add candidate papers to your binder first to evaluate methodological comparability.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = `
    <div class="space-y-4 py-8 text-center">
      <i data-lucide="loader-2" class="w-8 h-8 text-indigo-400 animate-spin mx-auto"></i>
      <div class="text-sm font-semibold text-slate-200">Comparing Literature Against Research Profile...</div>
      <p class="text-xs text-slate-500">Evaluating sampling unit alignment, independent sample size, repeated sessions, and validation standards</p>
    </div>
  `;
  lucide.createIcons();

  try {
    const res = await fetch('/api/research/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, papers })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentComparisons = data.comparisons || [];
    renderComparableTable(container, profile, currentComparisons);
  } catch (err) {
    console.error('Comparison error:', err);
    container.innerHTML = `
      <div class="p-6 rounded-xl bg-red-950/40 border border-red-800 text-red-200 text-xs space-y-2 text-center">
        <div class="font-bold">Failed to compare studies</div>
        <div>${err.message}</div>
      </div>
    `;
    lucide.createIcons();
  }
}

function renderComparableTable(container, profile, comparisons) {
  container.innerHTML = `
    <div class="space-y-4">
      
      <!-- Profile Header Summary Banner -->
      <div class="glass-panel p-5 rounded-2xl border border-slate-800 space-y-3 relative overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
              <i data-lucide="target" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="text-xs text-slate-400">Comparing Against Active Research Profile:</div>
              <h3 class="text-sm font-bold text-white">${profile.title}</h3>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="window.openProfileModal()" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors">
              Edit Profile
            </button>
            <button onclick="window.openJustificationReportModal()" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all">
              <i data-lucide="file-check" class="w-3.5 h-3.5"></i>
              <span>Generate Justification Report</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <span class="text-slate-500 text-[10px] block">Sampling Unit:</span>
            <span class="text-slate-200 font-semibold">${profile.samplingUnit}</span>
          </div>
          <div>
            <span class="text-slate-500 text-[10px] block">Independent Units (N):</span>
            <span class="text-emerald-400 font-semibold">${profile.independentUnitsCount} ${profile.independentUnitsDescription ? `(${profile.independentUnitsDescription})` : ''}</span>
          </div>
          <div>
            <span class="text-slate-500 text-[10px] block">Repeated Sessions:</span>
            <span class="text-indigo-300 font-semibold">${profile.repeatedSessionsCount} sessions × ${profile.observationsPerSession?.toLocaleString()} samples</span>
          </div>
          <div>
            <span class="text-slate-500 text-[10px] block">Validation Standard:</span>
            <span class="text-violet-300 font-semibold truncate block">${profile.validationStandards || 'Empirical'}</span>
          </div>
        </div>
      </div>

      <!-- 16-Column Comparison Table -->
      <div class="overflow-x-auto border border-slate-800 rounded-xl shadow-2xl bg-slate-900/60 backdrop-blur">
        <table class="w-full text-left text-xs text-slate-300 border-collapse matrix-table">
          <thead class="bg-slate-950/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th class="p-3 w-32">Study & Year</th>
              <th class="p-3 w-56">Title & DOI</th>
              <th class="p-3 w-40 text-center">Comparability</th>
              <th class="p-3 w-40">Sampling Unit</th>
              <th class="p-3 w-36">Independent N</th>
              <th class="p-3 w-40">Repeated Structure</th>
              <th class="p-3 w-40">Sampling Method</th>
              <th class="p-3 w-44">Standards Compliance</th>
              <th class="p-3 w-48">Author Justification</th>
              <th class="p-3 w-56">Methodological Similarities</th>
              <th class="p-3 w-56">Methodological Differences</th>
              <th class="p-3 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${comparisons.map(c => {
              const s = c.evidenceSummary || {};
              const doi = c.doi ? (c.doi.startsWith('http') ? c.doi : `https://doi.org/${c.doi}`) : null;

              return `
                <tr class="hover:bg-slate-800/40 transition-colors">
                  <td class="p-3 font-semibold text-slate-100 whitespace-nowrap">
                    <div>${c.authors?.[0] || 'Unknown'} (${c.publicationYear || 'n.d.'})</div>
                  </td>
                  <td class="p-3">
                    <div class="font-medium text-slate-200 line-clamp-2">${c.title}</div>
                    ${doi ? `<a href="${doi}" target="_blank" class="text-[10px] font-mono text-indigo-400 hover:underline">DOI link</a>` : ''}
                  </td>
                  <td class="p-3 text-center">
                    <span class="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${c.badgeColor}">
                      ${c.classification}
                    </span>
                    <div class="text-[10px] text-slate-400 mt-0.5">${c.comparabilityScore}% Match</div>
                  </td>
                  <td class="p-3 text-slate-300">${s.studySamplingUnit}</td>
                  <td class="p-3 font-semibold text-emerald-300">N = ${s.studyIndependentN}</td>
                  <td class="p-3 text-slate-300">${s.studyRepeatedStructure}</td>
                  <td class="p-3 text-slate-400">${c.analysis?.samplingDesign?.samplingTechnique?.name || 'Purposive'}</td>
                  <td class="p-3 text-violet-300 text-[11px]">${s.standardsCompliance}</td>
                  <td class="p-3 text-slate-400 text-[11px] line-clamp-2">${s.authorJustification}</td>
                  <td class="p-3 text-[11px] text-slate-300">
                    <ul class="list-disc list-inside space-y-0.5">
                      ${c.similarities.slice(0, 2).map(sim => `<li>${sim}</li>`).join('')}
                    </ul>
                  </td>
                  <td class="p-3 text-[11px] text-amber-300/90">
                    <ul class="list-disc list-inside space-y-0.5">
                      ${c.differences.slice(0, 2).map(diff => `<li>${diff}</li>`).join('')}
                    </ul>
                  </td>
                  <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <button onclick="window.openOaModal('${c.paperId}')" class="p-1 rounded bg-indigo-950 text-indigo-300 hover:text-white" title="Find Free Version">
                        <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="window.openResearchModal('${c.paperId}')" class="p-1 rounded bg-violet-950 text-violet-300 hover:text-white" title="Research Intelligence">
                        <i data-lucide="brain" class="w-3.5 h-3.5"></i>
                      </button>
                      <button onclick="window.openCiteModal('${c.paperId}')" class="p-1 rounded bg-slate-800 text-slate-300 hover:text-white" title="Cite">
                        <i data-lucide="quote" class="w-3.5 h-3.5"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
  lucide.createIcons();
}

// ==========================================
// JUSTIFICATION REPORT MODAL CONTROLLER
// ==========================================
let currentJustificationReport = null;

window.openJustificationReportModal = async function() {
  const profile = getStoredResearchProfile();
  const papers = currentPapers.length > 0 ? currentPapers : window.binder.getAll();

  const modal = document.getElementById('justificationReportModal');
  const content = document.getElementById('justificationReportContent');

  content.innerHTML = `
    <div class="space-y-4 py-8 text-center">
      <i data-lucide="loader-2" class="w-8 h-8 text-violet-400 animate-spin mx-auto"></i>
      <div class="text-sm font-semibold text-slate-200">Synthesizing Evidence-Linked Rationale...</div>
      <p class="text-xs text-slate-500">Formulating 10-section justification report grounded in published literature precedent</p>
    </div>
  `;
  modal.classList.remove('hidden');
  lucide.createIcons();

  try {
    const res = await fetch('/api/research/justification-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, papers })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    currentJustificationReport = data.report;
    renderJustificationReportContent(content, currentJustificationReport);
  } catch (err) {
    console.error('Report error:', err);
    content.innerHTML = `
      <div class="p-5 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs text-center space-y-2">
        <div class="font-bold">Failed to generate justification report</div>
        <div>${err.message}</div>
      </div>
    `;
    lucide.createIcons();
  }
};

window.closeJustificationReportModal = function() {
  document.getElementById('justificationReportModal').classList.add('hidden');
};

function renderJustificationReportContent(container, report) {
  const s = report.sections;

  let html = `
    <div class="space-y-5">
      
      <div class="p-4 rounded-xl bg-violet-950/40 border border-violet-800/60 space-y-1">
        <div class="text-[11px] font-bold uppercase tracking-wider text-violet-300">Target Study Problem & Scope</div>
        <div class="text-sm font-bold text-white">${report.profile.title}</div>
        <div class="text-xs text-slate-400">Total literature analyzed: ${report.totalStudiesAnalyzed} (${report.comparableStudiesCount} comparable matches)</div>
      </div>

      <div class="space-y-4">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(idx => {
          const sec = s[idx];
          if (!sec) return '';

          const isDraftRationale = idx === 10;
          const isCaution = idx === 8;

          const boxClass = isDraftRationale 
            ? 'p-4 rounded-xl bg-indigo-950/60 border border-indigo-700 space-y-2' 
            : (isCaution ? 'p-4 rounded-xl bg-amber-950/30 border border-amber-800 space-y-2' : 'p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2');

          return `
            <div class="${boxClass}">
              <div class="flex items-center justify-between">
                <h4 class="font-bold text-xs uppercase tracking-wider ${isDraftRationale ? 'text-indigo-300 font-extrabold' : (isCaution ? 'text-amber-300' : 'text-slate-300')}">
                  ${idx}. ${sec.title}
                </h4>
                ${isDraftRationale ? `
                  <button onclick="window.copyToClipboard('secRationaleText')" class="text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold flex items-center gap-1">
                    <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    <span>Copy Draft Rationale</span>
                  </button>
                ` : ''}
              </div>
              <div id="${isDraftRationale ? 'secRationaleText' : ''}" class="text-xs text-slate-200 leading-relaxed whitespace-pre-line select-all ${isDraftRationale ? 'font-serif-academic text-sm p-3 bg-slate-900 rounded-lg border border-indigo-900/50' : ''}">
                ${sec.content}
              </div>
            </div>
          `;
        }).join('')}
      </div>

    </div>
  `;

  container.innerHTML = html;
  lucide.createIcons();
}

// ==========================================
// CLIENT-SIDE PDF DOWNLOAD & FALLBACK CONTROLLER
// ==========================================
window.downloadPaperPdf = async function(event, paperId, rawTargetUrl, rawFilename, rawDoi, rawTitle) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const targetUrl = decodeURIComponent(rawTargetUrl || '');
  const customFilename = decodeURIComponent(rawFilename || 'academic_paper.pdf');
  const doi = rawDoi ? decodeURIComponent(rawDoi) : '';
  const title = rawTitle ? decodeURIComponent(rawTitle) : 'Research Paper';

  const btn = event?.currentTarget;
  const originalHtml = btn ? btn.innerHTML : '';
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Resolving PDF...</span>`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const proxyUrl = `/api/pdf/proxy?url=${encodeURIComponent(targetUrl)}&filename=${encodeURIComponent(customFilename)}`;
    const response = await fetch(proxyUrl);
    const contentType = (response.headers.get('content-type') || '').toLowerCase();

    // If upstream returned a verified PDF stream
    if (response.ok && contentType.includes('application/pdf')) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = customFilename.endsWith('.pdf') ? customFilename : `${customFilename}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      showToast(`Downloaded "${customFilename}"`, 'success');
      return;
    }

    // Upstream returned an error or landing page
    let errData = {};
    try {
      errData = await response.json();
    } catch {
      errData = { message: await response.text() };
    }

    const landingUrl = errData.landingUrl || targetUrl || doi;
    window.showPdfFallbackModal({
      title,
      doi,
      targetUrl: landingUrl,
      reason: errData.message || 'Direct automated streaming is restricted by this repository or requires an interactive session.',
      paperId
    });

  } catch (err) {
    console.error('PDF Download Error:', err);
    window.showPdfFallbackModal({
      title,
      doi,
      targetUrl: targetUrl || doi,
      reason: err.message,
      paperId
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      if (window.lucide) lucide.createIcons();
    }
  }
};

window.showPdfFallbackModal = function({ title, doi, targetUrl, reason, paperId }) {
  let modal = document.getElementById('pdfFallbackModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pdfFallbackModal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm';
    document.body.appendChild(modal);
  }

  const cleanDoi = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : '';
  const openUrl = targetUrl || cleanDoi;

  modal.innerHTML = `
    <div class="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 toast-slide-in">
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <i data-lucide="shield-alert" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white leading-snug">Interactive Reader Required</h3>
            <p class="text-[11px] text-slate-400">Upstream publisher restricted raw binary streaming</p>
          </div>
        </div>
        <button onclick="window.closePdfFallbackModal()" class="text-slate-400 hover:text-white p-1 rounded-lg">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
        <div class="font-semibold text-slate-200 line-clamp-2">${title}</div>
        <p class="text-[11px] text-amber-300/90 leading-relaxed">
          ${reason}
        </p>
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Major academic repositories (such as IEEE Xplore, ScienceDirect, or Springer) protect full-text downloads with interactive sessions, CAPTCHA, or custom browser readers. You can read the paper directly on the publisher portal or check for open repository preprints.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
        ${openUrl ? `
          <a href="${openUrl}" target="_blank" rel="noopener noreferrer"
            class="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/30 transition-all">
            <i data-lucide="external-link" class="w-4 h-4"></i>
            <span>Open Paper on Publisher Portal</span>
          </a>
        ` : ''}

        ${paperId ? `
          <button onclick="window.closePdfFallbackModal(); window.openOaModal('${paperId}')"
            class="px-4 py-2.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all">
            <i data-lucide="unlock" class="w-4 h-4"></i>
            <span>Find Free Alternative Copy</span>
          </button>
        ` : ''}
      </div>

      <div class="text-center pt-1">
        <button onclick="window.closePdfFallbackModal()" class="text-[11px] text-slate-500 hover:text-slate-300">
          Dismiss
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closePdfFallbackModal = function() {
  const modal = document.getElementById('pdfFallbackModal');
  if (modal) modal.classList.add('hidden');
};

