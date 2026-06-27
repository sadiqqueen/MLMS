import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import api from '../api/axios';
import { MemoPrefsProvider, useMemoPrefs, fmtDate } from '../components/memo/MemoPrefs';
import MemoNavbar from '../components/memo/MemoNavbar';
import { useMemoToasts, MemoToasts, MemoModal, AutoTextarea } from '../components/memo/MemoUi';
import { useInitiativeAccess } from '../components/memo/useInitiativeAccess';
import CouncilSelect from '../components/memo/CouncilSelect';
import Sk from '../components/Skeleton';
import {
  INIT_STRINGS, STAGES_ORDER, LEVELS, STAGE_CHECKPOINTS,
  SOURCE_OPTIONS, SOURCE_OTHER,
  stageLabel, levelLabel, checkpointLabel,
} from '../components/memo/initiativeStrings';
import { IconPlus, IconPaperclip, IconTrash, IconBack, IconRestore, IconArchive, IconCheck, IconClock } from '../components/icons';
import './ConsultantMemo.css';

// done count / total for an initiative's CURRENT stage
function stageProgress(initiative) {
  const keys = STAGE_CHECKPOINTS[initiative.stage] || [];
  const cps = initiative.checkpoints || {};
  const done = keys.filter(k => cps[k]?.status === 'done').length;
  return { done, total: keys.length };
}

// Searchable source combobox (fixed scientific-council list). Picking أخرى
// reveals a free-text field for a custom source. `value` is the source string.
const SOURCE_SELECT_OPTIONS = SOURCE_OPTIONS.map((name, i) => ({ _id: 'src-' + i, name }));

function SourceField({ id, value, onChange, required = false }) {
  const { lang } = useMemoPrefs();
  const [other, setOther] = useState(value !== '' && !SOURCE_OPTIONS.includes(value));

  const handleSelect = (opt) => {
    if (opt.name === SOURCE_OTHER) { setOther(true); onChange(''); }
    else { setOther(false); onChange(opt.name); }
  };

  return (
    <>
      <CouncilSelect
        id={id}
        options={SOURCE_SELECT_OPTIONS}
        required={required}
        value={other ? SOURCE_OTHER : (value || '')}
        onSelect={handleSelect}
      />
      {other && (
        <input
          className="cmx-input-lg"
          type="text"
          dir="rtl"
          lang="ar"
          style={{ marginTop: 8 }}
          placeholder={lang === 'en' ? 'Specify the source…' : 'حدد المصدر…'}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </>
  );
}

// ── Board (Kanban) ──────────────────────────────────────────────────────────
function Board({ items, ti, lang, onOpen, onMove, onAdd, onShowDeleted }) {
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);

  const handleDrop = (stage) => {
    setOverStage(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const it = items.find(i => i._id === id);
    if (it && it.stage !== stage) onMove(id, stage);
  };

  return (
    <>
      <div className="cmx-board-toolbar">
        <button className="cmx-btn cmx-btn-primary" onClick={onAdd}>
          <IconPlus /> <span>{ti('addInitiative')}</span>
        </button>
        <button className="cmx-btn cmx-btn-outline" onClick={onShowDeleted}>
          <IconArchive /> <span>{ti('deletedTab')}</span>
        </button>
      </div>

      {items.length === 0 ? (
        <p className="cmx-board-empty">{ti('boardEmpty')}</p>
      ) : (
        <div className="cmx-board">
          {STAGES_ORDER.map((stage, sIdx) => {
            const colItems = items.filter(i => i.stage === stage);
            return (
              <section
                key={stage}
                className={'cmx-col cmx-col-' + sIdx + (overStage === stage ? ' cmx-col-over' : '')}
                onDragOver={e => { e.preventDefault(); setOverStage(stage); }}
                onDragLeave={() => setOverStage(s => (s === stage ? null : s))}
                onDrop={() => handleDrop(stage)}
              >
                <header className={'cmx-col-head cmx-col-head-' + sIdx}>
                  <span>{stageLabel(stage, lang)}</span>
                  <span className="cmx-chip cmx-count-chip">{colItems.length}</span>
                </header>

                {/* per-stage search → pick an initiative to jump straight to it */}
                {colItems.length > 0 && (
                  <div className="cmx-col-search">
                    <CouncilSelect
                      id={'cmx-col-search-' + stage}
                      options={colItems.map(it => ({ _id: it._id, name: it.name }))}
                      value=""
                      placeholder={ti('searchStage')}
                      onSelect={(opt) => onOpen(opt._id)}
                    />
                  </div>
                )}

                {colItems.length === 0 && <p className="cmx-col-empty">{ti('columnEmpty')}</p>}

                {colItems.map(it => {
                  const { done, total } = stageProgress(it);
                  const idx = STAGES_ORDER.indexOf(it.stage);
                  return (
                    <article
                      key={it._id}
                      className="cmx-card"
                      draggable
                      onDragStart={() => setDragId(it._id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onClick={() => onOpen(it._id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(it._id); } }}
                    >
                      <p className="cmx-card-name">{it.name}</p>
                      {it.source && <p className="cmx-card-source">{ti('sourceLabel')}: {it.source}</p>}
                      <div className="cmx-card-row">
                        <span className="cmx-chip cmx-level-chip">{levelLabel(it.level, lang)}</span>
                        <span className="cmx-chip cmx-count-chip">{done}/{total}</span>
                      </div>
                      <div className="cmx-card-move" onClick={e => e.stopPropagation()}>
                        <button
                          className="cmx-move-btn"
                          disabled={idx <= 0}
                          aria-label={ti('moveBack')}
                          title={ti('moveBack')}
                          onClick={() => onMove(it._id, STAGES_ORDER[idx - 1])}
                        >‹</button>
                        <button
                          className="cmx-move-btn"
                          disabled={idx >= STAGES_ORDER.length - 1}
                          aria-label={ti('moveNext')}
                          title={ti('moveNext')}
                          onClick={() => onMove(it._id, STAGES_ORDER[idx + 1])}
                        >›</button>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Board skeleton (structure shown while the data loads) ────────────────────
function BoardSkeleton({ lang }) {
  return (
    <>
      <div className="cmx-board-toolbar">
        <Sk w={150} h={40} r={8} />
        <Sk w={120} h={40} r={8} />
      </div>
      <div className="cmx-board">
        {STAGES_ORDER.map((stage, sIdx) => (
          <section className={'cmx-col cmx-col-' + sIdx} key={stage}>
            <header className={'cmx-col-head cmx-col-head-' + sIdx}>
              <span>{stageLabel(stage, lang)}</span>
              <span className="cmx-chip cmx-count-chip"><Sk w={12} h={12} r={3} /></span>
            </header>
            <div className="cmx-col-search"><Sk w="100%" h={38} r={8} /></div>
            {[0, 1].map(i => (
              <div className="cmx-card cmx-card-skel" key={i}>
                <Sk w="70%" h={15} style={{ marginBottom: 10 }} />
                <Sk w="50%" h={12} style={{ marginBottom: 14 }} />
                <div className="cmx-card-row">
                  <Sk w={54} h={20} r={8} />
                  <Sk w={40} h={20} r={8} />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

// ── Deleted (archive) view ──────────────────────────────────────────────────
function DeletedView({ items, loading, ti, lang, onBack, onRestore, onPurge }) {
  const [confirmTarget, setConfirmTarget] = useState(null);
  return (
    <div className="cmx-detail">
      <div className="cmx-detail-head">
        <button className="cmx-btn cmx-btn-outline cmx-btn-sm" onClick={onBack}>
          <IconBack /> <span>{ti('back')}</span>
        </button>
        <strong className="cmx-detail-title">{ti('deletedTitle')}</strong>
        <span className="cmx-detail-chips" />
      </div>

      {loading ? (
        <p className="cmx-board-empty">{ti('boardLoading')}</p>
      ) : items.length === 0 ? (
        <p className="cmx-board-empty">{ti('deletedEmpty')}</p>
      ) : (
        <div className="cmx-deleted-list">
          {items.map(it => (
            <div className="cmx-file-row cmx-deleted-row" key={it._id}>
              <span className="cmx-deleted-info">
                <span className="cmx-deleted-name">{it.name}</span>
                <span className="cmx-deleted-meta">
                  <span className="cmx-chip cmx-level-chip">{levelLabel(it.level, lang)}</span>
                  <span className="cmx-chip">{stageLabel(it.stage, lang)}</span>
                </span>
              </span>
              <span className="cmx-deleted-actions">
                <button className="cmx-btn cmx-btn-outline cmx-btn-sm" onClick={() => onRestore(it._id)}>
                  <IconRestore /> <span>{ti('restore')}</span>
                </button>
                <button className="cmx-btn cmx-btn-danger cmx-btn-sm" onClick={() => setConfirmTarget(it)}>
                  <IconTrash /> <span>{ti('deleteForever')}</span>
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {confirmTarget && (
        <MemoModal onClose={() => setConfirmTarget(null)} labelledBy="cmx-purge-title">
          <div className="cmx-modal-head">
            <h3 id="cmx-purge-title">{ti('purgeConfirmTitle')}</h3>
          </div>
          <p style={{ margin: '6px 0 16px', color: 'var(--cmx-muted)' }}>
            {ti('purgeConfirmBody')}
          </p>
          <div className="cmx-actions">
            <button
              className="cmx-btn cmx-btn-danger"
              onClick={() => { const id = confirmTarget._id; setConfirmTarget(null); onPurge(id); }}
            >
              {ti('purgeYes')}
            </button>
            <button className="cmx-btn cmx-btn-outline" onClick={() => setConfirmTarget(null)}>{ti('cancel')}</button>
          </div>
        </MemoModal>
      )}
    </div>
  );
}

// ── Create modal ────────────────────────────────────────────────────────────
function CreateModal({ ti, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [source, setSource] = useState('');
  const [level, setLevel] = useState('primary');
  const [busy, setBusy] = useState(false);
  const { lang } = useMemoPrefs();

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const ok = await onCreate({ name: name.trim(), source: source.trim(), level });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <MemoModal onClose={onClose} labelledBy="cmx-init-create-title">
      <div className="cmx-modal-head">
        <h3 id="cmx-init-create-title">{ti('addInitiative')}</h3>
      </div>
      <form className="cmx-form" onSubmit={submit}>
        <div className="cmx-field">
          <label htmlFor="cmx-new-name">{ti('newName')} <span className="cmx-req" aria-hidden="true">*</span></label>
          <AutoTextarea id="cmx-new-name" className="cmx-textarea cmx-autoline" singleLine required value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="cmx-row2" style={{ marginTop: 12 }}>
          <div className="cmx-field">
            <label htmlFor="cmx-new-source">{ti('source')}</label>
            <SourceField id="cmx-new-source" value={source} onChange={setSource} />
          </div>
          <div className="cmx-field">
            <label htmlFor="cmx-new-level">{ti('level')}</label>
            <select id="cmx-new-level" value={level} onChange={e => setLevel(e.target.value)}>
              {LEVELS.map(l => <option key={l} value={l}>{levelLabel(l, lang)}</option>)}
            </select>
          </div>
        </div>
        <div className="cmx-actions">
          <button type="submit" className="cmx-btn cmx-btn-primary" disabled={busy || !name.trim()}>
            {busy ? ti('saving') : ti('addInitiative')}
          </button>
          <button type="button" className="cmx-btn cmx-btn-outline" onClick={onClose}>{ti('cancel')}</button>
        </div>
      </form>
    </MemoModal>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────
function Detail({ initiative, ti, lang, onBack, onPatchBasic, onMove, onCheckpoint, onAttachments, onDelete, onDirtyChange }) {
  const [name, setName]     = useState(initiative.name);
  const [source, setSource] = useState(initiative.source || '');
  const [level, setLevel]   = useState(initiative.level);
  const [notes, setNotes]   = useState(initiative.notes || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileInputRef = useRef(null);

  // Seed editable fields only when switching to a different initiative, so an
  // immediate checkpoint/stage/attachment update from the server doesn't wipe
  // an in-progress text edit.
  useEffect(() => {
    setName(initiative.name);
    setSource(initiative.source || '');
    setLevel(initiative.level);
    setNotes(initiative.notes || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initiative._id]);

  const dirty = name !== initiative.name
    || source !== (initiative.source || '')
    || level !== initiative.level
    || notes !== (initiative.notes || '');
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);

  const stageIdx = STAGES_ORDER.indexOf(initiative.stage);
  const stageKeys = STAGE_CHECKPOINTS[initiative.stage] || [];
  const cps = initiative.checkpoints || {};
  const { done, total } = stageProgress(initiative);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onPatchBasic({ name: name.trim(), source: source.trim(), level, notes });
    setSaving(false);
  };
  const handleCancel = () => {
    setName(initiative.name);
    setSource(initiative.source || '');
    setLevel(initiative.level);
    setNotes(initiative.notes || '');
  };

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/consultant-memo/upload', fd);
      await onAttachments([...(initiative.attachmentFiles || []), { ...res.data }]);
    } finally {
      setUploading(false);
    }
  };
  const removeFile = (i) => {
    onAttachments((initiative.attachmentFiles || []).filter((_, idx) => idx !== i));
  };

  return (
    <div className="cmx-detail">
      <div className="cmx-detail-head">
        <button className="cmx-btn cmx-btn-outline cmx-btn-sm" onClick={onBack}>
          <IconBack /> <span>{ti('back')}</span>
        </button>
        <strong className="cmx-detail-title">{initiative.name}</strong>
        <span className="cmx-detail-chips">
          <span className={'cmx-chip cmx-stage-chip cmx-stage-chip-' + stageIdx}>{stageLabel(initiative.stage, lang)}</span>
          <span className="cmx-chip cmx-level-chip">{levelLabel(initiative.level, lang)}</span>
        </span>
      </div>

      {/* Stage stepper */}
      <div className="cmx-stepper" role="list">
        {STAGES_ORDER.map((s, i) => (
          <span
            key={s}
            role="listitem"
            className={'cmx-step-pill' + (i < stageIdx ? ' done' : '') + (i === stageIdx ? ' current' : '')}
          >
            {i < stageIdx && <IconCheck />} {stageLabel(s, lang)}
          </span>
        ))}
      </div>

      {/* بيانات المبادرة */}
      <section className="cmx-section">
        <h2 className="cmx-bar">{ti('secData')}</h2>
        <div className="cmx-row2">
          <div className="cmx-field cmx-field-wide">
            <label htmlFor="cmx-d-name">{ti('name')} <span className="cmx-req" aria-hidden="true">*</span></label>
            <AutoTextarea id="cmx-d-name" className="cmx-textarea cmx-autoline" singleLine required value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="cmx-field">
            <label htmlFor="cmx-d-source">{ti('source')}</label>
            <SourceField key={initiative._id} id="cmx-d-source" value={source} onChange={setSource} />
          </div>
        </div>
        <div className="cmx-row2" style={{ marginTop: 12 }}>
          <div className="cmx-field">
            <label htmlFor="cmx-d-level">{ti('level')}</label>
            <select id="cmx-d-level" value={level} onChange={e => setLevel(e.target.value)}>
              {LEVELS.map(l => <option key={l} value={l}>{levelLabel(l, lang)}</option>)}
            </select>
          </div>
          <div className="cmx-field">
            <label htmlFor="cmx-d-date">{ti('addedDate')}</label>
            <input id="cmx-d-date" type="text" value={fmtDate(initiative.createdAt, lang)} disabled readOnly />
          </div>
        </div>
      </section>

      {/* خطوات الاعتماد — current stage only */}
      <section className="cmx-section">
        <h2 className="cmx-bar">{ti('secSteps')} — {stageLabel(initiative.stage, lang)} ({done}/{total})</h2>
        <div className="cmx-steps">
          {stageKeys.map(key => {
            const cp = cps[key] || { status: 'pending', date: null, note: '' };
            const isDone = cp.status === 'done';
            return (
              <div className={'cmx-step' + (isDone ? ' done' : '')} key={key}>
                <button
                  type="button"
                  className={'cmx-step-toggle ' + (isDone ? 'is-done' : 'is-todo')}
                  aria-pressed={isDone}
                  onClick={() => onCheckpoint(key, { status: isDone ? 'pending' : 'done' })}
                >
                  {isDone ? <IconCheck /> : <IconClock />}
                  <span>{isDone ? ti('done') : ti('inProgress')}</span>
                </button>
                <span className="cmx-step-label">{checkpointLabel(key, lang)}</span>
                <span className="cmx-step-date">{cp.date ? fmtDate(cp.date, lang) : ti('noDate')}</span>
                <input
                  className="cmx-step-note"
                  type="text"
                  placeholder={ti('notePlaceholder')}
                  defaultValue={cp.note || ''}
                  key={key + ':' + (cp.note || '')}
                  onBlur={e => { if (e.target.value !== (cp.note || '')) onCheckpoint(key, { note: e.target.value }); }}
                />
              </div>
            );
          })}
        </div>
        <div className="cmx-stage-moves">
          <button
            type="button"
            className="cmx-btn cmx-btn-outline"
            disabled={stageIdx <= 0}
            onClick={() => onMove(STAGES_ORDER[stageIdx - 1])}
          >‹ {ti('moveBack')}</button>
          <button
            type="button"
            className="cmx-btn cmx-btn-primary"
            disabled={stageIdx >= STAGES_ORDER.length - 1}
            onClick={() => onMove(STAGES_ORDER[stageIdx + 1])}
          >{ti('moveTo')}: {stageIdx < STAGES_ORDER.length - 1 ? stageLabel(STAGES_ORDER[stageIdx + 1], lang) : ''} ›</button>
        </div>
      </section>

      {/* المرفقات */}
      <section className="cmx-section">
        <h2 className="cmx-bar">{ti('secAttachments')}</h2>
        <div className="cmx-attachments">
          {(initiative.attachmentFiles || []).map((f0, i) => (
            <div className="cmx-file-row" key={(f0.url || '') + i}>
              <IconPaperclip />
              <a className="cmx-file-link" href={`${f0.url}?dl=${encodeURIComponent(f0.name)}`} target="_blank" rel="noreferrer">{f0.name}</a>
              <button type="button" className="cmx-attach-del" aria-label={`${ti('removeFile')}: ${f0.name}`} onClick={() => removeFile(i)}>
                <IconTrash />
              </button>
            </div>
          ))}
          <div className="cmx-attach-btns">
            <button type="button" className="cmx-attach-add" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <IconPaperclip /> {uploading ? ti('uploading') : ti('uploadFile')}
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
      </section>

      {/* ملاحظات */}
      <section className="cmx-section">
        <h2 className="cmx-bar">{ti('secNotes')}</h2>
        <AutoTextarea rows={3} className="cmx-textarea" value={notes} placeholder={ti('notesPlaceholder')} onChange={e => setNotes(e.target.value)} />
      </section>

      <div className="cmx-actions">
        <button type="button" className="cmx-btn cmx-btn-primary" disabled={saving || !name.trim() || !dirty} onClick={handleSave}>
          {saving ? ti('saving') : ti('save')}
        </button>
        <button type="button" className="cmx-btn cmx-btn-outline" disabled={!dirty} onClick={handleCancel}>{ti('cancel')}</button>
        <button type="button" className="cmx-btn cmx-btn-danger cmx-detail-delete" onClick={() => setConfirmDelete(true)}>
          <IconTrash /> <span>{ti('delete')}</span>
        </button>
      </div>

      {confirmDelete && (
        <MemoModal onClose={() => setConfirmDelete(false)} labelledBy="cmx-del-title">
          <div className="cmx-modal-head">
            <h3 id="cmx-del-title">{ti('deleteConfirmTitle')}</h3>
          </div>
          <p style={{ margin: '6px 0 16px', color: 'var(--cmx-muted)' }}>{ti('deleteConfirmBody')}</p>
          <div className="cmx-actions">
            <button className="cmx-btn cmx-btn-danger" onClick={() => { setConfirmDelete(false); onDelete(); }}>{ti('deleteYes')}</button>
            <button className="cmx-btn cmx-btn-outline" onClick={() => setConfirmDelete(false)}>{ti('cancel')}</button>
          </div>
        </MemoModal>
      )}
    </div>
  );
}

// ── App shell (board ↔ detail) ──────────────────────────────────────────────
function InitiativesApp() {
  const { theme, lang, dir } = useMemoPrefs();
  const navigate = useNavigate();
  const { toasts, showToast, dismiss } = useMemoToasts();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedItems, setDeletedItems] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const detailDirtyRef = useRef(false);

  const ti = useCallback(key => INIT_STRINGS[lang]?.[key] ?? INIT_STRINGS.ar[key] ?? key, [lang]);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/api/initiatives');
      setItems(res.data);
    } catch {
      showToast(ti('loadError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, ti]);
  useEffect(() => { load(); }, [load]);

  const upsert = (doc) => setItems(prev => {
    const i = prev.findIndex(x => x._id === doc._id);
    if (i === -1) return [doc, ...prev];
    const next = [...prev]; next[i] = doc; return next;
  });

  const selected = items.find(i => i._id === selectedId) || null;

  const guardNavigation = () =>
    !detailDirtyRef.current || window.confirm(STRINGS_unsaved(lang));

  // create
  const handleCreate = async (data) => {
    try {
      const res = await api.post('/api/initiatives', data);
      upsert(res.data);
      showToast(ti('createdToast'));
      setSelectedId(res.data._id);
      return true;
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
      return false;
    }
  };

  // move stage (from board or detail)
  const handleMove = async (id, stage) => {
    try {
      const res = await api.patch(`/api/initiatives/${id}/stage`, { stage });
      upsert(res.data);
      showToast(ti('movedToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };

  // checkpoint toggle / note
  const handleCheckpoint = async (id, key, patch) => {
    try {
      const res = await api.patch(`/api/initiatives/${id}/checkpoint`, { key, ...patch });
      upsert(res.data);
      if (patch.status !== undefined) showToast(ti('checkpointToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };

  // basic fields save
  const handlePatchBasic = async (id, data) => {
    try {
      const res = await api.patch(`/api/initiatives/${id}`, data);
      upsert(res.data);
      showToast(ti('savedToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };

  // attachments (persist immediately)
  const handleAttachments = async (id, attachmentFiles) => {
    try {
      const res = await api.patch(`/api/initiatives/${id}`, { attachmentFiles });
      upsert(res.data);
    } catch (err) {
      showToast(err.response?.data?.message || ti('uploadFailed'), 'error');
    }
  };

  // soft delete
  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/initiatives/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
      detailDirtyRef.current = false;
      setSelectedId(null);
      showToast(ti('deletedToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };

  // deleted archive
  const openDeleted = async () => {
    setShowDeleted(true);
    setDeletedLoading(true);
    try {
      const res = await api.get('/api/initiatives?deleted=true');
      setDeletedItems(res.data);
    } catch {
      showToast(ti('loadError'), 'error');
    } finally {
      setDeletedLoading(false);
    }
  };
  const handleRestore = async (id) => {
    try {
      const res = await api.patch(`/api/initiatives/${id}/restore`);
      setDeletedItems(prev => prev.filter(x => x._id !== id));
      upsert(res.data);
      showToast(ti('restoredToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };
  const handlePurge = async (id) => {
    try {
      await api.delete(`/api/initiatives/${id}/permanent`);
      setDeletedItems(prev => prev.filter(x => x._id !== id));
      showToast(ti('purgedToast'));
    } catch (err) {
      showToast(err.response?.data?.message || ti('actionError'), 'error');
    }
  };

  const openDetail = (id) => { setSelectedId(id); };
  const backToBoard = () => {
    if (!guardNavigation()) return;
    detailDirtyRef.current = false;
    setSelectedId(null);
  };

  return (
    <div className="cmx" data-theme={theme} dir={dir} lang={lang}>
      <div className="cmx-screen">
        <MemoNavbar
          onNewMemo={() => { if (guardNavigation()) navigate('/consultant-memo'); }}
          guardNavigation={guardNavigation}
        />

        <main className="cmx-main">
          <img className="cmx-watermark" src="/arab-board-logo.png" alt="" aria-hidden="true" />
          <h1 className="cmx-title">{ti('pageTitle')}</h1>

          {loading ? (
            <BoardSkeleton lang={lang} />
          ) : selected ? (
            <Detail
              initiative={selected}
              ti={ti}
              lang={lang}
              onBack={backToBoard}
              onPatchBasic={(data) => handlePatchBasic(selected._id, data)}
              onMove={(stage) => handleMove(selected._id, stage)}
              onCheckpoint={(key, patch) => handleCheckpoint(selected._id, key, patch)}
              onAttachments={(files) => handleAttachments(selected._id, files)}
              onDelete={() => handleDelete(selected._id)}
              onDirtyChange={(d) => { detailDirtyRef.current = d; }}
            />
          ) : showDeleted ? (
            <DeletedView
              items={deletedItems}
              loading={deletedLoading}
              ti={ti}
              lang={lang}
              onBack={() => setShowDeleted(false)}
              onRestore={handleRestore}
              onPurge={handlePurge}
            />
          ) : (
            <Board
              items={items}
              ti={ti}
              lang={lang}
              onOpen={openDetail}
              onMove={handleMove}
              onAdd={() => setShowCreate(true)}
              onShowDeleted={openDeleted}
            />
          )}
        </main>

        {showCreate && (
          <CreateModal ti={ti} onClose={() => setShowCreate(false)} onCreate={handleCreate} />
        )}

        <MemoToasts toasts={toasts} dismiss={dismiss} />
      </div>
    </div>
  );
}

// unsaved-changes confirm text (kept inline; mirrors MemoPrefs t('unsavedConfirm'))
function STRINGS_unsaved(lang) {
  return lang === 'en'
    ? 'You have unsaved changes. Continue without saving?'
    : 'لديك تغييرات غير محفوظة. هل تريد المتابعة دون حفظ؟';
}

// ── Gate + provider ─────────────────────────────────────────────────────────
function InitiativesGate() {
  const { allowed, loading } = useInitiativeAccess();
  if (loading) {
    // themed loading shell while permissions resolve
    return (
      <div className="cmx" data-theme={localStorage.getItem('cm-theme') === 'dark' ? 'dark' : 'light'}>
        <div className="cmx-screen" />
      </div>
    );
  }
  if (!allowed) return <Navigate to="/" replace />;
  return <InitiativesApp />;
}

export default function Initiatives() {
  return (
    <MemoPrefsProvider>
      <InitiativesGate />
    </MemoPrefsProvider>
  );
}
