// Persistência em localStorage. Um "concurso" agrupa cartelas + sorteio.

const KEY = 'bingo.concursos.v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

// id simples baseado em contador + aleatório (sem depender de libs).
function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${(performance.now() | 0).toString(36)}`;
}

export function listConcursos() {
  const all = readAll();
  return Object.values(all).sort((a, b) => b.criadoEm - a.criadoEm);
}

export function getConcurso(id) {
  return readAll()[id] || null;
}

export function createConcurso(nome) {
  const all = readAll();
  const id = makeId('c');
  const concurso = {
    id,
    nome: nome?.trim() || 'Concurso sem nome',
    criadoEm: Date.now(),
    cartelas: [],
    sorteados: [], // ordem em que os números saíram
    padrao: 'linha', // padrão de vitória do sorteio
    status: 'preparando', // preparando | sorteando
  };
  all[id] = concurso;
  writeAll(all);
  return concurso;
}

export function saveConcurso(concurso) {
  const all = readAll();
  all[concurso.id] = concurso;
  writeAll(all);
  return concurso;
}

export function deleteConcurso(id) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

export function addCartela(concursoId, grid, apelido) {
  const c = getConcurso(concursoId);
  if (!c) return null;
  const cartela = {
    id: makeId('k'),
    apelido: apelido?.trim() || `Cartela ${c.cartelas.length + 1}`,
    grid,
    criadaEm: Date.now(),
  };
  c.cartelas.push(cartela);
  saveConcurso(c);
  return cartela;
}

export function updateCartela(concursoId, cartelaId, patch) {
  const c = getConcurso(concursoId);
  if (!c) return null;
  const k = c.cartelas.find((x) => x.id === cartelaId);
  if (!k) return null;
  Object.assign(k, patch);
  saveConcurso(c);
  return k;
}

export function removeCartela(concursoId, cartelaId) {
  const c = getConcurso(concursoId);
  if (!c) return;
  c.cartelas = c.cartelas.filter((x) => x.id !== cartelaId);
  saveConcurso(c);
}
