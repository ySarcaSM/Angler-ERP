# Angler ERP

O **Angler ERP** é uma plataforma de gestão empresarial na nuvem. Nós operamos o software para que empresas possam centralizar sua rotina comercial, financeira e operacional em um único ambiente seguro, sem instalar programas ou manter infraestrutura própria.

Em vez de entregar um sistema para cada cliente configurar, o Angler ERP é o serviço: cuidamos da evolução da plataforma, disponibilidade, segurança e atualizações. O cliente acessa pelo navegador e trabalha com uma conta vinculada à sua empresa.

## Para quem é

O Angler ERP foi criado para empresas que precisam acompanhar a operação em um só lugar: cadastros, vendas, compras, estoque, financeiro, orçamentos e gestão de usuários.

Cada empresa possui seu próprio ambiente lógico e seus dados são separados dos dados das demais organizações.

## O que a plataforma oferece

### Gestão da operação

- **Dashboard:** visão geral da empresa com indicadores e gráficos.
- **Clientes:** cadastro, consulta, busca e manutenção da base de clientes.
- **Produtos:** catálogo, preços, categorias e acompanhamento de estoque.
- **Vendas:** registro e acompanhamento de vendas, com itens e reflexos no estoque.
- **Compras:** controle de compras e recebimentos.
- **Fornecedores:** cadastro e organização dos parceiros de compra.
- **Locais:** gerenciamento dos locais usados pela operação.
- **Estoque:** movimentações, alertas e visão consolidada do inventário.
- **Financeiro:** acompanhamento de receitas, despesas e informações financeiras.
- **Relatórios:** dados consolidados para análise da operação.
- **Orçamentos:** criação de orçamentos com perfis, grupos e fórmulas de cálculo.

### Gestão e controle

- Configurações da empresa em um ambiente centralizado.
- Gestão de usuários e permissões por função.
- Notificações para eventos relevantes da operação.
- Registro de atividades auditáveis.
- Painel administrativo interno para gestão global da plataforma.

### Angel Personal Assistant

A **Angel** é a assistente de IA do Angler ERP. Ela ajuda os usuários a entender e utilizar os recursos da plataforma, considerando o contexto disponível para consulta.

- Conversas organizadas por usuário e empresa.
- Criação, renomeação e exclusão de conversas.
- Limpeza de conversas sem mensagens.
- Respostas voltadas ao uso do Angler ERP e à consulta de dados permitidos.
- Chave de IA armazenada somente no navegador do usuário quando necessária.

## Como acessar

O Angler ERP é acessado diretamente pelo navegador. Não há instalação local.

| Caminho | Finalidade |
| --- | --- |
| `/` | Apresentação da plataforma. |
| `/login` | Entrada de usuários cadastrados. |
| `/register` | Criação de conta e empresa. |
| `/app` | Área principal autenticada. |
| `/assistant` | Angel Personal Assistant. |

Após o login, o menu da aplicação disponibiliza os módulos que fazem parte do plano e das permissões do usuário.

## Segurança e privacidade

- A autenticação é feita com contas de usuário.
- Os dados são segmentados por empresa.
- As permissões são definidas conforme o papel de cada usuário, como proprietário, administrador, gestor, operador ou visualizador.
- As ações relevantes podem ser registradas em logs de auditoria.
- A plataforma usa regras de acesso no banco de dados para complementar o controle feito pela interface.

## Tecnologias

O Angler ERP é desenvolvido como uma aplicação web moderna, com foco em rapidez e acessibilidade.

| Área | Tecnologias |
| --- | --- |
| Aplicação web | React, React Router e Vite. |
| Interface | Tailwind CSS, Lucide React e React Hot Toast. |
| Dados e acesso | Firebase Authentication, Cloud Firestore e Firebase Storage. |
| Visualização e documentos | Recharts e jsPDF. |
| Assistente | Integração com Gemini. |

## Arquitetura em alto nível

```text
Usuário no navegador
        │
        ▼
Angler ERP (aplicação web)
        │
        ├── Autenticação e permissões
        ├── Módulos de gestão empresarial
        ├── Angel Personal Assistant
        └── Relatórios e documentos
        │
        ▼
Infraestrutura gerenciada do Angler ERP
```

## Sobre este repositório

Este repositório contém o código-fonte e os recursos internos da plataforma Angler ERP. A operação, a infraestrutura e as atualizações são gerenciadas pela equipe do produto; o software não é distribuído para instalação ou hospedagem independente por clientes.

## Licença

Todos os direitos sobre o Angler ERP são reservados. O código não está licenciado para redistribuição, cópia, hospedagem independente ou uso comercial por terceiros sem autorização expressa.
