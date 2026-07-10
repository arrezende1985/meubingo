# 🎱 MeuBingo — Marcador de Cartelas (PWA)

App pessoal para facilitar a marcação em jogos de **bingo 75 bolas** (cartela 5×5, cabeçalho **B-I-N-G-O**, centro **FREE**). Site: **meubingo.app**

Colunas por faixa: **B** 1–15 · **I** 16–30 · **N** 31–45 · **G** 46–60 · **O** 61–75.

## Fluxo do app

1. **Concurso** — dê um nome ao jogo (ex: "Bingo da Festa Junina").
2. **Cartelas** — escaneie com a câmera (OCR) ou digite manualmente.
   - O OCR faz um "chute inicial" e abre uma **grade 3×9 para você revisar/corrigir** antes de salvar.
   - Células em **verde** = número ok na coluna certa; **vermelho** = fora da faixa da coluna.
3. **Sorteio** — digite cada número que sai (1–75). O app marca automaticamente em todas as cartelas (o FREE já vem marcado).
4. **Vitórias** — avisa em tela cheia quando uma cartela faz:
   - **BINGO!** = qualquer **linha, coluna ou diagonal** completa
   - **Cartela cheia** = todos os 24 números sorteados

Tudo fica salvo no navegador (localStorage). Dá pra fechar e continuar depois.

## Como rodar

O app precisa ser servido por HTTP (não abra o `index.html` direto — módulos ES e service worker exigem `http://`/`https://`).

**Opção 1 — Python (já vem no Windows/Mac/Linux):**
```bash
cd C:\Projects\Bingo
python -m http.server 8080
```
Abra: http://localhost:8080

**Opção 2 — Node:**
```bash
cd C:\Projects\Bingo
npx serve -l 8080
```

### Testar no celular
- A **câmera** só funciona em `localhost` ou `https`.
- Para usar no telefone, exponha via HTTPS (ex: `npx localtunnel --port 8080`, `ngrok http 8080`, ou hospede em GitHub Pages / Netlify / Vercel).
- No celular, use "Adicionar à tela inicial" para instalar como app (PWA).

## Detalhes técnicos

- **Sem build, sem framework** — JS puro (ES modules).
- **OCR:** [Tesseract.js](https://tesseract.projectnaptha.com/) carregado da CDN na 1ª leitura (precisa de internet uma vez; depois o app shell funciona offline).
- **Offline:** service worker faz cache do app (HTML/CSS/JS/ícones).
- **Estrutura:**
  - `js/bingo.js` — modelo da cartela, validação e detecção de vitória
  - `js/storage.js` — persistência (localStorage)
  - `js/ocr.js` — captura e leitura da câmera
  - `js/app.js` — telas e navegação
  - `service-worker.js` / `manifest.json` — PWA

## Regras de vitória (75 bolas)

| Prêmio | Condição |
|---|---|
| BINGO (linha) | Uma **linha**, **coluna** ou **diagonal** completa (o centro FREE conta) |
| Cartela cheia | Todos os 24 números da cartela sorteados |
