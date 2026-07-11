import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye }  from '../components/icons';
import {
  EvalModal, Avatar, isThisMonth, safeArr, baseEvalType, evalSubjectId, MONTHLY_CAP,
} from '../components/evaluations/EvalModal';
import { EVAL_STRINGS } from '../components/evaluations/evalStrings';
import { FORM_TYPES } from '../data/evalForms';

export default function SupervisorEvaluations() {
  const { user: me }   = useAuth();
  const { lang, dir }  = usePrefs();
  const t = k => EVAL_STRINGS[lang]?.[k] ?? EVAL_STRINGS.ar[k] ?? k;
  const [evals,      setEvals     ] = useState([]);
  const [trainees,   setTrainees  ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [search,     setSearch    ] = useState('');
  const [selected,   setSelected  ] = useState(null);
  const [toasts,     setToasts    ] = useState([]);

  const isReadOnly = me?.role === 'dio';

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/supervisor/evaluations'),
      api.get('/api/supervisor/trainees'),
    ]).then(([evalRes, traineeRes]) => {
      setEvals(safeArr(evalRes.data?.data || evalRes.data));
      setTrainees(safeArr(traineeRes.data?.data || traineeRes.data));
    }).catch(() => showToast(t('loadFailed'), 'error'))
      .finally(() => setLoading(false));
  }, [me]);

  const seen = new Set();
  const traineeList = [];
  for (const dist of safeArr(trainees)) {
    const tObj = dist.traineeId || dist.student || {};
    const tid = tObj._id?.toString();
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    traineeList.push({ dist, trainee: tObj });
  }

  const filtered = traineeList.filter(({ trainee }) => {
    const q = search.toLowerCase();
    return !q
      || trainee.name?.toLowerCase().includes(q)
      || (trainee.studentId || '').toLowerCase().includes(q);
  });

  function evalCountFor(tid) {
    return safeArr(evals).filter(ev => evalSubjectId(ev) === tid).length;
  }

  function monthlyTypesFor(tid) {
    const set = new Set(
      safeArr(evals)
        .filter(ev => evalSubjectId(ev) === tid && isThisMonth(ev?.date || ev?.createdAt))
        .map(baseEvalType)
        // Only count still-selectable forms so a legacy FITER this month can't
        // read as "6 / 5" now that the Internship form was removed.
        .filter(tp => FORM_TYPES.includes(tp))
    );
    return set.size;
  }

  // Supervisor transport: pending-on-create, then explicit finalize.
  async function submitEval(payload, { trainee, dist }) {
    try {
      const res = await api.post('/api/supervisor/evaluations', {
        traineeId:      trainee._id,
        student:        trainee._id,
        distributionId: dist._id,
        rotation:       dist._id,
        type:           payload.evaluationType,
        date:           new Date().toISOString(),
        ...payload,
      });
      return res.data?.data || res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || t('submitFailed'));
    }
  }

  async function finalize(evalId) {
    try {
      const res = await api.patch(`/api/supervisor/evaluations/${evalId}/finalize`);
      return res.data?.data || res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || t('finalizeFailed'));
    }
  }

  function handleSubmitted(newEval) {
    if (!newEval || typeof newEval !== 'object') return;
    setEvals(prev => [newEval, ...safeArr(prev)]);
    showToast(t('submitSuccess'));
  }

  function handleFinalized(evalId, finalized = {}) {
    setEvals(prev => safeArr(prev).map(ev => (
      ev?._id === evalId
        ? {
            ...ev, ...finalized, _id: ev._id, isFinalized: true,
            sentToTraineeAt: finalized.sentToTraineeAt || ev.sentToTraineeAt || new Date().toISOString(),
            status: finalized.status || ev.status || 'completed',
          }
        : ev
    )));
    showToast(t('sentToGradesToast'));
  }

  const evalList       = safeArr(evals);
  const totalEvals     = evalList.length;
  const finalizedCount = evalList.filter(ev => ev?.isFinalized).length;
  const thisMonthTotal = evalList.filter(ev => isThisMonth(ev?.date || ev?.createdAt)).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom:16 }}><Sk h={40} r={8} /></div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={44} h={44} r="50%" />
              <div style={{ flex:1 }}>
                <Sk w={160} h={14} style={{ marginBottom:8 }} />
                <Sk w={100} h={12} />
              </div>
              <Sk w={80} h={32} r={8} />
              <Sk w={60} h={32} r={8} />
            </div>
          ))}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label:t('statTotal'),     count:totalEvals,     color:'var(--info-fg)',    bg:'var(--info-bg)' },
            { label:t('statThisMonth'), count:thisMonthTotal, color:'var(--warning-fg)', bg:'var(--warning-bg)' },
            { label:t('statFinalized'), count:finalizedCount, color:'var(--success-fg)', bg:'var(--success-bg)' },
          ].map(c => (
            <div key={c.label} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>
                {c.count}
              </div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom:16 }}>
          <input
            className="admin-search"
            style={{ width:'100%', height:40, maxWidth:'100%' }}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>
              {traineeList.length === 0 ? t('emptyNoTrainees') : t('emptyNoMatch')}
            </div>
            <div style={{ fontSize:13 }}>{t('emptyHint')}</div>
          </div>
        )}

        {/* Trainee list */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(({ dist, trainee }) => {
            const tid        = trainee._id?.toString();
            const count      = evalCountFor(tid);
            const monthTypes = monthlyTypesFor(tid);
            const complete   = monthTypes >= MONTHLY_CAP;

            const isView = isReadOnly || complete; // read-only or fully complete → view-only

            return (
              <div
                key={tid}
                style={{
                  background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
                  padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)'
                }}
              >
                <Avatar user={trainee} size={44} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
                    {trainee.name || '—'}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {trainee.studentId ? `${t('idLabel')}: ${trainee.studentId} · ` : ''}
                    {count} {t('evaluationsTotal')} · {monthTypes}/{MONTHLY_CAP} {t('formsThisMonth')}
                  </div>
                </div>

                {complete && !isReadOnly && (
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                    background:'var(--success-bg)', color:'var(--success-fg)'
                  }}>{t('allFormsDone')}</span>
                )}

                {isView ? (
                  <button
                    onClick={() => setSelected({ dist, trainee })}
                    title={t('view')}
                    aria-label={t('view')}
                    style={{
                      width:36, height:36, borderRadius:8, background:'var(--surface)',
                      color:'var(--text-2)', border:'1.5px solid var(--border)',
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      cursor:'pointer', flexShrink:0
                    }}
                  >
                    <IconEye size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setSelected({ dist, trainee })}
                    style={{
                      padding:'8px 18px', borderRadius:8, background:'var(--accent)',
                      color:'#fff', border:'none', fontWeight:500, fontSize:12,
                      cursor:'pointer', flexShrink:0,
                      boxShadow:'0 2px 6px rgba(255,107,53,.3)'
                    }}
                  >
                    {t('evaluationsBtn')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {selected && (
          <EvalModal
            item={selected}
            evals={evals}
            assessorName={me?.name}
            onClose={() => setSelected(null)}
            onSubmitted={handleSubmitted}
            onFinalized={handleFinalized}
            isReadOnly={isReadOnly}
            submitEval={submitEval}
            finalize={isReadOnly ? undefined : finalize}
            t={t}
          />
        )}

        <Toast toasts={toasts} />

      </main>
    </>
  );
}
