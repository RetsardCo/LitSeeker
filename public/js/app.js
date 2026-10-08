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
    binder: document.getElementById('tabBinder')
  };

  Object.entries(tabs).forEach(([name, el]) => {
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
              <div class="flex items-center gap-2">
                
                <!-- Cite Button -->
                <button onclick="window.openCiteModal('${p.id}')"
                  class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors">
                  <i data-lucide="quote" class="w-3.5 h-3.5 text-indigo-400"></i>
                  <span>Cite</span>
                </button>

                <!-- PDF Download Button -->
                ${p.isOpenAccess && p.openAccessUrl ? `
                  <a href="/api/pdf/proxy?url=${encodeURIComponent(p.openAccessUrl)}&filename=${encodeURIComponent((p.authors?.[0] || 'Paper') + '_' + p.publicationYear + '.pdf')}"
                    target="_blank" download
                    class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all">
                    <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
                    <span>Download PDF</span>
                  </a>
                ` : `
                  <a href="${doi || 'https://scholar.google.com/scholar?q=' + encodeURIComponent(p.title)}" target="_blank" rel="noopener noreferrer"
                    class="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 text-xs flex items-center gap-1.5 transition-colors"
                    title="Paywalled or preprint repository access">
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
