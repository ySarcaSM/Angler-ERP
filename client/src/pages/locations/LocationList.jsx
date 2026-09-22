import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import {
  listLocations, createLocation, updateLocation, deleteLocation,
} from '../../services/firebase/locations';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';
import { logAudit } from '../../services/firebase/settings';

const EMPTY = {
  name: '', notes: '', cep: '', street: '', number: '', neighborhood: '', city: '', state: '',
};

function formatCEP(value) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export default function LocationList() {
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
    try {
      const result = await listLocations(company.id, { pageSize: 200, searchTerm: search });
      setData(result.data);
    } catch (error) {
      if (error.code === 'deletion-request-created') toast.success(error.message);
      else toast.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [company, search]);

  useEffect(() => { load(); }, [load]);

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const lookupCEP = async (value) => {
    const cep = value.replace(/\D/g, '');
    updateField('cep', formatCEP(value));
    if (cep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const address = await response.json();
      if (address.erro) throw new Error('CEP não encontrado.');
      setForm((current) => ({
        ...current,
        cep: formatCEP(cep),
        street: address.logradouro || current.street,
        neighborhood: address.bairro || current.neighborhood,
        city: address.localidade || current.city,
        state: address.uf || current.state,
      }));
    } catch (error) {
      toast.error(error.message || 'Não foi possível consultar o CEP.');
    } finally {
      setCepLoading(false);
    }
  };

  const openNew = () => { setForm({ ...EMPTY }); setEditing(null); setModal(true); };
  const openEdit = (location) => { setForm({ ...EMPTY, ...location }); setEditing(location.id); setModal(true); };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome da localização.');
    setSaving(true);
    try {
      if (editing) {
        const previousLocation = data.find((location) => location.id === editing);
        await updateLocation(editing, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'update', entity: 'Localização', entityId: editing, description: `${userData?.name || 'Usuário'} alterou a localização ${form.name}.`, details: { antes: { name: previousLocation?.name, city: previousLocation?.city, state: previousLocation?.state }, depois: { name: form.name, city: form.city, state: form.state } } });
        toast.success('Localização atualizada!');
      } else {
        const createdLocation = await createLocation(company.id, form);
        await logAudit(company.id, { user, userName: userData?.name, action: 'create', entity: 'Localização', entityId: createdLocation.id, description: `${userData?.name || 'Usuário'} criou a localização ${form.name}.`, details: { name: form.name, city: form.city, state: form.state } });
        toast.success('Localização criada!');
      }
      setModal(false);
      load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location) => {
    if (!confirm(`Remover a localização ${location.name}?`)) return;
    try {
      await deleteLocation(location.id);
      await logAudit(company.id, { user, userName: userData?.name, action: 'delete', entity: 'Localização', entityId: location.id, description: `${userData?.name || 'Usuário'} excluiu a localização ${location.name}.`, details: { name: location.name } });
      toast.success('Localização removida.');
      load();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'name', label: 'Nome', render: (value) => <div className="flex items-center gap-2 font-medium text-dark-100"><MapPin size={15} className="text-primary-400" />{value}</div> },
    { key: 'address', label: 'Endereço', render: (_, row) => <span className="text-dark-300">{[row.street, row.number, row.neighborhood, row.city, row.state].filter(Boolean).join(', ') || '—'}</span> },
    { key: 'cep', label: 'CEP', render: (value) => <span className="font-mono text-xs text-dark-400">{value || '—'}</span> },
    { key: '_actions', label: '', width: '80px', render: (_, row) => <div className="flex gap-1"><button onClick={(event) => { event.stopPropagation(); openEdit(row); }} className="btn-ghost btn-sm"><Edit2 size={14} /></button><button onClick={(event) => { event.stopPropagation(); handleDelete(row); }} className="btn-ghost btn-sm text-red-400"><Trash2 size={14} /></button></div> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Localizações" subtitle={`${data.length} localizações`} action={<button onClick={openNew} className="btn-primary"><Plus size={18} /> Nova Localização</button>} />
      <div className="card">
        <div className="card-header flex items-center gap-2 bg-dark-800 rounded-t-xl px-4 py-3">
          <Search size={16} className="text-dark-500" />
          <input type="text" placeholder="Buscar localizações..." className="bg-transparent text-sm outline-none w-full" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <DataTable columns={columns} data={data} loading={loading} onRowClick={openEdit} />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar Localização' : 'Nova Localização'} size="lg" backdropClassName="bg-transparent">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={(event) => updateField('name', event.target.value)} required placeholder="Estoque principal" /></div>
            <div>
              <label className="label">CEP</label>
              <div className="relative"><input className="input pr-10" value={form.cep} onChange={(event) => lookupCEP(event.target.value)} inputMode="numeric" maxLength={9} placeholder="00000-000" />{cepLoading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary-400" />}</div>
            </div>
            <div className="md:col-span-2"><label className="label">Logradouro</label><input className="input" value={form.street} onChange={(event) => updateField('street', event.target.value)} /></div>
            <div><label className="label">Número</label><input className="input" value={form.number} onChange={(event) => updateField('number', event.target.value)} /></div>
            <div><label className="label">Bairro</label><input className="input" value={form.neighborhood} onChange={(event) => updateField('neighborhood', event.target.value)} /></div>
            <div><label className="label">Cidade</label><input className="input" value={form.city} onChange={(event) => updateField('city', event.target.value)} /></div>
            <div><label className="label">Estado</label><input className="input" value={form.state} onChange={(event) => updateField('state', event.target.value)} maxLength={2} /></div>
          </div>
          <div><label className="label">Observações</label><textarea className="input" rows={3} value={form.notes} onChange={(event) => updateField('notes', event.target.value)} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-800"><button type="button" className="btn-secondary" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></div>
        </form>
      </Modal>
    </div>
  );
}
