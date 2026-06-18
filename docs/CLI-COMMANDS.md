# Comandos CLI do NEXO Landing Page Creator

Referência rápida dos comandos disponíveis no terminal para ativar cron, sanitizador, publicação na LOJA, thumbnails, etc.

> **Pré-requisitos para comandos que usam Kimi/Chrome:**
> - Backend rodando (`bash scripts/start-backend.sh` ou `npm run dev:server`)
> - Chrome com a extensão Kimi Web Bridge aberto na porta correta (`KIMI_CDP_PORT`, padrão `9226`)
> - Variáveis de ambiente carregadas (`.env`)

---

## 1. Sanitizador

### Rodar um teste isolado do sanitizador
Cria uma sessão e template de teste e executa o pipeline completo de sanitização.

```bash
node scripts/test-sanitization.js
```

**Salva em:**
- `data/nexo-lp-test-sanitization.db`
- `data/sanitization-test-{templateId}.html`
- `data/sanitization-test-{templateId}.json` (log)

---

### Sanitizar templates já publicados como `unreviewed`
Pega todos os templates com `status = 'unreviewed'` e roda a sanitização.
Se der certo, o template é promovido para `available`.

```bash
node scripts/sanitize-unreviewed.js
```

---

### Retomar sanitizações travadas em `sanitizing`
Processa templates que ficaram presos no status `sanitizing`, um por vez.

```bash
node scripts/resume-sanitization.js
```

---

## 2. Cron / publicação de sessões com HTML completo

### Ver quantas sessões têm HTML inteiro e ainda não foram publicadas
Esse é o comando de diagnóstico — não publica nada, só mostra os candidatos.

```bash
node scripts/diagnose-cron-candidates.js
```

Saída exemplo:
```
Total sessions: 150
Already have template: 40
No current_html: 20
HTML < 15000 chars: 30
HTML fails doctype/body checks: 10
Test/anonymous session: 15
Status not preview/deployed: 10
CRON CANDIDATES: 25
```

---

### Publicar na LOJA todas as sessões com HTML válido (cron)
Publica sessões que ainda não viraram template como `unreviewed` e já dispara a sanitização.

```bash
npm run cron:publish-unreviewed
# ou direto:
node scripts/cron-publish-unreviewed.js
```

**Config via env:**
- `CRON_UNREVIEWED_LIMIT` — quantas sessões processar (padrão `50`)
- `CRON_UNREVIEWED_DELAY_MS` — delay entre publicações (padrão `3000`)

Log salvo em: `data/cron-unreviewed-log.json`

---

### Publicar sessões de preview já existentes na LOJA
Similar ao cron, mas não filtra por tamanho mínimo de HTML (`15000` chars) — só verifica `<html>...</html>` e `<body>`.

```bash
node scripts/publish-existing-to-loja.js
```

---

## 3. Thumbnails e metadados

### Gerar thumbnails para templates publicados
Abre cada template disponível no Chrome e tira screenshot.

```bash
npm run generate:thumbnails
# ou:
node scripts/generate-template-thumbnails.js
```

---

### Enriquecer metadados sem usar Kimi
Lê o HTML dos templates `available` e infere título, descrição, categoria, tags etc.

```bash
npm run enrich:metadata
# ou:
node scripts/enrich-template-metadata.js
```

---

## 4. Manutenção de previews

### Republicar previews públicos
Atualiza os arquivos públicos de preview de todos os templates com o HTML sanitizado/atual.

```bash
node scripts/republish-previews.js
```

---

## 5. Desenvolvimento / testes

### Subir ambiente de dev
```bash
bash scripts/dev.sh
```

### Subir só o backend
```bash
bash scripts/start-backend.sh
```

### Reiniciar backend
```bash
bash scripts/restart-backend.sh
```

### Rodar todos os testes
```bash
npm test
# ou:
bash scripts/test.sh
```

### Rodar testes E2E (Playwright)
```bash
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
```

### Verificar build
```bash
npm run build
# ou:
bash scripts/verify-build.sh
```

---

## 6. Outros

### Importar chats do Kimi para a LOJA
```bash
npm run import:kimi-chats
# ou:
node scripts/import-kimi-chats-to-loja.js
```

---

## Resumo mental

| Quero fazer... | Comando |
|---|---|
| Testar o sanitizador com dados fake | `node scripts/test-sanitization.js` |
| Sanitizar templates `unreviewed` existentes | `node scripts/sanitize-unreviewed.js` |
| Des Travar templates `sanitizing` | `node scripts/resume-sanitization.js` |
| Ver sessões com HTML inteiro sem publicar | `node scripts/diagnose-cron-candidates.js` |
| Publicar essas sessões e sanitizar (cron) | `npm run cron:publish-unreviewed` |
| Gerar screenshots da LOJA | `npm run generate:thumbnails` |
| Enriquecer metadados sem AI | `npm run enrich:metadata` |
