<p align="center">
  <img src="public/assets/logo.png" alt="LitSeeker Logo" width="300">
</p>

# LitSeeker • Academic Literature Discovery, Open-Access Finder & Research Intelligence Studio 🎓

LitSeeker is an academic research platform designed for researchers, college students, and scholars preparing **Chapter 2: Review of Related Literature and Studies (RRL / RRS)**, seeking legitimate, free-to-read, open-access versions of academic papers, and constructing evidence-grounded research methodology and sample-size justifications.

---

## 🌟 Key Capabilities

### 1. Automatic Legal Open-Access Paper Finder ("Find Free Version")
- **Multi-Source Provider Architecture**: Integrates **OpenAlex**, **Unpaywall** API (`UNPAYWALL_EMAIL`), **arXiv**, and **Europe PMC** to discover authorized open-access versions of research papers.
- **Exact-Paper Matching Pipeline**: Employs normalized DOI matching, arXiv identifier verification, title similarity, author overlap, and publication year compatibility to ensure candidates represent the exact scholarly work.
- **Clear Access Classification**: Explicitly identifies whether a version is an **Open Access PDF**, **Free Full Text**, **Repository Copy** (institutional repository), **Preprint** (e.g. arXiv), **Free Publisher Version**, or **Landing Page Only**.
- **Safe SSRF-Protected PDF Downloader**: Multi-layer security validation blocks localhost, private network addresses (RFC 1918), link-local (169.254), and cloud metadata endpoints while safely streaming verified open-access PDFs with sanitized filenames.
- **Lawful Access Fallback Guidance**: When no legitimate free copy is found, provides actionable lawful guidance (publisher links, institutional library access, author manuscript requests, and interlibrary loan).

### 2. Research Intelligence & Methodology Extraction Engine
- **Study Overview**: Detailed bibliographic provenance, research objectives, research problem, hypotheses, and variables.
- **Research Design Classification**: Categorizes empirical designs (Quantitative Experimental, Quasi-Experimental, Benchmarking & Performance Evaluation, System Development, Observational, Survey, Qualitative Case Study, etc.) with explicit confidence and evidence traceability.
- **Population & Sampling Architecture**: Distinguishes independent sampling units (physical devices, hardware endpoints, human participants, benchmark datasets) from repeated measurements or observation cycles.
- **Specialized Hardware & Technical Research Support**: Explicitly warns when small numbers of hardware endpoints (e.g. N = 2 devices) are subjected to repeated runs (e.g. 1,000,000 measurements), ensuring repeated observations are not conflated with statistical representation across an entire hardware population.
- **Standards-Based Validation Protocol**: Inspects compliance with validation frameworks such as **NIST SP 800-90B** for entropy sources and random bit generation (restart testing, initial entropy estimation, min-entropy).
- **Separation of Author Limitations vs. Analytical Validity Threats**: Separates limitations explicitly acknowledged by researchers from analytical validity threats (internal, external, construct, statistical conclusion validity).

### 3. Dedicated Sample-Size Justification Assistant ("Find Comparable Sampling Studies")
- **"My Research Profile"**: Configure your study parameters (research title, objectives, discipline, design, sampling unit, technique, independent sample size, repeated session counts, validation standards).
- **Methodological Comparability Matching**: Compares retrieved papers against your profile and classifies them into:
  - *Direct Methodological Match*
  - *Strong Partial Match*
  - *Contextual Supporting Study*
  - *Weak Match*
  - *Not Comparable*
- **Structured Justification Report**: Generates a 10-point evidence-linked sample-size justification report for thesis defense, highlighting what the published evidence supports, critical limitations, and a defensible draft rationale.

### 4. Chapter 2 Synthesis Matrix & Custom Column Builder
- Dedicated grid view mapping Authors, Year, Title, Category (*Foreign/Local Literature/Studies*), Methodology, Key Findings, Research Gaps, and custom methodology columns.
- Real-time column visibility toggles, inline editing, and category classification.

### 5. Multi-Style Citation Suite & Export Suite
- **Citations**: Instant 1-click citation in **APA 7th Edition**, **IEEE**, **MLA 9th**, **Chicago 17th**, **Harvard**, and **BibTeX**, plus in-text parenthetical and narrative citations.
- **Exports**: Download full CSV synthesis matrices, BibTeX (`.bib`), RIS (`.ris`), pre-formatted Chapter 2 Markdown drafts (`.md`), and sample-size justification reports.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js (v18+)

### 2. Environment Configuration (Optional)
Create an optional `.env` file in the project root:
```env
PORT=3005
UNPAYWALL_EMAIL=your-email@university.edu
```
*(LitSeeker works out of the box with polite default academic headers if no environment variable is provided).*

### 3. Run the Application
Open PowerShell or your command terminal in this directory:
```bash
cmd /c npm start
```
The server will start at:
👉 **`http://localhost:3005`**

### 4. Run Automated Tests
```bash
cmd /c npm test
```
Runs 37 automated unit and integration tests verifying Open-Access discovery, SSRF protection, research intelligence, methodology extraction, citation formats, and API endpoints.

---

## 📁 Project Structure

```
LitSeeker/
├── lib/
│   ├── open_access_finder.js    # Multi-provider open-access discovery engine
│   ├── unpaywall.js             # Unpaywall API adapter (DOI discovery)
│   ├── openalex.js              # OpenAlex client & inverted index reconstructor
│   ├── arxiv.js                 # arXiv client for preprints & STEM papers
│   ├── europepmc.js             # Europe PMC repository adapter
│   ├── paper_matcher.js         # Exact-paper matching & deduplication pipeline
│   ├── research_intelligence.js # Methodology, sampling, and findings extraction engine
│   ├── research_profile.js      # Research profile & sample-size justification assistant
│   ├── similarity.js            # Semantic similarity & capstone matcher
│   ├── citation.js              # APA 7, IEEE, MLA 9, Chicago, Harvard, BibTeX formatter
│   ├── matrix.js                # Chapter 2 synthesis extractor
│   └── pdf_resolver.js          # SSRF-protected OA PDF resolver & CORS proxy
├── public/
│   ├── assets/
│   │   └── logo.png             # Official LitSeeker Logo
│   ├── index.html               # Academic research UI (Tailwind CSS, Lucide Icons)
│   ├── css/
│   │   └── app.css              # Academic styling, badges, animations
│   └── js/
│       ├── app.js               # Client state, search, OA modal, research intelligence
│       ├── binder.js            # 'My RRL Binder' local storage & collections
│       ├── matrix_view.js       # Synthesis table renderer with custom columns
│       └── exporter.js          # CSV, BibTeX, RIS, Markdown exporter
├── test/
│   ├── citation.test.js         # Citation engine formatting tests
│   ├── matrix.test.js           # Synthesis matrix extraction tests
│   ├── open_access_finder.test.js # OA provider, SSRF security, and matcher tests
│   ├── research_intelligence.test.js # Methodology, sampling, and justification tests
│   ├── server.test.js           # Express API integration tests
│   └── similarity.test.js       # Scoring & keyword overlap tests
├── server.js                    # Express HTTP server & API endpoints
├── run.bat                      # One-click Windows desktop launcher
└── package.json                 # Project configuration & test scripts
```

---

## 🔒 Security & Academic Integrity

- **Lawful Access Guarantee**: LitSeeker only indexes and links legitimate Open Access sources (Unpaywall, OpenAlex, arXiv, publisher authorized open access). It never bypasses authentication, paywalls, or anti-bot protections, and does not implement unauthorized mirrors.
- **SSRF Hardening**: All PDF streaming and URL verification requests are filtered against internal/private IP ranges (RFC 1918), link-local addresses, AWS/GCP metadata endpoints, and DNS rebinding attacks.
