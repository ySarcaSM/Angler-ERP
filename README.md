# Angler ERP

Angler ERP é uma aplicação web de gestão empresarial **multiempresa**, em português do Brasil, construída com React e Firebase. O sistema reúne gestão comercial, compras, vendas, estoque, financeiro, orçamentos, relatórios, auditoria e a assistente de IA **Angel** em uma única aplicação.

O projeto é **open source** e pode ser executado em uma infraestrutura Firebase própria. A aplicação também apresenta planos comerciais na landing page para recursos adicionais.

## Planos

Os planos atualmente apresentados pelo Angler são:

| Plano | Preço | Recursos |
| --- | ---: | --- |
| **TestFREE** | **R$ 0 — para sempre** | Acesso completo ao conteúdo disponível, todos os módulos do ERP, painel de administração de contas e suporte da comunidade |
| **AnglerPro** | **R$ 59,99/mês** | Tudo do TestFREE, relatórios semanais, IA por áudio, relatórios customizáveis, mais distribuidoras de IA e cálculos para reduzir o consumo de tokens |
| **AnglerUltra** | **R$ 99,99/mês** | Tudo do AnglerPro, configurações de UI, IA controladora de sistema, importação/exportação de dados e relatórios gerais em PDF |

> Os nomes, preços e recursos acima refletem a oferta atualmente apresentada em `client/src/pages/Landing.jsx`.

O código do projeto continua disponível como open source. O uso do plano TestFREE não significa que serviços de terceiros, como Firebase ou APIs externas de IA, sejam necessariamente ilimitados ou sem custos em qualquer infraestrutura.

## Funcionalidades

### Gestão empresarial

- Cadastro e gerenciamento de clientes, produtos, fornecedores e localizações.
- Vendas com itens, descontos, frete, impostos, numeração sequencial, aprovação, cancelamento e controle de estoque.
- Compras com recebimento, entrada automática no estoque e lançamento financeiro de despesas.
- Estoque com histórico de movimentações, alertas de baixo estoque e ajustes manuais.
- Financeiro com receitas, despesas, pendências e baixa de pagamentos.
- Orçamentos, fórmulas e calculadora de medição/aproveitamento de materiais.
- Relatórios de desempenho com gráficos e exportação em PDF.
- Sistema de módulos para ativar ou desativar recursos disponíveis para a empresa.

### Multiempresa

Uma mesma conta de usuário pode participar de várias empresas.

Cada usuário possui uma empresa pessoal, identificada por `personalCompanyId`, e pode possuir memberships adicionais em outras empresas. A empresa ativa é controlada por `companyId`.

A troca de empresa altera somente o contexto ativo do usuário; a empresa pessoal e suas informações de propriedade permanecem preservadas.

O fluxo de acesso entre empresas permite:

1. Um usuário solicitar acesso a outra empresa.
2. O proprietário ou administrador da empresa analisar a solicitação.
3. O acesso ser aprovado com um cargo específico.
4. O usuário passar a ter a nova empresa disponível em seu contexto, sem transferir a propriedade da empresa.

A aprovação de acesso não altera o `ownerUid` da empresa de destino.

### Usuários e permissões

O sistema trabalha com cinco papéis principais:

- **Owner** — proprietário da empresa e responsável pelas configurações mais sensíveis.
- **Admin** — administração da empresa e gerenciamento de usuários.
- **Manager** — operações com permissões de gestão conforme os recursos habilitados.
- **Operator** — pode criar e editar dados nos módulos disponíveis para a empresa, mas não possui exclusão direta de dados.
- **Viewer** — perfil predominantemente somente leitura.

O acesso aos módulos também pode ser configurado individualmente por usuário.

O **grupo do Operator não limita mais os módulos disponíveis**: operadores podem trabalhar nos módulos habilitados da empresa, independentemente do grupo configurado para eles.

Áreas administrativas continuam protegidas conforme o papel do usuário.

### Viewer

O Viewer foi projetado para consulta:

- Não pode criar, editar ou excluir dados operacionais.
- Não possui acesso ao módulo de Medição.
- Pode utilizar Fórmulas para realizar cálculos.
- Pode receber e consultar notificações.
- Não possui ações de exclusão nas tabelas.

### Acessibilidade

As preferências de acessibilidade são individuais por usuário, e não globais por empresa.

Entre as opções disponíveis estão:

- escala de texto;
- espaçamento;
- fonte para dislexia;
- contraste;
- escala de cinza;
- inversão de cores;
- guia de leitura;
- redução de movimento.

Ao trocar de empresa, as preferências de acessibilidade do usuário permanecem as mesmas.

### Notificações

O sistema possui notificações para eventos como:

- estoque baixo;
- vendas pendentes;
- lançamentos financeiros pendentes;
- indisponibilidade temporária da Angel.

As notificações não são exibidas para usuários com papel **Operator**.

### Auditoria e segurança

- Logs de auditoria registram ações relevantes do sistema.
- As regras do Firestore verificam autenticação, empresa ativa e papel do usuário.
- Os dados operacionais são associados a `companyId`.
- Acesso a dados entre empresas é restringido pelas regras do Firestore.
- O gerenciamento de usuários é reservado aos papéis administrativos adequados.
- A troca de empresa valida o membership do usuário antes de alterar o contexto.
- Acessibilidade é armazenada por usuário.

## Angel Personal Assistant

A **Angel** é a assistente de IA integrada ao ERP.

Ela pode trabalhar com o contexto dos dados disponíveis para o usuário e da empresa ativa. A chave da API Gemini é informada pelo próprio usuário e permanece somente no `sessionStorage` do navegador durante a sessão autenticada.

A aplicação chama a API Gemini diretamente do navegador.

Quando a API Gemini retorna erro de indisponibilidade temporária (`503`), a Angel informa o usuário e registra um alerta local no centro de notificações.

## Tecnologias

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
│   ├── src/components/     # Componentes reutilizáveis
│   ├── src/services/       # Acesso ao Firebase e à Angel
│   ├── src/context/        # Contextos de autenticação e aplicação
│   ├── src/utils/          # Utilitários, formatação e acessibilidade
│   └── .env.example        # Modelo das variáveis públicas do front-end
├── firestore.rules         # Regras de acesso do Firestore
├── firestore.indexes.json  # Índices compostos do Firestore
└── firebase.json           # Configuração de deploy Firebase
```

## Pré-requisitos

- Node.js compatível com Vite 5.
- Uma conta e um projeto no [Firebase Console](https://console.firebase.google.com/).
- Firebase CLI para publicar regras e índices:

```bash
npm install -g firebase-tools
```

## Execução local

1. Instale as dependências:

```bash
npm install
npm --prefix client install
```

Ou, quando suportado pelo projeto:

```bash
npm run install:all
```

2. Copie `client/.env.example` para `client/.env` e preencha os dados do aplicativo Web registrado no Firebase:

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

Não versione o arquivo `.env`. Variáveis iniciadas por `VITE_` são incorporadas ao bundle do navegador e, portanto, não devem ser usadas para armazenar segredos de servidor.

3. No Firebase Console:

- habilite **Authentication > E-mail/senha**;
- crie o banco **Cloud Firestore**;
- configure o projeto Firebase utilizado pela aplicação.

4. Inicie o front-end:

```bash
npm run dev
```

O Vite inicia em `http://localhost:3000`.

## Usuários e convites

O proprietário encontra **Sistema > Usuários** para consultar a equipe, gerenciar acessos e gerar links de convite.

Os perfis disponíveis para convite incluem:

- `admin`
- `manager`
- `operator`
- `viewer`

O convite é vinculado ao e-mail informado pelo administrador. O fluxo de entrada utiliza uma rota específica de convite e mantém a empresa de origem do convite como contexto de acesso.

Ao alterar as regras do Firestore, publique-as antes de testar o fluxo:

```bash
firebase deploy --only firestore:rules
```

## Módulos

Os módulos principais disponíveis na aplicação incluem:

- Clientes
- Produtos
- Vendas
- Compras
- Fornecedores
- Localizações
- Financeiro
- Estoque
- Relatórios
- Assistente de IA
- Medição
- Fórmulas
- Orçamentos

A empresa pode habilitar ou desabilitar módulos globalmente. Além disso, usuários podem receber configurações individuais de módulos conforme suas permissões administrativas.

O recurso de configuração de módulos possui mecanismo de confirmação por carimbo: para carimbar ou remover o carimbo, o proprietário deve digitar `CARIMBAR`. Enquanto a configuração estiver carimbada, a seleção dos módulos fica bloqueada.

## Publicação no Firebase

Autentique-se, selecione o projeto Firebase desejado e publique regras e índices:

```bash
firebase login
firebase use <seu-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

Para gerar o pacote de produção:

```bash
npm run build
```

O resultado é criado em `client/dist/`.

O repositório não possui uma configuração completa de Firebase Hosting. O diretório gerado pode ser publicado no provedor de hospedagem escolhido ou o Hosting pode ser configurado no `firebase.json` antes de utilizar:

```bash
firebase deploy --only hosting
```

## Segurança e dados

- As regras do Firestore verificam autenticação, associação à empresa e papéis para operações protegidas.
- Coleções operacionais carregam `companyId`; consultas e gravações são escopadas à empresa.
- Memberships determinam o acesso de cada usuário às empresas.
- O proprietário primário da empresa é definido por `ownerUid`.
- Aprovações de acesso multiempresa não transferem a propriedade da empresa.
- A exclusão direta de dados permanece restrita aos papéis autorizados; o Operator não possui permissão de exclusão direta.
- Conversas da Angel pertencem a um usuário e a uma empresa.
- O superadmin utiliza uma sessão administrativa separada da autenticação normal do ERP.

### Painel de superadmin

O painel administrativo possui uma autenticação própria e utiliza as variáveis:

```env
VITE_ADMIN_USER=
VITE_ADMIN_PASSWORD=
```

Como variáveis `VITE_` são públicas no bundle do navegador, esse mecanismo não deve ser tratado como uma barreira de segurança suficiente para produção. Uma arquitetura com backend/Admin SDK deve ser considerada para operações administrativas de maior criticidade.

A remoção de uma conta pelo painel remove os documentos correspondentes do Firestore. A exclusão de um usuário de outro usuário no Firebase Authentication exige backend com Admin SDK.

## Rotas principais

| Rota | Finalidade |
| --- | --- |
| `/` | Landing page institucional e planos |
| `/login` e `/register` | Autenticação e criação de conta |
| `/app` | Dashboard autenticado |
| `/app/clients`, `/products`, `/sales`, `/purchases` | Gestão comercial e operacional |
| `/app/financial`, `/stock`, `/reports` | Financeiro, estoque e relatórios |
| `/app/budgets` | Orçamentos, fórmulas e medição |
| `/app/settings` | Configurações da empresa |
| `/app/users` | Gestão de usuários |
| `/app/logs` | Auditoria |
| `/app/notifications` | Centro de notificações |
| `/assistant` | Angel Personal Assistant |
| `/admin/login` | Entrada do painel de superadmin |

## Verificação

Antes de publicar alterações, valide a build:

```bash
npm run build
```

Para desenvolvimento:

```bash
npm run dev
```

Para visualizar a build de produção localmente:

```bash
npm run preview
```

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o Vite |
| `npm run build` | Gera a build de produção em `client/dist/` |
| `npm run preview` | Serve localmente a build gerada |
| `npm run install:all` | Instala dependências da raiz e de `client/` |

## Licença

O projeto é apresentado como **open source sob a MIT License** na landing page do Angler.

Consulte a documentação e os arquivos de licença do repositório antes de redistribuir o projeto caso uma versão formal do arquivo `LICENSE` seja adicionada posteriormente.
