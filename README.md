# 🚀 Angler ERP

Sistema de gestão empresarial completo, construído com **React + Firebase**.

## Stack

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Lucide Icons |
| **Backend** | Firebase (Firestore, Firebase Auth, Storage) |
| **Deploy** | Firebase Hosting / Vercel / Netlify |

## Módulos

- 📊 **Dashboard** — KPIs, gráficos de vendas, top produtos
- 👥 **Clientes** — CRM com busca, endereço, status
- 📦 **Produtos** — Cadastro, preços, estoque, categorias
- 🛒 **Vendas** — Pedidos/orçamentos com aprovação automática de estoque
- 🚚 **Compras** — Pedidos com recebimento automático
- 🏭 **Fornecedores** — Cadastro completo
- 💰 **Financeiro** — Contas a pagar/receber, fluxo de caixa
- 📦 **Estoque** — Movimentações, alertas, ajustes manuais
- 📈 **Relatórios** — Vendas, lucro, margem
- ⚙️ **Configurações** — Empresa, usuários, log de auditoria
- 🔐 **Painel Admin** — Gerenciamento master de todas as contas (acesso exclusivo)

## Painel Administrativo

O Angler ERP possui um painel administrativo com acesso exclusivo via credenciais master.

### Configuração

1. Copie `.env.example` para `.env` dentro de `client/`
2. As variáveis `VITE_ADMIN_USER` e `VITE_ADMIN_PASSWORD` já vêm pré-configuradas
3. A conta Firebase Auth (`admin@angler-erp.local`) é criada automaticamente no primeiro login
4. As regras do Firestore (`firestore.rules`) concedem acesso total ao superadmin

### Acesso

- URL: `/admin/login`
- Usuário: `admin`
- Senha: definida em `VITE_ADMIN_PASSWORD` (20 caracteres)

### Funcionalidades

- Visualiza **todas as contas** de **todas as empresas**
- Busca por nome, e-mail ou empresa
- Filtros por cargo, status e empresa
- Desativar/reativar contas
- Excluir contas permanentemente (Firestore + Auth)
- Visualizar detalhes de cada conta

## Início Rápido

### 1. Criar projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative o **Firestore Database** (modo teste)
4. Ative o **Authentication** (Email/Senha)
5. Nas configurações do projeto, copie as credenciais web

### 2. Configurar o projeto

```bash
# Clonar e instalar
cd angler-erp
npm run install:all

# Configurar Firebase
cp client/.env.example client/.env
# Edite client/.env com suas credenciais do Firebase
```

### 3. Configurar Firestore

No Firebase Console, vá em **Firestore Database → Regras** e cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: user is authenticated
    function isAuth() {
      return request.auth != null;
    }

    // Helper: get user data
    function getUser() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    // Helper: user belongs to company
    function isMember(companyId) {
      return isAuth() && getUser().companyId == companyId;
    }

    // Companies
    match /companies/{companyId} {
      allow read: if isMember(companyId);
      allow write: if isAuth() && request.auth.uid == companyId;
    }

    // Users
    match /users/{userId} {
      allow read: if isAuth() && getUser().companyId == get(/databases/$(database)/documents/users/$(userId)).data.companyId;
      allow create: if isAuth() && request.auth.uid == userId;
      allow update: if isAuth() && (request.auth.uid == userId || getUser().role in ['owner', 'admin']);
    }

    // Generic company-scoped collections
    match /{collection}/{docId} {
      allow read, write: if isAuth() && isMember(resource.data.companyId);
      allow create: if isAuth() && isMember(request.resource.data.companyId);
    }

    // Counters
    match /counters/{companyId} {
      allow read, write: if isMember(companyId);
    }
  }
}
```

### 4. Rodar

```bash
npm run dev
# http://localhost:3000
```

### 5. Build

```bash
npm run build
```

O deploy deve ser feito pelo provedor de hospedagem escolhido. As regras em
`firestore.rules` podem ser copiadas manualmente em **Firestore Database → Rules**.

## Estrutura

```
angler-erp/
├── client/
│   ├── src/
│   │   ├── config/
│   │   │   └── firebase.js          # Firebase SDK init
│   │   ├── services/firebase/
│   │   │   ├── auth.js              # Firebase Auth (login, register, reset)
│   │   │   ├── firestore.js         # CRUD genérico Firestore
│   │   │   ├── clients.js           # Clientes
│   │   │   ├── products.js          # Produtos
│   │   │   ├── sales.js             # Vendas (com batch writes)
│   │   │   ├── purchases.js         # Compras
│   │   │   ├── suppliers.js         # Fornecedores
│   │   │   ├── financial.js         # Financeiro
│   │   │   ├── stock.js             # Estoque
│   │   │   ├── admin.js             # Superadmin (login master, CRUD contas)
│   │   │   ├── settings.js          # Config, usuários, audit log
│   │   │   └── index.js             # Export central
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # Auth state com Firebase
│   │   │   └── AdminAuthContext.jsx  # Auth state do superadmin
│   │   ├── components/              # UI components
│   │   ├── pages/
│   │   │   ├── admin/               # Painel administrativo master
│   │   │   └── ...                  # Páginas por módulo
│   │   └── utils/                   # Formatação
│   └── .env.example
├── package.json
└── README.md
```

## Firestore Collections

| Collection | Descrição |
|------------|-----------|
| `companies` | Dados da empresa (ID = owner UID) |
| `users` | Usuários com role e companyId |
| `clients` | Clientes da empresa |
| `products` | Produtos com estoque |
| `sales` | Vendas com itens |
| `purchases` | Compras com itens |
| `suppliers` | Fornecedores |
| `financialTransactions` | Receitas e despesas |
| `stockMovements` | Movimentações de estoque |
| `auditLogs` | Log de atividades |
| `counters` | Contadores (nº venda, compra) |

## Segurança

- ✅ Autenticação Firebase Auth (email/senha)
- ✅ Regras Firestore por companyId
- ✅ RBAC no cliente (owner, admin, manager, operator, viewer)
- ✅ Audit log de todas as ações
- ✅ Validação client-side + server-side rules
- ✅ Painel superadmin com acesso total (credenciais master)

## Licença

MIT
