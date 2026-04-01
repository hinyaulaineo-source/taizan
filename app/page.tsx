export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '760px',
          padding: '2.2rem',
          borderRadius: '16px',
          border: '0.5px solid #222',
          background: '#111',
        }}
      >
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '10px' }}>TAIZAN Athletics</p>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: 600, color: '#fff' }}>
          The Basecamp for Speed Lab training
        </h1>
        <p style={{ color: '#a3a3a3', fontSize: '15px', marginBottom: '1.6rem', lineHeight: 1.7 }}>
          Role-based dashboards for owners, coaches, athletes, and parents. Manage sessions, approvals,
          bookings, and feedback in one place.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a
            href="/login"
            style={{
              background: '#fff',
              color: '#000',
              padding: '10px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Sign in
          </a>
          <a
            href="/dashboard"
            style={{
              border: '0.5px solid #333',
              color: '#ddd',
              padding: '10px 16px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </main>
  )
}
