import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../services/firebase/suppliers';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatPhone, formatDate } from '../../utils/format';
import toast from 'react-hot-toast';

const EMPTY = { name: '', document: '', email: '', phone: '', contact: '', paymentTerms: '', leadTime: '', notes: '', active: true };

export default function SupplierList() {
  const { company } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try { const res = await listSuppliers(company.id, { pageSize: 200, searchTerm: search }); setData(res.data); }
    catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  }, [company, search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (s) => { setForm({ ...EMPTY, ...s }); setEditing(s.id); setModal(true); };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editing) { await updateSupplier(editing, form); toast.success('Atualizado!'); }
      else { await createSupplier(company.id, form); toast.success('Criado!'); }
      setModal(false); load();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (s) => {
    if (!confirm(`Remover ${s.name}?`)) return;
    try { await deleteSupplier(s.id); toast.success('Removido.'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'name', label: 'Fornecedor', render: (v, row) => <div><div className="font-medium text-dark-100">{v}</div>{row.contact && <div className="text-xs text-dark-500">{row.contact}</div>}</div> },
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
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Documento</label><input className="input" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Telefone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">Contato</label><input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
            <div><label className="label">Prazo (dias)</label><input type="number" className="input" value={form.leadTime} onChange={(e) => setForm({ ...form, leadTime: e.target.value })} /></div>
          </div>
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
