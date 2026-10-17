'use strict';

// Mundo lógico do jogo (unidades do mundo, desenhado em vetor e escalado para a tela).
// A largura cresce com o celular deitado (as fases se espalham na horizontal).
const BASE_W = 224;
let W = BASE_W;
const H = 256;
const TAU = Math.PI * 2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
const randi = (a, b) => Math.floor(rand(a, b + 1));
const chance = (p) => Math.random() < p;
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtScore(n) {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

function fmtNum(n) {
  return Math.floor(n).toLocaleString('pt-BR');
}

function fmtDate(ms) {
  try {
    return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch (e) {
    return '';
  }
}

// Gerador pseudoaleatório com semente (para cenários estáveis).
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Mistura uma cor hex com preto (amt<0) ou branco (amt>0).
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const k = Math.abs(amt);
  r = Math.round(r + (t - r) * k);
  g = Math.round(g + (t - g) * k);
  b = Math.round(b + (t - b) * k);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  del(key) {
    try { localStorage.removeItem(key); } catch (e) { /* sem armazenamento */ }
  },
};
