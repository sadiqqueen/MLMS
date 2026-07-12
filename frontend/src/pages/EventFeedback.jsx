import { useState, useEffect, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import FormBuilder from '../components/eventFeedback/FormBuilder';
import Responses from '../components/eventFeedback/Responses';

const ACCENT = '#F0892B';
const box = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
const inp = { padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 };

export default function EventFeedback() {
  const [events, setEvents]   = useState([]);
  const [forms, setForms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [selId, setSelId]     = useState('');
  const [tab, setTab]         = useState('form');
  const [toasts, setToasts]   = useState([]);
  const [showNew, setShowNew] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  const loadEvents = useCallback(() => {
    return api.get('/api/event-feedback/events', { cache: false })
      .then(r => setEvents(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load events', 'error'));
  }, [showToast]);

  const loadForms = useCallback(() => {
    return api.get('/api/event-feedback/forms', { cache: false })
      .then(r => setForms(r.data?.data || r.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { Promise.all([loadEvents(), loadForms()]).finally(() => setLoading(false)); }, [loadEvents, loadForms]);

  // Default-select the first event once loaded.
  useEffect(() => { if (!selId && events.length) setSelId(events[0].id); }, [events, selId]);

  const selected = events.find(e => e.id === selId) || null;
  const formId = selected ? (selected.form?.id || selected.formId) : null;

  async function setEventStatus(action) {
    try {
      await api.post(`/api/event-feedback/events/${selId}/${action}`);
      await loadEvents();
      showToast(action === 'open' ? 'Event opened — accepting responses' : 'Event closed');
    } catch (e) { showToast('Failed to update event', 'error'); }
  }

  async function regenerateCode() {
    try {
      const r = await api.post(`/api/event-feedback/events/${selId}/regenerate-code`);
      await loadEvents();
      showToast('New code generated: ' + (r.data?.data?.code || ''));
    } catch (e) { showToast('Failed to regenerate code', 'error'); }
  }

  return (
    <>
      <Navbar />
      <main className="admin-main">
        {/* Header */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-secondary)' }}>Event Feedback</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Build the evaluation form, share an event code/QR, and see responses — all here.</div>
        </div>

        {/* Event selector bar */}
        <div style={{ ...box, padding: 14, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Event</label>
          <select style={{ ...inp, minWidth: 220 }} value={selId} onChange={e => setSelId(e.target.value)}>
            {events.length === 0 && <option value="">No events yet</option>}
            {events.map(e => <option key={e.id} value={e.id}>{e.title} · {e.code}{e.status === 'closed' ? ' (closed)' : ''}</option>)}
          </select>
          <button className="btn-purple" onClick={() => setShowNew(true)}>＋ New event</button>
          {selected && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'var(--surface-2)', border: '1px solid var(--border)', color: selected.status === 'open' ? '#059669' : '#d97706' }}>
              {selected.status === 'open' ? '● Accepting responses' : '● Closed'}
            </span>
          )}
        </div>

        {loading && <div style={{ ...box, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}

        {!loading && !selected && (
          <div style={{ ...box, padding: 56, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No event selected</div>
            <div style={{ fontSize: 13 }}>Create an event to attach a form and collect feedback.</div>
          </div>
        )}

        {!loading && selected && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
              {[['form', 'Form'], ['feedback', 'Feedback']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} style={{
                  padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  color: tab === k ? ACCENT : 'var(--text-muted)', borderBottom: '2px solid ' + (tab === k ? ACCENT : 'transparent'), marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>

            {tab === 'form' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <SharePanel event={selected} onStatus={setEventStatus} onRegen={regenerateCode} onToast={showToast} />
                {formId
                  ? <FormBuilder formId={formId} onToast={showToast} onStatus={() => loadEvents()} />
                  : <div style={{ ...box, padding: 24, color: 'var(--text-muted)' }}>This event has no form attached.</div>}
              </div>
            )}

            {tab === 'feedback' && <Responses eventId={selected.id} onToast={showToast} />}
          </>
        )}

        {showNew && (
          <NewEventModal
            forms={forms}
            onClose={() => setShowNew(false)}
            onCreated={async (ev) => { setShowNew(false); await Promise.all([loadEvents(), loadForms()]); setSelId(ev.id || ev._id); setTab('form'); showToast('Event created'); }}
            onToast={showToast}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}

// ── Event code + QR + open/close ─────────────────────────────────────────────
function SharePanel({ event, onStatus, onRegen, onToast }) {
  const copy = (text) => { navigator.clipboard?.writeText(text).then(() => onToast?.('Copied')); };
  return (
    <div style={{ ...box, padding: 18, display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ background: '#fff', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
        <QRCodeCanvas value={event.code} size={128} fgColor="#3B2A18" bgColor="#ffffff" />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Event code — attendees enter this in the app</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 4px' }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '.12em', color: ACCENT, fontFamily: 'monospace' }}>{event.code}</span>
          <button onClick={() => copy(event.code)} style={{ ...inp, cursor: 'pointer' }}>Copy</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Attendees scan the QR or type this code into the AMETI Event Feedback app.</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {event.status === 'open'
            ? <button onClick={() => onStatus('close')} style={{ ...inp, cursor: 'pointer', fontWeight: 700, color: '#d97706' }}>Close event</button>
            : <button onClick={() => onStatus('open')} style={{ ...inp, cursor: 'pointer', fontWeight: 700, background: ACCENT, color: '#fff', border: 'none' }}>Open event</button>}
          <button onClick={onRegen} style={{ ...inp, cursor: 'pointer' }}>Regenerate code</button>
        </div>
      </div>
    </div>
  );
}

// ── New event modal ──────────────────────────────────────────────────────────
function NewEventModal({ forms, onClose, onCreated, onToast }) {
  const [title, setTitle] = useState('');
  const [date, setDate]   = useState('');
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
        facilitators: facilitators.split(',').map(s => s.trim()).filter(Boolean), formId: fId,
      });
      onCreated(r.data?.data || r.data);
    } catch (e) { onToast?.(e.response?.data?.message || 'Failed to create event', 'error'); setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...box, padding: 22, width: 440, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--brand-secondary)' }}>New event</div>
        <div><label style={mLbl}>Title</label><input style={{ ...inp, width: '100%' }} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Cardiology Grand Round" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={mLbl}>Date</label><input type="date" style={{ ...inp, width: '100%' }} value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><label style={mLbl}>Location / Platform</label><input style={{ ...inp, width: '100%' }} value={location} onChange={e => setLocation(e.target.value)} /></div>
        </div>
        <div><label style={mLbl}>Facilitator(s) — comma separated</label><input style={{ ...inp, width: '100%' }} value={facilitators} onChange={e => setFacilitators(e.target.value)} /></div>
        <div>
          <label style={mLbl}>Form</label>
          <select style={{ ...inp, width: '100%' }} value={formId} onChange={e => setFormId(e.target.value)}>
            {forms.map(f => <option key={f.id} value={f.id}>{f.title} {f.status === 'published' ? '(published)' : '(' + f.status + ')'}</option>)}
            <option value="__new__">➕ Create a new blank form</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <button onClick={onClose} style={{ ...inp, cursor: 'pointer' }}>Cancel</button>
          <button onClick={create} disabled={busy} className="btn-purple" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating…' : 'Create event'}</button>
        </div>
      </div>
    </div>
  );
}
const mLbl = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, display: 'block' };
