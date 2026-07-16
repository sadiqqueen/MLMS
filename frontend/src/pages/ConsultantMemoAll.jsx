import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { MemoPrefsProvider, useMemoPrefs, fmtDateTime } from '../components/memo/MemoPrefs';
import MemoNavbar from '../components/memo/MemoNavbar';
import MemoPrint from '../components/memo/MemoPrint';
import { useMemoToasts, MemoToasts, MemoModal } from '../components/memo/MemoUi';
import { buildAttachmentPreviews } from '../components/memo/attachmentPreviews';
import { waitForPrintAssets } from '../components/memo/printMemo';
import Sk from '../components/Skeleton';
import { IconPencil, IconPrinter, IconCopy, IconRestore } from '../components/icons';
import './ConsultantMemo.css';

// Skeleton grid — shows the card structure while the memos load.
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
            <Sk w={34} h={30} r={8} />
          </div>
        </article>
      ))}
    </div>
  );
}

const CONTENT_FIELDS = [
  'topicName', 'source', 'topicDateTime', 'attachments', 'attachmentFiles', 'attachmentsDateTime',
  'presentation', 'presentationDateTime', 'executiveCommittee', 'executiveCommitteeDateTime',
  'presidentRecommendation', 'presidentRecommendationDateTime', 'jointCouncil', 'jointCouncilDateTime',
];

function MemoAllView() {
  const { theme, lang, dir, t } = useMemoPrefs();
  const navigate = useNavigate();
  const [memos, setMemos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('newest');
  const [chip, setChip]     = useState('saved');
  const [confirmTarget, setConfirmTarget] = useState(null);  // memo pending permanent delete
  const [printMemo, setPrintMemo] = useState(null);
  const { toasts, showToast, dismiss } = useMemoToasts();
  const printingRef = useRef(false);

  async function load() {
    try {
      const res = await api.get('/api/consultant-memo');
      setMemos(res.data);
    } catch {
      showToast(t('actionError'), 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  // Print directly from a card: fetch the full doc, render the hidden print
  // container, wait for its images (logo, watermark, attachment pages) + fonts
  // to paint — else mobile Chrome prints blank pages — then print and clear.
  useEffect(() => {
    if (!printMemo || printingRef.current) return;
    printingRef.current = true;
    let cancelled = false;
    const cleanup = () => { setPrintMemo(null); printingRef.current = false; };
    window.addEventListener('afterprint', cleanup, { once: true });
    waitForPrintAssets(document.querySelector('.cmx-print-mount')).then(() => {
      if (!cancelled) window.print();
    });
    return () => { cancelled = true; window.removeEventListener('afterprint', cleanup); };
  }, [printMemo]);

  const savedCount = memos.filter(m => m.status === 'saved').length;
  const draftCount = memos.filter(m => m.status === 'draft').length;

  const shown = memos
    .filter(m => m.status === chip)
    .filter(m => !search.trim() || (m.topicName || '').toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sort === 'name')   return (a.topicName || '').localeCompare(b.topicName || '', 'ar');
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // ── Actions ───────────────────────────────────────────────────────────
  const setStatusLocal = (id, status, movedToDraftAt = null) =>
    setMemos(prev => prev.map(m => m._id === id ? { ...m, status, movedToDraftAt } : m));

  async function moveToDraft(memo) {
    try {
      const res = await api.put(`/api/consultant-memo/${memo._id}`, { status: 'draft' });
      setStatusLocal(memo._id, 'draft', res.data.movedToDraftAt);
      showToast(t('movedToast'), 'success', {
        label: t('undo'),
        onClick: () => restore(memo, true),
      });
    } catch { showToast(t('actionError'), 'error'); }
  }

  async function restore(memo, silent = false) {
    try {
      await api.put(`/api/consultant-memo/${memo._id}`, { status: 'saved' });
      setStatusLocal(memo._id, 'saved', null);
      if (!silent) showToast(t('restoredToast'));
    } catch { showToast(t('actionError'), 'error'); }
  }

  async function deleteForever(memo) {
    try {
      await api.delete(`/api/consultant-memo/${memo._id}`);
      setMemos(prev => prev.filter(m => m._id !== memo._id));
      showToast(t('deletedToast'));
    } catch { showToast(t('actionError'), 'error'); }
    setConfirmTarget(null);
  }

  async function duplicate(memo) {
    try {
      const full = (await api.get(`/api/consultant-memo/${memo._id}`)).data;
      const copy = {};
      CONTENT_FIELDS.forEach(k => { copy[k] = full[k]; });
      copy.status = 'saved';
      await api.post('/api/consultant-memo', copy);
      showToast(t('duplicatedToast'));
      load();
    } catch { showToast(t('actionError'), 'error'); }
  }

  async function printCard(memo) {
    try {
      const full = (await api.get(`/api/consultant-memo/${memo._id}`)).data;
      // render the uploaded attachments' pages BEFORE opening the print dialog
      const previews = await buildAttachmentPreviews(full.attachmentFiles);
      setPrintMemo({ data: full, previews });
    } catch { showToast(t('actionError'), 'error'); }
  }

  return (
    <div className="cmx" data-theme={theme} dir={dir} lang={lang}>
      <div className="cmx-screen">
        <MemoNavbar onNewMemo={() => navigate('/consultant-memo')} />

        <main className="cmx-main">
          <div className="cmx-all-head">
            <h1 className="cmx-all-title">
              {t('allMemos')} <span className="cmx-all-count">({t('total')}: {memos.length})</span>
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
            <div className="cmx-chips" role="group" aria-label={t('sortLabel')}>
              <button
                className={'cmx-chip' + (chip === 'saved' ? ' active' : '')}
                aria-pressed={chip === 'saved'}
                onClick={() => setChip('saved')}
              >{t('chipSaved')} ({savedCount})</button>
              <button
                className={'cmx-chip' + (chip === 'draft' ? ' active' : '')}
                aria-pressed={chip === 'draft'}
                onClick={() => setChip('draft')}
              >{t('chipDraft')} ({draftCount})</button>
            </div>
          </div>

          {loading ? (
            <MemoGridSkeleton />
          ) : shown.length === 0 ? (
            <p className="cmx-empty">{chip === 'saved' ? t('emptySaved') : t('emptyDraft')}</p>
          ) : (
            <div className="cmx-grid">
              {shown.map(m => (
                // Card content (titles/previews) intentionally stays in its
                // original language — only UI chrome translates.
                <article className="cmx-card" key={m._id} dir="rtl" lang="ar">
                  <div className="cmx-card-top">
                    <h3 className="cmx-card-title">{m.topicName?.trim() || t('untitled')}</h3>
                    <span className={'cmx-pill ' + (m.status === 'saved' ? 'cmx-pill-green' : 'cmx-pill-amber')}>
                      {m.status === 'saved' ? t('chipSaved') : t('chipDraft')}
                    </span>
                  </div>
                  <div className="cmx-card-source">{t('councilLabel')}: {m.councilName?.trim() || '—'}</div>
                  <div className="cmx-card-dates">
                    {m.status === 'draft' && m.movedToDraftAt
                      ? `${t('movedToDraftAt')} ${fmtDateTime(m.movedToDraftAt, lang)}`
                      : `${t('created')} ${fmtDateTime(m.createdAt, lang)} · ${t('modified')} ${fmtDateTime(m.updatedAt, lang)}`}
                  </div>
                  {m.presentationPreview?.trim() && (
                    <p className="cmx-card-preview">{m.presentationPreview}</p>
                  )}
                  <div className="cmx-card-actions" dir={dir}>
                    <button
                      className="cmx-btn cmx-btn-primary cmx-btn-sm"
                      onClick={() => navigate(`/consultant-memo?id=${m._id}`)}
                    >
                      <IconPencil /> <span>{m.status === 'saved' ? t('openEdit') : t('open')}</span>
                    </button>
                    <button className="cmx-btn cmx-btn-outline cmx-btn-sm" aria-label={t('print')} title={t('print')} onClick={() => printCard(m)}>
                      <IconPrinter />
                    </button>
                    <button className="cmx-btn cmx-btn-outline cmx-btn-sm" aria-label={t('duplicate')} title={t('duplicate')} onClick={() => duplicate(m)}>
                      <IconCopy />
                    </button>
                    {m.status === 'draft' && (
                      <button className="cmx-btn cmx-btn-outline cmx-btn-sm" onClick={() => restore(m)}>
                        <IconRestore /> <span>{t('restore')}</span>
                      </button>
                    )}
                  </div>
                  <div className="cmx-card-delete">
                    {m.status === 'saved' ? (
                      <button className="cmx-btn cmx-btn-amber cmx-btn-sm" onClick={() => moveToDraft(m)}>
                        {t('moveToDraft')}
                      </button>
                    ) : (
                      <button className="cmx-btn cmx-btn-danger cmx-btn-sm" onClick={() => setConfirmTarget(m)}>
                        {t('deleteForever')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        {confirmTarget && (
          <MemoModal onClose={() => setConfirmTarget(null)} labelledBy="cmx-del-title">
            <h3 id="cmx-del-title" className="cmx-modal-title">{t('deleteConfirmTitle')}</h3>
            <p className="cmx-modal-body">{t('deleteConfirmBody')}</p>
            <div className="cmx-modal-btns">
              <button className="cmx-btn cmx-btn-outline" onClick={() => setConfirmTarget(null)}>{t('cancel')}</button>
              <button className="cmx-btn cmx-btn-danger" onClick={() => deleteForever(confirmTarget)}>{t('deleteYes')}</button>
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

export default function ConsultantMemoAll() {
  return (
    <MemoPrefsProvider>
      <MemoAllView />
    </MemoPrefsProvider>
  );
}
