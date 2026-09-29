export const PROFILE_GROUPS = [
  {
    slug: 'mochilas',
    name: 'Mochilas',
    description: 'Perfis para mochilas e bolsas estruturadas.',
    items: [
      { slug: 'mochila', name: 'Mochila', kind: 'backpack', notes: 'Escolha entre alça ou cordão e informe as medidas do acessório.' },
    ],
  },
  {
    slug: 'sacolas-ecologicas',
    name: 'Sacolas ecológicas',
    description: 'Perfis em tecido ecológico 100% algodão.',
    items: [
      { slug: 'sacola-carteira-tecido-ecologico', name: 'Sacola e Carteira em Tecido ecológico 100% algodão', kind: 'bag', notes: 'Considere a carteira dobrável e a alça de transporte.' },
      { slug: 'sacola-tecido-ecologico', name: 'Sacola em tecido ecológico 100% algodão', kind: 'bag', notes: 'Considere tipo, largura e comprimento da alça.' },
    ],
  },
  {
    slug: 'sacolas-retornaveis',
    name: 'Sacolas retornáveis',
    description: 'Perfis de sacolas em TNT para reutilização.',
    items: [
      { slug: 'sacola-tnt-alca', name: 'Sacola em TNT com alça', kind: 'bag', notes: 'Considere duas alças e reforço na boca.' },
      { slug: 'sacola-tnt-alca-sanfona', name: 'Sacola em TNT com alça e sanfona lateral', kind: 'bag', notes: 'A sanfona lateral aumenta a área de material por unidade.' },
      { slug: 'sacola-tnt', name: 'Sacola em TNT', kind: 'bag', notes: 'Considere duas faces e acabamento superior.' },
      { slug: 'sacola-tnt-alca-vazada', name: 'Sacola em TNT modelo alça vazada', kind: 'bag', notes: 'Considere a área vazada no cálculo de material útil.' },
      { slug: 'sacola-tnt-alca-vazada-cetim', name: 'Sacola em TNT modelo alça vazada com fita de cetim', kind: 'bag', notes: 'Considere fita de cetim para acabamento da alça.' },
    ],
  },
  {
    slug: 'sacolas-papel',
    name: 'Sacolas de papel',
    description: 'Perfis para papel Duplex, Kraft e Offset.',
    items: [
      { slug: 'sacola-papel-duplex', name: 'Sacola de Papel Duplex', kind: 'paper', notes: 'Considere gramatura, dobra, cola e tipo de cordão.' },
      { slug: 'sacola-papel-kraft', name: 'Sacola de Papel Kraft', kind: 'paper', notes: 'Considere gramatura, dobra, cola e tipo de cordão.' },
      { slug: 'sacola-papel-offset', name: 'Sacola de Papel Offset', kind: 'paper', notes: 'Considere gramatura, dobra, cola e tipo de cordão.' },
    ],
  },
  {
    slug: 'sacolas-plasticas',
    name: 'Sacolas plásticas',
    description: 'Perfis para diferentes modelos de alça plástica.',
    items: [
      { slug: 'sacola-plastica-alca-cadeado', name: 'Sacola plástica modelo alça cadeado', kind: 'plastic', notes: 'Considere solda, espessura do filme e área da alça.' },
      { slug: 'sacola-plastica-alca-camiseta', name: 'Sacola plástica modelo alça camiseta', kind: 'plastic', notes: 'Considere recorte das alças e espessura do filme.' },
      { slug: 'sacola-plastica-alca-fita', name: 'Sacola plástica modelo alça fita', kind: 'plastic', notes: 'Considere comprimento da fita por alça.' },
      { slug: 'sacola-plastica-alca-vazada', name: 'Sacola plástica modelo alça vazada', kind: 'plastic', notes: 'Considere a área removida no recorte da alça.' },
    ],
  },
  {
    slug: 'etc',
    name: 'ETC',
    description: 'Outros perfis de embalagens.',
    items: [
      { slug: 'saco-tnt-dois-cordoes-nylon', name: 'Saco em TNT com 2 cordões em nylon', kind: 'drawstring', notes: 'Considere dois cordões, canaleta e acabamento inferior.' },
      { slug: 'sacola-tnt-laminado', name: 'Sacola em TNT laminado 40x30', kind: 'bag', notes: 'Largura e altura sugeridas: 40 x 30 cm. Ajuste conforme o produto.' },
    ],
  },
];

export function findProfileGroup(slug) {
  return PROFILE_GROUPS.find((group) => group.slug === slug);
}
