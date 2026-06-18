# Tutorial de Operações do NEXO Landing Page Creator

Guia passo a passo para executar as principais funções de produção: gerar thumbnails, publicar na LOJA, sanitizar templates, rodar cron e manter metadados.

---

## Pré-requisitos gerais

Antes de qualquer comando que use Kimi/Chrome:

1. **Backend rodando** na porta `3460`:
   ```bash
   bash scripts/start-backend.sh
   # ou
   npm run dev:server
   ```

2. **Chrome com a extensão Kimi Web Bridge** aberto e conectado na porta configurada em `.env`:
   ```env
   KIMI_CDP_URL=http://127.0.0.1:9226
   ```

3. **Variáveis de ambiente carregadas**. Os scripts leem o `.env` automaticamente.

---

## 1. Gerar thumbnails dos templates

### O que faz
Abre cada template público no Chrome, tira um screenshot da página e salva em:
```
data/previews/thumbnails/{templateId}.png
```

### Comando
```bash
npm run generate:thumbnails
```

### O que esperar
```
[THUMBNAILS] Found 21 public templates
[1/21] Skipping tpl-xxx — thumbnail already exists
[2/21] Capturing http://localhost:3460/preview/public/xxx.html
  -> saved /home/jhin/.../data/previews/thumbnails/tpl-yyy.png
...
[THUMBNAILS] Done: 4 captured, 17 skipped, 0 failed (total 21)
```

### Dica
O script **só gera thumbnails que ainda não existem**. Pode rodar várias vezes sem sobrescrever.

---

## 2. Publicar sessões com HTML completo na LOJA

### O que faz
Procura sessões que já geraram um HTML válido (`status = preview|deployed|review`) e ainda não viraram template. Publica como `unreviewed` (metade do preço) e já dispara a sanitização.

### Antes: ver candidatos
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

### Publicar e sanitizar
```bash
npm run cron:publish-unreviewed
```

Ou direto:
```bash
node scripts/cron-publish-unreviewed.js
```

### Configuração opcional via `.env`
```env
CRON_UNREVIEWED_LIMIT=50      # quantas sessões processar
CRON_UNREVIEWED_DELAY_MS=3000 # delay entre publicações
```

### Log
O cron salva o resultado em:
```
data/cron-unreviewed-log.json
```

---

## 3. Sanitizar templates que já estão publicados

### 3.1 Sanitizar templates `unreviewed`
Templates vendidos como `unreviewed` podem ser sanitizados depois:

```bash
node scripts/sanitize-unreviewed.js
```

Se der certo, o template é promovido automaticamente para `available` e volta ao preço normal.

### 3.2 Retomar sanitizações travadas
Se um template ficou preso em `sanitizing` (erro de rede, Chrome travou, etc.):

```bash
node scripts/resume-sanitization.js
```

Ele processa **um por vez** para não sobrecarregar o bridge.

### 3.3 Testar o pipeline de sanitização
Cria uma sessão/template de teste e roda a sanitização completa:

```bash
node scripts/test-sanitization.js
```

Arquivos gerados:
- `data/nexo-lp-test-sanitization.db`
- `data/sanitization-test-{templateId}.html`
- `data/sanitization-test-{templateId}.json` (log)

---

## 4. Republicar previews públicos

### O que faz
Atualiza os arquivos HTML públicos de preview com o HTML atual/sanitizado de cada template.

```bash
node scripts/republish-previews.js
```

Use quando:
- O HTML sanitizado foi atualizado no banco mas o arquivo público ficou desatualizado.
- Quer refletir mudanças de metadados no preview.

---

## 5. Enriquecer metadados sem usar Kimi

### O que faz
Lê o HTML dos templates `available` e infere título, descrição, categoria, tags, features etc. Não abre Chrome.

```bash
npm run enrich:metadata
```

Ou direto:
```bash
node scripts/enrich-template-metadata.js
```

---

## 6. Fluxo de produção recomendado

Quando você tem várias landing pages geradas e quer deixar tudo publicado:

```bash
# 1. Ver quantas estão prontas
node scripts/diagnose-cron-candidates.js

# 2. Publicar na LOJA e sanitizar
npm run cron:publish-unreviewed

# 3. Se alguma travou em 'sanitizing'
node scripts/resume-sanitization.js

# 4. Republicar previews com HTML final
node scripts/republish-previews.js

# 5. Gerar thumbnails só das que faltam
npm run generate:thumbnails

# 6. Enriquecer metadados
npm run enrich:metadata
```

---

## 7. Monitorar logs

- Logs do backend: `logs/nexo-lp-server.log`
- Log do cron: `data/cron-unreviewed-log.json`
- Log de sanitização: fica salvo no campo `sanitization_log` do template

---

## Resumo rápido

| Tarefa | Comando |
|---|---|
| Gerar thumbnails | `npm run generate:thumbnails` |
| Ver candidatos ao cron | `node scripts/diagnose-cron-candidates.js` |
| Publicar e sanitizar candidatos | `npm run cron:publish-unreviewed` |
| Sanitizar templates `unreviewed` | `node scripts/sanitize-unreviewed.js` |
| Retomar sanitizações travadas | `node scripts/resume-sanitization.js` |
| Testar sanitização | `node scripts/test-sanitization.js` |
| Republicar previews | `node scripts/republish-previews.js` |
| Enriquecer metadados | `npm run enrich:metadata` |
