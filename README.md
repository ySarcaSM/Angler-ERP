# Angler ERP

Aplicação web de gestão empresarial multiempresa, em português do Brasil. O projeto reúne cadastros comerciais, compras, vendas, estoque, financeiro, orçamentos, relatórios, auditoria e a assistente de IA Angel em uma interface React hospedável no Firebase.

> Este repositório contém uma aplicação em desenvolvimento. As instruções abaixo são destinadas a quem vai executar ou publicar o projeto em uma conta Firebase própria.

## Funcionalidades

- Autenticação por e-mail e senha, recuperação de senha e verificação de e-mail.
- Cadastro inicial de empresa e isolamento lógico dos dados por `companyId`.
- Clientes, produtos, fornecedores e localizações com busca e operações de cadastro, edição e exclusão.
- Vendas com itens, descontos, frete, impostos, numeração sequencial, aprovação, cancelamento e reversão de estoque ao excluir uma venda aprovada.
- Compras com recebimento, entrada automática no estoque e lançamento financeiro de despesa.
- Estoque com histórico de movimentações, alertas de baixo estoque e ajustes manuais.
- Financeiro com receitas, despesas, pendências e baixa de pagamentos; aprovar um orçamento cria uma receita pendente.
- Relatórios de desempenho com gráficos e exportação em PDF.
- Orçamentos, fórmulas e calculadora de medição/aproveitamento de material para perfis de embalagens.
- Notificações de estoque baixo, vendas pendentes, lançamentos financeiros pendentes e indisponibilidade temporária da Angel.
- Logs de auditoria para ações relevantes e gestão de usuários da empresa.
- Módulo de sistema para o proprietário ativar ou desativar os recursos disponíveis da empresa.
- O módulo **Módulos** permite carimbar a configuração; para carimbar ou remover o carimbo, o proprietário deve digitar `CARIMBAR`. Enquanto carimbada, a seleção de módulos fica bloqueada.
- Recursos de acessibilidade: escala de texto, espaçamento, fonte para dislexia, contraste, escala de cinza, inversão, guia de leitura e redução de movimento.
- Painel de superadmin para consultar, ativar, desativar e remover documentos de contas.
- Angel Personal Assistant: conversas por usuário/empresa, contexto de leitura do ERP e integração direta com Gemini pelo navegador.

## Tecnologias

## Usuários e convites

O owner encontra **Sistema > Usuários** para consultar a equipe, desativar contas que não sejam owner e gerar links de convite. Ao criar um convite, informe o e-mail do destinatário e o perfil de acesso (`admin`, `manager`, `operator` ou `viewer`).

O link é de uso único e só pode ser concluído com o e-mail convidado. A pessoa abre `/join/<id-do-convite>`, informa nome e senha, verifica o e-mail e então passa a acessar os dados da mesma empresa. Publique as regras atualizadas antes de usar esse fluxo:

```bash
firebase deploy --only firestore:rules
```

| Camada | Tecnologias |
| --- | --- |
| Front-end | React 18, React Router, Vite e Tailwind CSS |
| Componentes | Lucide React e React Hot Toast |
| Dados | Firebase Authentication, Cloud Firestore e Firebase Storage |
| Backend | Firebase Authentication, Cloud Firestore e Firebase Storage |
| Visualização e documentos | Recharts e jsPDF |
| IA | Gemini, chamada diretamente pelo navegador durante a sessão |

## Estrutura

```text
.
├── client/                 # Aplicação React/Vite
│   ├── src/pages/          # Telas e módulos do ERP
│   ├── src/services/       # Acesso ao Firebase e à Angel
│   ├── src/context/        # Contextos de autenticação
│   ├── src/utils/          # Formatação, alertas e acessibilidade
│   └── .env.example        # Modelo das variáveis públicas do front-end
├── firestore.rules         # Regras de acesso do Firestore
├── firestore.indexes.json  # Índices compostos do Firestore
└── firebase.json           # Configuração de deploy Firebase
```

## Pré-requisitos

- Node.js compatível com Vite 5.
- Uma conta e um projeto no [Firebase Console](https://console.firebase.google.com/).
- Firebase CLI para publicar regras e índices: `npm install -g firebase-tools`.

## Execução local

1. Instale as dependências de cada pacote:

   ```bash
   npm install
   npm --prefix client install
   ```

2. Copie `client/.env.example` para `client/.env` e preencha os dados do app Web registrados no Firebase:

   ```env
   VITE_FIREBASE_API_KEY=
   VITE_FIREBASE_AUTH_DOMAIN=
   VITE_FIREBASE_PROJECT_ID=
   VITE_FIREBASE_STORAGE_BUCKET=
   VITE_FIREBASE_MESSAGING_SENDER_ID=
   VITE_FIREBASE_APP_ID=

   # Opcional: acesso ao painel /admin
   VITE_ADMIN_USER=
   VITE_ADMIN_PASSWORD=
   ```

   Não versione o arquivo `.env` e substitua qualquer valor de exemplo antes de usar a aplicação. Variáveis iniciadas por `VITE_` são incorporadas ao bundle do navegador; não armazene nelas segredos de servidor.

3. No Firebase Console, habilite **Authentication > E-mail/senha** e crie o banco **Cloud Firestore**.

4. Inicie o front-end:

   ```bash
   npm run dev
   ```

   O Vite inicia em `http://localhost:3000`.

## Configuração da Angel

A chave da API Gemini é informada pelo usuário na tela da Angel. Ela é mantida apenas no `sessionStorage` do navegador durante a sessão autenticada e é removida ao sair da conta; portanto, deve ser informada novamente a cada login. A aplicação chama a API Gemini diretamente do navegador.

Quando a API Gemini retorna `503` (serviço temporariamente indisponível), a Angel mostra um aviso imediato e adiciona um alerta ao centro de notificações, atualizando o contador do sino. Esses alertas ficam armazenados localmente por empresa neste navegador, com os 20 mais recentes mantidos.

## Publicação no Firebase

Autentique-se, selecione o projeto Firebase desejado e publique regras e índices:

```bash
firebase login
firebase use <seu-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

Para gerar o pacote de produção do front-end:

```bash
npm run build
```

O resultado é criado em `client/dist/`. Este repositório não possui uma configuração de Firebase Hosting; publique esse diretório no provedor de hospedagem escolhido ou adicione a configuração de Hosting ao `firebase.json` antes de usar `firebase deploy --only hosting`.

## Segurança e dados

- As regras do Firestore verificam autenticação, associação à empresa e papéis `owner`/`admin` para as operações protegidas.
- Coleções operacionais carregam `companyId`; consultas e gravações são escopadas à empresa ativa.
- Conversas da Angel pertencem a um usuário e a uma empresa; suas mensagens ficam em uma subcoleção.
- O superadmin é identificado pelo e-mail `admin@angler-erp.local` nas regras. O painel administrativo depende também de `VITE_ADMIN_USER` e `VITE_ADMIN_PASSWORD` no front-end. Como essas variáveis são públicas no bundle, esse mecanismo não deve ser tratado como uma barreira de segurança suficiente para produção sem uma revisão de arquitetura.
- A remoção de uma conta pelo painel remove o documento do Firestore. A exclusão do usuário no Firebase Authentication exige uma implementação de backend com Admin SDK.

## Rotas principais

| Rota | Finalidade |
| --- | --- |
| `/` | Página institucional |
| `/login` e `/register` | Autenticação e criação da primeira empresa |
| `/app` | Dashboard autenticado |
| `/app/clients`, `/products`, `/sales`, `/purchases` | Gestão comercial e operacional |
| `/app/financial`, `/stock`, `/reports` | Financeiro, estoque e relatórios |
| `/app/budgets` | Orçamentos, fórmulas e medição |
| `/app/settings`, `/logs`, `/notifications` | Administração da empresa |
| `/assistant` | Angel Personal Assistant |
| `/admin/login` | Entrada do painel de superadmin |

## Verificação de produção

Antes de publicar, valide o build:

```bash
npm run build
```

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Vite dentro de `client/` |
| `npm run build` | Gera a build de produção em `client/dist/` |
| `npm run preview` | Serve localmente a build gerada |
| `npm run install:all` | Instala dependências da raiz e de `client/` |

## Licença

Nenhuma licença de código aberto está declarada neste repositório. Todos os direitos permanecem reservados até que uma licença seja adicionada pelos mantenedores.
