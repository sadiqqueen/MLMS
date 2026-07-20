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
import { useMtToast, MtToastHost } from '../components/MtToast';
import StatCard     from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye }  from '../components/icons';
import {
  EvalModal, Avatar, isThisMonth, safeArr, baseEvalType, evalSubjectId,
} from '../components/evaluations/EvalModal';
import { EVAL_STRINGS } from '../components/evaluations/evalStrings';
import { EVAL_FORMS, SUPERVISOR_EVAL_FORMS } from '../data/evalForms';
import './dio.css';

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
  const { toasts, showToast } = useMtToast();

  useEffect(() => {
    Promise.all([
      api.get('/api/dio/evaluations'),
      api.get('/api/dio/trainees'),
      api.get('/api/dio/supervisors'),
    ]).then(([eRes, tRes, sRes]) => {
      setEvals(safeArr(eRes.data?.data || eRes.data));
      setTrainees(safeArr(tRes.data?.data || tRes.data));
      setSupervisors(safeArr(sRes.data?.data || sRes.data));
    }).catch(() => showToast(t('loadFailed'), 'dng'))
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
    showToast(t('submitSuccess'), 'ok');
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
      <main className="mt-content" dir={dir}>
        <div className="dio-tabs">{[0, 1].map(i => <Sk key={i} w={110} h={32} r={6} style={{ marginInlineEnd: 6 }} />)}</div>
        <div className="mt-stat-grid" style={{ marginBlockEnd: 20 }}>
          {[0, 1, 2].map(i => <Sk key={i} h={104} r={12} />)}
        </div>
        <div style={{ marginBlockEnd: 16 }}><Sk h={40} r={8} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(6)].map((_, i) => <Sk key={i} h={72} r={12} />)}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>

        {/* Subject toggle — Trainees | Supervisors */}
        <div className="dio-tabs">
          {TABS.map(x => (
            <button
              key={x.key}
              type="button"
              className={`dio-tab${tab === x.key ? ' is-active' : ''}`}
              onClick={() => switchTab(x.key)}
            >
              {lang === 'ar' ? x.ar : x.en}
            </button>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="mt-stat-grid" style={{ marginBlockEnd: 20 }}>
          {[
            { label: t('statTotal'),     count: total,         icon: 'doc'   },
            { label: t('statThisMonth'), count: thisMonth,     icon: 'clock', tone: 'warn' },
            { label: tabLabel,           count: people.length, icon: isSupervisorTab ? 'users' : 'grad' },
          ].map((c, i) => (
            <RevealOnScroll key={c.label} delay={i * 0.055}>
              <StatCard label={c.label} value={c.count} icon={c.icon} tone={c.tone || 'ok'} />
            </RevealOnScroll>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBlockEnd: 16 }}>
          <input
            className="mt-input"
            placeholder={lang === 'ar' ? `ابحث في ${tabLabel}…` : `Search ${tabLabel.toLowerCase()} by name…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconEye size={22} /></div>
            <div className="mt-empty-title">
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
              <div key={id} className="mt-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar user={person} size={44} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBlockEnd: 2 }}>
                    {person.name || '—'}
                  </div>
                  <div className="mt-card-sub">
                    {person.studentId ? `${t('idLabel')}: ${person.studentId} · ` : ''}
                    {count} {t('evaluationsTotal')}{cap > 0 ? ` · ${monthTypes}/${cap} ${t('formsThisMonth')}` : ''}
                  </div>
                </div>

                {complete && <span className="mt-pill mt-pill--active">{t('allFormsDone')}</span>}

                {complete ? (
                  <button className="mt-icon-action" onClick={() => setSelected({ trainee: person, dist: {} })}
                    title={t('view')} aria-label={t('view')} style={{ flexShrink: 0 }}>
                    <IconEye size={16} />
                  </button>
                ) : (
                  <button className="mt-btn mt-btn--small" onClick={() => setSelected({ trainee: person, dist: {} })} style={{ flexShrink: 0 }}>
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

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
