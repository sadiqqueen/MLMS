// frontend/src/pages/DioAssignments.jsx
//
// Combined DIO "Assignments" page — Supervisor Distribution + Trainee Rotation
// on one screen with a tab switcher. Distribution opens by default. Each tab
// reuses the extracted panel from its original page (no code duplication).
//
// Deep links: `?tab=rotations` selects the Rotations tab; `?new=1` auto-opens
// the active tab's Add modal (consumed once, then stripped from the URL so a
// re-render/tab-switch never reopens it). Works under both /dio and /basic/dio.
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { DistributionsPanel } from './DioDistributions';
import { RotationsPanel } from './DioRotations';
import { ProgramDirectorsPanel } from './DioAssignPds';
import './dio.css';

const TABS = [
  { key: 'distributions',     label: 'Sup. Distribution' },
  { key: 'rotations',         label: 'Rotations' },
  { key: 'program-directors', label: 'Program Directors' },
];
const TAB_KEYS = TABS.map(t => t.key);

export default function DioAssignments() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const initialTab = TAB_KEYS.includes(params.get('tab')) ? params.get('tab') : 'distributions';
  const wantNew = params.get('new') === '1';

  const [tab, setTab] = useState(initialTab);
  // Consume `?new=1` exactly once, for whichever tab was requested.
  const [autoOpen, setAutoOpen] = useState(wantNew);

  // Strip `new=1` from the URL after mount so re-renders don't reopen the modal.
  useEffect(() => {
    if (!wantNew) return;
    const p = new URLSearchParams(location.search);
    p.delete('new');
    navigate({ pathname: location.pathname, search: p.toString() ? `?${p.toString()}` : '' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchTab(next) {
    if (next === tab) return;
    setTab(next);
    setAutoOpen(false);
    const p = new URLSearchParams(location.search);
    p.set('tab', next);
    p.delete('new');
    navigate({ pathname: location.pathname, search: `?${p.toString()}` }, { replace: true });
  }

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="dio-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={`dio-tab${tab === t.key ? ' is-active' : ''}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Only the active panel is mounted; keyed for a subtle crossfade. */}
        <div key={tab} style={{ animation: 'fadeIn .18s ease-out' }}>
          {tab === 'distributions' && <DistributionsPanel autoOpenNew={autoOpen && initialTab === 'distributions'} />}
          {tab === 'rotations'     && <RotationsPanel autoOpenNew={autoOpen && initialTab === 'rotations'} />}
          {tab === 'program-directors' && <ProgramDirectorsPanel />}
        </div>
      </main>
    </>
  );
}
