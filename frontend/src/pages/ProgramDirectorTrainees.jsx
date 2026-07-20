// frontend/src/pages/ProgramDirectorTrainees.jsx
//
// Program Director / Sub-PD trainee roster (lists_views.md §PD trainees) —
// read-only AccountCard grid with a Year badge + a detail drawer (rotations,
// courses, publications). Restyled to the mt- system. Read-only for both PD and
// Sub-PD (no edit pencil, RULINGS §G35/§43).
//   GET /api/program-director/trainees        → { trainees, distributions }
//   GET /api/trainee-courses/trainee/:id       (drill)
//   GET /api/research/trainee/:id              (drill)
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './pd.css';

const PAGE_SIZE = 9;

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const STRINGS = {
  ar: {
    count: (n) => `${n} متدرب · برنامجي`, year: 'السنة', allYears: 'كل السنوات',
    searchPh: 'ابحث بالاسم أو الرقم أو الاختصاص…',
    specialty: 'الاختصاص', hospital: 'المركز', rotation: 'التدوير الحالي', email: 'البريد', city: 'المدينة', studentId: 'الرقم التعريفي', phone: 'الهاتف',
    yearN: (y) => `السنة ${y}`, trainee: 'متدرب',
    rotations: 'سجل التدوير', courses: 'الدورات والشهادات', pubs: 'الأبحاث',
    noRotations: 'لا يوجد تدوير مسند بعد.', noCourses: 'لا توجد دورات أو شهادات.', noPubs: 'لا توجد أبحاث.',
    supervisor: 'المشرف', open: 'فتح', close: 'إغلاق', weeks: 'أسابيع',
    empty: 'لا يوجد متدربون في اختصاصك بعد.', noMatch: 'لا يوجد تطابق مع بحثك.', loadFailed: 'فشل تحميل المتدربين',
  },
  en: {
    count: (n) => `${n} trainees · my program`, year: 'Year', allYears: 'All years',
    searchPh: 'Search by name, ID, or specialty…',
    specialty: 'Specialty', hospital: 'Center', rotation: 'Current rotation', email: 'Email', city: 'City', studentId: 'Student ID', phone: 'Phone',
    yearN: (y) => `Year ${y}`, trainee: 'Trainee',
    rotations: 'Rotation history', courses: 'Courses & certificates', pubs: 'Publications',
    noRotations: 'No rotations assigned yet.', noCourses: 'No courses or certificates uploaded.', noPubs: 'No publications.',
    supervisor: 'Supervisor', open: 'Open', close: 'Close', weeks: 'weeks',
    empty: 'No trainees are in your specialty yet.', noMatch: 'No match for your search.', loadFailed: 'Failed to load trainees',
  },
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function weeksBetween(a, b) {
  if (!a || !b) return null;
  const s = new Date(a); const e = new Date(b);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  return Math.max(1, Math.ceil((e - s) / (7 * 24 * 60 * 60 * 1000)));
}
function specName(x) { return x?.specialtyId?.name || x?.specialty || '—'; }
function hospName(x) { return x?.hospitalId?.name || x?.hospital?.name || '—'; }
function distsFor(trainee, dists) {
  return dists.filter((d) => {
    const tid = d.traineeId?._id || d.traineeId || d.student?._id || d.student;
    return tid?.toString() === trainee._id?.toString();
  });
}

function statusTone(status) {
  if (status === 'current' || status === 'active') return 'mt-pill--active';
  if (status === 'cancelled') return 'mt-pill--rejected';
  if (status === 'completed') return 'mt-pill--capacity';
  return 'mt-pill--warn';
}

function TraineeDetail({ trainee, distributions, onClose, t }) {
  const [courses, setCourses] = useState([]);
  const [pubs, setPubs] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get(`/api/trainee-courses/trainee/${trainee._id}`)
      .then((r) => { if (alive) setCourses(Array.isArray(r.data) ? r.data : (r.data?.data || [])); }).catch(() => {});
    api.get(`/api/research/trainee/${trainee._id}`)
      .then((r) => { if (alive) setPubs(Array.isArray(r.data) ? r.data : (r.data?.data || [])); }).catch(() => {});
    return () => { alive = false; };
  }, [trainee._id]);

  const mine = distsFor(trainee, distributions);
  const yearLabel = trainee.year || trainee.trainingYear ? t('yearN')(trainee.year || trainee.trainingYear) : t('trainee');

  return (
    <MtModal
      open
      title={trainee.name}
      sub={trainee.email || ''}
      meta={yearLabel}
      onClose={onClose}
      footer={<button type="button" className="mt-btn--cancel" onClick={onClose}>{t('close')}</button>}
    >
      <div className="pd-detail-kv">
        {[
          [t('studentId'), trainee.studentId || '—'],
          [t('phone'), trainee.phone || '—'],
          [t('specialty'), specName(trainee)],
          [t('hospital'), hospName(trainee)],
          [t('year'), trainee.year || trainee.trainingYear ? t('yearN')(trainee.year || trainee.trainingYear) : '—'],
          [t('city'), trainee.city || '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="pd-detail-k">{k}</div>
            <div className="pd-detail-v">{v}</div>
          </div>
        ))}
      </div>

      <div className="pd-detail-title">{t('rotations')}</div>
      {mine.length === 0 ? <div className="pd-detail-empty">{t('noRotations')}</div> : mine.map((d) => {
        const sp = d.specialtyId?.name || d.specialty || '—';
        const sup = d.supervisorId?.name || d.doctor?.name || '—';
        const status = d.status || 'upcoming';
        const dur = d.durationWeeks || weeksBetween(d.startDate, d.endDate);
        return (
          <div key={d._id} className="pd-detail-row">
            <div className="pd-detail-row-head">
              <div className="pd-detail-v" style={{ fontWeight: 600 }}>{sp}</div>
              <span className={`mt-pill ${statusTone(status)}`}>{status}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBlockEnd: 4 }}>{t('supervisor')}: <strong>{sup}</strong></div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{fmtDate(d.startDate)} → {fmtDate(d.endDate)}{dur ? ` · ${dur} ${t('weeks')}` : ''}</div>
          </div>
        );
      })}

      <div className="pd-detail-title">{t('courses')}</div>
      {courses.length === 0 ? <div className="pd-detail-empty">{t('noCourses')}</div> : courses.map((c) => (
        <div key={c._id} className="pd-detail-link">
          <div style={{ minWidth: 0 }}>
            <div className="pd-detail-v" style={{ fontWeight: 600 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.kind === 'course' ? 'Course' : 'Certificate'}{c.issuer ? ` · ${c.issuer}` : ''}{c.completedDate ? ` · ${fmtDate(c.completedDate)}` : ''}</div>
          </div>
          {c.fileUrl && <a href={c.fileUrl} target="_blank" rel="noreferrer" className="pd-detail-open">{t('open')}</a>}
        </div>
      ))}

      <div className="pd-detail-title">{t('pubs')}</div>
      {pubs.length === 0 ? <div className="pd-detail-empty">{t('noPubs')}</div> : pubs.map((p) => (
        <div key={p._id} className="pd-detail-link">
          <div style={{ minWidth: 0 }}>
            <div className="pd-detail-v" style={{ fontWeight: 600 }}>{p.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{[p.authors, p.journal].filter(Boolean).join(' · ') || 'Publication'}</div>
          </div>
          {p.fileUrl && <a href={p.fileUrl} target="_blank" rel="noreferrer" className="pd-detail-open">{t('open')}</a>}
        </div>
      ))}
    </MtModal>
  );
}

export default function ProgramDirectorTrainees() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [trainees, setTrainees] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/api/program-director/trainees')
      .then((r) => {
        const d = r.data?.data || r.data || {};
        setTrainees(d.trainees || (Array.isArray(d) ? d : []));
        setDistributions(d.distributions || []);
      })
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const years = [...new Set(trainees.map((x) => x.year || x.trainingYear).filter(Boolean))].sort((a, b) => a - b);

  const filtered = trainees.filter((tr) => {
    const y = tr.year || tr.trainingYear;
    if (yearFilter !== 'all' && String(y) !== String(yearFilter)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return tr.name?.toLowerCase().includes(q)
      || (tr.studentId || '').toLowerCase().includes(q)
      || specName(tr).toLowerCase().includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetPage(setter) { return (v) => { setter(v); setPage(1); }; }

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={0} charts={0} table /></main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          <span className="mt-count">{t('count')(trainees.length)}</span>
          <span className="mt-filterbar-spacer" />
          <span className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => resetPage(setSearch)(e.target.value)} placeholder={t('searchPh')} aria-label={t('searchPh')} />
          </span>
          <select className="mt-filter" value={yearFilter} onChange={(e) => resetPage(setYearFilter)(e.target.value)} aria-label={t('year')}>
            <option value="all">{t('allYears')}</option>
            {years.map((y) => <option key={y} value={y}>{t('yearN')(y)}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-empty" style={{ padding: 48 }}>
            <div className="mt-empty-title">{trainees.length === 0 ? t('empty') : t('noMatch')}</div>
          </div>
        ) : (
          <>
            <div className="mt-acct-grid">
              {pageItems.map((tr, i) => {
                const y = tr.year || tr.trainingYear;
                const cur = distsFor(tr, distributions).find((d) => d.status === 'current' || d.status === 'active') || distsFor(tr, distributions)[0];
                return (
                  <RevealOnScroll key={tr._id} delay={i * 0.06}>
                    <AccountCard
                      name={tr.name}
                      id={tr.studentId || tr.idNumber}
                      role={y ? t('yearN')(y) : t('trainee')}
                      fields={[
                        { label: t('specialty'), value: specName(tr) },
                        { label: t('hospital'), value: hospName(tr) },
                        { label: t('rotation'), value: cur ? (cur.specialtyId?.name || cur.specialty || cur.status || '—') : '—' },
                        { label: t('email'), value: tr.email || '—' },
                      ]}
                      canEdit={false}
                      onView={() => setSelected(tr)}
                    />
                  </RevealOnScroll>
                );
              })}
            </div>
            <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPrev={() => setPage((n) => Math.max(1, n - 1))} onNext={() => setPage((n) => Math.min(totalPages, n + 1))} />
          </>
        )}

        {selected && <TraineeDetail trainee={selected} distributions={distributions} onClose={() => setSelected(null)} t={t} />}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
