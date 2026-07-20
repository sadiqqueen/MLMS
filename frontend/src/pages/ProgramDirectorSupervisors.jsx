// frontend/src/pages/ProgramDirectorSupervisors.jsx
//
// PD supervisors roster — UN-ROUTED LEGACY: the redesigned PD nav swaps
// "Supervisors" → "Log Book" (roles.js), so this page has no nav link. The route
// stays in App.jsx (no feature removal, RULINGS §B13/§D21), so it is given a
// LIGHT mt- port here purely so a direct URL still renders inside the new shell.
// Read-only (the /supervisors endpoint is GET only); the "Trainer" label is not
// used. Not a design screen — kept minimal.
//   GET /api/program-director/supervisors → supervisors (+ traineeCount)
//   GET /api/program-director/trainees     → for the per-supervisor drill
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import MtSkeleton from '../components/MtSkeleton';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './pd.css';

function textValue(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.title || fallback;
  return fallback;
}
function idOf(v) { return v?._id || v || ''; }
function initialsOf(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

const STRINGS = {
  ar: {
    supervisors: 'المشرفون', assigned: 'المتدربون المسندون', searchPh: 'ابحث بالاسم أو الاختصاص أو القسم…',
    colName: 'المشرف', colSpecialty: 'الاختصاص', colDept: 'القسم', colPhone: 'الهاتف', colTrainees: 'المتدربون', colAction: 'الإجراء',
    view: 'عرض', close: 'إغلاق', specialty: 'الاختصاص', department: 'القسم', phone: 'الهاتف', city: 'المدينة', hospital: 'المركز', assignedTrainees: 'المتدربون المسندون',
    traineesOf: (n) => `المتدربون (${n})`, noTrainees: 'لا يوجد متدربون مسندون لهذا المشرف.', empty: 'لا يوجد مشرفون في اختصاصك بعد.', noMatch: 'لا يوجد تطابق مع بحثك.', loadFailed: 'فشل التحميل',
  },
  en: {
    supervisors: 'Supervisors', assigned: 'Assigned trainees', searchPh: 'Search by name, specialty, or department…',
    colName: 'Supervisor', colSpecialty: 'Specialty', colDept: 'Department', colPhone: 'Phone', colTrainees: 'Trainees', colAction: 'Action',
    view: 'View', close: 'Close', specialty: 'Specialty', department: 'Department', phone: 'Phone', city: 'City', hospital: 'Center', assignedTrainees: 'Assigned trainees',
    traineesOf: (n) => `Trainees (${n})`, noTrainees: 'No trainees assigned to this supervisor.', empty: 'No supervisors in your specialty yet.', noMatch: 'No match for your search.', loadFailed: 'Failed to load',
  },
};

function SupervisorDetail({ supervisor, trainees, onClose, t }) {
  return (
    <MtModal
      open
      title={supervisor.name}
      sub={supervisor.email || ''}
      meta={textValue(supervisor.specialtyId || supervisor.specialty, '')}
      onClose={onClose}
      footer={<button type="button" className="mt-btn--cancel" onClick={onClose}>{t('close')}</button>}
    >
      <div className="pd-detail-kv">
        {[
          [t('specialty'), textValue(supervisor.specialtyId || supervisor.specialty)],
          [t('department'), supervisor.department || '—'],
          [t('phone'), supervisor.phone || '—'],
          [t('city'), supervisor.city || '—'],
          [t('hospital'), supervisor.hospitalId?.name || supervisor.hospital?.name || '—'],
          [t('assignedTrainees'), supervisor.traineeCount ?? '—'],
        ].map(([k, v]) => (<div key={k}><div className="pd-detail-k">{k}</div><div className="pd-detail-v">{String(v)}</div></div>))}
      </div>

      <div className="pd-detail-title">{t('traineesOf')(trainees.length)}</div>
      {trainees.length === 0 ? <div className="pd-detail-empty">{t('noTrainees')}</div> : trainees.map((tr) => (
        <div key={tr._id} className="pd-detail-link">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span className="pd-sign-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initialsOf(tr.name)}</span>
            <div style={{ minWidth: 0 }}>
              <div className="pd-detail-v" style={{ fontWeight: 600 }}>{tr.name}</div>
              {(tr.studentId || tr.idNumber) && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{tr.studentId || tr.idNumber}</div>}
            </div>
          </div>
        </div>
      ))}
    </MtModal>
  );
}

export default function ProgramDirectorSupervisors() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [supervisors, setSupervisors] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/api/program-director/supervisors')
      .then((r) => { const list = r.data?.data || r.data || []; setSupervisors(Array.isArray(list) ? list : []); })
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
    api.get('/api/program-director/trainees')
      .then((r) => { const list = r.data?.data?.trainees || r.data?.trainees || []; setTrainees(Array.isArray(list) ? list : []); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function traineesForSupervisor(s) {
    if (!s) return [];
    return trainees.filter((tr) => idOf(tr.supervisorId) === s._id);
  }

  const filtered = supervisors.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.name?.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q)
      || textValue(s.specialtyId || s.specialty, '').toLowerCase().includes(q) || (s.department || '').toLowerCase().includes(q);
  });
  const totalTrainees = supervisors.reduce((sum, sv) => sum + (sv.traineeCount || 0), 0);

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content"><MtSkeleton stats={2} charts={0} table /></main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-stat-grid">
          <RevealOnScroll><StatCard label={t('supervisors')} value={supervisors.length} icon="users" /></RevealOnScroll>
          <RevealOnScroll delay={0.055}><StatCard label={t('assigned')} value={totalTrainees} icon="grad" /></RevealOnScroll>
        </div>

        <div className="mt-filterbar" style={{ marginBlockStart: 16 }}>
          <span className="mt-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPh')} aria-label={t('searchPh')} />
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-empty" style={{ padding: 48 }}>
            <div className="mt-empty-title">{supervisors.length === 0 ? t('empty') : t('noMatch')}</div>
          </div>
        ) : (
          <RevealOnScroll className="mt-card" style={{ padding: 0 }}>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('colName')}</th>
                    <th className="mt-th">{t('colSpecialty')}</th>
                    <th className="mt-th">{t('colDept')}</th>
                    <th className="mt-th">{t('colPhone')}</th>
                    <th className="mt-th">{t('colTrainees')}</th>
                    <th className="mt-th">{t('colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s._id}>
                      <td className="mt-td mt-td--name" data-label={t('colName')}>
                        {s.name}
                        {s.email && <div className="mt-td--muted" style={{ padding: 0, fontSize: 11 }}>{s.email}</div>}
                      </td>
                      <td className="mt-td" data-label={t('colSpecialty')}><span className="mt-pill mt-pill--capacity">{textValue(s.specialtyId || s.specialty)}</span></td>
                      <td className="mt-td mt-td--muted" data-label={t('colDept')}>{s.department || '—'}</td>
                      <td className="mt-td mt-td--muted" data-label={t('colPhone')}>{s.phone || '—'}</td>
                      <td className="mt-td" data-label={t('colTrainees')}>{s.traineeCount || 0}</td>
                      <td className="mt-td mt-td--actions" data-label={t('colAction')}>
                        <button type="button" className="mt-btn mt-btn--small-outline" onClick={() => setSelected(s)}>{t('view')}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </RevealOnScroll>
        )}

        {selected && <SupervisorDetail supervisor={selected} trainees={traineesForSupervisor(selected)} onClose={() => setSelected(null)} t={t} />}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
