/**
 * My RRL Binder - Local Storage & Chapter 2 Collections Manager
 */

const STORAGE_KEY = 'capstone_rrl_binder_v1';

class RrlBinder {
  constructor() {
    this.papers = this.load();
    this.listeners = [];
  }

  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.papers));
      this.notify();
    } catch (err) {
      console.error('Failed to save to binder:', err);
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.papers));
  }

  has(paperId) {
    return this.papers.some(p => p.id === paperId);
  }

  toggle(paper) {
    if (this.has(paper.id)) {
      this.remove(paper.id);
      return false;
    } else {
      this.add(paper);
      return true;
    }
  }

  add(paper, category = null) {
    if (this.has(paper.id)) return;
    const cat = category || (paper.matrix ? paper.matrix.category : 'Foreign Study');
    this.papers.unshift({
      ...paper,
      savedAt: new Date().toISOString(),
      rrlCategory: cat
    });
    this.save();
  }

  remove(paperId) {
    this.papers = this.papers.filter(p => p.id !== paperId);
    this.save();
  }

  updateCategory(paperId, category) {
    const paper = this.papers.find(p => p.id === paperId);
    if (paper) {
      paper.rrlCategory = category;
      this.save();
    }
  }

  clear() {
    this.papers = [];
    this.save();
  }

  getAll() {
    return this.papers;
  }

  count() {
    return this.papers.length;
  }
}

window.binder = new RrlBinder();
