import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { MemoPrefsProvider, useMemoPrefs } from '../components/memo/MemoPrefs';
import MemoNavbar from '../components/memo/MemoNavbar';
import MemoPrint from '../components/memo/MemoPrint';
import { useMemoToasts, MemoToasts, MemoModal, AutoTextarea } from '../components/memo/MemoUi';
import { buildAttachmentPreviews } from '../components/memo/attachmentPreviews';
import CouncilSelect from '../components/memo/CouncilSelect';
import { IconSave, IconPrinter, IconEye, IconPaperclip, IconTrash } from '../components/icons';
import './ConsultantMemo.css';

const EMPTY = {
  topicName: '', source: '', council: '', councilName: '', topicDateTime: '',
  attachments: ['', ''], attachmentFiles: [], attachmentsDateTime: '',
  presentation: '', presentationDateTime: '',
  executiveCommittee: '', executiveCommitteeDateTime: '',
  presidentRecommendation: '', presidentRecommendationDateTime: '',
  jointCouncil: '', jointCouncilDateTime: '',
};
const DT_KEYS = ['topicDateTime', 'attachmentsDateTime', 'presentationDateTime',
  'executiveCommitteeDateTime', 'presidentRecommendationDateTime', 'jointCouncilDateTime'];
const TEXT_KEYS = ['topicName', 'source', 'presentation', 'executiveCommittee',
  'presidentRecommendation', 'jointCouncil'];

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;  // date only
}

function fromMemo(m) {
  const f = {
    ...EMPTY,
    attachments: m.attachments?.length ? [...m.attachments] : ['', ''],
    // keep ALL metadata (fileId/mimeType/size/uploadedAt) so re-saving
    // doesn't strip it
    attachmentFiles: m.attachmentFiles?.length ? m.attachmentFiles.map(x => ({ ...x })) : [],
  };
  TEXT_KEYS.forEach(k => { f[k] = m[k] || ''; });
  DT_KEYS.forEach(k => { f[k] = toLocalInput(m[k]); });
  f.council = m.council || '';
  f.councilName = m.councilName || '';
  return f;
}

function toPayload(f) {
  const p = { attachments: f.attachments, attachmentFiles: f.attachmentFiles };
  TEXT_KEYS.forEach(k => { p[k] = f[k]; });
  DT_KEYS.forEach(k => { p[k] = f[k] ? new Date(f[k]).toISOString() : null; });
  p.council = f.council || null;
  p.councilName = f.councilName || '';
  return p;
}

function isEmptyForm(f) {
  return TEXT_KEYS.every(k => !f[k].trim())
    && f.attachments.every(a => !a.trim())
    && f.attachmentFiles.length === 0
    && !f.councilName
    && DT_KEYS.every(k => !f[k]);
}

function snapshot(f) {
  return { ...f, attachments: [...f.attachments], attachmentFiles: [...f.attachmentFiles] };
}

function MemoForm() {
  const { theme, lang, dir, t } = useMemoPrefs();
  const [searchParams, setSearchParams] = useSearchParams();
  const memoId = searchParams.get('id');

  const [form, setForm]             = useState(EMPTY);
  const [memoNumber, setMemoNumber] = useState('');
  const [dirty, setDirty]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [lastAuto, setLastAuto]     = useState(null);
  const [banner, setBanner]         = useState(null);   // 'translating' | 'translated' | 'failed'
  const [showPreview, setShowPreview] = useState(false);
  const [loadedKey, setLoadedKey]   = useState(0);
  const [uploading, setUploading]   = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState([]);
  const [councils, setCouncils]     = useState([]);
  const [otherActive, setOtherActive] = useState(false);  // أخرى chosen
  const [otherName, setOtherName]     = useState('');
  const { toasts, showToast, dismiss } = useMemoToasts();
  const fileInputRef = useRef(null);
  const previewsPromiseRef = useRef(Promise.resolve());
  const otherActiveRef = useRef(false); otherActiveRef.current = otherActive;
  const otherNameRef = useRef('');      otherNameRef.current = otherName;

  // المجلس العلمي options — the seeded defaults + every saved custom council
  const loadCouncils = useCallback(async () => {
    try {
      const res = await api.get('/api/scientific-councils');
      setCouncils(res.data);
    } catch { /* dropdown stays empty; selection still shows councilName */ }
  }, []);
  useEffect(() => { loadCouncils(); }, [loadCouncils]);

  const formRef = useRef(form);     formRef.current = form;
  const dirtyRef = useRef(dirty);   dirtyRef.current = dirty;
  const memoIdRef = useRef(memoId); memoIdRef.current = memoId;
  const savingRef = useRef(false);
  const arBackupRef = useRef(null);
  const prevLangRef = useRef(null);
  const langTokenRef = useRef(0);

  // ── Load an existing memo (?id=…) ────────────────────────────────────
  useEffect(() => {
    if (!memoId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/consultant-memo/${memoId}`);
        if (cancelled) return;
        setForm(fromMemo(res.data));
        setMemoNumber(res.data.memoNumber || '');
        setOtherActive(false);
        setOtherName('');
        setDirty(false);
        arBackupRef.current = null;
        setLoadedKey(k => k + 1);
      } catch {
        if (!cancelled) showToast(t('loadError'), 'error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoId]);

  // ── Save (manual or autosave) ─────────────────────────────────────────
  const doSave = useCallback(async (silent = false) => {
    if (savingRef.current) return;
    if (!memoIdRef.current && isEmptyForm(formRef.current)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const payload = toPayload(formRef.current);

      // أخرى flow: the new council is created ONLY on the explicit حفظ
      // (never on autosave, so half-typed names can't become junk entries).
      if (otherActiveRef.current) {
        const newName = otherNameRef.current.trim();
        if (!silent && newName) {
          const created = (await api.post('/api/scientific-councils', { name: newName })).data;
          payload.council = created._id;
          payload.councilName = created.name;
          setForm(f => ({ ...f, council: created._id, councilName: created.name }));
          setOtherActive(false);
          setOtherName('');
          loadCouncils();  // it now appears in the dropdown for every memo
        } else {
          payload.council = null;
          payload.councilName = '';
        }
      }

      if (memoIdRef.current) {
        await api.put(`/api/consultant-memo/${memoIdRef.current}`, payload);
      } else {
        const res = await api.post('/api/consultant-memo', payload);
        setMemoNumber(res.data.memoNumber || '');
        setSearchParams({ id: res.data._id }, { replace: true });
      }
      setDirty(false);
      if (lang === 'en') arBackupRef.current = null;  // English is canonical once saved in EN
      if (silent) setLastAuto(new Date());
      else showToast(t('savedToast'));
    } catch {
      if (!silent) showToast(t('saveError'), 'error');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [lang, setSearchParams, showToast, t, loadCouncils]);

  // Autosave: debounce ~2s after typing stops
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => doSave(true), 2000);
    return () => clearTimeout(timer);
  }, [form, dirty, doSave]);

  // Warn on unload with unsaved changes
  useEffect(() => {
    const h = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  // Pre-render uploaded attachments (images / PDF pages) for the print
  // layout, so the annex pages are ready when the user hits طباعة.
  const attachmentFilesKey = JSON.stringify(form.attachmentFiles.map(f => f.url));
  useEffect(() => {
    let cancelled = false;
    const job = buildAttachmentPreviews(formRef.current.attachmentFiles)
      .then(p => { if (!cancelled) setAttachmentPreviews(p); })
      .catch(() => { if (!cancelled) setAttachmentPreviews([]); });
    previewsPromiseRef.current = job;
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachmentFilesKey]);

  async function handlePrint() {
    await previewsPromiseRef.current;   // make sure annex pages are rendered
    window.print();
  }

  // ── Content translation when the feature is in EN mode ───────────────
  useEffect(() => {
    const prev = prevLangRef.current;
    prevLangRef.current = lang;
    const token = ++langTokenRef.current;

    if (lang === 'en') {
      const current = snapshot(formRef.current);
      if (isEmptyForm(current)) { setBanner(null); return; }
      arBackupRef.current = current;

      const texts = {};
      TEXT_KEYS.forEach(k => { if (current[k].trim()) texts[k] = current[k]; });
      current.attachments.forEach((a, i) => { if (a.trim()) texts['att' + i] = a; });

      setBanner('translating');
      api.post('/api/consultant-memo/translate', { texts })
        .then(res => {
          if (langTokenRef.current !== token) return;
          const tr = res.data.translations || {};
          setForm(f => {
            const out = snapshot(f);
            Object.entries(tr).forEach(([k, v]) => {
              if (k.startsWith('att')) out.attachments[Number(k.slice(3))] = v;
              else out[k] = v;
            });
            return out;
          });
          setBanner('translated');
        })
        .catch(() => {
          if (langTokenRef.current === token) setBanner('failed');
        });
    } else if (prev === 'en') {
      if (arBackupRef.current) {
        setForm(arBackupRef.current);
        arBackupRef.current = null;
      }
      setBanner(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, loadedKey]);

  // ── Field helpers ─────────────────────────────────────────────────────
  const set = k => e => { const v = e.target.value; setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const setAttachment = i => e => {
    const v = e.target.value;
    setForm(f => { const a = [...f.attachments]; a[i] = v; return { ...f, attachments: a }; });
    setDirty(true);
  };
  const addAttachment = () => { setForm(f => ({ ...f, attachments: [...f.attachments, ''] })); setDirty(true); };
  const removeAttachment = i => {
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }));
    setDirty(true);
  };
  const removeFile = i => {
    setForm(f => ({ ...f, attachmentFiles: f.attachmentFiles.filter((_, idx) => idx !== i) }));
    setDirty(true);
  };
  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/consultant-memo/upload', fd);
      setForm(f => ({ ...f, attachmentFiles: [...f.attachmentFiles, { ...res.data }] }));
      setDirty(true);
    } catch {
      showToast(t('uploadFailed'), 'error');
    } finally {
      setUploading(false);
    }
  }

  // المجلس العلمي selection from the combobox
  const handleCouncilSelect = option => {
    if (option.name === 'أخرى') {
      setOtherActive(true);
      setForm(f => ({ ...f, council: '', councilName: '' }));
    } else {
      setOtherActive(false);
      setOtherName('');
      setForm(f => ({ ...f, council: option._id, councilName: option.name }));
    }
    setDirty(true);
  };

  const guardNavigation = () => !dirtyRef.current || window.confirm(t('unsavedConfirm'));

  const handleNew = () => {
    if (!guardNavigation()) return;
    langTokenRef.current++;
    setSearchParams({}, { replace: true });
    setForm(EMPTY);
    setMemoNumber('');
    setDirty(false);
    setBanner(null);
    setOtherActive(false);
    setOtherName('');
    arBackupRef.current = null;
  };

  const printable = {
    ...form,
    memoNumber,
    councilName: form.councilName || (otherActive ? otherName.trim() : ''),
  };

  const autoTime = lastAuto
    ? lastAuto.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="cmx" data-theme={theme} dir={dir} lang={lang}>
      <div className="cmx-screen">
        <MemoNavbar onNewMemo={handleNew} guardNavigation={guardNavigation} />

        <main className="cmx-main">
          <img className="cmx-watermark" src="/arab-board-logo.png" alt="" aria-hidden="true" />

          <h1 className="cmx-title">{t('pageTitle')}</h1>

          {banner && (
            <div className={'cmx-banner' + (banner === 'failed' ? ' cmx-banner-warn' : '')} role="status">
              {banner === 'translating' ? t('translating')
                : banner === 'failed' ? t('translateFailed')
                : t('translatedBanner')}
            </div>
          )}

          <form className="cmx-form" onSubmit={e => { e.preventDefault(); doSave(false); }}>
            {/* بيانات الموضوع */}
            <section className="cmx-section">
              <h2 className="cmx-bar">{t('secTopic')}</h2>
              <div className="cmx-row2">
                <div className="cmx-field cmx-field-wide">
                  <label htmlFor="cmx-topic">{t('topicName')} <span className="cmx-req" aria-hidden="true">*</span></label>
                  <input id="cmx-topic" className="cmx-input-lg" type="text" required value={form.topicName} onChange={set('topicName')} />
                </div>
                {/* المجلس العلمي — replaces the former المصدر field */}
                <div className="cmx-field">
                  <label htmlFor="cmx-council">{t('councilLabel')} <span className="cmx-req" aria-hidden="true">*</span></label>
                  <CouncilSelect
                    id="cmx-council"
                    options={councils}
                    required
                    value={otherActive ? 'أخرى' : form.councilName}
                    onSelect={handleCouncilSelect}
                  />
                </div>
              </div>
              {otherActive && (
                <div className="cmx-row2">
                  <div className="cmx-field cmx-field-wide">
                    <label htmlFor="cmx-council-new">{t('newCouncilLabel')} <span className="cmx-req" aria-hidden="true">*</span></label>
                    <input
                      id="cmx-council-new"
                      className="cmx-input-lg"
                      type="text"
                      required
                      dir="rtl"
                      lang="ar"
                      value={otherName}
                      onChange={e => { setOtherName(e.target.value); setDirty(true); }}
                    />
                  </div>
                </div>
              )}
              <DateTimeRow id="cmx-dt-topic" t={t} value={form.topicDateTime} onChange={set('topicDateTime')} />
            </section>

            {/* المرفقات */}
            <section className="cmx-section">
              <h2 className="cmx-bar">{t('secAttachments')}</h2>
              <div className="cmx-attachments">
                {form.attachments.map((a, i) => (
                  <div className="cmx-attach-row" key={i}>
                    <input
                      type="text"
                      className="cmx-input-lg"
                      aria-label={`${t('attachment')} ${i + 1}`}
                      value={a}
                      onChange={setAttachment(i)}
                    />
                    <button
                      type="button"
                      className="cmx-attach-del"
                      aria-label={`${t('removeAttachment')} ${i + 1}`}
                      onClick={() => removeAttachment(i)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
                {form.attachmentFiles.map((f0, i) => (
                  <div className="cmx-file-row" key={f0.url + i}>
                    <IconPaperclip />
                    {/* ?dl= makes the server send the original (Arabic) filename */}
                    <a className="cmx-file-link" href={`${f0.url}?dl=${encodeURIComponent(f0.name)}`} target="_blank" rel="noreferrer">{f0.name}</a>
                    <button
                      type="button"
                      className="cmx-attach-del"
                      aria-label={`${t('removeFile')}: ${f0.name}`}
                      onClick={() => removeFile(i)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                ))}
                <div className="cmx-attach-btns">
                  <button type="button" className="cmx-attach-add" onClick={addAttachment}>
                    {t('addAttachment')}
                  </button>
                  <button
                    type="button"
                    className="cmx-attach-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <IconPaperclip /> {uploading ? t('uploading') : t('uploadFile')}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    tabIndex={-1}
                    aria-hidden="true"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                    onChange={handleFileChosen}
                  />
                </div>
              </div>
              <DateTimeRow id="cmx-dt-attach" t={t} value={form.attachmentsDateTime} onChange={set('attachmentsDateTime')} />
            </section>

            {/* العرض */}
            <TextSection id="cmx-presentation" title={t('secPresentation')} rows={10} t={t}
              value={form.presentation} onChange={set('presentation')}
              dtId="cmx-dt-pres" dtValue={form.presentationDateTime} onDtChange={set('presentationDateTime')} />

            {/* اللجنة التنفيذية */}
            <TextSection id="cmx-exec" title={t('secExec')} rows={4} t={t}
              value={form.executiveCommittee} onChange={set('executiveCommittee')}
              dtId="cmx-dt-exec" dtValue={form.executiveCommitteeDateTime} onDtChange={set('executiveCommitteeDateTime')} />

            {/* توصية معالي رئيس المجلس */}
            <TextSection id="cmx-presrec" title={t('secPresRec')} rows={4} t={t}
              value={form.presidentRecommendation} onChange={set('presidentRecommendation')}
              dtId="cmx-dt-presrec" dtValue={form.presidentRecommendationDateTime} onDtChange={set('presidentRecommendationDateTime')} />

            {/* المجلس العلمي الاستشاري المشترك */}
            <TextSection id="cmx-joint" title={t('secJoint')} rows={4} t={t}
              value={form.jointCouncil} onChange={set('jointCouncil')}
              dtId="cmx-dt-joint" dtValue={form.jointCouncilDateTime} onDtChange={set('jointCouncilDateTime')} />

            {/* Action bar */}
            <div className="cmx-actions">
              <button type="submit" className="cmx-btn cmx-btn-primary" disabled={saving}>
                <IconSave /> <span>{saving ? t('saving') : t('save')}</span>
              </button>
              <button type="button" className="cmx-btn cmx-btn-outline" onClick={handlePrint}>
                <IconPrinter /> <span>{t('print')}</span>
              </button>
              <button type="button" className="cmx-btn cmx-btn-outline" onClick={() => setShowPreview(true)}>
                <IconEye /> <span>{t('preview')}</span>
              </button>
              <span className="cmx-autosave" aria-live="polite">
                {autoTime ? `${t('autosaved')} · ${autoTime}` : ''}
              </span>
            </div>
          </form>
        </main>

        {showPreview && (
          <MemoModal wide onClose={() => setShowPreview(false)} labelledBy="cmx-preview-title">
            <div className="cmx-modal-head">
              <h3 id="cmx-preview-title">{t('preview')}</h3>
              <button className="cmx-btn cmx-btn-outline" onClick={() => setShowPreview(false)}>
                {t('closePreview')}
              </button>
            </div>
            <div className="cmx-preview-scroll">
              <MemoPrint memo={printable} lang={lang} attachmentPreviews={attachmentPreviews} />
            </div>
          </MemoModal>
        )}

        <MemoToasts toasts={toasts} dismiss={dismiss} />
      </div>

      {/* Hidden print layout — the only thing visible under @media print */}
      <div className="cmx-print-mount">
        <MemoPrint memo={printable} lang={lang} attachmentPreviews={attachmentPreviews} />
      </div>
    </div>
  );
}

function DateTimeRow({ id, t, value, onChange }) {
  return (
    <div className="cmx-dtrow">
      <label htmlFor={id}>📅 {t('dateTime')}</label>
      <input type="date" id={id} value={value} onChange={onChange} />
    </div>
  );
}

function TextSection({ id, title, rows, t, value, onChange, dtId, dtValue, onDtChange }) {
  return (
    <section className="cmx-section">
      <h2 className="cmx-bar"><label htmlFor={id} className="cmx-bar-label">{title}</label></h2>
      <AutoTextarea id={id} rows={rows} value={value} onChange={onChange} className="cmx-textarea" />
      <DateTimeRow id={dtId} t={t} value={dtValue} onChange={onDtChange} />
    </section>
  );
}

export default function ConsultantMemo() {
  return (
    <MemoPrefsProvider>
      <MemoForm />
    </MemoPrefsProvider>
  );
}
