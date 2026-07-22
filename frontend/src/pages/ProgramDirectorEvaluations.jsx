// frontend/src/pages/ProgramDirectorEvaluations.jsx
//
// Program Director evaluations — SAME shape/flow as the supervisor's: per-trainee
// cards where the PD picks a WPBA evaluation form (Mini-CEX / CBD / DOPS /
// Academic Supervisor Report / MSF-360) for each trainee via the shared EvalModal.
// Reuses the shared component (exactly like DioEvaluations) with a PD transport.
// PD evaluations are finalized on create, so no `finalize` handler is passed and
// the modal hides the finalize step. program_director-only write (RULINGS §D20).
//   GET  /api/program-director/evaluations               → authored evals
//   GET  /api/program-director/trainees                  → trainee pool
//   POST /api/program-director/trainees/:id/evaluations  → create (finalized;
//                                                          accepts the WPBA payload)
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import StatCard from '../components/StatCard';
import RevealOnScroll from '../components/RevealOnScroll';
import Sk from '../components/Skeleton';
import { IconEye } from '../components/icons';
import {
  EvalModal, Avatar, isThisMonth, safeArr, baseEvalType, evalSubjectId,
} from '../components/evaluations/EvalModal';
import { EVAL_STRINGS } from '../components/evaluations/evalStrings';
import { EVAL_FORMS } from '../data/evalForms';
import api from '../api/axios';
import './pd.css';

export default function ProgramDirectorEvaluations() {
  const { user: me } = useAuth();
  const { lang, dir } = usePrefs();
  const t = k => EVAL_STRINGS[lang]?.[k] ?? EVAL_STRINGS.ar[k] ?? k;

  const [evals, setEvals] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const { toasts, showToast } = useMtToast();

  useEffect(() => {
    Promise.all([
      api.get('/api/program-director/evaluations'),
      api.get('/api/program-director/trainees'),
    ]).then(([eRes, tRes]) => {
      setEvals(safeArr(eRes.data?.data || eRes.data));
      const td = tRes.data?.data || tRes.data || [];
      setTrainees(safeArr(Array.isArray(td) ? td : (td.trainees || [])));
    }).catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forms = EVAL_FORMS;          // trainee WPBA set (Mini-CEX / CBD / DOPS / …)
  const cap = forms.length;

  // Only trainee-subject evaluations (a legacy row without evaluateeRole = trainee).
  const traineeEvals = safeArr(evals).filter(ev => (ev?.evaluateeRole || 'trainee') !== 'supervisor');

  const filtered = safeArr(trainees).filter(p => {
    const q = search.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q)
      || (p.studentId || '').toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q);
  });

  function evalCountFor(id) {
    return traineeEvals.filter(ev => evalSubjectId(ev) === id).length;
  }
  function monthlyTypesFor(id) {
    return new Set(
      traineeEvals.filter(ev => evalSubjectId(ev) === id && isThisMonth(ev?.date || ev?.createdAt))
        .map(baseEvalType).filter(tp => forms.some(f => f.type === tp))
    ).size;
  }

  // PD transport: finalized-on-create. The WPBA payload from EvalModal is accepted
  // as-is by POST /api/program-director/trainees/:id/evaluations (scores/formData/
  // evaluationType/totalScore), so we mirror the DIO submitEval shape.
  async function submitEval(payload, { trainee }) {
    try {
      const res = await api.post(`/api/program-director/trainees/${trainee._id}/evaluations`, {
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

  const total = traineeEvals.length;
  const thisMonth = traineeEvals.filter(ev => isThisMonth(ev?.date || ev?.createdAt)).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
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
        {/* Stat cards */}
        <div className="mt-stat-grid" style={{ marginBlockEnd: 20 }}>
          {[
            { label: t('statTotal'), count: total, icon: 'doc' },
            { label: t('statThisMonth'), count: thisMonth, icon: 'clock', tone: 'warn' },
            { label: lang === 'ar' ? 'المتدربون' : 'Trainees', count: trainees.length, icon: 'grad' },
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
            placeholder={lang === 'ar' ? 'ابحث باسم المتدرب…' : 'Search trainees by name…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconEye size={22} /></div>
            <div className="mt-empty-title">
              {trainees.length === 0
                ? (lang === 'ar' ? 'لا يوجد متدربون بعد' : 'No trainees yet')
                : (lang === 'ar' ? 'لا يوجد تطابق مع بحثك' : 'No match for your search')}
            </div>
          </div>
        )}

        {/* Trainee list — pick a WPBA form for each trainee */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(person => {
            const id = person._id?.toString();
            const count = evalCountFor(id);
            const monthTypes = monthlyTypesFor(id);
            const complete = cap > 0 && monthTypes >= cap;
            return (
              <div key={id} className="mt-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <Avatar user={person} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBlockEnd: 2 }}>{person.name || '—'}</div>
                  <div className="mt-card-sub">
                    {person.studentId ? `${t('idLabel')}: ${person.studentId} · ` : ''}
                    {count} {t('evaluationsTotal')}{cap > 0 ? ` · ${monthTypes}/${cap} ${t('formsThisMonth')}` : ''}
                  </div>
                </div>
                {complete && <span className="mt-pill mt-pill--active">{t('allFormsDone')}</span>}
                {complete ? (
                  <button className="mt-icon-action" onClick={() => setSelected({ trainee: person, dist: {} })} title={t('view')} aria-label={t('view')} style={{ flexShrink: 0 }}>
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
            evals={traineeEvals}
            forms={forms}
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
