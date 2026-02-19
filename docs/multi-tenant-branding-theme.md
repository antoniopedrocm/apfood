# Arquitetura multi-tenant + branding + tema de usuário (React + Firebase)

## 1) Estratégia geral

- **Resolução de tenant por subdomínio**: o app extrai `slug` de `{slug}.apfood.com.br` em runtime.
- **Fallback local**: em `localhost`, usa `?loja={slug}` para desenvolvimento.
- **Store lookup**: busca em `stores` com `where('slug', '==', slug)`.
- **Bloqueio de app quando não encontrar loja**: exibe "Loja não encontrada" e não inicializa carregamentos dependentes da loja.

## 2) Convivência entre Branding da loja e Preferência individual

### Camada institucional (loja)
Definida por gerente/admin em `stores/{storeId}.branding`:
- `logoUrl`, `logoPath`
- `colors.brandPrimary`, `colors.brandSecondary`, `colors.brandAccent`
- `updatedAt`, `updatedBy`

Essa camada controla elementos críticos de identidade:
- Header da loja
- Logo
- Botão principal de checkout

### Camada pessoal (usuário)
Definida em `users/{uid}.preferences`:
- `themeMode` (`light`/`dark`)
- `uiAccentColor` (opcional)
- `updatedAt`

Essa camada controla apenas aspectos pessoais de UI:
- modo claro/escuro
- cor de acento secundário para componentes não críticos

### Regra de precedência
1. `brandPrimary` da loja **sempre vence** em pontos críticos.
2. `uiAccentColor` do usuário aplica em itens de navegação auxiliar e detalhes visuais.
3. dark mode altera contraste/fundo, sem trocar identidade da marca.

## 3) Modelo de dados Firestore (mínimo)

### `stores/{storeId}`
```json
{
  "name": "AP Food Matriz",
  "slug": "matriz",
  "status": "active",
  "branding": {
    "logoUrl": "https://...",
    "logoPath": "stores/{storeId}/branding/logo_1710000000000.png",
    "colors": {
      "brandPrimary": "#E11D48",
      "brandSecondary": "#0F172A",
      "brandAccent": "#F59E0B"
    },
    "updatedAt": "<serverTimestamp>",
    "updatedBy": "uid_do_gerente"
  },
  "createdAt": "<serverTimestamp>",
  "updatedAt": "<serverTimestamp>"
}
```

### `users/{uid}`
```json
{
  "email": "gerente@apfood.com.br",
  "role": "MANAGER",
  "storeIds": ["storeA", "storeB"],
  "rolesByStore": {
    "storeA": "ADMIN",
    "storeB": "MANAGER"
  },
  "preferences": {
    "themeMode": "dark",
    "uiAccentColor": "#2563EB",
    "updatedAt": "<serverTimestamp>"
  }
}
```

## 4) Hosting / DNS / wildcard

- DNS wildcard Cloudflare: `*.apfood.com.br` em **DNS only** apontando para Firebase/App Hosting.
- App Hosting com domínio wildcard `*.apfood.com.br`.
- Frontend identifica tenant por `window.location.hostname`.
- Em SSR/backend, usar `X-Forwarded-Host` para host original.

## 5) Fluxo de upload e persistência de logo

1. Validar arquivo no client:
   - `image/png`, `image/jpeg`, `image/webp`
   - tamanho máximo `1MB`
2. Upload para Storage:
   - `stores/{storeId}/branding/logo_{timestamp}.{ext}`
3. Salvar metadados em Firestore:
   - `stores/{storeId}.branding`

## 6) Checklist de testes

### Multi-loja
- [ ] `matriz.apfood.com.br` resolve `slug=matriz`.
- [ ] `goiania.apfood.com.br` resolve `slug=goiania`.
- [ ] slug inválido retorna "Loja não encontrada".
- [ ] `localhost:3000?loja=matriz` funciona no dev.

### Branding
- [ ] Manager/Admin consegue subir logo válido até 1MB.
- [ ] Arquivo > 1MB é rejeitado no client.
- [ ] Tipos fora de png/jpg/webp são rejeitados.
- [ ] `stores/{id}.branding` é atualizado com `updatedAt`/`updatedBy`.
- [ ] fallback para logo padrão quando `logoUrl` não existir.

### Preferência de usuário
- [ ] Usuário altera `light/dark` e persiste em `users/{uid}.preferences`.
- [ ] Usuário altera `uiAccentColor` e persiste.
- [ ] Ao novo login, preferências são reaplicadas automaticamente.
- [ ] `uiAccentColor` não substitui botão crítico com `brandPrimary`.

### Segurança
- [ ] usuário comum não edita `stores/{storeId}.branding`.
- [ ] apenas manager/admin faz upload em `stores/{storeId}/branding/*`.
- [ ] usuário só escreve em `users/{uid}.preferences` do próprio uid.
- [ ] leitura de branding é pública para cardápio.

### Responsividade / mobile
- [ ] logo e botões mantêm contraste em tela pequena.
- [ ] dark mode mantém legibilidade no mobile.
- [ ] troca de tenant não quebra layout no PWA.
