// frontend/src/pages/SgPrograms.jsx
//
// Secretary General / Assistant Secretary read-only program list.
// Restyled to the mt- design: navy-header table (read-only, no edit actions),
// search + pagination. Contract (unchanged): GET /api/sg/programs → programs with
// populated trainingCenterId / specialtyId / programDirectorId, plus durationYears
// and computed accreditationStatus.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccreditationBadge from '../components/AccreditationBadge';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconLayers } from '../components/icons';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './sg.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    search: 'ابحث باسم البرنامج…', count: n => `${n} برنامج`,
    colName: 'البرنامج', colCenter: 'المركز', colSpecialty: 'الاختصاص', colPd: 'مدير البرنامج',
    colDuration: 'المدة', colAccred: 'الاعتماد', years: n => `${n} سنوات`,
    noneTitle: 'لا توجد برامج بعد.', noneSub: 'ستظهر البرامج هنا عند إضافتها.',
    noMatchTitle: 'لا توجد برامج مطابقة.', noMatchSub: 'جرّب تعديل البحث.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by program name…', count: n => `${n} programs`,
    colName: 'Program', colCenter: 'Center', colSpecialty: 'Specialty', colPd: 'Program Director',
    colDuration: 'Duration', colAccred: 'Accreditation', years: n => `${n} yrs`,
    noneTitle: 'No programs yet.', noneSub: 'Programs appear here once added.',
    noMatchTitle: 'No programs match.', noMatchSub: 'Try adjusting your search.',
    loadFailed: 'Failed to load',
  },
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function refName(x) { return x?.name || '—'; }

export default function SgPrograms() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/programs')
      .then((r) => setPrograms(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search]);

  const filtered = programs.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q
      || (p.name || '').toLowerCase().includes(q)
      || refName(p.trainingCenterId).toLowerCase().includes(q)
      || specialtyName(p.specialtyId).toLowerCase().includes(q);
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
          </div>
          <div className="mt-filterbar-spacer" />
          {!loading && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sg-skel-rows">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 22, borderRadius: 6 }} />)}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconLayers size={22} /></div>
            <div className="mt-empty-title">{programs.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{programs.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table mt-table--stack">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('colName')}</th>
                      <th className="mt-th">{t('colCenter')}</th>
                      <th className="mt-th">{t('colSpecialty')}</th>
                      <th className="mt-th">{t('colPd')}</th>
                      <th className="mt-th">{t('colDuration')}</th>
                      <th className="mt-th">{t('colAccred')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => (
                      <tr key={p._id}>
                        <td className="mt-td mt-td--name" data-label={t('colName')}>{p.name}</td>
                        <td className="mt-td" data-label={t('colCenter')}>{refName(p.trainingCenterId)}</td>
                        <td className="mt-td" data-label={t('colSpecialty')}>{specialtyName(p.specialtyId)}</td>
                        <td className="mt-td" data-label={t('colPd')}>{refName(p.programDirectorId)}</td>
                        <td className="mt-td mt-td--muted" data-label={t('colDuration')}>{p.durationYears ? t('years')(p.durationYears) : '—'}</td>
                        <td className="mt-td" data-label={t('colAccred')}><AccreditationBadge status={p.accreditationStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RevealOnScroll>
            {total > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={total}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)} />
            )}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
