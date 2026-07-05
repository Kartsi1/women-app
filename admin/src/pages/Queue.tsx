import { useState, useEffect, useCallback } from 'react';
import { getVerificationQueue, type PendingUser } from '../api/adminApi';
import VerificationCard from '../components/VerificationCard';

export default function Queue() {
  const [queue, setQueue] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getVerificationQueue();
      if (result.error) {
        setError(result.error);
      } else {
        setQueue(result.queue ?? []);
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Verification Queue</h1>
        <button onClick={() => void fetchQueue()} disabled={loading} style={styles.refreshButton}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && queue.length === 0 && (
        <p style={styles.empty}>No pending verifications.</p>
      )}

      {queue.map((user) => (
        <VerificationCard
          key={user.uid}
          user={user}
          onActionComplete={() => void fetchQueue()}
        />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: '0 auto',
    padding: 32,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    margin: 0,
    color: '#222',
  },
  refreshButton: {
    padding: '8px 16px',
    fontSize: 14,
    backgroundColor: '#6200ee',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  },
  error: {
    color: '#c0392b',
    marginBottom: 16,
  },
  empty: {
    color: '#888',
    fontStyle: 'italic',
  },
};
