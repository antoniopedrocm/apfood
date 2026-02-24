# AUTH_DOMAIN_TROUBLESHOOTING

## Diagnóstico rápido: por que ocorre o erro

Os erros `auth/requests-from-referer-...-are-blocked`, `The current domain is not authorized for OAuth operations` e `identitytoolkit.googleapis.com 403` acontecem quando **o domínio da aplicação não está autorizado no Firebase Authentication** ou quando a aplicação usa **API key/projeto incorreto**.

---

## Checklist obrigatório no Firebase Console (passo a passo)

1. Abra o projeto **apfood-e9627** no Firebase Console.
2. Vá em **Authentication → Settings → Authorized domains**.
3. Adicione explicitamente:
   - `apfood.com.br`
   - `www.apfood.com.br` (se existir tráfego)
   - domínios de staging usados de fato (ex.: `staging.apfood.com.br`).
4. Em **Authentication → Sign-in method**, confirme que o provedor **Google** está habilitado.
5. Em **Project settings → General → Your apps → Web app**, valide que o `authDomain` em produção é o mesmo esperado no frontend (normalmente `apfood-e9627.firebaseapp.com`).
6. Valide o `.env` da aplicação em produção:
   - `REACT_APP_FIREBASE_PROJECT_ID=apfood-e9627`
   - `REACT_APP_FIREBASE_API_KEY` da Web App do mesmo projeto.
7. Verifique se a chave API não está bloqueada por HTTP referrer incompatível no Google Cloud Console.

> Importante: não usar wildcard em Authorized domains (por exemplo `*.apfood.com.br`) porque o Firebase Authentication não suporta esse padrão.

---

## Multi-tenant com subdomínio (`{slug}.apfood.com.br`)

### Limitação
Sem wildcard, cada subdomínio exigiria autorização manual no Firebase Auth.

### Opção A (recomendada): login centralizado
- Usuário inicia em `https://{slug}.apfood.com.br`.
- Frontend salva `returnUrl` + `slug` e redireciona para `https://apfood.com.br/admin` (ou `https://auth.apfood.com.br`).
- Login ocorre no domínio central autorizado.
- Após autenticar, frontend redireciona de volta para `returnUrl` original.

**Prós**
- Escalável para muitos tenants.
- Menos manutenção de domínios autorizados.

**Contras**
- Um redirecionamento adicional no fluxo.

### Opção B: autorizar subdomínios manualmente
Adicionar cada subdomínio utilizado em `Authorized domains`.

**Prós**
- UX direta no próprio tenant.

**Contras**
- Operação manual contínua e pouco escalável.

---

## Como validar depois da correção

1. Abrir DevTools e tentar login com email/senha em `https://apfood.com.br/admin`.
2. Confirmar ausência de 403 em `identitytoolkit.googleapis.com`.
3. Testar login com Google (popup):
   - popup deve autenticar,
   - se bloqueado, deve cair para redirect.
4. Testar acesso via tenant `https://loja.apfood.com.br`:
   - app deve encaminhar para login central,
   - após login, voltar para a URL de origem.

