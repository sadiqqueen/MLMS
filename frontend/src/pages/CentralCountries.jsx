// frontend/src/pages/CentralCountries.jsx
//
// Central Secretary — Countries (read-only catalogue). The CS has no country
// mutation endpoint, so this is a browse view. The per-country Centers / Programs
// / Trainees columns are derived client-side from the scoped list endpoints
// (the API serves no per-country aggregate) — real counts, never fabricated
// (RULINGS §34).
// Contract: GET /api/central/countries , /central/centers , /central/programs ,
//           /central/trainees.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './central.css';

const PAGE_SIZE = 8;

const STRINGS = {
  ar: {
    title: 'الدول', sub: 'السكرتير المركزي',
    count: n => `${n} دولة`,
    country: 'الدولة', code: 'الرمز', centers: 'المراكز', programs: 'البرامج', trainees: 'المتدربون',
    none: 'لا توجد دول في نطاقك.', loadFailed: 'فشل تحميل الدول', na: '—',
  },
  en: {
    title: 'Countries', sub: 'Central Secretary',
    count: n => `${n} countr${n === 1 ? 'y' : 'ies'}`,
    country: 'Country', code: 'Code', centers: 'Centers', programs: 'Programs', trainees: 'Trainees',
    none: 'No countries in your scope yet.', loadFailed: 'Failed to load countries', na: '—',
  },
};

function idOf(v) { return v?._id || v || ''; }

function ListSkeleton() {
  return (
    <div>
      <div className="mt-filterbar">
        <div className="skeleton" style={{ height: 20, width: 120, borderRadius: 6 }} />
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
    </div>
  );
}

export default function CentralCountries() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [countries, setCountries] = useState([]);
  const [centers, setCenters] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [coRes, ceRes, pRes, trRes] = await Promise.allSettled([
      api.get('/api/central/countries'),
      api.get('/api/central/centers'),
      api.get('/api/central/programs'),
      api.get('/api/central/trainees'),
    ]);
    if (coRes.status === 'fulfilled') setCountries(coRes.value.data?.data || coRes.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (ceRes.status === 'fulfilled') setCenters(ceRes.value.data?.data || ceRes.value.data || []);
    if (pRes.status === 'fulfilled') setPrograms(pRes.value.data?.data || pRes.value.data || []);
    if (trRes.status === 'fulfilled') setTrainees(trRes.value.data?.data || trRes.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // centerId -> countryId, so a program can be attributed to its center's country.
  const centerCountry = useMemo(() => {
    const m = {};
    centers.forEach(c => { m[c._id] = idOf(c.countryId); });
    return m;
  }, [centers]);

  const rows = useMemo(() => {
    const centersByCountry = {};
    centers.forEach(c => { const k = idOf(c.countryId); centersByCountry[k] = (centersByCountry[k] || 0) + 1; });
    const programsByCountry = {};
    programs.forEach(p => { const k = centerCountry[idOf(p.trainingCenterId)]; if (k) programsByCountry[k] = (programsByCountry[k] || 0) + 1; });
    const traineesByCountry = {};
    trainees.forEach(tr => { const k = idOf(tr.countryId); if (k) traineesByCountry[k] = (traineesByCountry[k] || 0) + 1; });
    return countries
      .map(co => ({
        ...co,
        _centers: centersByCountry[co._id] || 0,
        _programs: programsByCountry[co._id] || 0,
        _trainees: traineesByCountry[co._id] || 0,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [countries, centers, programs, trainees, centerCountry]);

  const pageItems = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Navbar title={t('title')} subtitle={t('sub')} />
      <main className="mt-content" dir={dir}>
        {loading ? <ListSkeleton /> : (
          <>
            <div className="mt-filterbar">
              <span className="mt-filterbar-spacer" />
              <span className="mt-count">{t('count')(rows.length)}</span>
            </div>

            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('country')}</th>
                      <th className="mt-th">{t('code')}</th>
                      <th className="mt-th">{t('centers')}</th>
                      <th className="mt-th">{t('programs')}</th>
                      <th className="mt-th">{t('trainees')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 && (
                      <tr>
                        <td className="mt-td" colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-2)' }}>
                          {t('none')}
                        </td>
                      </tr>
                    )}
                    {pageItems.map(co => (
                      <tr key={co._id}>
                        <td className="mt-td mt-td--name">{co.name}</td>
                        <td className="mt-td mt-td--mono">{co.code || t('na')}</td>
                        <td className="mt-td" style={{ fontVariantNumeric: 'tabular-nums' }}>{co._centers}</td>
                        <td className="mt-td" style={{ fontVariantNumeric: 'tabular-nums' }}>{co._programs}</td>
                        <td className="mt-td" style={{ fontVariantNumeric: 'tabular-nums' }}>{co._trainees}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {rows.length > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)} />
            )}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
