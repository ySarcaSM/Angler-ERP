import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../services/firebase/suppliers';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatPhone, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

const EMPTY = { name: '', document: '', email: '', phone: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '', contractTerm: '', notes: '', active: true };

function formatCNPJ(value) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCEP(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function isValidCNPJ(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const digit = (length, weights) => {
    const sum = digits.slice(0, length).split('').reduce((total, number, index) => total + Number(number) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12])
    && digit(13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13]);
}

export default function SupplierList() {
  const { company, user, userData } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try { const res = await listSuppliers(company.id, { pageSize: 200, searchTerm: search }); setData(res.data); }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setLoading(false); }
  }, [company, search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s }); setEditing(s.id); setModal(true); };

  const lookupCEP = async (value) => {
    const cep = value.replace(/\D/g, '');
    setForm((current) => ({ ...current, cep: formatCEP(value) }));
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado.');
      setForm((current) => ({ ...current, cep: formatCEP(cep), street: address.logradouro || '', neighborhood: address.bairro || '', city: address.localidade || '', state: address.uf || '' }));
    } catch (error) { if (error.code === 'deletion-request-created') { toast.success(error.message || 'Não foi possível consultar o CEP.'); } else { toast.error(error.message || 'Não foi possível consultar o CEP.'); } }
    finally { setCepLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error('Informe o nome do fornecedor.');
    if (!isValidCNPJ(form.document)) return toast.error('Informe um CNPJ válido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Informe um e-mail válido.');
    if (form.phone.replace(/\D/g, '').length < 10) return toast.error('Informe um telefone válido.');
    if (!form.contractTerm || Number(form.contractTerm) < 1) return toast.error('Informe o prazo de contrato.');
    setSaving(true);
    try {
      if (editing) { const previousSupplier = data.find((supplier) => supplier.id === editing); await updateSupplier(editing, form); await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Fornecedor', entityId: editing, description: `${userData?.name || 'Usuário'} alterou o fornecedor ${form.name}.`, details: { antes: { name: previousSupplier?.name, email: previousSupplier?.email, phone: previousSupplier?.phone }, depois: { name: form.name, email: form.email, phone: form.phone } } }); toast.success('Atualizado!'); }
      else { const createdSupplier = await createSupplier(company.id, form); await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Fornecedor', entityId: createdSupplier.id, description: `${userData?.name || 'Usuário'} criou o fornecedor ${form.name}.`, details: { name: form.name, email: form.email } }); toast.success('Criado!'); }
      setModal(false); load();
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Remover ${s.name}?`)) return;
    try { await deleteSupplier(s.id); await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Fornecedor', entityId: s.id, description: `${userData?.name || 'Usuário'} excluiu o fornecedor ${s.name}.`, details: { name: s.name } }); toast.success('Removido.'); load(); }
    catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
  };

  const columns = [
    { key: 'name', label: 'Fornecedor', render: (v, row) => <div><div className="font-medium text-dark-100">{v}</div>{row.contact && <div className="text-xs text-dark-500">{row.contact}</div>}</div> },
    { key: 'document', label: 'CNPJ', render: (v) => <span className="text-dark-400 text-xs">{v || '—'}</span> },
    { key: 'phone', label: 'Telefone', render: (v) => <span className="text-dark-400 text-xs">{formatPhone(v)}</span> },
    { key: 'email', label: 'Email', render: (v) => <span className="text-dark-400 text-xs">{v || '—'}</span> },
    { key: 'active', label: 'Status', render: (v) => <span className={v ? 'badge-success' : 'badge-danger'}>{v ? 'Ativo' : 'Inativo'}</span> },
    { key: '_actions', label: '', width: '80px', render: (_, row) => <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-ghost btn-sm"><Edit2 size={14} /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Fornecedores" subtitle={`${data.length} fornecedores`} action={<button onClick={openNew} className="btn-primary"><Plus size={18} /> Novo Fornecedor</button>} />
      <div className="card">
        <div className="card-header"><div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 max-w-sm"><Search size={16} className="text-dark-500" /><input type="text" placeholder="Buscar..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg" backdropClassName="bg-transparent">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">CNPJ *</label><input className="input" value={form.document} onChange={(e) => setForm({ ...form, document: formatCNPJ(e.target.value) })} inputMode="numeric" maxLength={18} required /></div>
            <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><label className="label">Telefone de contato *</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} inputMode="tel" required /></div>
            <div><label className="label">Prazo de contrato (dias) *</label><input type="number" min="1" step="1" className="input" value={form.contractTerm} onChange={(e) => setForm({ ...form, contractTerm: e.target.value })} required /></div>
            <div>
              <label className="label">CEP *</label>
              <div className="relative"><input className="input pr-10" value={form.cep} onChange={(e) => lookupCEP(e.target.value)} inputMode="numeric" maxLength={9} placeholder="00000-000" required />{cepLoading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary-400" />}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="label">Logradouro</label><input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div><div><label className="label">Número</label><input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div><div><label className="label">Bairro</label><input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div><div><label className="label">Cidade/UF</label><input className="input" value={`${form.city}${form.state ? `/${form.state}` : ''}`} readOnly /></div></div>
          <div><label className="label">Observações</label><textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
