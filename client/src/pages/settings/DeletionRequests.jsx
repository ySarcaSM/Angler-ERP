import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import toast from 'react-hot-toast';

export default function DeletionRequests() {
  const { company, user, userData } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id || !user?.uid) return;
    const constraints = [where('companyId', '==', company.id)];
    if (!['owner', 'admin'].includes(userData?.role)) constraints.push(where('requesterUid', '==', user.uid));
    const load = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'deletionRequests'), ...constraints));
        const sortedDocs = [...snapshot.docs].sort((a, b) => {
          const aTime = a.data().createdAt?.toMillis?.() || 0;
          const bTime = b.data().createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        setItems(sortedDocs.map((item) => ({ id: item.id, ...item.data() })));
      } catch (error) {
        toast.error(error.message || 'Não foi possível carregar as requisições.');
      } finally { setLoading(false); }
    };
    load();
  }, [company?.id, user?.uid, userData?.role]);

  return <div className="max-w-4xl space-y-5">
    <div><h1 className="text-2xl font-bold text-dark-100">Requisições</h1><p className="text-sm text-dark-500 mt-1">Acompanhe solicitações de exclusão. Operadores não removem registros diretamente.</p></div>
    {loading ? <div className="text-dark-400">Carregando…</div> : items.length === 0 ? <div className="card p-5 text-sm text-dark-400">Nenhuma requisição encontrada.</div> : items.map((item) => <div key={item.id} className="card p-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="flex-1"><div className="font-medium text-dark-100">{item.collection} / {item.documentId}</div><div className="text-xs text-dark-500">Solicitante: {item.requesterName || item.requesterUid}</div><div className="text-xs text-dark-500">{item.status === 'pending' ? 'Pendente' : item.status === 'approved' ? 'Aprovada' : 'Recusada'}</div></div>
      {item.status === 'pending' && <span className="badge badge-warning">Aguardando aprovação</span>}
    </div>)}
  </div>;
}
