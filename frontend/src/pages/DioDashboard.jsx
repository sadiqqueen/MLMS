import Navbar from '../components/Navbar';

export default function DioDashboard() {
  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ padding: 48, textAlign: 'center', color: '#8B8FA8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1B1464', marginBottom: 6 }}>DIO — Dashboard</div>
          <div style={{ fontSize: 14 }}>This page is being built. Check back soon.</div>
        </div>
      </main>
    </>
  );
}
