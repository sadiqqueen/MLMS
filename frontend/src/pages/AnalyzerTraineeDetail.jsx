// frontend/src/pages/AnalyzerTraineeDetail.jsx
//
// Data Analyzer / Head CS — READ-ONLY trainee card. Opened from the Trainees
// list (eye icon). Shows the trainee's profile plus their rotations, evaluations
// and reports. NO grading, editing or any write affordance (the analyzer suite is
// observe-and-approve only). Backed by GET /api/analyzer/trainees/:id/details
// (guarded by ANALYZER_ROLES, which includes head_cs).
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { IconBack, IconFileText } from '../components/icons';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './Analyzer.css';

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
const nameOf = (...refs) => { for (const r of refs) { if (r && r.name) return r.name; } return '—'; };
const centerName = (o) => o?.hospitalId?.name || o?.hospital?.name || '—';

function statusPill(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'current' || s === 'completed' || s === 'approved' || s === 'graded') return 'mt-pill--active';
  if (s === 'cancelled' || s === 'rejected') return 'mt-pill--rejected';
  if (s === 'pending' || s === 'upcoming') return 'mt-pill--pending';
  return 'mt-pill--neutral';
}

function Section({ title, count, children }) {
  return (
    <section className="mt-card" style={{ padding: 0, marginBlockEnd: 18 }}>
      <div className="mt-card-head" style={{ padding: '14px 18px' }}>
        <div className="mt-card-title">{title}</div>
        <span className="mt-filterbar-spacer" />
        <span className="mt-count">{count.toLocaleString('en-US')}</span>
      </div>
      <div className="mt-table-wrap">{children}</div>
    </section>
  );
}

export default function AnalyzerTraineeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toasts, showToast } = useMtToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const r = await api.get(`/api/analyzer/trainees/${id}/details`, { cache: false });
      setData(r.data?.data || null);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load this trainee.');
    } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function openFile(url) {
    if (!url) return;
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      window.open(blobUrl, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch { showToast('Could not open the file.', 'dng'); }
  }

  const t = data?.trainee;
  const rotations = data?.rotations || [];
  const evaluations = data?.evaluations || [];
  const reports = data?.reports || [];

  const info = t ? [
    ['ID', t.studentId || t.idNumber || '—'],
    ['Specialty', t.specialtyId?.name || '—'],
    ['Program', t.programId?.name || '—'],
    ['Center', centerName(t)],
    ['Country', t.countryId?.name || '—'],
    ['Year', t.trainingYear ? `Year ${t.trainingYear}` : '—'],
    ['Program Director', t.pdId?.name || '—'],
    ['Trainer', nameOf(t.supervisorId, t.supervisor)],
    ['Email', t.email || '—'],
    ['Phone', t.phone || '—'],
  ] : [];

  return (
    <>
      <Navbar title="Trainee" subtitle="Trainee record" />
      <main className="mt-content">
        <button type="button" className="mt-btn--small-outline" style={{ marginBlockEnd: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          onClick={() => navigate('/analyzer/trainees')}>
          <IconBack size={15} /> Back to trainees
        </button>

        {loading ? (
          <div className="skeleton mt-skel mt-skel-table" style={{ height: 320 }} />
        ) : error ? (
          <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>{error}</div>
        ) : !t ? (
          <div className="mt-empty"><div className="mt-empty-title">Trainee not found</div></div>
        ) : (
          <>
            {/* header */}
            <section className="mt-card" style={{ padding: '18px 20px', marginBlockEnd: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBlockEnd: 12 }}>{t.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                {info.map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-2)', marginBlockEnd: 2 }}>{k}</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* rotations */}
            <Section title="Rotations" count={rotations.length}>
              <table className="mt-table mt-table--stack">
                <thead><tr>
                  <th className="mt-th">Center</th><th className="mt-th">Specialty</th><th className="mt-th">Trainer</th>
                  <th className="mt-th">Start</th><th className="mt-th">End</th><th className="mt-th">Status</th><th className="mt-th">Final grade</th>
                </tr></thead>
                <tbody>
                  {rotations.length === 0 && <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 22 }}>No rotations.</td></tr>}
                  {rotations.map(r => (
                    <tr key={r._id}>
                      <td className="mt-td" data-label="Center">{centerName(r)}</td>
                      <td className="mt-td mt-td--muted" data-label="Specialty">{r.specialtyId?.name || '—'}</td>
                      <td className="mt-td mt-td--muted" data-label="Trainer">{nameOf(r.supervisorId, r.doctor)}</td>
                      <td className="mt-td" data-label="Start">{fmtDate(r.startDate)}</td>
                      <td className="mt-td" data-label="End">{fmtDate(r.endDate)}</td>
                      <td className="mt-td" data-label="Status"><span className={`mt-pill ${statusPill(r.status)}`}>{r.status || '—'}</span></td>
                      <td className="mt-td" data-label="Final grade">{r.finalGrade ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* evaluations */}
            <Section title="Evaluations" count={evaluations.length}>
              <table className="mt-table mt-table--stack">
                <thead><tr>
                  <th className="mt-th">Date</th><th className="mt-th">Evaluator</th><th className="mt-th">Grade</th>
                  <th className="mt-th">Score</th><th className="mt-th">Status</th>
                </tr></thead>
                <tbody>
                  {evaluations.length === 0 && <tr><td className="mt-td mt-td--muted" colSpan={5} style={{ textAlign: 'center', padding: 22 }}>No evaluations.</td></tr>}
                  {evaluations.map(e => (
                    <tr key={e._id}>
                      <td className="mt-td" data-label="Date">{fmtDate(e.date || e.createdAt)}</td>
                      <td className="mt-td mt-td--muted" data-label="Evaluator">{nameOf(e.doctor, e.supervisorId, e.evaluatorId, e.createdBy)}</td>
                      <td className="mt-td" data-label="Grade">{e.grade ?? '—'}</td>
                      <td className="mt-td" data-label="Score">{e.totalScore ?? '—'}</td>
                      <td className="mt-td" data-label="Status"><span className={`mt-pill ${(e.isFinalized || e.status === 'completed') ? 'mt-pill--active' : 'mt-pill--pending'}`}>{(e.isFinalized || e.status === 'completed') ? 'Finalized' : 'Pending'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* reports */}
            <Section title="Reports" count={reports.length}>
              <table className="mt-table mt-table--stack">
                <thead><tr>
                  <th className="mt-th">Date</th><th className="mt-th">Type</th><th className="mt-th">Grade</th>
                  <th className="mt-th">Status</th><th className="mt-th">Graded by</th><th className="mt-th">File</th>
                </tr></thead>
                <tbody>
                  {reports.length === 0 && <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign: 'center', padding: 22 }}>No reports.</td></tr>}
                  {reports.map(r => (
                    <tr key={r._id}>
                      <td className="mt-td" data-label="Date">{fmtDate(r.date || r.createdAt)}</td>
                      <td className="mt-td" data-label="Type"><span className="mt-pill mt-pill--neutral" style={{ textTransform: 'capitalize' }}>{r.type || '—'}</span></td>
                      <td className="mt-td" data-label="Grade">{r.grade ?? r.score ?? '—'}</td>
                      <td className="mt-td" data-label="Status"><span className={`mt-pill ${statusPill(r.status)}`}>{r.status || '—'}</span></td>
                      <td className="mt-td mt-td--muted" data-label="Graded by">{r.gradedBy?.name || '—'}</td>
                      <td className="mt-td" data-label="File">
                        {r.fileUrl
                          ? <button type="button" className="mt-btn--small-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => openFile(r.fileUrl)}><IconFileText size={14} /> Open</button>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
