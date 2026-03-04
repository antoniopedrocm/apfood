# APFood Multi-loja RBAC + Impersonation (Firestore)

## Coleções

### `users`
```json
{
  "id": "uid",
  "name": "Maria",
  "email": "maria@apfood.com",
  "role": "admin | franqueador | gerente | atendente | cliente",
  "status": "active | inactive"
}
```

### `franchises`
```json
{
  "id": "franchise_1",
  "name": "Franquia Centro",
  "ownerUserId": "uid_franqueador"
}
```

### `stores`
```json
{
  "id": "store_1",
  "franchiseId": "franchise_1",
  "name": "Loja Campinas",
  "slug": "loja-campinas",
  "isActive": true
}
```

### `user_store_memberships`
```json
{
  "id": "membership_1",
  "userId": "uid_gerente",
  "storeId": "store_1",
  "storeRole": "gerente | atendente",
  "scopes": ["orders:read", "orders:update"]
}
```

### `user_franchise_memberships`
```json
{
  "id": "membership_2",
  "userId": "uid_franqueador",
  "franchiseId": "franchise_1",
  "franchiseRole": "franqueador"
}
```

### `audit_logs`
```json
{
  "id": "log_1",
  "timestamp": "2026-01-10T10:00:00.000Z",
  "actorId": "uid_admin_real",
  "subjectId": "uid_gerente_emulado",
  "action": "order.status.update",
  "resourceType": "order",
  "resourceId": "order_123",
  "storeId": "store_1",
  "franchiseId": "franchise_1",
  "ip": "177.x.x.x",
  "userAgent": "Mozilla/5.0",
  "metadata": {"newStatus": "preparando"}
}
```

## Regras de negócio
- Gerente pode ter N documentos em `user_store_memberships`.
- Atendente deve ter exatamente 1 documento em `user_store_memberships`.
- Franqueador deve ter `user_franchise_memberships` válidos para visualizar lojas do grupo.
- Admin vê tudo e pode emular qualquer usuário com token curto (10-30 min).
- Emulação não concede novos privilégios: backend usa permissões do `subject`, mantendo `actor` para auditoria.
