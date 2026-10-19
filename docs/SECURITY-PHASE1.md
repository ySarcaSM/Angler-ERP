# Fase 1 — migração de segurança (2026-10-19)

**Esta branch é de revisão. Não publique as regras no Firebase antes de validá-las no Emulator Suite com os fluxos reais.**
O arquivo `firestore.rules` é uma baseline restritiva; ele não migra as regras da sua instância automaticamente.

## Administrador mestre

1. **Revogue imediatamente** a senha que estava no `.env.example` e qualquer `VITE_ADMIN_PASSWORD` em Vercel/ambientes. Variáveis `VITE_*` são públicas no bundle do Vite.
2. Crie ou identifique uma conta de e-mail/senha no Firebase Authentication, **com e-mail real e senha exclusiva**, para o superadministrador.
3. Em máquina confiável, configure **somente em ambiente servidor** `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON completo) e `SUPERADMIN_UID` (UID exato do usuário). Nunca salve as credenciais no Git.
4. Execute `node scripts/bootstrap-superadmin.mjs` com essas variáveis. O script concede a custom claim `superadmin: true` e revoga refresh tokens antigos.
5. Faça login novamente em `/admin/login`, usando o e-mail completo. O frontend nunca compara senhas com `import.meta.env`.
6. Revogue claims antigas e troque as senhas de quaisquer contas administrativas antigas não utilizadas.
7. O Admin SDK em scripts e rotinas de backend **ignora Firestore Security Rules**; proteja separadamente as credenciais e os endpoints privilegiados.

## Regras e tenant

- Antes de implantar, teste com Firebase Emulator Suite: cadastro gratuito, login, seleção entre empresas, convite/aprovação, remoção de membro, operações de cliente/produto, vendas, compras, orçamentos, estoque, logs, assistente, relatórios, painel do administrador e contatos.
- Teste usuários de empresas diferentes e operador/visualizador: nenhuma leitura ou escrita cruzada deve funcionar.
- As regras não permitem que o cliente altere o campo `plan` da empresa; migrações de planos devem usar backend autenticado (Firebase Admin SDK) com validação de pagamento.
- Os módulos ainda executam várias gravações diretamente do navegador. Regras de tenant **não substituem** um backend para validar todos os invariantes contábeis. Para dinheiro real, migre essas mutações para serviços privilegiados.
- O próprio Firebase não permite que regras executem filtros em dados retornados. Consultas cliente devem filtrar por `companyId`.
- Inclua índices exigidos pelas consultas conforme o console indicar, antes de ativar a regra restritiva.

## Migração e rollback

- Faça backup/exportação do Firestore e registre a versão atual das regras publicadas.
- Valide as regras no emulador antes de `firebase deploy --only firestore`.
- Publique em ambiente de homologação primeiro. Não copie uma regra global `allow read, write: if true`.
- Se ocorrer `permission-denied`, investigue a consulta e a regra correspondente; não relaxe permissões globais para contornar o erro.
- A ativação da claim do superadmin e publicação das regras exigem acesso administrativo ao Firebase: **não são executadas por este commit**.

## Integridade de dados

- Numeração, aprovação e recepção são transacionais; as novas transações usam IDs previsíveis por venda/compra/orçamento.
- Vendas aprovadas, compras recebidas e orçamentos aprovados são bloqueados para exclusão até haver fluxo de estorno auditável.
- Registros legados podem requerer reconciliação de contadores e lançamentos financeiros.
- Não publicamos índices vazios (isso apagaria índices anteriores da instância).

- CI: o lockfile existente está incompleto para `npm ci`; o build de revisão usa `npm install`, como a Vercel atual. Sincronizar o lockfile em uma etapa posterior.

## Exclusão administrativa

- Configure `FIREBASE_SERVICE_ACCOUNT_JSON` **somente** na Vercel para a função `/api/admin/delete-user`.
- O endpoint exige método POST, token Firebase válido e **claim superadmin**.
- Apaga Auth com Admin SDK somente depois de limpar os dados Firestore; mantém auditoria de empresas externas.
- Faça backup prévio. A exclusão é irreversível, pode exceder tempo em tenants muito grandes e pode precisar de reprocessamento manual.
- Não executar em produção antes de validar a rota e limites de duração da função na Vercel.
