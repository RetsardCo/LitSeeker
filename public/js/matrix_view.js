/**
 * Chapter 2 Literature Review Synthesis Matrix Table Component with Research Intelligence Columns
 */

let matrixColumnState = {
  showResearchDesign: true,
  showSamplingDetails: true,
  showSampleSize: true,
  showJustification: true
};

window.toggleMatrixColumn = function(colName) {
  if (colName in matrixColumnState) {
    matrixColumnState[colName] = !matrixColumnState[colName];
    if (window.currentPapers) {
      const container = document.getElementById('mainDisplayArea');
      renderMatrixTable(container, window.currentPapers);
    }
  }
};

function renderMatrixTable(container, papers, options = {}) {
  if (!papers || papers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4 bg-slate-900/50 rounded-2xl border border-slate-800">
        <i data-lucide="table" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
        <h3 class="text-base font-semibold text-slate-200">No literature available for synthesis matrix</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Search for your capstone topic or add candidate papers to your binder to generate the synthesis matrix.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const { showResearchDesign, showSamplingDetails, showSampleSize, showJustification } = matrixColumnState;

  const tableHtml = `
    <div class="space-y-3">
      
      <!-- Matrix Column Visibility Controls -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
        <div class="flex items-center gap-2 text-slate-400 font-medium">
          <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5 text-indigo-400"></i>
          <span>Chapter 2 Matrix Columns:</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${showResearchDesign ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}">
            <input type="checkbox" onchange="window.toggleMatrixColumn('showResearchDesign')" ${showResearchDesign ? 'checked' : ''} class="hidden">
            <span>Research Design</span>
          </label>
          <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${showSamplingDetails ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}">
            <input type="checkbox" onchange="window.toggleMatrixColumn('showSamplingDetails')" ${showSamplingDetails ? 'checked' : ''} class="hidden">
            <span>Sampling Unit & Method</span>
          </label>
          <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${showSampleSize ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}">
            <input type="checkbox" onchange="window.toggleMatrixColumn('showSampleSize')" ${showSampleSize ? 'checked' : ''} class="hidden">
            <span>Sample Size & Runs</span>
          </label>
          <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${showJustification ? 'bg-indigo-950/70 border-indigo-700 text-indigo-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}">
            <input type="checkbox" onchange="window.toggleMatrixColumn('showJustification')" ${showJustification ? 'checked' : ''} class="hidden">
            <span>Sample Justification</span>
          </label>
        </div>
      </div>

      <!-- Main Responsive Matrix Table -->
      <div class="overflow-x-auto border border-slate-800 rounded-xl shadow-2xl bg-slate-900/60 backdrop-blur">
        <table class="w-full text-left text-xs text-slate-300 border-collapse matrix-table">
          <thead class="bg-slate-950/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th class="p-3 w-10 text-center">Pin</th>
              <th class="p-3 w-32">Author & Year</th>
              <th class="p-3 w-64">Study Title & DOI</th>
              <th class="p-3 w-28">Category</th>
              ${showResearchDesign ? '<th class="p-3 w-40">Research Design</th>' : ''}
              ${showSamplingDetails ? '<th class="p-3 w-44">Sampling Unit & Method</th>' : ''}
              ${showSampleSize ? '<th class="p-3 w-40">Sample Size & Runs</th>' : ''}
              ${showJustification ? '<th class="p-3 w-48">Sample Justification</th>' : ''}
              <th class="p-3 w-48">Methodology / Tech Stack</th>
              <th class="p-3 w-56">Key Findings</th>
              <th class="p-3 w-56">Research Gap</th>
              <th class="p-3 w-36 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${papers.map((p) => {
              const matrix = p.matrix || {};
              const isSaved = window.binder.has(p.id);
              const currentCat = p.rrlCategory || matrix.category || 'Foreign Study';
              const doi = p.doi ? (p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`) : null;

              return `
                <tr class="hover:bg-slate-800/40 transition-colors" data-paper-id="${p.id}">
                  <!-- Pin to Binder -->
                  <td class="p-3 text-center">
                    <button onclick="window.handleToggleBinder('${p.id}')" 
                      class="p-1.5 rounded-lg border transition-all ${
                        isSaved 
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                          : 'border-slate-700 text-slate-500 hover:text-amber-400 hover:border-slate-600'
                      }" title="${isSaved ? 'Remove from Binder' : 'Pin to My RRL Binder'}">
                      <i data-lucide="${isSaved ? 'bookmark-check' : 'bookmark'}" class="w-4 h-4"></i>
                    </button>
                  </td>

                  <!-- Author & Year -->
                  <td class="p-3 font-semibold text-slate-100 whitespace-nowrap">
                    <div>${matrix.authorYear || p.authors?.[0] || 'Unknown'}</div>
                    <div class="text-[10px] text-slate-400 font-normal mt-0.5">${p.journal || ''}</div>
                  </td>

                  <!-- Title & DOI -->
                  <td class="p-3">
                    <div class="font-medium text-slate-200 line-clamp-2 leading-relaxed mb-1">${p.title}</div>
                    ${doi ? `
                      <a href="${doi}" target="_blank" rel="noopener noreferrer" 
                        class="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:underline">
                        <i data-lucide="external-link" class="w-3 h-3"></i>
                        <span>DOI: ${doi.replace('https://doi.org/', '')}</span>
                      </a>
                    ` : '<span class="text-[10px] text-slate-600 font-mono">No DOI listed</span>'}
                  </td>

                  <!-- Chapter 2 Category Dropdown -->
                  <td class="p-3">
                    <select onchange="window.handleCategoryChange('${p.id}', this.value)"
                      class="bg-slate-800/80 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500">
                      <option value="Foreign Literature" ${currentCat === 'Foreign Literature' ? 'selected' : ''}>Foreign Lit</option>
                      <option value="Foreign Study" ${currentCat === 'Foreign Study' ? 'selected' : ''}>Foreign Study</option>
                      <option value="Local Literature" ${currentCat === 'Local Literature' ? 'selected' : ''}>Local Lit</option>
                      <option value="Local Study" ${currentCat === 'Local Study' ? 'selected' : ''}>Local Study</option>
                    </select>
                  </td>

                  ${showResearchDesign ? `
                    <td class="p-3">
                      <span class="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium text-[11px] border border-slate-700">
                        ${matrix.researchDesign || 'Quantitative Empirical'}
                      </span>
                    </td>
                  ` : ''}

                  ${showSamplingDetails ? `
                    <td class="p-3 text-[11px] text-slate-300 space-y-0.5">
                      <div class="font-semibold text-indigo-300">${matrix.samplingUnit || 'Endpoints / Units'}</div>
                      <div class="text-slate-400 text-[10px]">${matrix.samplingTechnique || 'Purposive / Empirical'}</div>
                    </td>
                  ` : ''}

                  ${showSampleSize ? `
                    <td class="p-3 text-[11px] text-slate-300 space-y-0.5">
                      <div class="font-semibold text-emerald-300">N = ${matrix.independentSampleSize || 'Not reported'}</div>
                      <div class="text-slate-400 text-[10px]">${matrix.repeatedSessions || ''} ${matrix.totalObservations ? `(${matrix.totalObservations} obs)` : ''}</div>
                    </td>
                  ` : ''}

                  ${showJustification ? `
                    <td class="p-3 text-[11px] text-slate-400 line-clamp-2">
                      ${matrix.sampleSizeJustification || 'Structured by empirical hardware testing.'}
                    </td>
                  ` : ''}

                  <!-- Methodology / Tech Stack -->
                  <td class="p-3">
                    <span class="inline-block px-2 py-1 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-[11px] font-medium leading-relaxed">
                      ${matrix.methodology || 'Empirical Analysis'}
                    </span>
                  </td>

                  <!-- Key Findings -->
                  <td class="p-3 text-slate-300 leading-relaxed text-[11px] line-clamp-3">
                    ${matrix.findings || 'Reported empirical validation results.'}
                  </td>

                  <!-- Research Gap / Relevance -->
                  <td class="p-3 text-slate-400 leading-relaxed text-[11px] line-clamp-3">
                    <span class="text-emerald-400 font-medium">Gap:</span> ${matrix.researchGap || 'Supports capstone system formulation.'}
                  </td>

                  <!-- Quick Action Buttons -->
                  <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <!-- Find Free Version Button -->
                      <button onclick="window.openOaModal('${p.id}')" 
                        class="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-indigo-300 hover:text-white transition-all"
                        title="Find Legitimate Free Version">
                        <i data-lucide="unlock" class="w-3.5 h-3.5"></i>
                      </button>

                      <!-- Research Intelligence Button -->
                      <button onclick="window.openResearchModal('${p.id}')" 
                        class="p-1.5 rounded-lg bg-violet-950/80 hover:bg-violet-900 border border-violet-700 text-violet-300 hover:text-white transition-all"
                        title="Research Intelligence & Methodology">
                        <i data-lucide="brain" class="w-3.5 h-3.5"></i>
                      </button>

                      <!-- Cite Button -->
                      <button onclick="window.openCiteModal('${p.id}')" 
                        class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
                        title="Cite Paper">
                        <i data-lucide="quote" class="w-3.5 h-3.5"></i>
                      </button>

                      <!-- PDF Download or External Link -->
                      ${p.isOpenAccess && p.openAccessUrl ? `
                        <a href="/api/pdf/proxy?url=${encodeURIComponent(p.openAccessUrl)}&filename=${encodeURIComponent((p.authors?.[0] || 'Paper') + '_' + p.publicationYear + '.pdf')}"
                          target="_blank" download
                          class="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-400 transition-all"
                          title="Download Open Access PDF">
                          <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
                        </a>
                      ` : `
                        <button onclick="window.openOaModal('${p.id}')"
                          class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-amber-400 transition-all"
                          title="Paywalled: Check Free Copies">
                          <i data-lucide="search" class="w-3.5 h-3.5"></i>
                        </button>
                      `}
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

  container.innerHTML = tableHtml;
  lucide.createIcons();
}

window.renderMatrixTable = renderMatrixTable;
