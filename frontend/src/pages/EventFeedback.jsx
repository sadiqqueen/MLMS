// W2-Developer — Event Feedback (RULINGS §B14 keeps it on the developer nav).
// mt- restyle of the page shell (event selector, QR/code share panel, tabs, new-
// event modal); the FormBuilder / Responses child components are imported
// unchanged. All behaviour kept.
import { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconCopy } from '../components/icons';
import api from '../api/axios';
import FormBuilder from '../components/eventFeedback/FormBuilder';
import Responses from '../components/eventFeedback/Responses';
import './developer.css';

export default function EventFeedback() {
  const { toasts, showToast } = useMtToast();
  const [events, setEvents] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId] = useState('');
  const [tab, setTab] = useState('form');
  const [showNew, setShowNew] = useState(false);

  const loadEvents = useCallback(() => api.get('/api/event-feedback/events', { cache: false })
    .then((r) => setEvents(r.data?.data || r.data || []))
    .catch(() => showToast('Failed to load events', 'dng')), [showToast]);
  const loadForms = useCallback(() => api.get('/api/event-feedback/forms', { cache: false })
    .then((r) => setForms(r.data?.data || r.data || [])).catch(() => {}), []);

  useEffect(() => { Promise.all([loadEvents(), loadForms()]).finally(() => setLoading(false)); }, [loadEvents, loadForms]);
  useEffect(() => { if (!selId && events.length) setSelId(events[0].id); }, [events, selId]);

  const selected = events.find((e) => e.id === selId) || null;
  const formId = selected ? (selected.form?.id || selected.formId) : null;

  async function setEventStatus(action) {
    try {
      await api.post(`/api/event-feedback/events/${selId}/${action}`);
      await loadEvents();
      showToast(action === 'open' ? 'Event opened — accepting responses' : 'Event closed', 'ok');
    } catch { showToast('Failed to update event', 'dng'); }
  }
  async function regenerateCode() {
    try {
      const r = await api.post(`/api/event-feedback/events/${selId}/regenerate-code`);
      await loadEvents();
      showToast('New code generated: ' + (r.data?.data?.code || ''), 'ok');
    } catch { showToast('Failed to regenerate code', 'dng'); }
  }

  return (
    <>
      <Navbar title="Event Feedback" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">Build the evaluation form, share an event code / QR, and review responses.</div>

        {/* Event selector */}
        <div className="mt-card" style={{ padding: 14, marginBlockEnd: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="mt-label" style={{ marginBlockEnd: 0 }}>Event</label>
          <select className="mt-select" style={{ width: 'auto', minWidth: 220 }} value={selId} onChange={(e) => setSelId(e.target.value)}>
            {events.length === 0 && <option value="">No events yet</option>}
            {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {e.code}{e.status === 'closed' ? ' (closed)' : ''}</option>)}
          </select>
          <button className="mt-btn" onClick={() => setShowNew(true)}>+ New event</button>
          {selected && (
            <span className={`mt-pill ${selected.status === 'open' ? 'mt-pill--active' : 'mt-pill--warn'}`} style={{ marginInlineStart: 'auto' }}>
              {selected.status === 'open' ? '● Accepting responses' : '● Closed'}
            </span>
          )}
        </div>

        {loading && <div className="skeleton mt-skel" style={{ height: 200 }} />}

        {!loading && !selected && (
          <div className="mt-empty">
            <div className="mt-empty-title">No event selected</div>
            <div className="mt-empty-sub">Create an event to attach a form and collect feedback.</div>
          </div>
        )}

        {!loading && selected && (
          <>
            <div className="dev-tabs">
              {[['form', 'Form'], ['feedback', 'Feedback']].map(([k, label]) => (
                <button key={k} className={`dev-tab${tab === k ? ' is-active' : ''}`} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>

            {tab === 'form' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SharePanel event={selected} onStatus={setEventStatus} onRegen={regenerateCode} onCopy={() => showToast('Copied', 'ok')} />
                {formId
                  ? <FormBuilder formId={formId} onToast={(m, t) => showToast(m, t === 'error' ? 'dng' : 'ok')} onStatus={() => loadEvents()} />
                  : <div className="mt-card mt-td--muted">This event has no form attached.</div>}
              </div>
            )}

            {tab === 'feedback' && <Responses eventId={selected.id} onToast={(m, t) => showToast(m, t === 'error' ? 'dng' : 'ok')} />}
          </>
        )}

        {showNew && (
          <NewEventModal
            forms={forms}
            onClose={() => setShowNew(false)}
            onCreated={async (ev) => { setShowNew(false); await Promise.all([loadEvents(), loadForms()]); setSelId(ev.id || ev._id); setTab('form'); showToast('Event created', 'ok'); }}
            onToast={(m, t) => showToast(m, t === 'error' ? 'dng' : 'ok')}
          />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}

// ── Event code + QR + open/close ─────────────────────────────────────────────
function SharePanel({ event, onStatus, onRegen, onCopy }) {
  const copy = (text) => { navigator.clipboard?.writeText(text).then(() => onCopy?.()); };
  return (
    <div className="mt-card dev-share">
      <div className="dev-share-qr"><QRCodeCanvas value={event.code} size={128} fgColor="#0C447C" bgColor="#ffffff" /></div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="mt-label">Event code — attendees enter this in the app</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 4px' }}>
          <span className="dev-share-code">{event.code}</span>
          <button className="mt-btn--small-outline" onClick={() => copy(event.code)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCopy size={14} /> Copy</button>
        </div>
        <div className="mt-td--muted" style={{ fontSize: 12 }}>Attendees scan the QR or type this code into the AMETI Event Feedback app.</div>
        <div style={{ display: 'flex', gap: 8, marginBlockStart: 12, flexWrap: 'wrap' }}>
          {event.status === 'open'
            ? <button className="mt-btn--danger" onClick={() => onStatus('close')}>Close event</button>
            : <button className="mt-btn mt-btn--small" onClick={() => onStatus('open')}>Open event</button>}
          <button className="mt-btn--small-outline" onClick={onRegen}>Regenerate code</button>
        </div>
      </div>
    </div>
  );
}

// ── New event modal ──────────────────────────────────────────────────────────
function NewEventModal({ forms, onClose, onCreated, onToast }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [facilitators, setFacilitators] = useState('');
  const [formId, setFormId] = useState(forms[0]?.id || '');
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try {
      let fId = formId;
      if (fId === '__new__') {
        const fr = await api.post('/api/event-feedback/forms', { title: title || 'New form' });
        fId = (fr.data?.data || fr.data)._id;
      }
      if (!fId) { onToast?.('Choose or create a form', 'error'); setBusy(false); return; }
      const r = await api.post('/api/event-feedback/events', {
        title: title || 'Untitled event', date: date || null, location,
        facilitators: facilitators.split(',').map((s) => s.trim()).filter(Boolean), formId: fId,
      });
      onCreated(r.data?.data || r.data);
    } catch (e) { onToast?.(e.response?.data?.message || 'Failed to create event', 'error'); setBusy(false); }
  }

  return (
    <MtModal open title="New event" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create event'}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full"><label className="mt-label">Title</label><input className="mt-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cardiology Grand Round" /></div>
        <div className="mt-field"><label className="mt-label">Date</label><input className="mt-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">Location / platform</label><input className="mt-input" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">Facilitator(s) — comma separated</label><input className="mt-input" value={facilitators} onChange={(e) => setFacilitators(e.target.value)} /></div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Form</label>
          <select className="mt-select" value={formId} onChange={(e) => setFormId(e.target.value)}>
            {forms.map((f) => <option key={f.id} value={f.id}>{f.title} {f.status === 'published' ? '(published)' : `(${f.status})`}</option>)}
            <option value="__new__">+ Create a new blank form</option>
          </select>
        </div>
      </div>
    </MtModal>
  );
}
