# Revisão: Ponte Nexo LP Creator → Nexo Digital Store

> Arquivo vivo — anotações de bugs, brechas e melhorias encontrados durante a análise.

## 0. Descobertas da análise (contexto)

- **LP Creator local:** 50 templates no SQLite, 42 funcionais (`approved`/`available`/`unreviewed` + HTML válido), 11 de teste/lixo, 105 sessões (66 com HTML válido).
- **LP Creator VPS:** apenas 2 templates no `data/nexo-lp.db`; roda em `127.0.0.1:13510`, exposto por Caddy em `vps.nexo-digital.app:3510/3511`. Apesar de `DATABASE_URL` apontar para Postgres, o código ainda usa SQLite via `better-sqlite3`.
- **Nexo Store VPS:** escuta em `127.0.0.1:13469`, exposto em `vps.nexo-digital.app:3470`. Tem commits/mudanças não refletidas no repo local.
- **Chaves admin:** Store usa `ADMIN_API_KEY=7741`; LP Creator usa `ADMIN_SECRET=7741`. Ambas são senhas numéricas fracas expostas em env.

## 1. Bugs / inconsistências funcionais

### 1.1 `import-kimi-chats-to-loja.js` mente sobre sanitização
- **Onde:** `nexo-lp-creator/scripts/import-kimi-chats-to-loja.js`
- **Problema:** O comentário e o log dizem *"direct, no sanitization"*, mas a chamada `POST /sessions/:id/publish` com `{ direct: true }` cai em `lpTemplateService.publishFromSession()`, que **sempre** cria o template com `status='sanitizing'` e dispara o `SanitizationOrchestrator` em background.
- **Impacto:** Importações em massa disparam dezenas de requisições ao Kimi sem o operador saber. Pode estourar rate-limit/contexto.
- **Sugestão:** Ou respeitar a flag `direct` no `publishFromSession` (pulando sanitização e marcando `available`/`approved`), ou corrigir o texto do script.

### 1.2 `publish-existing-to-loja.js` também dispara sanitização
- **Onde:** `nexo-lp-creator/scripts/publish-existing-to-loja.js`
- **Problema:** Mesmo padrão: chama `publishFromSession`, que dispara sanitização. O script não oferece opção de publicar direto com HTML já validado.
- **Impacto:** Mesmo de 1.1 — reprocessamento desnecessário via Kimi.

### 1.3 Categoria sempre fixada em `landing` no publish
- **Onde:** `lpTemplateService.publishFromSession()` (linha 141) e `publishUnreviewedFromSession()` (linha 214)
- **Problema:** O template é criado sempre com `category: 'landing'`, ignorando a categoria inferida depois pela sanitização. O `SanitizationOrchestrator` só atualiza `category` no **final** (se tiver sucesso), mas enquanto isso o template aparece mal categorizado na loja interna do LP Creator.
- **Sugestão:** Rodar `enrichMetadataLocal` antes de inserir, ou pelo menos usar a categoria inferida do prompt/ HTML no insert inicial.

### 1.4 Slug pode colidir na Store
- **Onde:** `nexo-digital-store/src/lib/template-adapter.ts` (`slugify(name) + '-template'`)
- **Problema:** Dois templates com nomes similares geram o mesmo slug. A API admin da Store retorna 409 para `id` ou `slug` duplicado, mas a ponte pode falhar silenciosamente se não tratar.
- **Impacto:** Segundo template com nome parecido não entra na Store.
- **Sugestão:** Adicionar sufixo hash curto ou contador no slug quando houver colisão.

### 1.5 `generateStaticParams` em `/template/[slug]` só conhece mocks
- **Onde:** `nexo-digital-store/src/app/(store)/template/[slug]/page.tsx`
- **Problema:** Gera páginas estáticas apenas a partir de `mockApps` (mockLPCTemplates). Templates adicionados via admin/API em `apps.json` não terão página estática pré-gerada; só funcionarão se o Next cair em dynamic rendering.
- **Impacto:** Risco de 404 em deploy estático/ISR quando um template novo for acessado.
- **Sugestão:** Ler `getDataApps()` no `generateStaticParams` (server-side) ou garantir `dynamicParams = true` + fallback no runtime.

### 1.6 `mockApi.getTemplates` server-side ignora `apps.json`
- **Onde:** `nexo-digital-store/src/lib/api-client.ts`
- **Problema:** No servidor, `getTemplates` filtra `mockApps` (que inclui os 5 mocks LP + os apps do `apps.json` via proxy). Na prática parece funcionar por causa do proxy, mas a lógica fica confusa e frágil.
- **Sugestão:** Unificar: sempre chamar `/api/apps` no cliente e, no servidor, ler `getDataApps()` diretamente.

### 1.7 Divergência de versões: Store VPS à frente do local
- **Onde:** VPS `/root/nexo-projects-abner/nexo-digital-store`
- **Problema:** VPS tem commits/mudanças não refletidas no repo local (`package-lock.json`, `src/app/admin/page.tsx`, `src/app/api/admin/upload/route.ts`, `src/components/app-detail-page.tsx`, `src/data/apps.json`).
- **Impacto:** Se fizer deploy a partir do local, pode sobrescrever correções feitas no VPS.
- **Sugestão:** Sincronizar: dar `git status` no VPS, commitar ou resetar, e garantir que local e VPS apontem para o mesmo HEAD antes de qualquer alteração.

## 2. Brechas de segurança

### 2.1 Upload de imagens da admin pode aceitar path traversal
- **Onde:** `nexo-digital-store/src/app/api/admin/upload/route.ts` (modificado no VPS)
- **Problema:** Precisa verificar se o filename vindo do cliente é sanitizado (`../` etc.) e se o content-type é validado.
- **Ação:** Ler implementação atual do upload no VPS.

### 2.2 Admin Store protegido apenas por `x-admin-key` estático
- **Onde:** `nexo-digital-store/src/app/api/admin/apps/route.ts`
- **Problema:** Header único sem expiração, sem rate-limit específico. Se vazar, permite criar/editar/deletar apps.
- **Sugestão:** Considerar token JWT de curta duração ou IP whitelist; não é blocker, mas vale anotar.

### 2.3 LP Creator admin expõe operações poderosas com token simples
- **Onde:** `nexo-lp-creator/nexo-lp-server/security/adminAuth.js`
- **Problema:** Operações como creditar/débito de moedas, deletar sessões, impersonate dependem de um token único.
- **Sugestão:** Auditar logs e rotacionar token; não é blocker para a ponte.

### 2.4 Previews HTML são servidos sem CSP restritivo
- **Onde:** `nexo-lp-creator` (CSP foi desabilitado no VPS)
- **Problema:** HTML gerado por usuários/third-party é servido sem isolamento. Pode executar scripts maliciosos no domínio do VPS.
- **Sugestão:** Servir previews em subdomínio isolado ou sandboxar via iframe com `sandbox`; desabilitar CSP é paliativo perigoso.

### 2.5 Chaves admin numéricas e expostas
- **Onde:** Ambos os projetos (`ADMIN_API_KEY=7741`, `ADMIN_SECRET=7741`)
- **Problema:** Senha curta e numérica, sem rate-limit específico. Em ambiente exposto na internet, é trivial forçar.
- **Sugestão:** Gerar tokens longos (64+ chars), rotacionar e considerar IP whitelist.

### 2.6 Upload de thumbnail pode sobrescrever arquivos
- **Onde:** `nexo-digital-store/src/app/api/admin/upload/route.ts` (VPS)
- **Problema:** O filename é `${slug}${originalExt}`. Se dois templates tiverem o mesmo slug, um sobrescreve o outro. Não há hash/version no nome.
- **Sugestão:** Suffixar com hash curto ou timestamp.

### 2.7 Watchdog `luna-health-watchdog` reiniciava serviços sem parar
- **Onde:** `/root/nexo-projects-abner/luna-kernel/packages/kernel/luna-health-watchdog.js`
- **Problema:** O watchdog monitorava portas antigas (`luna-server:3458`, `nexo-lp-server:3460`). Como os serviços internos migraram para `13600` e `13510`, o watchdog não encontrava resposta e reiniciava os processos a cada 30s.
- **Ação tomada:** Corrigido o watchdog para monitorar as portas internas corretas e paths de health (`/health`, `/api/nexo-lp/health`).
- **Resultado:** `luna-server` e `nexo-lp-server` ficaram estáveis.

## 3. Melhorias arquiteturais para a ponte

### 3.1 Unificar modelo de template
- A Store entende `AppProduct`; o LP Creator entende `templates` (SQLite). A adaptação existe (`template-adapter.ts`), mas hoje é usada só para mocks.
- **Sugestão:** Criar um endpoint/rotina que leia templates do LP Creator, adapte e envie para a Store via API admin.

### 3.2 Decidir onde fica a "fonte da verdade"
- Opção A: LP Creator é fonte; Store consome via API/sincronização periódica.
- Opção B: Store é fonte; LP Creator publica direto no `apps.json`.
- Opção C: Ambas as fontes coexistem, com IDs estáveis e merge determinístico.
- **Recomendação preliminar:** Opção A — LP Creator mantém o catálogo de templates; Store faz proxy/cache. Assim a sanitização, metadados e preços continuam no LP Creator.

### 3.3 Transferência de templates local → VPS
- LP Creator local tem 50 templates; VPS tem 2.
- **Opções:**
  1. Copiar `data/nexo-lp.db` do local para o VPS (mais simples, mas leva sessões/mensagens também).
  2. Exportar apenas templates aprovados/disponíveis para JSON e importar no VPS.
  3. Sincronizar via API: script local bate na API do VPS.
- **Recomendação preliminar:** Opção 2 — exportar templates funcionais (approved/available/unreviewed com HTML válido) para JSON e reinserir no VPS, evitando levar lixo/teste.

### 3.4 Sanitização na ponte
- O usuário disse: *"essa landing page vai direto pra nexo store apos ser sanitizado"*.
- **Sugestão:** A ponte deve consumir `sanitized_html` (quando status=approved) ou `html` original com fallback. Templates `unreviewed` podem ir com badge/flag de desconto, mas o default deve ser só mandar `approved`/`available`.

### 3.5 Thumbnails
- Templates do LP Creator podem ter `thumbnail_url` ou preview token. A Store precisa de ícone/thumbnail servido em `/thumbnails/` ou URL absoluta.
- **Sugestão:** Durante a ponte, gerar screenshot (se não existir) e copiar o arquivo de preview/ thumbnail para a Store, garantindo URL acessível.

## 4. Dúvidas a esclarecer com o usuário

1. **Qual a versão “oficial”?** VPS Store tem mudanças não commitadas. Devo commitar/limpar o VPS primeiro?
2. **Todos os templates locais (approved + available + unreviewed = 50) devem ir para o VPS?** Ou só os `approved`/`available`?
3. **A ponte deve ser automática** (toda landing page gerada vai para a Store) **ou manual** (botão/publicar)?
4. **A Store deve listar templates em tempo real do LP Creator** ou ter uma cópia sincronizada em `apps.json`?
5. **Preços:** manter `price_stars/suns/moons` do LP Creator ou converter para EUR na Store?
6. **Domínio/preview:** os templates na Store devem usar `public_preview_token` do LP Creator (link para o LP Creator) ou ter preview próprio na Store?

---

*Última atualização: análise em andamento.*
