// Modelo de bingo 75 bolas (cartela 5x5, cabeçalho B-I-N-G-O, centro FREE).
// Faixas por coluna:
//   B: 1-15 | I: 16-30 | N: 31-45 | G: 46-60 | O: 61-75
// O centro (linha 2, col 2) é FREE e conta sempre como marcado.

export const ROWS = 5;
export const COLS = 5;
export const MAX_NUMBER = 75;
export const FREE = 'FREE';
export const COL_LABELS = ['B', 'I', 'N', 'G', 'O'];
export const COL_RANGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
export const CENTER = { r: 2, c: 2 };

// Índice da coluna (0..4) para um número no layout 75 bolas.
export function columnFor(n) {
  if (!Number.isInteger(n) || n < 1 || n > MAX_NUMBER) return -1;
  return Math.min(COLS - 1, Math.floor((n - 1) / 15));
}

export function isFree(v) {
  return v === FREE;
}

// Cria uma grade 5x5 vazia com FREE no centro.
export function emptyGrid() {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  g[CENTER.r][CENTER.c] = FREE;
  return g;
}

// Lista dos números (ignora brancos e FREE).
export function gridNumbers(grid) {
  const out = [];
  for (const row of grid) for (const cell of row) if (typeof cell === 'number') out.push(cell);
  return out;
}

// Validação estrutural de uma cartela 75 bolas.
export function validateGrid(grid) {
  const errors = [];
  const nums = gridNumbers(grid);
  const seen = new Set();

  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > MAX_NUMBER) errors.push(`Número inválido: ${n}`);
    if (seen.has(n)) errors.push(`Número repetido: ${n}`);
    seen.add(n);
  }

  // 24 números + FREE = 25 células preenchidas.
  if (nums.length !== 24) {
    errors.push(`A cartela deve ter 24 números + FREE (tem ${nums.length} números).`);
  }

  if (grid[CENTER.r][CENTER.c] !== FREE) {
    errors.push('O centro da cartela deve ser FREE.');
  }

  // Cada coluna: 5 números na faixa (a coluna N tem 4 números + FREE).
  for (let c = 0; c < COLS; c++) {
    const [lo, hi] = COL_RANGES[c];
    for (let r = 0; r < ROWS; r++) {
      const v = grid[r][c];
      if (v === FREE || v == null) continue;
      if (v < lo || v > hi) {
        errors.push(`${COL_LABELS[c]}: número ${v} fora da faixa ${lo}-${hi}.`);
      }
    }
    const filled = grid.map((row) => row[c]).filter((v) => v != null).length;
    if (filled !== ROWS) errors.push(`Coluna ${COL_LABELS[c]} deve ter 5 casas preenchidas (tem ${filled}).`);
  }

  return { valid: errors.length === 0, errors };
}

// true se a célula está marcada (FREE ou número já sorteado).
function cellMarked(cell, drawnSet) {
  return cell === FREE || (typeof cell === 'number' && drawnSet.has(cell));
}

// Avalia a cartela contra os números sorteados.
export function evaluateCard(grid, drawnSet) {
  const rows = [];
  for (let r = 0; r < ROWS; r++) rows.push(grid[r].every((cell) => cellMarked(cell, drawnSet)));

  const cols = [];
  for (let c = 0; c < COLS; c++) cols.push(grid.every((row) => cellMarked(row[c], drawnSet)));

  let diag1 = true, diag2 = true;
  for (let i = 0; i < ROWS; i++) {
    if (!cellMarked(grid[i][i], drawnSet)) diag1 = false;
    if (!cellMarked(grid[i][COLS - 1 - i], drawnSet)) diag2 = false;
  }

  // nomes dos padrões completos (para o anúncio)
  const completed = [];
  rows.forEach((ok, r) => { if (ok) completed.push(`Linha ${r + 1}`); });
  cols.forEach((ok, c) => { if (ok) completed.push(`Coluna ${COL_LABELS[c]}`); });
  if (diag1) completed.push('Diagonal ↘');
  if (diag2) completed.push('Diagonal ↙');

  const anyLine = completed.length > 0;

  // quatro cantos
  const corners = cellMarked(grid[0][0], drawnSet) && cellMarked(grid[0][COLS - 1], drawnSet)
    && cellMarked(grid[ROWS - 1][0], drawnSet) && cellMarked(grid[ROWS - 1][COLS - 1], drawnSet);

  const todos = gridNumbers(grid);
  const marcados = todos.filter((n) => drawnSet.has(n)).length;
  const full = todos.length > 0 && marcados === todos.length;

  return { rows, cols, diag1, diag2, completed, anyLine, corners, full, marcados, total: todos.length };
}

// Maior prêmio alcançado: 'cheia' > 'linha' (qualquer linha/coluna/diagonal) > null
export function bestPrize(ev) {
  if (ev.full) return 'cheia';
  if (ev.anyLine) return 'linha';
  return null;
}

// ---------- padrões de vitória selecionáveis no sorteio ----------
export const PATTERNS = {
  linha:      { label: 'Qualquer linha', desc: 'Horizontal, vertical ou diagonal', icon: '≡' },
  horizontal: { label: 'Horizontal', desc: 'Uma linha deitada (5 números)', icon: '—' },
  vertical:   { label: 'Vertical (coluna)', desc: 'Uma coluna inteira', icon: '|' },
  diagonal:   { label: 'Diagonal', desc: 'Uma das diagonais', icon: '╲' },
  cantos:     { label: 'Quatro cantos', desc: 'As 4 pontas da cartela', icon: '⁘' },
  cheia:      { label: 'Cartela cheia', desc: 'Todos os 24 números', icon: '▦' },
};

export const PATTERN_ORDER = ['linha', 'horizontal', 'vertical', 'diagonal', 'cantos', 'cheia'];

// Coordenadas [r,c] das casas que formam o padrão vencedor (para destaque).
export function winningCells(ev, key) {
  const cells = [];
  const addRow = (r) => { for (let c = 0; c < COLS; c++) cells.push([r, c]); };
  const addCol = (c) => { for (let r = 0; r < ROWS; r++) cells.push([r, c]); };
  const wantH = key === 'horizontal' || key === 'linha';
  const wantV = key === 'vertical' || key === 'linha';
  const wantD = key === 'diagonal' || key === 'linha';
  if (wantH) ev.rows.forEach((ok, r) => { if (ok) addRow(r); });
  if (wantV) ev.cols.forEach((ok, c) => { if (ok) addCol(c); });
  if (wantD) {
    if (ev.diag1) for (let i = 0; i < ROWS; i++) cells.push([i, i]);
    if (ev.diag2) for (let i = 0; i < ROWS; i++) cells.push([i, COLS - 1 - i]);
  }
  if (key === 'cantos' && ev.corners) cells.push([0, 0], [0, COLS - 1], [ROWS - 1, 0], [ROWS - 1, COLS - 1]);
  if (key === 'cheia' && ev.full) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push([r, c]);
  return cells;
}

// Verifica se a cartela bateu o padrão selecionado; devolve rótulos do que fechou.
export function checkPattern(ev, key) {
  const labels = [];
  switch (key) {
    case 'horizontal':
      ev.rows.forEach((ok, r) => { if (ok) labels.push(`Linha ${r + 1}`); });
      break;
    case 'vertical':
      ev.cols.forEach((ok, c) => { if (ok) labels.push(`Coluna ${COL_LABELS[c]}`); });
      break;
    case 'diagonal':
      if (ev.diag1) labels.push('Diagonal ↘');
      if (ev.diag2) labels.push('Diagonal ↙');
      break;
    case 'cantos':
      if (ev.corners) labels.push('Quatro cantos');
      break;
    case 'cheia':
      if (ev.full) labels.push('Cartela cheia');
      break;
    case 'linha':
    default:
      labels.push(...ev.completed);
      break;
  }
  return { done: labels.length > 0, labels };
}
