import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

export default function DioSecretaries() {
  const [secretaries, setSecretaries] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [editId,      setEditId     ] = useState(null);
  const [editForm,    setEditForm   ] = useState({});
  const [saving,      setSaving     ] = useState(false);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(msg, type='success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message:msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/dio/secretaries'),
      api.get('/api/specialties'),
    ]).then(([sRes, spRes]) => {
      setSecretaries(sRes.data?.data || sRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
    }).catch(() => showToast('Failed to load secretaries', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(secretary) {
    setEditId(secretary._id);
    setEditForm({
      specialtyId: secretary.specialtyId?._id || secretary.specialtyId || '',
      isActive:    secretary.isActive !== false,
    });
  }

  function cancelEdit() { setEditId(null); setEditForm({}); }

  async function handleSave(id) {
    setSaving(true);
    try {
      const res = await api.patch(`/api/dio/secretaries/${id}`, editForm);
      const updated = res.data?.data || res.data;
      setSecretaries(prev => prev.map(s => s._id === id ? { ...s, ...updated } : s));
      setEditId(null);
      showToast('Secretary updated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(secretary) {
    try {
      const res = await api.patch(`/api/dio/secretaries/${secretary._id}`, {
        isActive: secretary.isActive === false ? true : false
      });
      const updated = res.data?.data || res.data;
      setSecretaries(prev => prev.map(s => s._id === secretary._id ? { ...s, ...updated } : s));
      showToast(`Secretary ${secretary.isActive === false ? 'activated' : 'deactivated'}`);
    } catch {
      showToast('Update failed', 'error');
    }
  }

  const filtered = secretaries.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || (s.specialtyId?.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(5)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={100} h={22} r={20} /></td>
                    <td><Sk w={80}  h={22} r={20} /></td>
                    <td><div style={{ display:'flex', gap:6 }}><Sk w={80} h={28} r={6} /><Sk w={60} h={28} r={6} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:20 }}>📋</div>
          <div style={{ fontSize:13, color:'#1E40AF', lineHeight:1.6 }}>
            As DIO, you can assign secretaries to specialties and activate or deactivate their accounts.
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200 }}
              placeholder="Search by name, email, or specialty…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
              {filtered.length} secretar{filtered.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Secretary</th><th>Assigned Specialty</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {secretaries.length === 0 ? 'No secretaries in this hospital' : 'No secretaries match your search'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const isEditing = editId === s._id;
                  const isActive  = s.isActive !== false;
                  const specName  = s.specialtyId?.name || '—';

                  return (
                    <tr key={s._id}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>
                          <div>
                            <strong>{s.name}</strong>
                            <div style={{ fontSize:11, color:'#8B8FA8' }}>{s.email}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {isEditing ? (
                          <select
                            className="admin-search"
                            style={{ minWidth:180 }}
                            value={editForm.specialtyId || ''}
                            onChange={e => setEditForm(f => ({ ...f, specialtyId: e.target.value }))}
                          >
                            <option value="">— No specialty —</option>
                            {specialties.map(sp => (
                              <option key={sp._id} value={sp._id}>{sp.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                            background: specName === '—' ? '#F3F4F6' : '#EEEDFE',
                            color:      specName === '—' ? '#6B7280' : '#3C3489'
                          }}>
                            {specName}
                          </span>
                        )}
                      </td>

                      <td>
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                          background: isActive ? '#D1FAE5' : '#FEE2E2',
                          color:      isActive ? '#065F46' : '#991B1B'
                        }}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                          {isEditing ? (
                            <>
                              <button
                                style={{ padding:'5px 12px', borderRadius:6, background:'#1B1464', color:'#fff', border:'none', fontSize:12, fontWeight:500, cursor:'pointer', opacity: saving ? 0.7 : 1 }}
                                onClick={() => handleSave(s._id)}
                                disabled={saving}
                              >
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                style={{ padding:'5px 12px', borderRadius:6, background:'#fff', color:'#4B5563', border:'1.5px solid #E8E9EF', fontSize:12, fontWeight:500, cursor:'pointer' }}
                                onClick={cancelEdit}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                style={{ padding:'5px 12px', borderRadius:6, background:'#EEEDFE', color:'#1B1464', border:'none', fontSize:12, fontWeight:500, cursor:'pointer' }}
                                onClick={() => startEdit(s)}
                              >
                                Assign Specialty
                              </button>
                              <button
                                style={{
                                  padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border:'none',
                                  background: isActive ? '#FEE2E2' : '#D1FAE5',
                                  color:      isActive ? '#991B1B' : '#065F46'
                                }}
                                onClick={() => toggleActive(s)}
                              >
                                {isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
