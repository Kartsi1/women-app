import { useState, useEffect, useCallback } from 'react';
import { getReports, resolveReport, type Report } from '../api/adminApi';

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getReports();
      if (result.error) {
        setError(result.error);
      } else {
        setReports(result.reports ?? []);
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  async function resolve(id: string) {
    setBusy(id);
    try {
      const res = await resolveReport(id);
      if (res.error) setError(res.error);
      await fetchReports();
    } catch {
      setError('Action failed.');
    } finally {
      setBusy(null);
    }
  }

  const visible = showResolved ? reports : reports.filter((r) => r.status === 'open');
  const openCount = reports.filter((r) => r.status === 'open').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Reports ({openCount} open)</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={styles.toggle}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            Show resolved
          </label>
          <button onClick={() => void fetchReports()} disabled={loading} style={styles.refreshButton}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && visible.length === 0 && <p style={styles.empty}>No reports.</p>}

      {!error && visible.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Reporter</th>
              <th style={styles.th}>Target</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Reason</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={styles.td}>{r.reporterName}</td>
                <td style={styles.td}>
                  {r.reportedName ?? <span style={styles.muted}>—</span>}
                  {r.contentId && <span style={styles.muted}> #{r.contentId.slice(-6)}</span>}
                </td>
                <td style={styles.td}>{r.contentType ?? <span style={styles.muted}>—</span>}</td>
                <td style={styles.tdReason}>{r.reason}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      color: r.status === 'open' ? '#b45309' : '#15803d',
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={styles.td}>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  {r.status === 'open' ? (
                    <button
                      style={styles.resolveBtn}
                      disabled={busy === r.id}
                      onClick={() => void resolve(r.id)}
                    >
                      Resolve
                    </button>
                  ) : (
                    <span style={styles.muted}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1000, margin: '0 auto', padding: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: 700, margin: 0 },
  toggle: { fontSize: 14, color: '#555', display: 'flex', gap: 6, alignItems: 'center' },
  refreshButton: {
    padding: '8px 16px', borderRadius: 6, border: 'none',
    background: '#6200ea', color: '#fff', cursor: 'pointer', fontWeight: 600,
  },
  error: { color: '#d32f2f' },
  empty: { color: '#888' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #eee', color: '#555' },
  td: { padding: '10px 8px', borderBottom: '1px solid #f0f0f0', verticalAlign: 'top' },
  tdReason: { padding: '10px 8px', borderBottom: '1px solid #f0f0f0', maxWidth: 280 },
  muted: { color: '#bbb' },
  badge: { fontWeight: 700, textTransform: 'capitalize' },
  resolveBtn: {
    padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: '#15803d', color: '#fff', fontWeight: 600, fontSize: 12,
  },
};
