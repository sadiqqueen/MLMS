// Head AD — Permissions inbox. Head AD's ONE actionable screen (every other
// registry page it sees is read-only). It reviews the data-entry clerk's edit &
// delete requests: before→after diff, attached book-of-changes PDF, then Approve
// (applies immediately) or Reject (review note REQUIRED). Mirror of the analyzer
// Pending-Changes inbox, retargeted to the head-ad pipeline. Contracts:
//   GET   /api/head-ad/change-requests?status=pending|approved|rejected
//   PATCH /api/head-ad/change-requests/:id/approve { note? }
//   PATCH /api/head-ad/change-requests/:id/reject  { note* }   (400 if missing)
import { useEffect, useRef, useState } from 'react';
import { usePrefs } from '../context/PrefsContext';
import { roleLabel } from '../config/roles';
import Navbar from '../components/Navbar';
import DiffTable from '../components/DiffTable';
import RevealOnScroll from '../components/RevealOnScroll';
import { IconInbox, IconFileText } from '../components/icons';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import {
  SearchBox, FilterSelect, ListSkeleton, EmptyState,
  fmtDate, fmtSize, initialsOf, reqId,
} from './AnalyzerListKit';
import './Analyzer.css';

const STATUS_OPTS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function RegistryPermissions() {
  const { lang } = usePrefs();
  const { toasts, showToast } = useMtToast();

  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});          // { crId: reviewNote }
  const [busy, setBusy] = useState({});             // { crId: true }
  const noteRefs = useRef({});

  async function load(isFirst) {
    if (isFirst) setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/head-ad/change-requests', { params: { status }, cache: false });
      setItems(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load pending changes.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, [status]);

  const setNote = (id, v) => setNotes((n) => ({ ...n, [id]: v }));
  const setCardBusy = (id, v) => setBusy((b) => ({ ...b, [id]: v }));

  async function approve(cr) {
    setCardBusy(cr._id, true);
    try {
      const note = (notes[cr._id] || '').trim();
      await api.patch(`/api/head-ad/change-requests/${cr._id}/approve`, note ? { note } : {});
      showToast(`Approved — changes applied to ${cr.targetLabel || 'the record'}`, 'ok');
      setItems((list) => list.filter((x) => x._id !== cr._id));
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not apply this change.', 'dng');
    } finally {
      setCardBusy(cr._id, false);
    }
  }

  async function reject(cr) {
    const note = (notes[cr._id] || '').trim();
    if (!note) {
      showToast('A review note is required to reject.', 'warn');
      noteRefs.current[cr._id]?.focus();
      return;
    }
    setCardBusy(cr._id, true);
    try {
      await api.patch(`/api/head-ad/change-requests/${cr._id}/reject`, { note });
      showToast(`Rejected — returned to ${cr.requestedBy?.name || 'the requester'} with your note`, 'dng');
      setItems((list) => list.filter((x) => x._id !== cr._id));
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not reject this request.', 'dng');
    } finally {
      setCardBusy(cr._id, false);
    }
  }

  async function openPdf(pdf, download) {
    if (!pdf?.fileUrl) return;
    try {
      const url = pdf.fileUrl + (download ? `?dl=${encodeURIComponent(pdf.fileName || '')}` : '');
      const res = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(res.data);
      if (download) {
        const a = document.createElement('a');
        a.href = blobUrl; a.download = pdf.fileName || 'book-of-changes.pdf';
        document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(blobUrl, '_blank', 'noopener');
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      showToast('Could not open the PDF.', 'dng');
    }
  }

  const q = search.trim().toLowerCase();
  const visible = q
    ? items.filter((cr) => [cr.targetLabel, cr.requestedBy?.name].some((s) => String(s || '').toLowerCase().includes(q)))
    : items;

  const diffRows = (cr) => (cr.display || []).map((d) => ({ field: d.label, before: d.from, after: d.to }));

  return (
    <>
      <Navbar title="Permissions" subtitle="Head AD" />
      <main className="mt-content">
        <div className="mt-filterbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search requester or target…" />
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTS} />
          <span className="mt-filterbar-spacer" />
          <span className="mt-count">
            {visible.length.toLocaleString('en-US')} {status} {visible.length === 1 ? 'request' : 'requests'}
          </span>
        </div>

        {status === 'pending' && (
          <div className="mt-banner" style={{ maxWidth: 920 }}>
            Approving a request applies the changes immediately and stamps the record's change history.
            Rejections require a review note.
          </div>
        )}

        {error && (
          <div className="mt-banner" style={{ maxWidth: 920, background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ maxWidth: 920 }}><ListSkeleton /></div>
        ) : visible.length === 0 ? (
          <div style={{ maxWidth: 920 }}>
            <EmptyState icon={<IconInbox size={22} />}
              title={status === 'pending' ? 'Inbox zero — no pending changes' : `No ${status} requests`}
              sub={status === 'pending' ? 'New data-entry clerk edit & delete requests will appear here for review.' : 'Reviewed requests appear here.'} />
          </div>
        ) : (
          <div className="mt-az-inbox">
            {visible.map((cr, i) => {
              const pdf = cr.bookOfChangesPdf;
              const rows = diffRows(cr);
              const isDelete = cr.requestType === 'delete';
              const decided = cr.status !== 'pending';
              return (
                <RevealOnScroll key={cr._id} delay={i * 0.09} className="mt-az-req">
                  {/* header */}
                  <div className="mt-az-req-head">
                    <div className="mt-az-avatar">{initialsOf(cr.requestedBy?.name)}</div>
                    <div className="mt-az-who">
                      <div className="mt-az-who-name">{cr.requestedBy?.name || 'Unknown requester'}</div>
                      <div className="mt-az-who-sub">
                        {roleLabel(cr.requestedBy?.role, lang) || cr.requestedBy?.role} · {fmtDate(cr.createdAt)} · {reqId(cr._id)}
                      </div>
                    </div>
                    <div className="mt-az-head-spacer" />
                    <span className={`mt-pill ${cr.status === 'approved' ? 'mt-pill--active' : cr.status === 'rejected' ? 'mt-pill--rejected' : 'mt-pill--pending'}`}>
                      {cr.status === 'pending' ? 'Pending review' : cr.status === 'approved' ? 'Approved' : 'Rejected'}
                    </span>
                  </div>

                  {/* target */}
                  <div className="mt-az-req-target">
                    Target · <b>{cr.targetLabel || '—'}</b>{isDelete ? ' · deletion requested' : ''}
                  </div>

                  {/* diff (edits) */}
                  {rows.length > 0 && (
                    <div className="mt-az-req-diff"><DiffTable rows={rows} /></div>
                  )}
                  {isDelete && rows.length === 0 && (
                    <div className="mt-az-req-target" style={{ paddingBlockStart: 0 }}>
                      This request removes the record from the registry.
                    </div>
                  )}

                  {/* PDF strip */}
                  {pdf?.fileName && (
                    <div className="mt-az-pdf">
                      <div className="mt-az-pdf-ic"><IconFileText size={18} /></div>
                      <div className="mt-az-pdf-meta">
                        <div className="mt-az-pdf-name">{pdf.fileName}</div>
                        <div className="mt-az-pdf-sub">{fmtSize(pdf.sizeBytes)} · uploaded with request</div>
                      </div>
                      <div className="mt-az-pdf-actions">
                        <button type="button" className="mt-btn--small-outline" onClick={() => openPdf(pdf, false)}>Preview</button>
                        <button type="button" className="mt-btn--small-outline" onClick={() => openPdf(pdf, true)}>Download</button>
                      </div>
                    </div>
                  )}

                  {/* footer: actions (pending) or decision (decided) */}
                  {decided ? (
                    <div className="mt-az-req-decided">
                      <span className="mt-count">
                        {cr.status === 'approved' ? 'Approved' : 'Rejected'}
                        {cr.reviewedAt ? ` · ${fmtDate(cr.reviewedAt)}` : ''}
                        {cr.reviewNote ? ` · Note: ${cr.reviewNote}` : ''}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-az-req-foot">
                      <input
                        ref={(el) => { noteRefs.current[cr._id] = el; }}
                        className="mt-input mt-az-note"
                        placeholder="Review note — required on reject…"
                        value={notes[cr._id] || ''}
                        onChange={(e) => setNote(cr._id, e.target.value)}
                        aria-label="Review note"
                      />
                      <button type="button" className="mt-btn" disabled={busy[cr._id]} onClick={() => approve(cr)}>Approve</button>
                      <button type="button" className="mt-btn--danger" disabled={busy[cr._id]} onClick={() => reject(cr)}>Reject</button>
                    </div>
                  )}
                </RevealOnScroll>
              );
            })}
          </div>
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
