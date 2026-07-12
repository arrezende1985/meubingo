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

// ---------- ícones (SVG inline, herdam currentColor) ----------
const ICONS = {
  ball: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.5" r="2.6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22"/><path d="M14 14.6V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 4"/><path d="M18 2H6v7a6 6 0 0 0 12 0Z"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h6l2 3h3a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  play: '<path d="M7 4l13 8-13 8Z" fill="currentColor" stroke="none"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 1.5v2.5M12 20v2.5M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M1.5 12h2.5M20 12h2.5M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  backspace: '<path d="M20 5H8.5a2 2 0 0 0-1.5.7L2 12l5 6.3a2 2 0 0 0 1.5.7H20a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/><path d="M17 9l-5 6M12 9l5 6"/>',
  download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  share: '<path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
  menu: '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
};

function icon(name, { size = 22, cls = '' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (cls) svg.setAttribute('class', cls);
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

// anel de progresso (donut SVG)
function ring(pct, { size = 52, stroke = 6, text = null } = {}) {
  const p = Math.max(0, Math.min(100, pct));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - p / 100);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'ring');
  svg.innerHTML =
    `<circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"/>` +
    `<circle class="ring-prog" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" ` +
    `stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" stroke-linecap="round" ` +
    `transform="rotate(-90 ${size / 2} ${size / 2})"/>` +
    (text != null ? `<text class="ring-text" x="50%" y="50%" text-anchor="middle" dominant-baseline="central">${text}</text>` : '');
  return svg;
}

// ---------- tema (claro / escuro / automático) ----------
const THEME_KEY = 'bingo.theme';
const THEME_ORDER = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: 'auto', light: 'sun', dark: 'moon' };
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
      e.currentTarget.replaceChildren(icon(THEME_ICON[t], { size: 20 }));
      e.currentTarget.title = `Tema: ${THEME_LABEL[t]}`;
      toast(`Tema: ${THEME_LABEL[t]}`, 'ok');
    },
  }, [icon(THEME_ICON[getTheme()], { size: 20 })]);
  return el('header', { class: 'topbar' }, [
    backHash ? el('button', { class: 'icon-btn', onclick: () => go(backHash), 'aria-label': 'Voltar' }, [icon('back', { size: 22 })]) : el('img', { class: 'logo', src: './icons/icon.svg', alt: 'MeuBingo', width: '40', height: '40' }),
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

// ---------- timeline "como funciona" ----------
const COMO_FUNCIONA = [
  ['edit', 'Crie o concurso', 'Dê um nome ao jogo (ex: "Bingo da Festa Junina").'],
  ['grid', 'Cadastre as cartelas', 'Escaneie com a câmera (OCR) ou digite os números.'],
  ['target', 'Registre os sorteados', 'Digite cada número que sai e o app marca em todas as cartelas.'],
  ['trophy', 'Acompanhe as vitórias', 'O app avisa em tela cheia quando bate BINGO ou cartela cheia.'],
];

function timeline() {
  return el('ol', { class: 'timeline' }, COMO_FUNCIONA.map(([ic, titulo, desc], i) =>
    el('li', { class: 'timeline-step' }, [
      el('div', { class: 'timeline-num' }, [String(i + 1)]),
      el('div', { class: 'timeline-body' }, [
        el('strong', {}, [icon(ic, { size: 19, cls: 'ti-icon' }), titulo]),
        el('span', {}, [desc]),
      ]),
    ])
  ));
}

// ---------- doação (PIX) ----------
const PIX_KEY = '74b99fb4-a1ab-47b2-9c5c-13b9753c35a6'; // chave aleatória (EVP)
const PIX_NAME = 'MEU BINGO';
const PIX_CITY = 'BRASIL';

function pixEmv(id, value) { return id + String(value.length).padStart(2, '0') + value; }

function pixCrc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// gera o "copia e cola" (BR Code estático) da chave PIX
function pixPayload() {
  const mai = pixEmv('26', pixEmv('00', 'br.gov.bcb.pix') + pixEmv('01', PIX_KEY));
  const body = pixEmv('00', '01') + mai + pixEmv('52', '0000') + pixEmv('53', '986') +
    pixEmv('58', 'BR') + pixEmv('59', PIX_NAME) + pixEmv('60', PIX_CITY) + pixEmv('62', pixEmv('05', '***'));
  const partial = body + '6304';
  return partial + pixCrc16(partial);
}

function copyText(text, okMsg) {
  const done = () => toast(okMsg || 'Copiado!', 'ok');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = el('textarea', { style: 'position:fixed;opacity:0' });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch {}
  ta.remove();
}

function openDonate() {
  if (document.querySelector('.modal-overlay')) return; // evita abrir duplicado
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  // estilos essenciais inline (garante a janela flutuante mesmo com CSS em cache antigo)
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.55)';
  const card = el('div', { class: 'modal-card' }, [
    el('button', { class: 'icon-btn modal-close', 'aria-label': 'Fechar', onclick: () => overlay.remove() }, [icon('close', { size: 18 })]),
    el('div', { class: 'donate-heart' }, [icon('heart', { size: 30 })]),
    el('h2', {}, ['Apoie o MeuBingo']),
    el('p', { class: 'muted' }, ['O app é gratuito e sem anúncios. Se ele te ajudou, uma colaboração via PIX ajuda a manter o projeto. Obrigado! 💛']),
    el('div', { class: 'pix-field' }, [
      el('div', { class: 'pix-info' }, [
        el('div', { class: 'pix-label' }, ['Chave PIX']),
        el('div', { class: 'pix-value' }, [PIX_KEY]),
      ]),
      el('button', { class: 'btn btn-secondary', onclick: () => copyText(PIX_KEY, 'Chave copiada!') }, [icon('copy', { size: 18 }), 'Copiar']),
    ]),
    el('button', { class: 'btn btn-primary btn-block', onclick: () => copyText(pixPayload(), 'PIX copia e cola copiado!') }, [icon('copy', { size: 18 }), 'Copiar PIX copia e cola']),
  ]);
  card.style.cssText = 'position:relative;background:var(--card);color:var(--fg);border-radius:20px;padding:28px 22px;max-width:380px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,0.35);text-align:center';
  overlay.appendChild(card);
  requestAnimationFrame(() => overlay.classList.add('show'));
  document.body.appendChild(overlay);
}

// rodapé discreto de apoio (usado em alguns pontos do app)
function donateFooter() {
  return el('button', { class: 'donate-link', onclick: openDonate }, [icon('heart', { size: 15 }), 'Gostou? Apoie o app']);
}

// ---------- dica de instalação (PWA) ----------
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstallPrompt = e; });

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function dismissInstall(node) {
  localStorage.setItem('bingo.hideInstall', '1');
  node.remove();
}

function installHint() {
  if (isStandalone() || localStorage.getItem('bingo.hideInstall') === '1') return null;

  // Android/desktop: usa o prompt nativo do navegador
  if (deferredInstallPrompt) {
    const card = el('section', { class: 'card install-card' });
    card.appendChild(el('div', { class: 'install-head' }, [
      el('img', { class: 'install-badge', src: './icons/icon.svg', alt: '', width: '44', height: '44' }),
      el('div', { class: 'ci-body' }, [
        el('strong', {}, ['Instalar Meu Bingo']),
        el('span', { class: 'muted small' }, ['Fica na tela inicial e abre em tela cheia, sem a barra do navegador.']),
      ]),
      el('button', { class: 'icon-btn', 'aria-label': 'Dispensar', onclick: () => dismissInstall(card) }, [icon('close', { size: 18 })]),
    ]));
    card.appendChild(el('button', {
      class: 'btn btn-primary btn-block',
      onclick: async () => {
        deferredInstallPrompt.prompt();
        try { await deferredInstallPrompt.userChoice; } catch {}
        deferredInstallPrompt = null;
        card.remove();
      },
    }, [icon('download', { size: 18 }), 'Instalar agora']));
    return card;
  }

  // iOS (e demais): usa o card ilustrado com o passo a passo
  const wrap = el('section', { class: 'install-illus' }, [
    el('img', { class: 'install-illus-img', src: './icons/install-card.png', alt: 'Para instalar: toque em Compartilhar e depois em Adicionar à Tela de Início.' }),
    el('button', { class: 'icon-btn install-illus-close', 'aria-label': 'Dispensar', onclick: () => dismissInstall(wrap) }, [icon('close', { size: 18 })]),
  ]);
  return wrap;
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

  const hint = installHint();
  if (hint) body.appendChild(hint);

  // passo-a-passo: aberto para quem chega pela 1ª vez, recolhido para quem já usa
  if (concursos.length) {
    body.appendChild(el('details', { class: 'card how-to' }, [
      el('summary', {}, ['Como funciona']),
      timeline(),
    ]));
  } else {
    body.appendChild(el('section', { class: 'card how-to' }, [
      el('h3', { class: 'section-title' }, ['Como funciona']),
      timeline(),
    ]));
  }

  if (concursos.length) {
    const lista = el('section', { class: 'stack' }, [el('h3', { class: 'section-title' }, ['Concursos'])]);
    for (const c of concursos) {
      const emAndamento = c.status === 'sorteando';
      lista.appendChild(el('div', { class: 'card list-item', onclick: () => go(`/c/${c.id}`) }, [
        el('div', { class: 'ci-lead' }, [icon('grid', { size: 22 })]),
        el('div', { class: 'ci-body' }, [
          el('strong', {}, [c.nome]),
          el('div', { class: 'ci-meta muted small' }, [
            el('span', { class: `ci-status ${emAndamento ? 'live' : ''}` }, [emAndamento ? 'em andamento' : 'preparando']),
            el('span', {}, [`${c.cartelas.length} cartela(s) · ${c.sorteados.length} sorteado(s)`]),
          ]),
        ]),
        el('button', { class: 'icon-btn danger', onclick: (e) => {
          e.stopPropagation();
          if (confirm(`Excluir "${c.nome}"?`)) { store.deleteConcurso(c.id); renderHome(); }
        }, 'aria-label': 'Excluir' }, [icon('trash', { size: 18 })]),
      ]));
    }
    body.appendChild(lista);
  } else {
    body.appendChild(el('p', { class: 'muted center' }, ['Nenhum concurso ainda.']));
  }

  body.appendChild(donateFooter());
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
    el('button', { class: 'btn btn-primary tall', onclick: () => go(`/c/${id}/scan`) }, [icon('camera', { size: 26 }), el('span', {}, ['Escanear cartela'])]),
    el('button', { class: 'btn btn-secondary tall', onclick: () => go(`/c/${id}/manual`) }, [icon('edit', { size: 26 }), el('span', {}, ['Adicionar manual'])]),
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
  }, [icon('play', { size: 16 }), c.sorteados.length ? 'Continuar sorteio' : 'Iniciar sorteio']));

  body.appendChild(donateFooter());
  app.appendChild(body);
}

function cartelaPreview(concurso, cartela, { onEdit, onRemove, drawnSet } = {}) {
  const wrap = el('div', { class: 'card cartela-card' });
  wrap.appendChild(el('div', { class: 'cartela-head' }, [
    el('strong', {}, [cartela.apelido]),
    el('div', { class: 'cartela-actions' }, [
      onEdit ? el('button', { class: 'icon-btn', onclick: onEdit, 'aria-label': 'Editar' }, [icon('edit', { size: 18 })]) : null,
      onRemove ? el('button', { class: 'icon-btn danger', onclick: onRemove, 'aria-label': 'Remover' }, [icon('trash', { size: 18 })]) : null,
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

  // cabeçalho B-I-N-G-O + ajuda dinâmica da coluna
  const headerRow = el('div', { class: 'bingo-header edit-header' }, COL_LABELS.map((l, i) => el('span', { 'data-col': String(i) }, [l])));
  const helper = el('div', { class: 'edit-helper' }, ['Toque numa casa e digite o número.']);
  function setActiveCol(col) {
    headerRow.classList.toggle('active-col', col != null);
    headerRow.querySelectorAll('span').forEach((s) => s.classList.toggle('active', Number(s.dataset.col) === col));
    helper.textContent = col == null
      ? 'Toque numa casa e digite o número.'
      : `Coluna ${COL_LABELS[col]} aceita de ${COL_RANGES[col][0]} a ${COL_RANGES[col][1]}.`;
  }

  const cells = []; // { inp, r, c }: só as casas editáveis (sem o FREE)
  const gridNode = el('div', { class: 'edit-grid' });
  for (let r = 0; r < ROWS; r++) {
    for (let cc = 0; cc < COLS; cc++) {
      if (r === CENTER.r && cc === CENTER.c) {
        state.grid[r][cc] = FREE;
        gridNode.appendChild(el('div', { class: 'cell-input cell-free' }, ['★']));
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
        state.grid[r][cc] = inp.value ? parseInt(inp.value, 10) : null;
        recolor();
        updateStatus();
      });
      inp.addEventListener('focus', () => setActiveCol(cc));
      inp.addEventListener('blur', () => { recolor(); setActiveCol(null); });
      cells.push({ inp, r, c: cc });
      gridNode.appendChild(inp);
    }
  }

  // números que aparecem mais de uma vez na cartela
  function dupSet() {
    const seen = new Set(), dup = new Set();
    for (const n of gridNumbers(state.grid)) { if (seen.has(n)) dup.add(n); seen.add(n); }
    return dup;
  }

  // uma casa está errada se: fora de 1-75, coluna errada, ou número repetido
  function cellError(n, col, dup) {
    if (typeof n !== 'number') return false;
    return n < 1 || n > 75 || columnFor(n) !== col || dup.has(n);
  }

  function colorCell(inp, n, col, dup) {
    inp.classList.remove('cell-ok', 'cell-warn', 'cell-empty');
    if (typeof n !== 'number') { inp.classList.add('cell-empty'); return; }
    inp.classList.add(cellError(n, col, dup) ? 'cell-warn' : 'cell-ok');
  }

  function recolor() {
    const dup = dupSet();
    for (const { inp, r, c } of cells) colorCell(inp, state.grid[r][c], c, dup);
  }

  // há alguma casa em vermelho? (repetido ou fora da faixa): impede salvar
  function hasCellErrors() {
    const dup = dupSet();
    return cells.some(({ r, c }) => cellError(state.grid[r][c], c, dup));
  }

  function updateStatus() {
    const nums = gridNumbers(state.grid);
    const erro = hasCellErrors();
    statusLine.innerHTML = '';
    statusLine.appendChild(el('span', { class: `chip ${!erro && nums.length === 24 ? 'chip-ok' : 'chip-warn'}` }, [`${nums.length}/24 números`]));
    if (erro) statusLine.appendChild(el('span', { class: 'chip chip-warn' }, ['casas em vermelho: repetido ou fora da faixa']));
  }
  recolor();
  updateStatus();

  container.appendChild(headerRow);
  container.appendChild(gridNode);
  container.appendChild(helper);
  container.appendChild(statusLine);
  container.appendChild(apInput);

  return {
    node: container,
    getGrid: () => state.grid.map((r) => r.slice()),
    getApelido: () => state.apelido,
    hasCellErrors,
  };
}

// ---------- adicionar / editar manual ----------
function renderManual(id) {
  const c = store.getConcurso(id);
  if (!c) return go('/');
  clear();
  app.appendChild(header('Nova cartela', `/c/${id}`));
  const body = el('main', { class: 'container' });
  body.appendChild(el('p', { class: 'muted small' }, ['Preencha coluna por coluna. Toque numa casa para ver a faixa aceita. O centro é FREE.']));
  const editor = gridEditor(emptyGrid());
  body.appendChild(editor.node);
  body.appendChild(el('button', { class: 'btn btn-success btn-block big', onclick: () => saveFromEditor(id, editor) }, ['Salvar cartela']));
  app.appendChild(body);
}

function saveFromEditor(id, editor) {
  if (editor.hasCellErrors()) return toast('Corrija as casas em vermelho antes de salvar (número repetido ou fora da faixa).', 'warn');
  const grid = editor.getGrid();
  const { valid, errors } = validateGrid(grid);
  if (!valid && !confirm(`A cartela ainda está incompleta:\n\n- ${errors.slice(0, 4).join('\n- ')}\n\nSalvar mesmo assim?`)) return;
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
    if (editor.hasCellErrors()) return toast('Corrija as casas em vermelho antes de salvar (número repetido ou fora da faixa).', 'warn');
    const grid = editor.getGrid();
    const { valid, errors } = validateGrid(grid);
    if (!valid && !confirm(`A cartela ainda está incompleta:\n- ${errors.slice(0, 4).join('\n- ')}\n\nSalvar assim?`)) return;
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

// moldura-guia no formato da cartela (cabeçalho B-I-N-G-O + grade 5×5)
function buildGuideFrame() {
  const bingo = el('div', { class: 'guide-bingo' }, COL_LABELS.map((l) => el('span', {}, [l])));
  const grid = el('div', { class: 'guide-grid' });
  for (let i = 0; i < ROWS * COLS; i++) {
    const isCenter = i === CENTER.r * COLS + CENTER.c;
    grid.appendChild(el('span', { class: isCenter ? 'free' : '' }, [isCenter ? '★' : '']));
  }
  const frame = el('div', { class: 'guide-frame' }, [bingo, grid]);
  ['tl', 'tr', 'bl', 'br'].forEach((k) => frame.appendChild(el('div', { class: `guide-corner ${k}` })));
  return el('div', { class: 'guide-inner' }, [frame, el('div', { class: 'guide-hint' }, ['Encaixe a cartela na moldura'])]);
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
    const guide = el('div', { class: 'camera-guide' }, [buildGuideFrame()]);
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
    } }, [icon('camera', { size: 20 }), 'Capturar']);

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

  body.appendChild(el('button', { class: 'btn btn-secondary btn-block', onclick: () => fileInput.click() }, [icon('image', { size: 20 }), 'Enviar foto da galeria']));
  body.appendChild(el('button', { class: 'btn btn-ghost btn-block', onclick: () => go(`/c/${id}/manual`) }, [icon('edit', { size: 20 }), 'Digitar manualmente']));
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
  } }, [icon('rotate', { size: 18 }), 'Girar']);
  const readBtn = el('button', { class: 'btn btn-primary', onclick: () => ler() }, [icon('search', { size: 18 }), 'Ler cartela']);

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
      readBtn.disabled = false; rotateBtn.disabled = false; readBtn.replaceChildren(icon('search', { size: 18 }), document.createTextNode('Ler cartela'));
      toast(e.message || 'Falha no OCR.', 'warn');
    }
  }
}

function abrirRevisao(id, grid) {
  clear();
  app.appendChild(header('Revisar leitura', `/c/${id}`));
  const body = el('main', { class: 'container' });
  body.appendChild(el('div', { class: 'notice' }, ['Confira os números lidos e corrija o que estiver errado. Células em vermelho estão fora da faixa da coluna.']));
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
  app.appendChild(header(`Sorteio · ${c.nome}`, `/c/${id}`));
  const body = el('main', { class: 'container sorteio' });

  const drawnSet = new Set(c.sorteados);
  let ordem = c.sorteados.slice();

  const winPanel = el('section', { class: 'win-panel' });

  // ---- banner da última bola ----
  const banner = el('section', { class: 'live-banner' });
  function renderBanner(novo) {
    banner.innerHTML = '';
    const last = ordem.length ? ordem[ordem.length - 1] : null;
    const pct = Math.round((ordem.length / 75) * 100);
    banner.appendChild(el('div', { class: `live-ball ${last != null && last === novo ? 'just' : ''}` }, [last != null ? String(last) : '–']));
    banner.appendChild(el('div', { class: 'live-info' }, [
      el('div', { class: 'live-title' }, [last != null ? `Última: ${COL_LABELS[columnFor(last)]} ${last}` : 'Comece o sorteio']),
      el('div', { class: 'live-sub' }, [`${ordem.length} de 75 bolas sorteadas`]),
    ]));
    banner.appendChild(ring(pct, { size: 54, stroke: 6, text: `${pct}%` }));
  }

  // ---- teclado numérico ----
  let buffer = '';
  const kpValue = el('span', { class: 'kp-value empty' }, ['–']);
  function renderBuffer() { kpValue.textContent = buffer || '–'; kpValue.classList.toggle('empty', !buffer); }
  function pushDigit(d) {
    const next = buffer + d;
    buffer = next.length > 2 ? d : next;
    if (parseInt(buffer, 10) > 75) buffer = d;
    renderBuffer();
  }
  function backspace() { buffer = buffer.slice(0, -1); renderBuffer(); }

  const keypad = el('div', { class: 'keypad' });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((k) =>
    keypad.appendChild(el('button', { class: 'key', onclick: () => pushDigit(k) }, [k])));
  keypad.appendChild(el('button', { class: 'key key-sub', onclick: backspace, 'aria-label': 'Apagar' }, [icon('backspace', { size: 24 })]));
  keypad.appendChild(el('button', { class: 'key', onclick: () => pushDigit('0') }, ['0']));
  keypad.appendChild(el('button', { class: 'key key-enter', onclick: () => sortear(), 'aria-label': 'Sortear' }, [icon('check', { size: 26 })]));

  const controls = el('section', { class: 'sorteio-controls' }, [
    el('div', { class: 'kp-display' }, [el('span', { class: 'kp-label' }, ['Digite a bola sorteada']), kpValue]),
    keypad,
  ]);

  // teclado físico (desktop)
  function onKey(e) {
    if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
    else if (e.key === 'Backspace') backspace();
    else if (e.key === 'Enter') sortear();
    else return;
    e.preventDefault();
  }
  window.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', () => window.removeEventListener('keydown', onKey), { once: true });

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

  // ---- seletor dos padrões de vitória (um ou mais) ----
  let padroes = Array.isArray(c.padroes) && c.padroes.length
    ? c.padroes.filter((k) => PATTERNS[k])
    : [c.padrao || 'linha'];
  if (!padroes.length) padroes = ['linha'];
  const patternRow = el('section', { class: 'pattern-row' });
  const patternDesc = el('div', { class: 'pattern-desc muted small' });

  function renderPatternChips() {
    patternRow.innerHTML = '';
    PATTERN_ORDER.forEach((key) => {
      patternRow.appendChild(el('button', {
        class: `pattern-chip ${padroes.includes(key) ? 'active' : ''}`,
        onclick: () => togglePadrao(key),
      }, [PATTERNS[key].label]));
    });
    patternDesc.textContent = `Vale: ${padroes.map((k) => PATTERNS[k].label).join(' · ')}`;
  }

  const anunciado = new Set(); // cartelas já anunciadas no padrão atual

  body.appendChild(banner);
  body.appendChild(ultimos);
  body.appendChild(controls);
  body.appendChild(el('section', { class: 'pattern-picker' }, [
    el('div', { class: 'section-title' }, ['Padrões que valem']),
    el('div', { class: 'muted small' }, ['Toque para marcar um ou mais.']),
    patternRow,
    patternDesc,
  ]));
  body.appendChild(winPanel);
  body.appendChild(el('h3', { class: 'section-title' }, ['Cartelas']));
  body.appendChild(cartelasLive);
  body.appendChild(el('details', { class: 'board-details' }, [
    el('summary', {}, ['Painel de números (toque para marcar ou desmarcar)']),
    board,
  ]));
  app.appendChild(body);

  function persistAll() { c.sorteados = ordem.slice(); store.saveConcurso(c); }

  // avalia a cartela contra TODOS os padrões selecionados
  function matchPatterns(ev) {
    const labels = [];
    const keys = [];
    let cheia = false;
    for (const key of padroes) {
      const r = checkPattern(ev, key);
      if (r.done) {
        keys.push(key);
        labels.push(...r.labels);
        if (key === 'cheia') cheia = true;
      }
    }
    return { done: keys.length > 0, labels, keys, cheia };
  }

  function seedAnunciados() {
    anunciado.clear();
    c.cartelas.forEach((k) => {
      const ev = evaluateCard(k.grid, drawnSet);
      if (matchPatterns(ev).done) anunciado.add(k.id);
    });
  }

  function togglePadrao(key) {
    if (padroes.includes(key)) {
      if (padroes.length === 1) return toast('Deixe pelo menos um padrão marcado.', 'warn');
      padroes = padroes.filter((k) => k !== key);
    } else {
      // mantém a ordem canônica dos padrões
      padroes = PATTERN_ORDER.filter((k) => padroes.includes(k) || k === key);
    }
    c.padroes = padroes.slice();
    c.padrao = padroes[0]; // compatibilidade com versões anteriores
    store.saveConcurso(c);
    seedAnunciados(); // mudar os padrões não dispara popup dos que já estavam prontos
    renderPatternChips();
    refresh();
  }

  function sortear() {
    const n = parseInt(buffer, 10);
    buffer = ''; renderBuffer();
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
    renderBanner(novo);
    board.querySelectorAll('.ball').forEach((b) => {
      const n = parseInt(b.dataset.n, 10);
      b.classList.toggle('drawn', drawnSet.has(n));
      b.classList.toggle('just', n === novo);
    });

    ultimos.innerHTML = '';
    if (ordem.length) {
      ultimos.appendChild(el('div', { class: 'ultimos-head' }, [
        el('div', { class: 'muted small' }, ['Últimas bolas']),
        el('button', { class: 'btn-undo', onclick: undoLast }, [icon('rotate', { size: 15 }), 'Desfazer última']),
      ]));
      const chips = el('div', { class: 'chips' });
      ordem.slice(-10).reverse().forEach((n, i) => chips.appendChild(el('span', { class: `ball-chip ${i === 0 && n === novo ? 'just' : ''}` }, [String(n)])));
      ultimos.appendChild(chips);
    }

    cartelasLive.innerHTML = '';
    let vencedores = 0;
    c.cartelas.forEach((k) => {
      const ev = evaluateCard(k.grid, drawnSet);
      const res = matchPatterns(ev);
      const cls = res.cheia ? 'cheia' : 'linha';
      if (res.done) vencedores++;
      const highlight = res.done ? new Set() : null;
      if (res.done) res.keys.forEach((key) => winningCells(ev, key).forEach(([r, cc]) => highlight.add(`${r},${cc}`)));
      const card = el('div', { class: `card cartela-card ${res.done ? 'has-prize prize-' + cls : ''}` });
      card.appendChild(el('div', { class: 'cartela-head' }, [
        el('strong', {}, [k.apelido]),
        el('span', { class: 'muted small' }, [`${ev.marcados}/${ev.total}`]),
      ]));
      card.appendChild(bingoHeaderRow());
      card.appendChild(renderMiniGrid(k.grid, drawnSet, highlight));
      if (res.done) card.appendChild(el('div', { class: `prize-badge prize-${cls}` }, [
        res.cheia ? 'CARTELA CHEIA!' : `BINGO! ${res.labels[0] || ''}`,
      ]));
      cartelasLive.appendChild(card);

      if (res.done && !anunciado.has(k.id)) {
        anunciado.add(k.id);
        anunciarVitoria(k, res);
      }
    });

    winPanel.innerHTML = '';
    winPanel.appendChild(el('div', { class: 'win-summary win-summary-1' }, [
      winBadge('Cartelas premiadas', vencedores),
    ]));
  }

  function undoLast() {
    if (!ordem.length) return toast('Nenhuma bola para desfazer.', 'warn');
    const n = ordem.pop();
    drawnSet.delete(n);
    persistAll();
    refresh();
    toast(`Bola ${n} desfeita.`, 'ok');
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

function anunciarVitoria(cartela, res) {
  const cheia = !!(res && res.cheia);
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

// ---------- atualização do app (novo service worker disponível) ----------
let updatePromptShown = false;
function showUpdatePrompt(reg) {
  if (updatePromptShown) return;
  updatePromptShown = true;
  const bar = el('div', { class: 'update-bar' }, [
    el('span', { class: 'update-txt' }, ['Nova versão disponível']),
    el('button', {
      class: 'btn btn-primary', onclick: (e) => {
        e.currentTarget.textContent = 'Atualizando…';
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        else location.reload();
      },
    }, ['Atualizar']),
    el('button', { class: 'icon-btn', 'aria-label': 'Agora não', onclick: () => bar.remove() }, [icon('close', { size: 18 })]),
  ]);
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
}

function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdatePrompt(reg);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) showUpdatePrompt(reg);
      });
    });
    const check = () => reg.update().catch(() => {});
    check();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }).catch(() => {});
}

// ---------- bootstrap ----------
applyTheme(getTheme());
window.addEventListener('hashchange', router);
router();
setupServiceWorker();
