import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Phone, Mail } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { listClients, createClient, updateClient, deleteClient } from '../../services/firebase/clients';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import { formatPhone, formatDocument, formatDate } from '../../utils/format';
import { logAudit } from '../../services/firebase/settings';
import toast from 'react-hot-toast';

const EMPTY = { name: '', document: '', email: '', phone: '', whatsapp: '', contact: '', address: { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' }, notes: '', status: 'active' };

function formatCPF(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function isValidCPF(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calculateDigit = (length) => {
    const sum = digits.slice(0, length).split('').reduce((total, digit, index) => (
      total + Number(digit) * (length + 1 - index)
    ), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export default function ClientList() {
  const { company, user, userData } = useAuth();
  const isOperator = userData?.role === 'operator';
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(urlSearch);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const load = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const res = await listClients(company.id, { pageSize: 100, searchTerm: search });
      setData(res.data);
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setLoading(false); }
  }, [company, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setSearch(urlSearch); }, [urlSearch]);

  const openNew = () => { setForm({ ...EMPTY, address: { ...EMPTY.address } }); setErrors({}); setEditing(null); setModal(true); };
  const openEdit = (c) => { setForm({ ...EMPTY, ...c, address: { ...EMPTY.address, ...c.address } }); setErrors({}); setEditing(c.id); setModal(true); };

  const validateForm = () => {
    const nextErrors = {};
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (form.name.trim().length < 2) nextErrors.name = 'Informe o nome completo.';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Informe um e-mail válido.';
    if (phoneDigits.length < 10 || phoneDigits.length > 11) nextErrors.phone = 'Informe um telefone válido.';
    if (!isValidCPF(form.document)) nextErrors.document = 'Informe um CPF válido.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSaving(true);
    try {
      if (editing) {
        const previousClient = data.find((client) => client.id === editing);
        await updateClient(editing, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Cliente', entityId: editing, description: `${userData?.name || 'Usuário'} alterou o cliente ${form.name}.`, details: { antes: { name: previousClient?.name, email: previousClient?.email, phone: previousClient?.phone, status: previousClient?.status }, depois: { name: form.name, email: form.email, phone: form.phone, status: form.status } } });
        toast.success('Cliente atualizado!');
      } else {
        const createdClient = await createClient(company.id, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Cliente', entityId: createdClient.id, description: `${userData?.name || 'Usuário'} criou o cliente ${form.name}.`, details: { name: form.name, email: form.email, phone: form.phone } });
        toast.success('Cliente criado!');
      }
      setModal(false); load();
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
    finally { setSaving(false); }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remover ${c.name}?`)) return;
    try {
      await deleteClient(c.id);
      await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Cliente', entityId: c.id, description: `${userData?.name || 'Usuário'} excluiu o cliente ${c.name}.`, details: { name: c.name, email: c.email } });
      toast.success('Removido.'); load();
    } catch (err) { if (err.code === 'deletion-request-created') { toast.success(err.message); } else { toast.error(err.message); } }
  };

  const columns = [
    { key: 'name', label: 'Nome', render: (v, row) => <div><div className="font-medium text-dark-100">{v}</div>{row.contact && <div className="text-xs text-dark-500">{row.contact}</div>}</div> },
    { key: 'document', label: 'Documento', render: (v) => <span className="font-mono text-dark-400 text-xs">{formatDocument(v)}</span> },
    { key: 'phone', label: 'Contato', render: (v, row) => <div className="flex flex-col gap-0.5 text-xs">{v && <span className="flex items-center gap-1 text-dark-400"><Phone size={12} /> {formatPhone(v)}</span>}{row.email && <span className="flex items-center gap-1 text-dark-400"><Mail size={12} /> {row.email}</span>}</div> },
    { key: 'status', label: 'Status', render: (v) => <span className={`badge ${v === 'active' ? 'badge-success' : v === 'blocked' ? 'badge-danger' : 'badge-neutral'}`}>{v === 'active' ? 'Ativo' : v === 'blocked' ? 'Bloqueado' : 'Inativo'}</span> },
    { key: 'createdAt', label: 'Criado em', render: (v) => <span className="text-dark-500 text-xs">{formatDate(v?.toDate?.() || v)}</span> },
    { key: '_actions', label: '', width: '80px', render: (_, row) => <div className="flex gap-1"><button onClick={(e) => { e.stopPropagation(); openEdit(row); }} className="btn-ghost btn-sm"><Edit2 size={14} /></button><button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" subtitle={`${data.length} clientes`} action={!isOperator && <button onClick={openNew} className="btn-primary"><Plus size={18} /> Novo Cliente</button>} />
      <div className="card">
        <div className="card-header flex items-center gap-4">
          <div className="flex items-center gap-2 bg-dark-800 rounded-xl px-4 py-2 flex-1 max-w-sm">
            <Search size={16} className="text-dark-500" />
            <input type="text" placeholder="Buscar clientes..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
        backdropClassName="bg-transparent"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />{errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}</div>
            <div><label className="label">CPF *</label><input className="input" value={form.document} onChange={(e) => setForm({ ...form, document: formatCPF(e.target.value) })} inputMode="numeric" maxLength={14} required />{errors.document && <p className="text-xs text-red-400 mt-1">{errors.document}</p>}</div>
            <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />{errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}</div>
            <div><label className="label">Telefone de contato *</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} inputMode="tel" required />{errors.phone && <p className="text-xs text-red-400 mt-1">{errors.phone}</p>}</div>
          </div>
          <div><label className="label">Observações</label><textarea className="input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
