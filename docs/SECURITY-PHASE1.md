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

- CI: o package-lock.json foi regenerado, e o build final usa npm ci para garantir instalações reproduzíveis.

## Exclusão administrativa

- Configure `FIREBASE_SERVICE_ACCOUNT_JSON` **somente** na Vercel para a função `/api/admin/delete-user`.
- O endpoint exige método POST, token Firebase válido e **claim superadmin**.
- Apaga Auth com Admin SDK somente depois de limpar os dados Firestore; mantém auditoria de empresas externas.
- Faça backup prévio. A exclusão é irreversível, pode exceder tempo em tenants muito grandes e pode precisar de reprocessamento manual.
- Não executar em produção antes de validar a rota e limites de duração da função na Vercel.

- Regras de criação de usuário exigem exclusivamente a associação pessoal, sem privilégios pré-atribuídos em empresas externas. Administradores de empresa não podem conceder cargo `owner` nem modificar a flag `personal` de outros usuários.

## Validações automatizadas de Firestore

O workflow GitHub Actions inclui testes de acesso cruzado entre empresas, tentativa de upgrade de plano, escalonamento de privilégios, transições indevidas de vendas e proteção de lançamentos financeiros ligados a vendas. Esses testes usam o **Firestore Emulator** com dados fictícios.

## Validação do preview na Vercel

- A configuração Root Directory do projeto Vercel foi corrigida de `client` para a raiz do repositório em 2026-10-19.
- Um deployment de preview da branch foi compilado com status READY. Isto valida a compilação e a entrega dos artefatos, não a autenticação real nem a segurança da base de produção.
- Não foi realizado merge na main; a custom claim superadmin e a credencial de serviço continuam exigindo acesso administrativo ao Firebase.

## Resultado da validação ampliada — 19/10/2026

- **18 testes de Firebase Emulator aprovados**, abrangendo autenticação e consultas de 14 coleções, fluxos de venda, compra, orçamento, movimentação de estoque, verificação de tenant e bloqueio a terceiros.
- `npm ci` e `npm run build` aprovados no GitHub Actions.
- Vercel: `Root Directory` corrigido de `client` para a **raiz** do repositório. O preview do commit `a594b0f` ficou `READY` (sem promoção à produção).
- `firestore.rules` agora possui regras específicas de listagem para coleções de tenant. Em todas essas coleções, as consultas frontend devem incluir `where('companyId','==', activeCompanyId)` e o perfil precisa ter membership ativo.
- **Condição para merge:** executar migração de superadmin e testes de login e exclusão na instância de homologação do Firebase. O preview e os testes não simulam contas reais, dados legados, integração de pagamentos ou ambiente de produção.
- A Vercel possui configurações legadas `VITE_ADMIN_USER` e `VITE_ADMIN_PASSWORD`; **rotacione qualquer segredo reutilizado**, remova essas variáveis públicas e configure apenas a credencial de serviço em segredo de servidor, se e quando a função de exclusão for ativada. Não coloque credenciais no GitHub.
- O PR permanece separado da branch `main` para impedir que a troca do login administrativo quebre o acesso existente sem as claims provisionadas.

## Uso do Firebase original (producao) — inspecao sem alteracoes

Nao existe um ambiente de homologacao separado. O plugin Firebase esta instalado, mas suas operacoes administrativas nao estao disponiveis nesta conversa. A **aprovacao para usar a instancia original nao substitui uma credencial administrativa** e nao justifica publicar regras sem copia de seguranca.

Esta branch inclui `scripts/firebase-production-preflight.mjs`, que executa **somente leituras**: confirma o ID exato do projeto, faz backup local da versao das regras publicadas, verifica ate 500 perfis quanto a `memberships` e examina a claim superadmin quando SUPERADMIN_UID estiver disponivel. Os dados de usuarios nao sao exportados nem exibidos; somente contagens. O backup das regras deve permanecer fora do Git.

Em uma maquina confiavel, depois de instalar as dependencias, configure `EXPECTED_FIREBASE_PROJECT_ID` e uma credencial administrativa via `FIREBASE_SERVICE_ACCOUNT_JSON` ou `GOOGLE_APPLICATION_CREDENTIALS`. Opcionalmente configure `SUPERADMIN_UID`. Execute:

```sh
node scripts/firebase-production-preflight.mjs
```

Nenhuma credencial deve ser enviada no chat nem incluida no repositorio. Se o comando detectar membros legados sem `memberships`, corrigir a migracao de perfis antes de publicar as novas regras. Se houver mais de 500 perfis, o relatorio sera marcado como incompleto. A inspecao nao concede custom claims, nao publica regras, nao exclui dados nem substitui backup do banco.

**Ordem obrigatoria antes da alteracao de producao:** backup dos dados por meio apropriado e backup das regras ativas; reconciliar perfis e memberships; provisionar o superadmin com Admin SDK em maquina confiavel; testar login e acesso dos funcionarios com contas reais autorizadas; preparar janela curta de implantacao/rollback; publicar regras somente com os passos conferidos. O Firebase permite reativar um ruleset anterior com Admin SDK ou pelo console, mas rollback das regras nao recupera documentos excluidos ou modificados.
