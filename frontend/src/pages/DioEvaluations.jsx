// frontend/src/pages/DioEvaluations.jsx
//
// DIO evaluation feature — same design/flow as the supervisor's, but the DIO
// evaluates BOTH trainees and supervisors via a top toggle. Reuses the shared
// EvalModal + WPBA forms. DIO evaluations are finalized on create, so no
// `finalize` handler is passed and the modal hides the finalize step.
import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye }  from '../components/icons';
import {
  EvalModal, Avatar, isThisMonth, safeArr, baseEvalType, evalSubjectId,
} from '../components/evaluations/EvalModal';
import { EVAL_STRINGS } from '../components/evaluations/evalStrings';
import { EVAL_FORMS, SUPERVISOR_EVAL_FORMS } from '../data/evalForms';

const TABS = [
  { key: 'trainees',    en: 'Trainees',    ar: 'المتدربون' },
  { key: 'supervisors', en: 'Supervisors', ar: 'المشرفون'  },
];

export default function DioEvaluations() {
  const { user: me }  = useAuth();
  const { lang, dir } = usePrefs();
  const t = k => EVAL_STRINGS[lang]?.[k] ?? EVAL_STRINGS.ar[k] ?? k;

  const [tab,         setTab        ] = useState('trainees');
  const [evals,       setEvals      ] = useState([]);
  const [trainees,    setTrainees   ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [selected,    setSelected   ] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/dio/evaluations'),
      api.get('/api/dio/trainees'),
      api.get('/api/dio/supervisors'),
    ]).then(([eRes, tRes, sRes]) => {
      setEvals(safeArr(eRes.data?.data || eRes.data));
      setTrainees(safeArr(tRes.data?.data || tRes.data));
      setSupervisors(safeArr(sRes.data?.data || sRes.data));
    }).catch(() => showToast(t('loadFailed'), 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSupervisorTab = tab === 'supervisors';
  const people = isSupervisorTab ? supervisors : trainees;
  // Forms available for the active subject: none for supervisors (all removed),
  // the trainee WPBA set otherwise. cap 0 → hide the "X/N forms" progress + the
  // "all forms done" state so supervisor rows read cleanly.
  const activeForms = isSupervisorTab ? SUPERVISOR_EVAL_FORMS : EVAL_FORMS;
  const cap = activeForms.length;
  const tabLabel = lang === 'ar' ? TABS.find(x => x.key === tab).ar : TABS.find(x => x.key === tab).en;

  // Split the DIO's evaluations by subject type (legacy rows → trainee).
  const tabEvals = safeArr(evals).filter(ev => {
    const role = ev?.evaluateeRole || 'trainee';
    return isSupervisorTab ? role === 'supervisor' : role !== 'supervisor';
  });

  const filtered = safeArr(people).filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || (p.studentId || '').toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q);
  });

  function evalCountFor(id) {
    return tabEvals.filter(ev => evalSubjectId(ev) === id).length;
  }
  function monthlyTypesFor(id) {
    return new Set(
      tabEvals.filter(ev => evalSubjectId(ev) === id && isThisMonth(ev?.date || ev?.createdAt))
        .map(baseEvalType).filter(tp => activeForms.some(f => f.type === tp))
    ).size;
  }

  // DIO transport: finalized-on-create. Endpoint depends on the active tab.
  async function submitEval(payload, { trainee }) {
    const apiName = isSupervisorTab ? 'supervisors' : 'trainees';
    try {
      const res = await api.post(`/api/dio/${apiName}/${trainee._id}/evaluations`, {
        type: payload.evaluationType,
        date: new Date().toISOString(),
        distributionId: null,
        ...payload,
      });
      return res.data?.data || res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || t('submitFailed'));
    }
  }

  function handleSubmitted(newEval) {
    if (!newEval || typeof newEval !== 'object') return;
    setEvals(prev => [newEval, ...safeArr(prev)]);
    showToast(t('submitSuccess'));
  }

  function switchTab(next) {
    if (next === tab) return;
    setTab(next);
    setSelected(null);
  }

  const total     = tabEvals.length;
  const thisMonth = tabEvals.filter(ev => isThisMonth(ev?.date || ev?.createdAt)).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          {[0, 1].map(i => <Sk key={i} w={110} h={32} r={20} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Sk w={46} h={46} r={10} /><Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}><Sk h={40} r={8} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Sk w={44} h={44} r="50%" />
              <div style={{ flex: 1 }}><Sk w={160} h={14} style={{ marginBottom: 8 }} /><Sk w={100} h={12} /></div>
              <Sk w={80} h={32} r={8} />
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

        {/* Subject toggle — Trainees | Supervisors */}
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          {TABS.map(x => (
            <button
              key={x.key}
              type="button"
              className={`filter-tab${tab === x.key ? ' active' : ''}`}
              onClick={() => switchTab(x.key)}
            >
              {lang === 'ar' ? x.ar : x.en}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: t('statTotal'),     count: total,           color: 'var(--info-fg)',    bg: 'var(--info-bg)' },
            { label: t('statThisMonth'), count: thisMonth,       color: 'var(--warning-fg)', bg: 'var(--warning-bg)' },
            { label: tabLabel,           count: people.length,   color: 'var(--success-fg)', bg: 'var(--success-bg)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: c.color, flexShrink: 0 }}>
                {c.count}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="admin-search"
            style={{ width: '100%', height: 40, maxWidth: '100%' }}
            placeholder={lang === 'ar' ? `ابحث في ${tabLabel}…` : `Search ${tabLabel.toLowerCase()} by name…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 56, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              {people.length === 0
                ? (lang === 'ar' ? `لا يوجد ${tabLabel} بعد` : `No ${tabLabel.toLowerCase()} yet`)
                : (lang === 'ar' ? 'لا يوجد تطابق مع بحثك' : 'No match for your search')}
            </div>
          </div>
        )}

        {/* People list */}
        <div key={tab} style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn .18s ease-out' }}>
          {filtered.map(person => {
            const id         = person._id?.toString();
            const count      = evalCountFor(id);
            const monthTypes = monthlyTypesFor(id);
            const complete   = cap > 0 && monthTypes >= cap;

            return (
              <div
                key={id}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  boxShadow: '0 1px 3px rgba(0,0,0,.05)',
                }}
              >
                <Avatar user={person} size={44} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                    {person.name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {person.studentId ? `${t('idLabel')}: ${person.studentId} · ` : ''}
                    {count} {t('evaluationsTotal')}{cap > 0 ? ` · ${monthTypes}/${cap} ${t('formsThisMonth')}` : ''}
                  </div>
                </div>

                {complete && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--success-bg)', color: 'var(--success-fg)' }}>
                    {t('allFormsDone')}
                  </span>
                )}

                {complete ? (
                  <button
                    onClick={() => setSelected({ trainee: person, dist: {} })}
                    title={t('view')} aria-label={t('view')}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--surface)', color: 'var(--text-2)', border: '1.5px solid var(--border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <IconEye size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setSelected({ trainee: person, dist: {} })}
                    style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 500, fontSize: 12, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 6px rgba(255,107,53,.3)' }}
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
            evals={tabEvals}
            forms={activeForms}
            assessorName={me?.name}
            onClose={() => setSelected(null)}
            onSubmitted={handleSubmitted}
            onFinalized={() => {}}
            isReadOnly={false}
            submitEval={submitEval}
            t={t}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
