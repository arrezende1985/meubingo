// OCR de cartelas 75 bolas usando Tesseract.js (carregado sob demanda via CDN).
//
// Estratégia por CÉLULA (bem mais precisa que ler a foto inteira):
//  1. O usuário alinha uma moldura 5x5 sobre os números.
//  2. Para cada uma das 25 casas, recortamos a casa, removemos a borda,
//     convertemos para preto-e-branco (limiar) e ampliamos.
//  3. Rodamos o Tesseract em cada casa isolada (modo "linha única", só dígitos).
// O resultado é sempre revisado manualmente pelo usuário.

import { ROWS, COLS, columnFor, emptyGrid, FREE, CENTER, COL_RANGES } from './bingo.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let tesseractPromise = null;
let workerPromise = null;

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tesseractPromise) return tesseractPromise;
  tesseractPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = TESSERACT_URL;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('Falha ao carregar Tesseract.js (precisa de internet na 1ª vez).'));
    document.head.appendChild(s);
  });
  return tesseractPromise;
}

async function getWorker() {
  const T = await loadTesseract();
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await T.createWorker('eng');
      await w.setParameters({
        tessedit_char_whitelist: '0123456789',
        tessedit_pageseg_mode: '7', // linha única de texto
      });
      return w;
    })();
  }
  return workerPromise;
}

export function ocrDisponivel() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

// Recorta uma casa da imagem, remove borda, binariza e amplia para OCR.
function prepararCelula(src, sx, sy, sw, sh) {
  // inset pra descartar a borda do quadradinho impresso
  const mx = sw * 0.14, my = sh * 0.14;
  sx += mx; sy += my; sw -= 2 * mx; sh -= 2 * my;

  const TW = 140, TH = 140, PAD = 16;
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, TW, TH);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, sx, sy, sw, sh, PAD, PAD, TW - 2 * PAD, TH - 2 * PAD);

  // binarização por limiar global (fundo claro, dígito escuro)
  const img = ctx.getImageData(0, 0, TW, TH);
  const d = img.data;
  let sum = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const mean = sum / n;
  const thr = mean * 0.78;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = g < thr ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function parseNumero(texto, col) {
  const digs = (texto || '').replace(/\D/g, '');
  if (!digs) return null;
  // tenta os primeiros 1-2 dígitos; prioriza um valor dentro da faixa da coluna
  const [lo, hi] = COL_RANGES[col];
  const cands = [];
  if (digs.length >= 2) cands.push(parseInt(digs.slice(0, 2), 10));
  cands.push(parseInt(digs.slice(0, 1), 10));
  if (digs.length >= 2) cands.push(parseInt(digs.slice(-2), 10));
  for (const n of cands) if (n >= lo && n <= hi) return n;
  for (const n of cands) if (n >= 1 && n <= 75) return n;
  return null;
}

// Lê a grade 5x5 a partir de uma área retangular {x,y,w,h} da imagem-fonte.
export async function lerGrade(srcCanvas, rect, onProgress) {
  const worker = await getWorker();
  const grid = emptyGrid();
  const cw = rect.w / COLS;
  const ch = rect.h / ROWS;
  const total = ROWS * COLS - 1; // menos o FREE
  let done = 0;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === CENTER.r && c === CENTER.c) { grid[r][c] = FREE; continue; }
      const cell = prepararCelula(srcCanvas, rect.x + c * cw, rect.y + r * ch, cw, ch);
      let num = null;
      try {
        const { data } = await worker.recognize(cell);
        num = parseNumero(data.text, c);
      } catch { /* casa ilegível fica em branco pra revisão */ }
      grid[r][c] = num;
      done++;
      if (onProgress) onProgress(done / total);
    }
  }
  return grid;
}
