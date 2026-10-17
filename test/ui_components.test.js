const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const appCssPath = path.join(__dirname, '..', 'public', 'css', 'app.css');

test('UI: HTML contains paper display count controls in toolbar and status bar', () => {
  const html = fs.readFileSync(indexPath, 'utf8');

  // Toolbar limit dropdown
  assert.match(html, /id="filterLimit"/, 'Toolbar should have #filterLimit dropdown');
  assert.match(html, /id="statusBarLimit"/, 'Status bar should have #statusBarLimit dropdown');

  // Options 10, 20, 30, 50, 100
  const expectedValues = ['10', '20', '30', '50', '100'];
  for (const val of expectedValues) {
    assert.ok(html.includes(`value="${val}"`), `Dropdown must include option for ${val} papers`);
  }

  // Synchronized callback
  assert.match(html, /onchange="window\.syncAndTriggerLimit\(this\.value\)"/, 'Dropdowns must use syncAndTriggerLimit');
});

test('UI: Abstract section has explicit button and no automatic hover expansion', () => {
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // No automatic hover expansion
  assert.doesNotMatch(appJs, /hover:line-clamp-none/, 'Abstract container must NOT expand automatically on hover');

  // Has explicit See more button
  assert.match(appJs, /abstract-toggle-btn/, 'Card must render abstract toggle button');
  assert.match(appJs, />See more</, 'Button must default to "See more"');
  assert.match(appJs, /window\.toggleAbstract/, 'Button must trigger window.toggleAbstract');
});

test('UI: app.js defines syncAndTriggerLimit and toggleAbstract handlers', () => {
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert.match(appJs, /window\.syncAndTriggerLimit\s*=/, 'window.syncAndTriggerLimit must be defined');
  assert.match(appJs, /window\.toggleAbstract\s*=/, 'window.toggleAbstract must be defined');
  assert.match(appJs, /Show less/, 'toggleAbstract must toggle to "Show less"');
});

test('UI: CSS styles include line-clamp rules for abstract toggle', () => {
  const css = fs.readFileSync(appCssPath, 'utf8');

  assert.match(css, /\.abstract-text\.line-clamp-3/, 'CSS must define .abstract-text.line-clamp-3');
  assert.match(css, /\.abstract-text\.line-clamp-none/, 'CSS must define .abstract-text.line-clamp-none');
});

test('UI: Abstract toggle state machine correctly flips classes, icons, titles, and text on real app.js', () => {
  const vm = require('node:vm');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  class MockClassList {
    constructor(initial = []) {
      this.classes = new Set(initial);
    }
    contains(c) { return this.classes.has(c); }
    add(c) { this.classes.add(c); }
    remove(c) { this.classes.delete(c); }
  }

  class MockElement {
    constructor(tag, id = '', classes = []) {
      this.tagName = tag.toUpperCase();
      this.id = id;
      this.classList = new MockClassList(classes);
      this.attributes = {};
      this.innerHTML = '';
      this.nodeType = 1;
      this._container = null;
      this._text = null;
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    getAttribute(k) { return this.attributes[k]; }
    closest(selector) {
      if (selector === '.abstract-container') return this._container;
      if (selector === '.abstract-toggle-btn') return this;
      return null;
    }
    querySelector(selector) {
      if (selector === '.abstract-text') return this._text;
      return null;
    }
  }

  const textEl = new MockElement('p', 'abstract-text-0', ['abstract-text', 'line-clamp-3']);
  const btn = new MockElement('button', 'abstract-btn-0', ['abstract-toggle-btn']);
  const container = new MockElement('div', '', ['abstract-container']);
  btn._container = container;
  container._text = textEl;

  const elements = {
    'abstract-text-0': textEl,
    'abstract-btn-0': btn
  };

  let lucideCalls = 0;
  const mockLucide = {
    createIcons: () => { lucideCalls++; }
  };
  const context = {
    window: {
      lucide: mockLucide
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => elements[id] || null
    },
    lucide: mockLucide,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console
  };

  vm.createContext(context);
  vm.runInContext(appJs, context);

  assert.equal(typeof context.window.toggleAbstract, 'function');
  assert.equal(typeof context.window.syncAndTriggerLimit, 'function');
  assert.ok(Array.isArray(context.window.currentPapers), 'window.currentPapers must be initialized');

  // Initially clamped (collapsed)
  assert.equal(textEl.classList.contains('line-clamp-3'), true);
  assert.equal(textEl.classList.contains('line-clamp-none'), false);

  // Click 1: expand
  context.window.toggleAbstract(btn, 0);
  assert.equal(textEl.classList.contains('line-clamp-3'), false);
  assert.equal(textEl.classList.contains('line-clamp-none'), true);
  assert.equal(btn.attributes['aria-expanded'], 'true');
  assert.equal(btn.attributes['title'], 'Collapse abstract');
  assert.match(btn.innerHTML, /Show less/);
  assert.match(btn.innerHTML, /data-lucide="chevron-up"/);
  assert.ok(lucideCalls >= 1);

  // Click 2: collapse
  context.window.toggleAbstract(btn, 0);
  assert.equal(textEl.classList.contains('line-clamp-3'), true);
  assert.equal(textEl.classList.contains('line-clamp-none'), false);
  assert.equal(btn.attributes['aria-expanded'], 'false');
  assert.equal(btn.attributes['title'], 'Expand full abstract');
  assert.match(btn.innerHTML, /See more/);
  assert.match(btn.innerHTML, /data-lucide="chevron-down"/);

  // Click 3: expand using index string
  context.window.toggleAbstract('0');
  assert.equal(textEl.classList.contains('line-clamp-3'), false);
  assert.equal(textEl.classList.contains('line-clamp-none'), true);
});

test('UI: syncAndTriggerLimit keeps toolbar and status bar selectors in sync', async () => {
  const vm = require('node:vm');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  const filterLimit = { value: '20' };
  const statusBarLimit = { value: '20' };

  let searched = false;
  const mockLucide = { createIcons: () => {} };
  const mockBinder = { has: () => false, getAll: () => [], count: () => 0, subscribe: () => {} };
  const context = {
    window: {
      lucide: mockLucide,
      binder: mockBinder
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => {
        if (id === 'filterLimit') return filterLimit;
        if (id === 'statusBarLimit') return statusBarLimit;
        if (id === 'searchQueryInput') return { value: 'IoT telemetry' };
        if (id === 'btnSubmitSearch') return { disabled: false, innerHTML: '' };
        if (id === 'filterRecentYears') return { checked: false };
        if (id === 'filterOpenAccessOnly') return { checked: false };
        if (id === 'filterSource') return { value: 'all' };
        if (id === 'filterSort') return { value: 'similarity' };
        if (id === 'mainDisplayArea') return { innerHTML: '' };
        if (id === 'resultsStatusBar') return { classList: { remove: () => {}, add: () => {} } };
        if (id === 'resultsCountText') return { textContent: '' };
        if (id === 'resultsRelevanceSummary') return { textContent: '' };
        return null;
      }
    },
    fetch: async () => {
      searched = true;
      return {
        ok: true,
        json: async () => ({ papers: [{ id: 'p1', title: 'Paper 1' }] })
      };
    },
    lucide: mockLucide,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console
  };

  vm.createContext(context);
  vm.runInContext(appJs, context);

  // Trigger sync to 50
  context.window.syncAndTriggerLimit('50');

  assert.equal(filterLimit.value, '50');
  assert.equal(statusBarLimit.value, '50');

  // Allow async performSearch promise resolution
  await new Promise(r => setTimeout(r, 20));
  assert.equal(searched, true);
});
