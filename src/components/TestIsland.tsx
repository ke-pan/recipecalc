import { useState } from 'react';

export default function TestIsland() {
  const [count, setCount] = useState(0);

  return (
    <div
      className="test-island"
      style={{
        padding: 'var(--space-md)',
        backgroundColor: 'var(--surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        marginTop: 'var(--space-md)',
      }}
    >
      <p style={{ fontFamily: 'var(--font-body)', marginBottom: 'var(--space-sm)' }}>
        React Island is working.
      </p>
      <p className="mono" style={{ marginBottom: 'var(--space-sm)' }}>
        Count: {count}
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize: 'var(--text-sm)',
          padding: 'var(--space-sm) var(--space-md)',
          backgroundColor: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
        }}
      >
        Increment
      </button>
    </div>
  );
}
