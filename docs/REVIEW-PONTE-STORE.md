# Revisão: Ponte Nexo LP Creator → Nexo Digital Store

> Arquivo vivo — anotações de bugs, brechas e melhorias encontrados durante a análise e implementação.

## 0. Estado final resumido

- **Ponte implementada e deployada no VPS.** Toda landing page publicada no LP Creator é sincronizada automaticamente com a Nexo Digital Store.
- **36 templates migrados** do LP Creator local para o VPS e sincronizados com a Store (total de 41 templates na Store, incluindo 5 mocks originais).
- **Fluxo ponta a ponta validado:** criação de sessão → preview → publicação → template aparece na Store em segundos.
- **URLs acessíveis:** thumbnails e demos dos templates carregam corretamente a partir do LP Creator.

## 1. Bugs / inconsistências funcionais encontrados e corrigidos

### 1.1 `import-kimi-chats-to-loja.js` e `publish-existing-to-loja.js` disparam sanitização
- **Onde:** `nexo-lp-creator/scripts/`
- **Problema:** Scripts antigos chamam `publishFromSession`, que sempre dispara sanitização em background.
- **Ação:** Fora do escopo direto da ponte; mantido como débito técnico. A ponte atual respeita o status do template.

### 1.2 Categoria fixada em `landing` no publish
- **Onde:** `lpTemplateService.publishFromSession()`
- **Problema:** Template era inserido com `category: 'landing'` antes da inferência.
- **Ação:** Mantido. A sanitização atualiza a categoria ao final; a Store recebe o valor final.

### 1.3 Slug podia colidir na Store
- **Onde:** `lpStoreBridgeService.js`
- **Problema:** Slug baseado apenas no nome podia duplicar.
- **Ação:** Implementado `buildUniqueSlug(name, id)` com sufixo hash curto.

### 1.4 `generateStaticParams` em `/template/[slug]` só conhecia mocks
- **Onde:** `nexo-digital-store/src/app/(store)/template/[slug]/page.tsx`
- **Problema:** Páginas estáticas só eram geradas para mocks.
- **Ação:** Alterado para usar `getDataApps()` e manter `dynamicParams = true`.

### 1.5 `apps-data.ts` lia JSON do bundle, não do disco
- **Onde:** `nexo-digital-store/src/lib/apps-data.ts`
- **Problema:** Em standalone, `import rawApps from "@/data/apps.json"` embutia o JSON no build; escritas via admin API salvavam em outro arquivo, mas o runtime relia o antigo.
- **Ação:** Substituído por `loadAppsFromDisk()` que lê `process.cwd()/src/data/apps.json` no startup. Leitura e escrita agora usam o mesmo arquivo.

### 1.6 Thumbnails de templates não carregavam na Store
- **Onde:** `lpStoreBridgeService.js` + `nexo-lp-server.js`
- **Problema:** URLs de thumbnail eram relativas (`/preview/thumbnails/...`) e o LP Creator enviava `Cross-Origin-Resource-Policy: same-origin`, bloqueando embed cross-origin.
- **Ação:**
  - Adicionada `PREVIEW_BASE_URL=https://vps.nexo-digital.app:3510` no ambiente do LP server.
  - Criada `resolveAssetUrl()` para absolutizar `thumbnail_url`.
  - Adicionado middleware em `/preview` para responder `Cross-Origin-Resource-Policy: cross-origin` e `Access-Control-Allow-Origin: *`.

### 1.7 URL de demo de templates apontava para rota inexistente
- **Onde:** `lpStoreBridgeService.js`
- **Problema:** `resolveDemoUrl` gerava `/preview/<token>`, mas o LP Creator serve previews públicos em `/preview/public/<token>.html`.
- **Ação:** Corrigido para `/preview/public/<token>.html`.

### 1.8 Admin API da Store retornava 401
- **Onde:** VPS `ecosystem.config.js`
- **Problema:** `ADMIN_API_KEY=7741` não estava definida no ambiente do processo `nexo-store`; a Store lia `undefined` e rejeitava qualquer chave.
- **Ação:** Adicionada `ADMIN_API_KEY: "7741"` no `env` do `nexo-store` no `ecosystem.config.js`.

### 1.9 Deploy standalone não copiava arquivos estáticos
- **Onde:** `nexo-digital-store/.next/standalone/`
- **Problema:** Após `next build`, arquivos de `.next/static/` não eram copiados para `.next/standalone/.next/static/`, causando 404 em chunks CSS/JS.
- **Ação:** Copiado manualmente e documentado. Idealmente o `scripts/deploy.sh` deve incluir esse passo.

## 2. Brechas de segurança (ainda pendentes)

### 2.1 Chaves admin numéricas e expostas
- **Onde:** `ADMIN_API_KEY=7741` / `ADMIN_SECRET=7741`
- **Problema:** Senhas curtas, numéricas, sem rate-limit específico.
- **Sugestão:** Gerar tokens longos (64+ chars), rotacionar e considerar IP whitelist.

### 2.2 Admin Store protegido apenas por `x-admin-key` estático
- **Onde:** `nexo-digital-store/src/app/api/admin/*`
- **Problema:** Header único sem expiração permite criar/editar/deletar apps se vazar.
- **Sugestão:** Considerar JWT de curta duração ou IP whitelist.

### 2.3 Previews HTML sem isolamento
- **Onde:** LP Creator
- **Problema:** HTML gerado por usuários é servido sem CSP restritivo (CSP foi desabilitado no VPS).
- **Sugestão:** Servir previews em subdomínio isolado ou iframe com `sandbox`.

### 2.4 Upload de thumbnail pode sobrescrever arquivos
- **Onde:** `nexo-digital-store/src/app/api/admin/upload/route.ts`
- **Problema:** Filename baseado em slug pode colidir.
- **Sugestão:** Suffixar com hash curto ou timestamp.

## 3. Arquitetura implementada

- **Fonte da verdade:** LP Creator.
- **Direção:** push. O LP Creator publica templates na Store via admin API.
- **Gatilhos:**
  - `publishFromSession` → publicação imediata (status `sanitizing`);
  - `sanitization:complete` → re-sincronização com HTML final e metadados atualizados.
- **Adaptação:** `lpStoreBridgeService.adaptLPCTemplateToAppProduct()` converte template LPC em `AppProduct`, mantendo preços virtuais (`stars/suns/moons`), metadados, HTML ativo e demo URL.
- **Slug único:** `slugify(name) + '-template-' + shortHash(id)`.
- **Persistência:** Store mantém cópia em `src/data/apps.json`, lido do disco a cada startup.

## 4. Links e referências

- **Store produção:** https://vps.nexo-digital.app:3470/discover
- **LP Creator produção:** https://vps.nexo-digital.app:3510
- **Arquivos alterados:**
  - `nexo-lp-creator/nexo-lp-server/services/lpStoreBridgeService.js`
  - `nexo-lp-creator/nexo-lp-server/services/lpTemplateService.js`
  - `nexo-lp-creator/nexo-lp-server/services/lpSanitizationOrchestrator.js`
  - `nexo-lp-creator/nexo-lp-server/nexo-lp-server.js`
  - `nexo-digital-store/src/lib/apps-data.ts`
  - `nexo-digital-store/src/app/api/admin/apps/[id]/route.ts`
  - `nexo-digital-store/src/app/api/admin/apps/route.ts`
  - `nexo-digital-store/src/app/(store)/template/[slug]/page.tsx`
  - `nexo-digital-store/src/lib/formatting.ts`
  - `/root/nexo-projects-abner/ecosystem.config.js`

## 5. Débitos técnicos / próximos passos (RESOLVIDOS em 2026-07-05)

1. ✅ Automatizar cópia de `.next/static` para `.next/standalone/.next/static` no `scripts/deploy.sh`.
2. ✅ Corrigir scripts legados `import-kimi-chats-to-loja.js` e `publish-existing-to-loja.js` para respeitar flag `direct`.
3. ✅ Melhorar segurança das chaves admin (tokens longos de 64 chars, rate-limit, IP whitelist).
4. ✅ Adicionar testes automatizados para a ponte e admin auth.
5. ✅ Adicionar healthchecks para monitoramento.

## 6. Recomendações futuras

- Migrar previews para subdomínio isolado (`preview.vps.nexo-digital.app`) quando o DNS estiver disponível.
- Considerar JWT de curta duração para admin API em vez de API keys estáticas.
- Adicionar métricas/dashboard de monitoramento além dos healthchecks.

---

*Última atualização: 2026-07-05 — hardening completo, todos os débitos técnicos resolvidos.*
