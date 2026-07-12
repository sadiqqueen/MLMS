import { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../../api/axios';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const box = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
const ACCENT = '#F0892B';

export default function Responses({ eventId, onToast }) {
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [exporting, setExporting] = useState(false);

  const loadAnalytics = useCallback(() => {
    api.get(`/api/event-feedback/events/${eventId}/analytics`, { cache: false })
      .then(r => setAnalytics(r.data?.data || r.data))
      .catch(() => onToast?.('Failed to load analytics', 'error'));
  }, [eventId, onToast]);

  const loadResponses = useCallback((p) => {
    api.get(`/api/event-feedback/events/${eventId}/responses?page=${p}&limit=25`, { cache: false })
      .then(r => setResponses(r.data?.data || r.data))
      .catch(() => onToast?.('Failed to load responses', 'error'))
      .finally(() => setLoading(false));
  }, [eventId, onToast]);

  useEffect(() => { setLoading(true); loadAnalytics(); loadResponses(page); }, [eventId, page, loadAnalytics, loadResponses]);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get(`/api/event-feedback/events/${eventId}/responses/export?format=csv`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `event-${eventId}-responses.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { onToast?.('Export failed', 'error'); }
    finally { setExporting(false); }
  }

  if (loading && !analytics) return <div style={{ ...box, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading results…</div>;

  const ratings = analytics?.ratings || [];
  const rated   = ratings.filter(r => r.average != null);
  const comments = (analytics?.comments || []).filter(c => c.entries?.length);
  const count = analytics?.responseCount || 0;

  const chartData = {
    labels: rated.map(r => (r.label || r.id).slice(0, 26) + ((r.label || '').length > 26 ? '…' : '')),
    datasets: [{ label: 'Average (1–5)', data: rated.map(r => Number(r.average.toFixed(2))), backgroundColor: ACCENT, borderRadius: 4 }],
  };
  const chartOpts = {
    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { x: { min: 0, max: 5, ticks: { stepSize: 1 } }, y: { ticks: { font: { size: 10 } } } },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stat cards + export */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <Stat label="Responses" value={count} />
        <Stat label="Overall average" value={analytics?.overallAverage != null ? analytics.overallAverage.toFixed(2) + ' / 5' : '—'} />
        <div style={{ flex: 1 }} />
        <button className="btn-purple" onClick={exportCsv} disabled={exporting || count === 0} style={{ alignSelf: 'center', opacity: (exporting || count === 0) ? 0.55 : 1 }}>
          {exporting ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {count === 0 && (
        <div style={{ ...box, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>No responses yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Share this event's code or QR — responses appear here instantly.</div>
        </div>
      )}

      {rated.length > 0 && (
        <div style={{ ...box, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-secondary)', marginBottom: 12 }}>Average rating per question</div>
          <div style={{ height: Math.max(160, rated.length * 26) }}>
            <Bar data={chartData} options={chartOpts} />
          </div>
        </div>
      )}

      {comments.length > 0 && (
        <div style={{ ...box, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-secondary)', marginBottom: 12 }}>Comments</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {comments.map(c => (
              <div key={c.id}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{c.label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({c.entries.length})</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.entries.slice(0, 50).map((e, i) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>“{e}”</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Responses table */}
      {responses.items?.length > 0 && (
        <div style={{ ...box, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-secondary)', marginBottom: 12 }}>Individual responses</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>Submitted</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Lang</th><th style={th}>Answers</th>
                </tr>
              </thead>
              <tbody>
                {responses.items.map(r => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={td}>{new Date(r.meta?.submittedAt || r.createdAt).toLocaleString()}</td>
                    <td style={td}>{r.participantName || '—'}</td>
                    <td style={td}>{r.participantEmail || '—'}</td>
                    <td style={td}>{(r.lang || 'en').toUpperCase()}</td>
                    <td style={td}>{Object.keys(r.answers || {}).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {responses.pages > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
              <button style={pgBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Page {responses.page} / {responses.pages}</span>
              <button style={pgBtn} disabled={page >= responses.pages} onClick={() => setPage(p => p + 1)}>Next ›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', color: 'var(--text)' };
const pgBtn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--text)', fontSize: 12 };

function Stat({ label, value }) {
  return (
    <div style={{ ...box, padding: '14px 18px', minWidth: 150 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT, marginTop: 4 }}>{value}</div>
    </div>
  );
}
