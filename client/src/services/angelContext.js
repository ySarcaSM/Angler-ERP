import { listClients } from './firebase/clients';
import { listProducts } from './firebase/products';
import { listSales } from './firebase/sales';
import { getSummary } from './firebase/financial';

const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const number = (value) => Number(value || 0);

export async function loadAngelReadContext(company) {
  const [clientsResult, productsResult, salesResult, financial] = await Promise.all([
    listClients(company.id, { pageSize: 50 }),
    listProducts(company.id, { pageSize: 100 }),
    listSales(company.id, { pageSize: 30 }),
    getSummary(company.id),
  ]);

  const clients = clientsResult.data.map((client) => ({
    nome: compact(client.name),
    email: compact(client.email),
    telefone: compact(client.phone),
    status: client.active === false ? 'inativo' : 'ativo',
    totalCompras: number(client.totalPurchases),
  }));
  const products = productsResult.data.map((product) => ({
    nome: compact(product.name),
    sku: compact(product.sku),
    categoria: compact(product.category),
    preco: number(product.price),
    estoqueAtual: number(product.stock?.current),
    estoqueMinimo: number(product.stock?.minimum),
    status: product.active === false ? 'inativo' : 'ativo',
  }));
  const sales = salesResult.data.map((sale) => ({
    numero: sale.number,
    cliente: compact(sale.clientName),
    total: number(sale.total),
    status: compact(sale.status),
    pagamento: compact(sale.paymentStatus),
    itens: (sale.items || []).map((item) => `${compact(item.productName)} (${number(item.quantity)})`).join(', '),
  }));
  const lowStock = products.filter((product) => product.status === 'ativo' && product.estoqueAtual <= product.estoqueMinimo);

  return JSON.stringify({
    empresa: { nome: company.name, setor: company.sector, plano: company.plan || 'free' },
    resumo: {
      clientesCarregados: clients.length,
      produtosCarregados: products.length,
      vendasRecentesCarregadas: sales.length,
      produtosComEstoqueBaixo: lowStock.map((product) => product.nome),
      financeiroDoMes: financial?.month || {},
    },
    clientes: clients,
    produtos: products,
    vendasRecentes: sales,
  });
}

export function getReadOnlyListAnswer(message, readContext) {
  const question = String(message || '').toLocaleLowerCase('pt-BR');
  const isClientListRequest = question.includes('cliente') && /\b(meu|minha|listar|lista|mostra|mostrar|quais)\b/.test(question);
  if (!isClientListRequest) return null;

  const { clientes = [] } = JSON.parse(readContext);
  if (clientes.length === 0) return 'Não há clientes cadastrados no momento.';

  const entries = clientes.map((client, index) => {
    const details = [
      `**Status:** ${client.status}`,
      client.email && `**E-mail:** ${client.email}`,
      client.telefone && `**Telefone:** ${client.telefone}`,
    ].filter(Boolean);
    return `${index + 1}. **${client.nome || 'Cliente sem nome'}**\n   - ${details.join('\n   - ')}`;
  });

  return `Você possui atualmente **${clientes.length} cliente${clientes.length === 1 ? '' : 's'}** cadastrado${clientes.length === 1 ? '' : 's'}:\n\n${entries.join('\n\n')}`;
}
