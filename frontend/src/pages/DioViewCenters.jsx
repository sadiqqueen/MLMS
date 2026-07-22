// frontend/src/pages/DioViewCenters.jsx
//
// DIO / Sub-DIO training-center oversight — restyled to the mt- design
// (dashboards.md §4.8 · lists_views "DIO › training-centers"). A navy-header
// table of the caller's assigned centers; each row expands to reveal that
// center's programs with accreditation status. Fully read-only (RULINGS §43).
// Contract: GET /api/dio-view/centers →
//   [{ ...center, idNumber, city, accreditationStatus, countryId, traineesCount?,
//      programs: [{ ...program, specialtyId:{name}, programDirectorId:{name},
//                   accreditationType, accreditationStatus }] }]
// `traineesCount` is additive (Fable fix-wave / analyzer batch convention); the
// Trainees column renders "—" until the backend supplies it.
import { useState, useEffect, Fragment } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccreditationBadge from '../components/AccreditationBadge';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconCaret, IconBuilding } from '../components/icons';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './dioview.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    search: 'ابحث باسم المركز…', count: (n) => `${n} مركز`,
    colCenter: 'المركز', colId: 'المعرف', colCity: 'المدينة', colPrograms: 'البرامج', colTrainees: 'المتدربون', colStatus: 'الاعتماد',
    pName: 'البرنامج', pSpecialty: 'الاختصاص', pPd: 'مدير البرنامج', pStatus: 'الاعتماد',
    noPrograms: 'لا توجد برامج في هذا المركز.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', noCentersSub: 'ستظهر مراكزك التدريبية هنا بمجرد إسنادها.',
    noMatch: 'لا توجد مراكز مطابقة.', noMatchSub: 'جرّب تعديل البحث.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by center name…', count: (n) => `${n} centers`,
    colCenter: 'Center', colId: 'ID', colCity: 'City', colPrograms: 'Programs', colStatus: 'Accreditation',
    pName: 'Program', pSpecialty: 'Specialty', pPd: 'Program Director', pStatus: 'Accreditation',
    noPrograms: 'No programs in this center.',
    noCenters: 'No centers are assigned to your account yet.', noCentersSub: 'Your training centers appear here once assigned.',
    noMatch: 'No centers match.', noMatchSub: 'Try adjusting your search.', loadFailed: 'Failed to load',
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

function ProgramsPanel({ center, t }) {
  const programs = center.programs || [];
  if (programs.length === 0) return <div className="dioview-pempty">{t('noPrograms')}</div>;
  return (
    <div className="dioview-plist">
      <div className="dioview-phead">
        <span>{t('pName')}</span><span>{t('pSpecialty')}</span><span>{t('pPd')}</span><span>{t('pStatus')}</span>
      </div>
      {programs.map((p) => (
        <div className="dioview-prow" key={p._id}>
          <span className="dioview-pname" title={p.name}>{p.name}</span>
          <span className="dioview-pmuted" title={specialtyName(p.specialtyId)}>{specialtyName(p.specialtyId)}</span>
          <span className="dioview-pmuted" title={refName(p.programDirectorId)}>{refName(p.programDirectorId)}</span>
          <span><AccreditationBadge status={p.accreditationStatus} /></span>
        </div>
      ))}
    </div>
  );
}

export default function DioViewCenters() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    api.get('/api/dio-view/centers')
      .then((r) => setCenters(r.data?.data || r.data || []))
      .catch((err) => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed'), 'dng'); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search]);

  function toggle(id) { setExpanded((e) => ({ ...e, [id]: !e[id] })); }

  const filtered = centers.filter((c) => {
    const q = search.trim().toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q);
  });
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (noCenters) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">{t('noCenters')}</div>
            <div className="mt-empty-sub">{t('noCentersSub')}</div>
          </div>
          <MtToastHost toasts={toasts} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
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
            <div style={{ display: 'grid', gap: 10, padding: 16 }}>
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 26, borderRadius: 6 }} />)}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">{centers.length === 0 ? t('noCenters') : t('noMatch')}</div>
            <div className="mt-empty-sub">{centers.length === 0 ? t('noCentersSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('colCenter')}</th>
                      <th className="mt-th">{t('colId')}</th>
                      <th className="mt-th">{t('colCity')}</th>
                      <th className="mt-th">{t('colPrograms')}</th>
                      <th className="mt-th">{t('colTrainees')}</th>
                      <th className="mt-th">{t('colStatus')}</th>
                      <th className="mt-th" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => {
                      const isOpen = !!expanded[c._id];
                      const nPrograms = (c.programs || []).length;
                      return (
                        <Fragment key={c._id}>
                          <tr
                            className="dioview-crow"
                            onClick={() => toggle(c._id)}
                            aria-expanded={isOpen}
                          >
                            <td className="mt-td mt-td--name">{c.name}</td>
                            <td className="mt-td mt-td--mono">{c.idNumber || '—'}</td>
                            <td className="mt-td">{c.city || '—'}</td>
                            <td className="mt-td"><span className="mt-pill mt-pill--neutral">{nPrograms}</span></td>
                            <td className="mt-td">{c.traineesCount ?? '—'}</td>
                            <td className="mt-td"><AccreditationBadge status={c.accreditationStatus} /></td>
                            <td className="mt-td mt-td--actions" style={{ textAlign: 'end' }}>
                              <button
                                type="button"
                                className={'dioview-caret' + (isOpen ? ' is-open' : '')}
                                onClick={(e) => { e.stopPropagation(); toggle(c._id); }}
                                aria-expanded={isOpen}
                                aria-label={c.name}
                              >
                                <IconCaret size={16} />
                              </button>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr>
                              <td className="dioview-detail-cell" colSpan={7}>
                                <ProgramsPanel center={c} t={t} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
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
