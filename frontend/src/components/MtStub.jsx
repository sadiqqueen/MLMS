import Navbar from './Navbar';
import { IconLayers } from './icons';

// Placeholder page body for routes whose real screen ships in a later wave.
// Renders the mt- shell (Navbar branches to the mt- nav + Topbar for the
// redesigned roles) with a dashed empty-state. Wave agents replace the whole
// stub page file with the real implementation.
export default function MtStub({ title, subtitle, note = 'This screen arrives in an upcoming wave.' }) {
  return (
    <>
      <Navbar title={title} subtitle={subtitle} />
      <main className="mt-content">
        <div className="mt-empty">
          <div className="mt-empty-icon"><IconLayers size={22} /></div>
          <div className="mt-empty-title">{title || 'Coming soon'}</div>
          <div className="mt-empty-sub">{note}</div>
        </div>
      </main>
    </>
  );
}
