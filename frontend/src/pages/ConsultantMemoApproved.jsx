import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { MemoPrefsProvider, useMemoPrefs, fmtDateTime } from '../components/memo/MemoPrefs';
import MemoNavbar from '../components/memo/MemoNavbar';
import MemoPrint from '../components/memo/MemoPrint';
import { useMemoToasts, MemoToasts, MemoModal } from '../components/memo/MemoUi';
import { buildAttachmentPreviews } from '../components/memo/attachmentPreviews';
import Sk from '../components/Skeleton';
import { IconEye, IconPrinter, IconTrash } from '../components/icons';
import './ConsultantMemo.css';

// Read-only "Approved memos" (المذكرات المعتمدة). Approved memos are permanently
// locked server-side (no edit/delete endpoint reaches them) — this page only
// views and prints them, reusing the same MemoPrint component as the builder.
function MemoGridSkeleton() {
  return (
    <div className="cmx-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <article className="cmx-card cmx-card-skel" key={i}>
          <div className="cmx-card-top">
            <Sk w="60%" h={17} />
            <Sk w={54} h={22} r={8} />
          </div>
          <Sk w="45%" h={12} />
          <Sk w="72%" h={11} />
          <Sk w="100%" h={32} r={6} style={{ marginTop: 4 }} />
          <div className="cmx-card-actions">
            <Sk w={108} h={30} r={8} />
            <Sk w={34} h={30} r={8} />
          </div>
        </article>
      ))}
    </div>
  );
}

function MemoApprovedView() {
  const { theme, lang, dir, t } = useMemoPrefs();
  const { user } = useAuth();
  const canDelete = user?.role === 'asg1';   // ASG.1 may delete approved (locked) memos
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const openId = searchParams.get('id');   // deep-link from the builder redirect

  const [memos, setMemos]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState('newest');
  const [viewMemo, setViewMemo]     = useState(null);   // { data, previews }
  const [viewLoading, setViewLoading] = useState(false);
  const [printMemo, setPrintMemo]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);   // approved memo pending delete (ASG.1)
  const { toasts, showToast, dismiss } = useMemoToasts();
  const printingRef  = useRef(false);
  const autoOpenedRef = useRef(false);

  async function load() {
    try {
      const res = await api.get('/api/consultant-memo?status=approved');
      setMemos(res.data);
    } catch {
      showToast(t('actionError'), 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  // Open a memo read-only — fetch the full doc + render its attachment pages.
  async function openView(memo) {
    setViewLoading(true);
    try {
      const full = (await api.get(`/api/consultant-memo/${memo._id}`)).data;
      const previews = await buildAttachmentPreviews(full.attachmentFiles);
      setViewMemo({ data: full, previews });
    } catch {
      showToast(t('actionError'), 'error');
    } finally {
      setViewLoading(false);
    }
  }

  // Deep-link ?id=… (a memo just approved from the builder) → auto-open once.
  useEffect(() => {
    if (autoOpenedRef.current || loading || !openId) return;
    const m = memos.find(x => x._id === openId);
    if (m) { autoOpenedRef.current = true; openView(m); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, openId, memos]);

  // Print directly from a card (same flow as the All-memos page).
  useEffect(() => {
    if (!printMemo || printingRef.current) return;
    printingRef.current = true;
    const cleanup = () => { setPrintMemo(null); printingRef.current = false; };
    window.addEventListener('afterprint', cleanup, { once: true });
    const raf = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(raf); window.removeEventListener('afterprint', cleanup); };
  }, [printMemo]);

  async function printCard(memo) {
    try {
      const full = (await api.get(`/api/consultant-memo/${memo._id}`)).data;
      const previews = await buildAttachmentPreviews(full.attachmentFiles);
      setPrintMemo({ data: full, previews });
    } catch { showToast(t('actionError'), 'error'); }
  }

  // ASG.1-only: permanently delete an approved (locked) memo. The backend
  // enforces the same role check; the confirm dialog guards against accidents.
  async function deleteForever(memo) {
    try {
      await api.delete(`/api/consultant-memo/${memo._id}`);
      setMemos(prev => prev.filter(m => m._id !== memo._id));
      showToast(t('deletedToast'));
    } catch { showToast(t('actionError'), 'error'); }
    setDeleteTarget(null);
  }

  const shown = memos
    .filter(m => !search.trim() || (m.topicName || '').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      const ad = new Date(a.approvedAt || a.createdAt);
      const bd = new Date(b.approvedAt || b.createdAt);
      if (sort === 'oldest') return ad - bd;
      if (sort === 'name')   return (a.topicName || '').localeCompare(b.topicName || '', 'ar');
      return bd - ad;
    });

  return (
    <div className="cmx" data-theme={theme} dir={dir} lang={lang}>
      <div className="cmx-screen">
        <MemoNavbar onNewMemo={() => navigate('/consultant-memo')} />

        <main className="cmx-main">
          <div className="cmx-all-head">
            <h1 className="cmx-all-title">
              {t('approvedMemos')} <span className="cmx-all-count">({t('total')}: {memos.length})</span>
            </h1>
          </div>

          <div className="cmx-all-controls">
            <input
              type="search"
              className="cmx-search"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="cmx-sort-label" htmlFor="cmx-sort">{t('sortLabel')}</label>
            <select id="cmx-sort" className="cmx-sort" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">{t('sortNewest')}</option>
              <option value="oldest">{t('sortOldest')}</option>
              <option value="name">{t('sortByName')}</option>
            </select>
          </div>

          {loading ? (
            <MemoGridSkeleton />
          ) : shown.length === 0 ? (
            <p className="cmx-empty">{t('emptyApproved')}</p>
          ) : (
            <div className="cmx-grid">
              {shown.map(m => (
                // Card content stays Arabic — only UI chrome translates.
                <article className="cmx-card" key={m._id} dir="rtl" lang="ar">
                  <div className="cmx-card-top">
                    <h3 className="cmx-card-title">{m.topicName?.trim() || t('untitled')}</h3>
                    <span className="cmx-pill cmx-pill-green">{t('chipApproved')}</span>
                  </div>
                  <div className="cmx-card-source">{t('councilLabel')}: {m.councilName?.trim() || '—'}</div>
                  <div className="cmx-card-dates">
                    {t('approvedAtLabel')} {fmtDateTime(m.approvedAt, lang)}
                    {m.approvedByName ? ` · ${t('approvedByLabel')} ${m.approvedByName}` : ''}
                  </div>
                  {m.presentationPreview?.trim() && (
                    <p className="cmx-card-preview">{m.presentationPreview}</p>
                  )}
                  <div className="cmx-card-actions" dir={dir}>
                    <button
                      className="cmx-btn cmx-btn-primary cmx-btn-sm"
                      onClick={() => openView(m)}
                      disabled={viewLoading}
                    >
                      <IconEye /> <span>{t('view')}</span>
                    </button>
                    <button
                      className="cmx-btn cmx-btn-outline cmx-btn-sm"
                      aria-label={t('print')}
                      title={t('print')}
                      onClick={() => printCard(m)}
                    >
                      <IconPrinter />
                    </button>
                    {canDelete && (
                      <button
                        className="cmx-btn cmx-btn-danger cmx-btn-sm"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <IconTrash /> <span>{t('deleteForever')}</span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {viewMemo && (
          <MemoModal wide onClose={() => setViewMemo(null)} labelledBy="cmx-view-title">
            <div className="cmx-modal-head">
              <h3 id="cmx-view-title" dir="rtl" lang="ar">{viewMemo.data.topicName?.trim() || t('untitled')}</h3>
              <button className="cmx-btn cmx-btn-outline" onClick={() => setViewMemo(null)}>{t('closePreview')}</button>
            </div>
            <div className="cmx-preview-scroll">
              <MemoPrint memo={viewMemo.data} lang={lang} attachmentPreviews={viewMemo.previews} />
            </div>
          </MemoModal>
        )}

        {deleteTarget && (
          <MemoModal onClose={() => setDeleteTarget(null)} labelledBy="cmx-del-title">
            <h3 id="cmx-del-title" className="cmx-modal-title">{t('deleteConfirmTitle')}</h3>
            <p className="cmx-modal-body">{t('deleteConfirmBody')}</p>
            <div className="cmx-modal-btns">
              <button className="cmx-btn cmx-btn-outline" onClick={() => setDeleteTarget(null)}>{t('cancel')}</button>
              <button className="cmx-btn cmx-btn-danger" onClick={() => deleteForever(deleteTarget)}>{t('deleteYes')}</button>
            </div>
          </MemoModal>
        )}

        <MemoToasts toasts={toasts} dismiss={dismiss} />
      </div>

      {/* Hidden print layout for printing directly from a card */}
      {printMemo && (
        <div className="cmx-print-mount">
          <MemoPrint memo={printMemo.data} lang={lang} attachmentPreviews={printMemo.previews} />
        </div>
      )}
    </div>
  );
}

export default function ConsultantMemoApproved() {
  return (
    <MemoPrefsProvider>
      <MemoApprovedView />
    </MemoPrefsProvider>
  );
}
