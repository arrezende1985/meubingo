# 🚀 Deploy do MeuBingo

App **estático** (HTML/CSS/JS, sem backend). Não tem etapa de build — os hosts
servem os arquivos direto. Este guia cobre **GitHub → Cloudflare Pages** ou
**GitHub → Vercel**, e a ligação do domínio **meubingo.app**.

---

## 1. Subir o código no GitHub

O repositório já está iniciado localmente (com um commit inicial). Falta criar
o repositório remoto e dar `push`.

### Opção A — com o GitHub CLI (`gh`), mais rápido
```bash
cd C:\Projects\Bingo
gh auth login              # só na primeira vez
gh repo create meubingo --public --source=. --remote=origin --push
```

### Opção B — manual (sem `gh`)
1. Crie um repositório vazio em https://github.com/new (nome: `meubingo`), **sem**
   README/.gitignore (já temos).
2. Conecte e envie:
```bash
cd C:\Projects\Bingo
git remote add origin https://github.com/SEU_USUARIO/meubingo.git
git branch -M main
git push -u origin main
```

> A cada mudança futura: `git add -A && git commit -m "descrição" && git push`

---

## 2A. Publicar na Cloudflare Pages

1. Acesse https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Autorize o GitHub e escolha o repositório `meubingo`.
3. Configuração de build (é site estático, então **deixe vazio**):
   - **Framework preset:** `None`
   - **Build command:** *(vazio)*
   - **Build output directory:** `/`  (a raiz do repo)
4. **Save and Deploy**. Em ~1 min sai um endereço `meubingo.pages.dev` com HTTPS.

O arquivo `_headers` já está no projeto e é aplicado automaticamente.

## 2B. (Alternativa) Publicar na Vercel

1. Acesse https://vercel.com → **Add New… → Project** → importe o repo `meubingo`.
2. **Framework Preset:** `Other`. **Build Command / Output:** deixe em branco
   (o `vercel.json` já cuida dos cabeçalhos).
3. **Deploy**. Sai um endereço `meubingo.vercel.app` com HTTPS.

> Use **um** dos dois (Cloudflare **ou** Vercel). Os dois arquivos de config
> (`_headers` e `vercel.json`) convivem sem problema no repo.

---

## 3. Ligar o domínio meubingo.app

O `.app` **exige HTTPS** (os dois hosts emitem o certificado automaticamente).

### Na Cloudflare Pages
1. No projeto → **Custom domains** → **Set up a domain** → digite `meubingo.app`.
2. A Cloudflare mostra os registros DNS a configurar.
3. No **registro.br** (onde você comprou), aponte o domínio para a Cloudflare:
   - O caminho mais simples é **usar a Cloudflare como DNS**: adicione o domínio
     em Cloudflare (plano free), e no registro.br troque os **servidores DNS**
     (nameservers) pelos que a Cloudflare indicar. Aí o domínio conecta sozinho.

### Na Vercel
1. No projeto → **Settings → Domains** → adicione `meubingo.app`.
2. A Vercel mostra os registros. No **registro.br**, em **Editar Zona / DNS**, crie:
   - `A` em `@` → o IP que a Vercel indicar **ou** `CNAME` `www` → `cname.vercel-dns.com`
   - (a Vercel indica os valores exatos na tela do domínio)
3. Aguarde a propagação (minutos a algumas horas) e o HTTPS é emitido sozinho.

---

## Checklist pós-deploy
- [ ] Abrir `https://meubingo.app` e conferir se carrega
- [ ] No celular: **Adicionar à tela inicial** (instala o PWA)
- [ ] Testar a **câmera/OCR** (só funciona em HTTPS — por isso o deploy é necessário)
- [ ] Confirmar que o app funciona **offline** depois da 1ª visita
