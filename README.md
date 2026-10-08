# LitFinder • Capstone Chapter 2 Literature & Synthesis Studio 🎓

An academic research web application designed specifically for college students and researchers preparing **Chapter 2: Review of Related Literature and Studies (RRL / RRS)** for capstone projects and theses.

---

## 🌟 Key Features

1. **Multi-Source Federated Academic Search**:
   - Searches **OpenAlex** (250M+ scholarly works across all disciplines) and **arXiv** (computer science, AI, engineering, and mathematics preprints).
   - Resolves verified **DOIs** (`https://doi.org/...`) and provides direct links to publisher versions.
   - Detects **Open Access** availability with direct PDF download streaming.

2. **Semantic Similarity & Capstone Matcher**:
   - Paste your full **Capstone Title** or **Problem Statement**.
   - NLP term-frequency and n-gram analysis calculates percentage similarity (0–100%).
   - Highlights shared technical variables (e.g. *YOLOv8*, *Raspberry Pi*, *CNN*, *IoT Telemetry*).

3. **Chapter 2 Literature Synthesis Matrix**:
   - Dedicated table view with structured columns:
     - **Author(s) & Year**
     - **Study Title & DOI**
     - **Category Tagging** (*Foreign Literature*, *Foreign Study*, *Local Literature*, *Local Study*)
     - **Methodology & Tech Stack**
     - **Key Findings & Performance Metrics**
     - **Research Gap & Capstone Relevance**

4. **Multi-Style Citation Suite**:
   - Generates instant citations across 6 academic formats:
     - **APA 7th Edition** (standard university capstone format)
     - **IEEE** (numbered format for CS/IT/Engineering)
     - **MLA 9th Edition**
     - **Chicago 17th Edition** (Author-Date)
     - **Harvard**
     - **BibTeX** (`.bib` for Overleaf and LaTeX)
   - Generates in-text parenthetical `(Santos & Del Rosario, 2023)` and narrative citations `Santos and Del Rosario (2023)`.

5. **Direct Open Access PDF Downloader**:
   - Built-in server CORS streaming proxy (`/api/pdf/proxy`) downloads papers directly to your computer with clean filenames (`Author_Year_Title.pdf`), bypassing browser download blocks.

6. **Literature Export Suite**:
   - **Synthesis Matrix (CSV / Excel)**: Ready to import into thesis synthesis matrices.
   - **BibTeX (.bib)**: Import directly into Zotero, Overleaf, or Mendeley.
   - **RIS (.ris)**: Import into EndNote and RefWorks.
   - **Chapter 2 Draft Document (.md)**: Pre-formatted review draft with sections (Synthesis of Reviewed Literature, Synthesis Matrix, and Complete References List).

7. **"My RRL Binder"**:
   - Pin candidate papers into your personal bibliography binder (persisted in browser storage).
   - Batch-export only your curated papers.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js (v18+)

### 2. Run the Application
Open PowerShell or your command terminal in this directory:
```bash
cmd /c npm start
```
The server will start at:
👉 **`http://localhost:3005`**

### 3. Run Automated Tests
```bash
cmd /c npm test
```
Runs 13 automated tests verifying citation generation, similarity scoring, matrix extraction, and API endpoints.

---

## 📁 Project Structure

```
capstone-lit-finder/
├── lib/
│   ├── openalex.js       # OpenAlex REST client & inverted index reconstructor
│   ├── arxiv.js          # arXiv search client for STEM/CS papers
│   ├── similarity.js     # TF-IDF & semantic keyword similarity scorer
│   ├── citation.js       # APA 7, IEEE, MLA 9, Chicago, Harvard, BibTeX formatter
│   ├── matrix.js         # Chapter 2 synthesis extractor (Methods, Findings, Gaps)
│   └── pdf_resolver.js   # Direct OA PDF URL resolver & CORS streaming proxy
├── public/
│   ├── index.html        # Academic research UI (Tailwind CSS, Lucide Icons)
│   ├── css/
│   │   └── app.css       # Academic styling, badges, animations
│   └── js/
│       ├── app.js        # Client state management, search, filters
│       ├── binder.js     # 'My RRL Binder' local storage & collections
│       ├── matrix_view.js# Synthesis table renderer
│       └── exporter.js   # CSV, BibTeX, RIS, Markdown exporter
├── test/
│   ├── citation.test.js  # Citation engine formatting tests
│   ├── similarity.test.js# Scoring & keyword overlap tests
│   ├── matrix.test.js    # Methodology & findings extraction tests
│   └── server.test.js    # Express API integration tests
├── server.js             # Express HTTP server & API endpoints
└── package.json          # Project configuration & test scripts
```
