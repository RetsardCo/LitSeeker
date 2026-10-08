/**
 * Chapter 2 Literature Review Synthesis Matrix Table Component
 */

function renderMatrixTable(container, papers, options = {}) {
  if (!papers || papers.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 px-4">
        <i data-lucide="table" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
        <h3 class="text-lg font-medium text-slate-300">No literature available for matrix</h3>
        <p class="text-sm text-slate-500 mt-1">Search for your capstone topic or add papers to your binder to generate the synthesis table.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const tableHtml = `
    <div class="overflow-x-auto border border-slate-800 rounded-xl shadow-2xl bg-slate-900/60 backdrop-blur">
      <table class="w-full text-left text-xs text-slate-300 border-collapse matrix-table">
        <thead class="bg-slate-950/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
          <tr>
            <th class="p-3 w-10 text-center">Save</th>
            <th class="p-3 w-32">Author & Year</th>
            <th class="p-3 w-64">Study Title & DOI</th>
            <th class="p-3 w-28">Category</th>
            <th class="p-3 w-48">Methodology / Tech Stack</th>
            <th class="p-3 w-64">Key Findings & Results</th>
            <th class="p-3 w-64">Research Gap / Relevance</th>
            <th class="p-3 w-28 text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-800/60">
          ${papers.map((p, index) => {
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

                <!-- Methodology / Tech Stack -->
                <td class="p-3">
                  <span class="inline-block px-2 py-1 rounded bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-[11px] font-medium leading-relaxed">
                    ${matrix.methodology || 'Empirical Analysis'}
                  </span>
                </td>

                <!-- Key Findings -->
                <td class="p-3 text-slate-300 leading-relaxed text-[11px]">
                  ${matrix.findings || 'Reported empirical validation results.'}
                </td>

                <!-- Research Gap / Relevance -->
                <td class="p-3 text-slate-400 leading-relaxed text-[11px]">
                  <span class="text-emerald-400/90 font-medium">Relevance:</span> ${matrix.researchGap || 'Supports capstone system formulation.'}
                </td>

                <!-- Quick Action Buttons -->
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button onclick="window.openCiteModal('${p.id}')" 
                      class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all"
                      title="Cite Paper">
                      <i data-lucide="quote" class="w-3.5 h-3.5"></i>
                    </button>
                    ${p.isOpenAccess && p.openAccessUrl ? `
                      <a href="/api/pdf/proxy?url=${encodeURIComponent(p.openAccessUrl)}&filename=${encodeURIComponent((p.authors?.[0] || 'Paper') + '_' + p.publicationYear + '.pdf')}"
                        target="_blank" download
                        class="p-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-emerald-400 transition-all"
                        title="Download Open Access PDF">
                        <i data-lucide="file-down" class="w-3.5 h-3.5"></i>
                      </a>
                    ` : `
                      <span class="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed" title="PDF paywalled or restricted">
                        <i data-lucide="file-x" class="w-3.5 h-3.5"></i>
                      </span>
                    `}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHtml;
  lucide.createIcons();
}

window.renderMatrixTable = renderMatrixTable;
