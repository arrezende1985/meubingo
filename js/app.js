import * as store from './storage.js';
import * as ocr from './ocr.js';
import {
  ROWS, COLS, emptyGrid, gridNumbers, validateGrid, columnFor,
  evaluateCard, checkPattern, winningCells, PATTERNS, PATTERN_ORDER,
  FREE, isFree, COL_LABELS, COL_RANGES, CENTER,
} from './bingo.js';

const app = document.getElementById('app');

// ---------- utilidades de DOM ----------
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function clear() { app.innerHTML = ''; }
function go(hash) { location.hash = hash; }

// ---------- tema (claro / escuro / automático) ----------
const THEME_KEY = 'bingo.theme';
const THEME_ORDER = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '🌗', light: '☀️', dark: '🌙' };
const THEME_LABEL = { auto: 'Automático', light: 'Claro', dark: 'Escuro' };

function getTheme() { return localStorage.getItem(THEME_KEY) || 'auto'; }
function applyTheme(t) {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function cycleTheme() {
  const next = THEME_ORDER[(THEME_ORDER.indexOf(getTheme()) + 1) % THEME_ORDER.length];
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  return next;
}

function header(title, backHash) {
  const themeBtn = el('button', {
    class: 'icon-btn', 'aria-label': 'Alternar tema', title: `Tema: ${THEME_LABEL[getTheme()]}`,
    onclick: (e) => {
      const t = cycleTheme();
      e.currentTarget.textContent = THEME_ICON[t];
      e.currentTarget.title = `Tema: ${THEME_LABEL[t]}`;
      toast(`Tema: ${THEME_LABEL[t]}`, 'ok');
    },
  }, [THEME_ICON[getTheme()]]);
  return el('header', { class: 'topbar' }, [
    backHash ? el('button', { class: 'icon-btn', onclick: () => go(backHash), 'aria-label': 'Voltar' }, ['‹']) : el('span', { class: 'logo' }, ['🎱']),
    el('h1', {}, [title]),
    themeBtn,
  ]);
}

function toast(msg, tipo = 'info') {
  const t = el('div', { class: `toast toast-${tipo}` }, [msg]);
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ---------- roteador ----------
function router() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return renderHome();
  if (parts[0] === 'c' && parts[1]) {
    const id = parts[1];
    const sub = parts[2];
    if (sub === 'scan') return renderScan(id);
    if (sub === 'manual') return renderManual(id);
    if (sub === 'sorteio') return renderSorteio(id);
    return renderConcurso(id);
  }
  return renderHome();
}

// ---------- TELA 1: concursos ----------
function renderHome() {
  clear();
  app.appendChild(header('MeuBingo'));
  const concursos = store.listConcursos();
  const body = el('main', { class: 'container' });

  body.appendChild(el('section', { class: 'card hero' }, [
    el('h2', {}, ['Novo concurso']),
    el('p', { class: 'muted' }, ['Dê um nome ao jogo. Depois escaneie as cartelas (B-I-N-G-O, 5×5) e comece o sorteio.']),
    (() => {
      const input = el('input', { type: 'text', placeholder: 'Ex: Bingo da Festa Junina', class: 'input', maxlength: '60' });
      const btn = el('button', { class: 'btn btn-primary btn-block', onclick: () => {
        const c = store.createConcurso(input.value);
        go(`/c/${c.id}`);
      } }, ['Criar concurso']);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') btn.click(); });
      return el('div', { class: 'stack' }, [input, btn]);
    })(),
  ]));

  if (concursos.length) {
    const lista = el('section', { class: 'stack' }, [el('h3', { class: 'section-title' }, ['Concursos'])]);
    for (const c of concursos) {
      lista.appendChild(el('div', { class: 'card list-item', onclick: () => go(`/c/${c.id}`) }, [
        el('div', {}, [
          el('strong', {}, [c.nome]),
          el('div', { class: 'muted small' }, [
            `${c.cartelas.length} cartela(s) · ${c.sorteados.length} sorteado(s) · ${c.status === 'sorteando' ? 'em andamento' : 'preparando'}`,
          ]),
        ]),
        el('button', { class: 'icon-btn danger', onclick: (e) => {
          e.stopPropagation();
          if (confirm(`Excluir "${c.nome}"?`)) { store.deleteConcurso(c.id); renderHome(); }
        }, 'aria-label': 'Excluir' }, ['🗑']),
      ]));
    }
    body.appendChild(lista);
  } else {
    body.appendChild(el('p', { class: 'muted center' }, ['Nenhum concurso ainda.']));
  }
  app.appendChild(body);
}

// ---------- TELA 2: concurso (cartelas) ----------
function renderConcurso(id) {
  const c = store.getConcurso(id);
  if (!c) return go('/');
  clear();
  app.appendChild(header(c.nome, '/'));
  const body = el('main', { class: 'container' });

  body.appendChild(el('section', { class: 'grid-2' }, [
    el('button', { class: 'btn btn-primary tall', onclick: () => go(`/c/${id}/scan`) }, ['📷', el('span', {}, ['Escanear cartela'])]),
    el('button', { class: 'btn btn-secondary tall', onclick: () => go(`/c/${id}/manual`) }, ['✏️', el('span', {}, ['Adicionar manual'])]),
  ]));

  body.appendChild(el('h3', { class: 'section-title' }, [`Cartelas (${c.cartelas.length})`]));

  if (c.cartelas.length === 0) {
    body.appendChild(el('p', { class: 'muted center' }, ['Nenhuma cartela cadastrada. Escaneie ou adicione manualmente.']));
  } else {
    const grid = el('section', { class: 'cartela-list' });
    c.cartelas.forEach((k) => {
      grid.appendChild(cartelaPreview(c, k, {
        onEdit: () => openCartelaEditor(id, k),
        onRemove: () => { if (confirm(`Remover ${k.apelido}?`)) { store.removeCartela(id, k.id); renderConcurso(id); } },
      }));
    });
    body.appendChild(grid);
  }

  const podeIniciar = c.cartelas.length > 0;
  body.appendChild(el('button', {
    class: `btn btn-success btn-block big ${podeIniciar ? '' : 'disabled'}`,
    onclick: () => {
      if (!podeIniciar) return toast('Adicione pelo menos uma cartela.', 'warn');
      c.status = 'sorteando';
      store.saveConcurso(c);
      go(`/c/${id}/sorteio`);
    },
  }, [c.sorteados.length ? '▶ Continuar sorteio' : '▶ Iniciar sorteio']));

  app.appendChild(body);
}

function cartelaPreview(concurso, cartela, { onEdit, onRemove, drawnSet } = {}) {
  const wrap = el('div', { class: 'card cartela-card' });
  wrap.appendChild(el('div', { class: 'cartela-head' }, [
    el('strong', {}, [cartela.apelido]),
    el('div', { class: 'cartela-actions' }, [
      onEdit ? el('button', { class: 'icon-btn', onclick: onEdit, 'aria-label': 'Editar' }, ['✏️']) : null,
      onRemove ? el('button', { class: 'icon-btn danger', onclick: onRemove, 'aria-label': 'Remover' }, ['🗑']) : null,
    ]),
  ]));
  wrap.appendChild(bingoHeaderRow());
  wrap.appendChild(renderMiniGrid(cartela.grid, drawnSet));
  return wrap;
}

function bingoHeaderRow() {
  return el('div', { class: 'bingo-header' }, COL_LABELS.map((l) => el('span', {}, [l])));
}

function renderMiniGrid(grid, drawnSet, highlight) {
  const g = el('div', { class: 'mini-grid' });
  for (let r = 0; r < ROWS; r++) {
    for (let cc = 0; cc < COLS; cc++) {
      const v = grid[r][cc];
      const win = highlight && highlight.has(`${r},${cc}`) ? 'win' : '';
      if (isFree(v)) {
        g.appendChild(el('div', { class: `mini-cell free marked ${win}` }, ['★']));
        continue;
      }
      const marcado = v && drawnSet && drawnSet.has(v);
      g.appendChild(el('div', { class: `mini-cell ${v ? '' : 'blank'} ${marcado ? 'marked' : ''} ${win}` }, [v ? String(v) : '']));
    }
  }
  return g;
}

// ---------- editor de grade 5x5 ----------
function gridEditor(initialGrid, apelidoInicial) {
  const state = { grid: initialGrid.map((r) => r.slice()), apelido: apelidoInicial || '' };
  const container = el('div', { class: 'stack' });

  const apInput = el('input', { class: 'input', type: 'text', placeholder: 'Apelido/nº da cartela (ex: 193)', value: state.apelido, maxlength: '40' });
  apInput.addEventListener('input', () => { state.apelido = apInput.value; });

  const statusLine = el('div', { class: 'grid-status' });

  // legenda de faixas por coluna
  container.appendChild(el('div', { class: 'col-legend' },
    COL_LABELS.map((l, i) => el('span', {}, [`${l}`, el('small', {}, [`${COL_RANGES[i][0]}-${COL_RANGES[i][1]}`])]))
  ));

  const gridNode = el('div', { class: 'edit-grid' });
  for (let r = 0; r < ROWS; r++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (r === CENTER.r && cc === CENTER.c) {
        state.grid[r][cc] = FREE;
        gridNode.appendChild(el('div', { class: 'cell-input cell-free' }, ['FREE']));
        continue;
      }
      const val = state.grid[r][cc];
      const inp = el('input', {
        class: 'cell-input', type: 'text', inputmode: 'numeric', maxlength: '2',
        value: typeof val === 'number' ? String(val) : '',
        'data-r': r, 'data-c': cc,
      });
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(/\D/g, '').slice(0, 2);
        const n = inp.value ? parseInt(inp.value, 10) : null;
        state.grid[r][cc] = n;
        colorCell(inp, n, cc);
        updateStatus();
      });
      inp.addEventListener('blur', () => colorCell(inp, state.grid[r][cc], cc));
      colorCell(inp, val, cc);
      gridNode.appendChild(inp);
    }
  }

  function colorCell(inp, n, col) {
    if (!inp.classList) return;
    inp.classList.remove('cell-ok', 'cell-warn', 'cell-empty');
    if (n == null || typeof n !== 'number') { inp.classList.add('cell-empty'); return; }
    if (n < 1 || n > 75 || columnFor(n) !== col) inp.classList.add('cell-warn');
    else inp.classList.add('cell-ok');
  }

  function updateStatus() {
    const nums = gridNumbers(state.grid);
    const { valid, errors } = validateGrid(state.grid);
    statusLine.innerHTML = '';
    statusLine.appendChild(el('span', { class: `chip ${valid ? 'chip-ok' : 'chip-warn'}` }, [`${nums.length}/24 números`]));
    if (!valid && errors.length) statusLine.appendChild(el('span', { class: 'muted small' }, [errors[0]]));
  }
  updateStatus();

  container.appendChild(gridNode);
  container.appendChild(statusLine);
  container.appendChild(apInput);

  return {
    node: container,
    getGrid: () => state.grid.map((r) => r.slice()),
    getApelido: () => state.apelido,
  };
}

// ---------- adicionar / editar manual ----------
function renderManual(id) {
  const c = store.getConcurso(id);
  if (!c) return go('/');
  clear();
  app.appendChild(header('Nova cartela', `/c/${id}`));
  const body = el('main', { class: 'container' });
  body.appendChild(el('p', { class: 'muted' }, ['Digite os números coluna por coluna. B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75. O centro é FREE.']));
  const editor = gridEditor(emptyGrid());
  body.appendChild(editor.node);
  body.appendChild(el('button', { class: 'btn btn-success btn-block big', onclick: () => saveFromEditor(id, editor) }, ['Salvar cartela']));
  app.appendChild(body);
}

function saveFromEditor(id, editor) {
  const grid = editor.getGrid();
  const { valid, errors } = validateGrid(grid);
  if (!valid && !confirm(`A cartela tem avisos:\n\n- ${errors.slice(0, 4).join('\n- ')}\n\nSalvar mesmo assim?`)) return;
  store.addCartela(id, grid, editor.getApelido());
  toast('Cartela salva!', 'ok');
  go(`/c/${id}`);
}

function openCartelaEditor(id, cartela) {
  clear();
  app.appendChild(header('Editar cartela', `/c/${id}`));
  const body = el('main', { class: 'container' });
  const editor = gridEditor(cartela.grid, cartela.apelido);
  body.appendChild(editor.node);
  body.appendChild(el('button', { class: 'btn btn-success btn-block big', onclick: () => {
    const grid = editor.getGrid();
    const { valid, errors } = validateGrid(grid);
    if (!valid && !confirm(`Avisos:\n- ${errors.slice(0, 4).join('\n- ')}\n\nSalvar assim?`)) return;
    store.updateCartela(id, cartela.id, { grid, apelido: editor.getApelido() });
    toast('Cartela atualizada!', 'ok');
    renderConcurso(id);
  } }, ['Salvar alterações']));
  app.appendChild(body);
}

// ---------- escanear: captura/galeria -> moldura -> leitura por casa ----------
function imagemParaCanvas(img, max = 1600) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const cvs = document.createElement('canvas');
  cvs.width = Math.round(w * scale);
  cvs.height = Math.round(h * scale);
  cvs.getContext('2d').drawImage(img, 0, 0, cvs.width, cvs.height);
  return cvs;
}

function rotateCanvas(src, deg) {
  deg = ((deg % 360) + 360) % 360;
  if (deg === 0) return src;
  const cvs = document.createElement('canvas');
  const ctx = cvs.getContext('2d');
  if (deg === 90 || deg === 270) { cvs.width = src.height; cvs.height = src.width; }
  else { cvs.width = src.width; cvs.height = src.height; }
  ctx.translate(cvs.width / 2, cvs.height / 2);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return cvs;
}

function renderScan(id) {
  const c = store.getConcurso(id);
  if (!c) return go('/');
  clear();
  app.appendChild(header('Escanear cartela', `/c/${id}`));
  const body = el('main', { class: 'container' });

  body.appendChild(el('div', { class: 'notice' }, ['Fotografe a cartela reta, com o B-I-N-G-O no topo, bem enquadrada. Na tela seguinte você encaixa a moldura sobre os 25 números.']));

  const fileInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'hidden' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => abrirCrop(id, imagemParaCanvas(img));
    img.onerror = () => toast('Não consegui abrir a imagem.', 'warn');
    img.src = URL.createObjectURL(f);
  });

  if (ocr.ocrDisponivel()) {
    const video = el('video', { class: 'camera', autoplay: '', playsinline: '', muted: '' });
    const guide = el('div', { class: 'camera-guide' }, [el('span', {}, ['Enquadre a cartela'])]);
    const camWrap = el('div', { class: 'camera-wrap' }, [video, guide]);
    let stream = null;
    const stopCam = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); };
    window.addEventListener('hashchange', stopCam, { once: true });

    const captureBtn = el('button', { class: 'btn btn-primary btn-block big', onclick: () => {
      if (!video.videoWidth) return toast('Câmera ainda não pronta.', 'warn');
      const cvs = document.createElement('canvas');
      cvs.width = video.videoWidth; cvs.height = video.videoHeight;
      cvs.getContext('2d').drawImage(video, 0, 0);
      stopCam();
      abrirCrop(id, cvs);
    } }, ['📸 Capturar']);

    body.appendChild(camWrap);
    body.appendChild(captureBtn);

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        video.srcObject = stream;
      } catch {
        body.insertBefore(el('p', { class: 'muted center' }, ['Sem acesso à câmera. Use "Enviar foto".']), camWrap.nextSibling);
      }
    })();
  }

  body.appendChild(el('button', { class: 'btn btn-secondary btn-block', onclick: () => fileInput.click() }, ['🖼️ Enviar foto da galeria']));
  body.appendChild(el('button', { class: 'btn btn-ghost btn-block', onclick: () => go(`/c/${id}/manual`) }, ['✏️ Digitar manualmente']));
  body.appendChild(fileInput);
  app.appendChild(body);
}

// tela de ajuste da moldura 5x5 sobre a foto
function abrirCrop(id, srcCanvas) {
  clear();
  app.appendChild(header('Ajustar leitura', `/c/${id}`));
  const body = el('main', { class: 'container' });

  let rotation = 0;
  let working = srcCanvas;
  const crop = { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.92 };

  const wrapper = el('div', { class: 'crop-wrap' });
  const box = el('div', { class: 'crop-box' });
  for (let i = 1; i <= 4; i++) {
    box.appendChild(el('div', { class: 'crop-line v', style: `left:${i * 20}%` }));
    box.appendChild(el('div', { class: 'crop-line h', style: `top:${i * 20}%` }));
  }
  ['tl', 'tr', 'bl', 'br'].forEach((k) => box.appendChild(el('div', { class: `crop-handle ${k}`, 'data-k': k })));
  wrapper.appendChild(box);

  function renderImage() {
    const old = wrapper.querySelector('canvas');
    if (old) old.remove();
    working.className = 'crop-canvas';
    wrapper.insertBefore(working, box);
  }
  function updateBox() {
    box.style.left = `${crop.x0 * 100}%`;
    box.style.top = `${crop.y0 * 100}%`;
    box.style.width = `${(crop.x1 - crop.x0) * 100}%`;
    box.style.height = `${(crop.y1 - crop.y0) * 100}%`;
  }
  renderImage();
  updateBox();

  let drag = null;
  const norm = (e) => {
    const r = wrapper.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  box.addEventListener('pointerdown', (e) => {
    const k = e.target.getAttribute && e.target.getAttribute('data-k');
    drag = k ? { mode: 'corner', k } : { mode: 'move', start: norm(e), startCrop: { ...crop } };
    e.preventDefault();
  });
  wrapper.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = norm(e);
    const MIN = 0.15;
    if (drag.mode === 'corner') {
      if (drag.k.includes('l')) crop.x0 = Math.min(p.x, crop.x1 - MIN);
      if (drag.k.includes('r')) crop.x1 = Math.max(p.x, crop.x0 + MIN);
      if (drag.k[0] === 't') crop.y0 = Math.min(p.y, crop.y1 - MIN);
      if (drag.k[0] === 'b') crop.y1 = Math.max(p.y, crop.y0 + MIN);
    } else {
      const w = drag.startCrop.x1 - drag.startCrop.x0, h = drag.startCrop.y1 - drag.startCrop.y0;
      let nx0 = Math.min(1 - w, Math.max(0, drag.startCrop.x0 + (p.x - drag.start.x)));
      let ny0 = Math.min(1 - h, Math.max(0, drag.startCrop.y0 + (p.y - drag.start.y)));
      crop.x0 = nx0; crop.y0 = ny0; crop.x1 = nx0 + w; crop.y1 = ny0 + h;
    }
    updateBox();
  });
  window.addEventListener('pointerup', () => { drag = null; });

  body.appendChild(el('p', { class: 'muted small' }, ['Arraste os cantos para encaixar a moldura sobre os 25 números (deixe a linha B-I-N-G-O de fora).']));
  body.appendChild(wrapper);

  const progress = el('div', { class: 'progress hidden' }, [el('div', { class: 'progress-bar' })]);
  const status = el('div', { class: 'muted small center hidden' }, ['Lendo cada casa…']);

  const rotateBtn = el('button', { class: 'btn btn-secondary', onclick: () => {
    rotation = (rotation + 90) % 360;
    working = rotateCanvas(srcCanvas, rotation);
    renderImage();
    crop.x0 = 0.08; crop.y0 = 0.08; crop.x1 = 0.92; crop.y1 = 0.92;
    updateBox();
  } }, ['🔄 Girar']);
  const readBtn = el('button', { class: 'btn btn-primary', onclick: () => ler() }, ['🔎 Ler cartela']);

  body.appendChild(el('div', { class: 'grid-2' }, [rotateBtn, readBtn]));
  body.appendChild(progress);
  body.appendChild(status);
  body.appendChild(el('button', { class: 'btn btn-ghost btn-block', onclick: () => go(`/c/${id}/manual`) }, ['Preferir digitar manualmente']));
  app.appendChild(body);

  async function ler() {
    readBtn.disabled = true; rotateBtn.disabled = true;
    readBtn.textContent = 'Lendo…';
    progress.classList.remove('hidden');
    status.classList.remove('hidden');
    const bar = progress.querySelector('.progress-bar');
    const rect = {
      x: crop.x0 * working.width, y: crop.y0 * working.height,
      w: (crop.x1 - crop.x0) * working.width, h: (crop.y1 - crop.y0) * working.height,
    };
    try {
      const grid = await ocr.lerGrade(working, rect, (p) => { bar.style.width = `${Math.round(p * 100)}%`; });
      abrirRevisao(id, grid);
    } catch (e) {
      progress.classList.add('hidden'); status.classList.add('hidden');
      readBtn.disabled = false; rotateBtn.disabled = false; readBtn.textContent = '🔎 Ler cartela';
      toast(e.message || 'Falha no OCR.', 'warn');
    }
  }
}

function abrirRevisao(id, grid) {
  clear();
  app.appendChild(header('Revisar leitura', `/c/${id}`));
  const body = el('main', { class: 'container' });
  body.appendChild(el('div', { class: 'notice' }, ['📷 Confira os números lidos e corrija o que estiver errado. Células em vermelho estão fora da faixa da coluna.']));
  const editor = gridEditor(grid);
  body.appendChild(editor.node);
  body.appendChild(el('div', { class: 'grid-2' }, [
    el('button', { class: 'btn btn-ghost', onclick: () => go(`/c/${id}/scan`) }, ['Escanear de novo']),
    el('button', { class: 'btn btn-success', onclick: () => saveFromEditor(id, editor) }, ['Salvar cartela']),
  ]));
  app.appendChild(body);
}

// ---------- sorteio ----------
function renderSorteio(id) {
  const c = store.getConcurso(id);
  if (!c) return go('/');
  clear();
  app.appendChild(header(`Sorteio — ${c.nome}`, `/c/${id}`));
  const body = el('main', { class: 'container sorteio' });

  const drawnSet = new Set(c.sorteados);
  let ordem = c.sorteados.slice();

  const winPanel = el('section', { class: 'win-panel' });

  const numInput = el('input', { class: 'input big-num', type: 'text', inputmode: 'numeric', maxlength: '2', placeholder: '00' });
  const addBtn = el('button', { class: 'btn btn-primary', onclick: () => sortear() }, ['Sortear']);
  numInput.addEventListener('input', () => { numInput.value = numInput.value.replace(/\D/g, '').slice(0, 2); });
  numInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sortear(); });

  const controls = el('section', { class: 'sorteio-controls' }, [
    el('div', { class: 'row' }, [numInput, addBtn]),
    el('div', { class: 'muted small' }, ['Digite o número que saiu (1–75) e toque em Sortear, ou use o painel abaixo.']),
  ]);

  const board = el('section', { class: 'board board-bingo' });
  // colunas B I N G O, cada uma com 15 números
  for (let col = 0; col < COLS; col++) {
    const [lo, hi] = COL_RANGES[col];
    const colDiv = el('div', { class: 'board-col' }, [el('div', { class: 'board-col-label' }, [COL_LABELS[col]])]);
    for (let n = lo; n <= hi; n++) {
      colDiv.appendChild(el('button', { class: `ball ${drawnSet.has(n) ? 'drawn' : ''}`, 'data-n': n, onclick: () => toggle(n) }, [String(n)]));
    }
    board.appendChild(colDiv);
  }

  const ultimos = el('section', { class: 'ultimos' });
  const cartelasLive = el('section', { class: 'cartela-list' });

  // ---- seletor do padrão de vitória ----
  let padrao = c.padrao || 'linha';
  const patternRow = el('section', { class: 'pattern-row' });
  const patternDesc = el('div', { class: 'pattern-desc muted small' });

  function renderPatternChips() {
    patternRow.innerHTML = '';
    PATTERN_ORDER.forEach((key) => {
      patternRow.appendChild(el('button', {
        class: `pattern-chip ${padrao === key ? 'active' : ''}`,
        onclick: () => setPadrao(key),
      }, [PATTERNS[key].label]));
    });
    patternDesc.textContent = `Vale: ${PATTERNS[padrao].desc}`;
  }

  const anunciado = new Set(); // cartelas já anunciadas no padrão atual

  body.appendChild(el('section', { class: 'pattern-picker' }, [
    el('div', { class: 'section-title' }, ['Padrão que vale']),
    patternRow,
    patternDesc,
  ]));
  body.appendChild(winPanel);
  body.appendChild(controls);
  body.appendChild(ultimos);
  body.appendChild(el('details', { class: 'board-details' }, [
    el('summary', {}, ['Painel de números (toque para marcar/desmarcar)']),
    board,
  ]));
  body.appendChild(el('h3', { class: 'section-title' }, ['Cartelas']));
  body.appendChild(cartelasLive);
  app.appendChild(body);

  function persistAll() { c.sorteados = ordem.slice(); store.saveConcurso(c); }

  function seedAnunciados() {
    anunciado.clear();
    c.cartelas.forEach((k) => {
      const ev = evaluateCard(k.grid, drawnSet);
      if (checkPattern(ev, padrao).done) anunciado.add(k.id);
    });
  }

  function setPadrao(key) {
    if (key === padrao) return;
    padrao = key;
    c.padrao = key;
    store.saveConcurso(c);
    seedAnunciados(); // trocar de padrão não dispara popup dos que já estavam prontos
    renderPatternChips();
    refresh();
  }

  function sortear() {
    const n = parseInt(numInput.value, 10);
    numInput.value = '';
    numInput.focus();
    if (!Number.isInteger(n) || n < 1 || n > 75) return toast('Número deve ser entre 1 e 75.', 'warn');
    if (drawnSet.has(n)) return toast(`${n} já foi sorteado.`, 'warn');
    drawnSet.add(n); ordem.push(n);
    persistAll(); refresh(n);
  }

  function toggle(n) {
    if (drawnSet.has(n)) { drawnSet.delete(n); ordem = ordem.filter((x) => x !== n); }
    else { drawnSet.add(n); ordem.push(n); }
    persistAll(); refresh();
  }

  function refresh(novo) {
    board.querySelectorAll('.ball').forEach((b) => {
      const n = parseInt(b.dataset.n, 10);
      b.classList.toggle('drawn', drawnSet.has(n));
      b.classList.toggle('just', n === novo);
    });

    ultimos.innerHTML = '';
    ultimos.appendChild(el('div', { class: 'muted small' }, [`${ordem.length} sorteado(s)`]));
    const chips = el('div', { class: 'chips' });
    ordem.slice(-8).reverse().forEach((n, i) => chips.appendChild(el('span', { class: `ball-chip ${i === 0 && n === novo ? 'just' : ''}` }, [String(n)])));
    ultimos.appendChild(chips);

    cartelasLive.innerHTML = '';
    const ehCheia = padrao === 'cheia';
    const cls = ehCheia ? 'cheia' : 'linha';
    let vencedores = 0;
    c.cartelas.forEach((k) => {
      const ev = evaluateCard(k.grid, drawnSet);
      const res = checkPattern(ev, padrao);
      if (res.done) vencedores++;
      const highlight = res.done ? new Set(winningCells(ev, padrao).map(([r, cc]) => `${r},${cc}`)) : null;
      const card = el('div', { class: `card cartela-card ${res.done ? 'has-prize prize-' + cls : ''}` });
      card.appendChild(el('div', { class: 'cartela-head' }, [
        el('strong', {}, [k.apelido]),
        el('span', { class: 'muted small' }, [`${ev.marcados}/${ev.total}`]),
      ]));
      card.appendChild(bingoHeaderRow());
      card.appendChild(renderMiniGrid(k.grid, drawnSet, highlight));
      if (res.done) card.appendChild(el('div', { class: `prize-badge prize-${cls}` }, [
        ehCheia ? 'CARTELA CHEIA!' : `BINGO! ${res.labels[0] || ''}`,
      ]));
      cartelasLive.appendChild(card);

      if (res.done && !anunciado.has(k.id)) {
        anunciado.add(k.id);
        anunciarVitoria(k, padrao, res);
      }
    });

    winPanel.innerHTML = '';
    winPanel.appendChild(el('div', { class: 'win-summary win-summary-1' }, [
      winBadge(`Bateram "${PATTERNS[padrao].label}"`, vencedores),
    ]));
  }

  function winBadge(label, count) {
    return el('div', { class: `win-badge ${count ? 'active' : ''}` }, [
      el('span', { class: 'win-count' }, [String(count)]),
      el('span', { class: 'win-label' }, [label]),
    ]);
  }

  seedAnunciados();
  renderPatternChips();
  refresh();
}

function anunciarVitoria(cartela, padraoKey, res) {
  const cheia = padraoKey === 'cheia';
  const overlay = el('div', { class: `win-overlay prize-${cheia ? 'cheia' : 'linha'}` });
  const titulo = cheia ? 'CARTELA CHEIA!' : 'BINGO!';
  const detalhe = (res && res.labels && res.labels[0]) ? ` · ${res.labels[0]}` : '';
  overlay.appendChild(el('div', { class: 'win-card' }, [
    el('div', { class: 'win-emoji' }, [cheia ? '🏆' : '🎉']),
    el('h2', {}, [titulo]),
    el('p', {}, [`${cartela.apelido}${detalhe}`]),
    el('button', { class: 'btn btn-light', onclick: () => overlay.remove() }, ['Continuar']),
  ]));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  try { navigator.vibrate?.(cheia ? [120, 60, 120, 60, 240] : [90, 50, 90]); } catch {}
  if (cheia) setTimeout(() => overlay.remove(), 6000);
}

// ---------- bootstrap ----------
applyTheme(getTheme());
window.addEventListener('hashchange', router);
router();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
