import { useState, useEffect, useCallback } from 'react';
import {
  getUsers,
  approveUser,
  rejectUser,
  banUser,
  unbanUser,
  type AdminUser,
} from '../api/adminApi';

const STATUS_COLORS: Record<AdminUser['verificationStatus'], string> = {
  none: '#888',
  pending: '#b45309',
  approved: '#15803d',
  rejected: '#b91c1c',
};

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers();
      if (result.error) {
        setError(result.error);
      } else {
        setUsers(result.users ?? []);
      }
    } catch {
      setError('Network error — is the backend running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  async function runAction(uid: string, fn: () => Promise<{ error?: string }>) {
    setBusy(uid);
    try {
      const res = await fn();
      if (res.error) setError(res.error);
      await fetchUsers();
    } catch {
      setError('Action failed.');
    } finally {
      setBusy(null);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          (u.displayName ?? '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.homeCity ?? '').toLowerCase().includes(q),
      )
    : users;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Users ({users.length})</h1>
        <button onClick={() => void fetchUsers()} disabled={loading} style={styles.refreshButton}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <input
        style={styles.search}
        placeholder="Search name / email / city"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {error && <p style={styles.error}>{error}</p>}

      {!loading && !error && filtered.length === 0 && <p style={styles.empty}>No users.</p>}

      {!error && filtered.length > 0 && (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>City</th>
              <th style={styles.th}>Status</th>
              <th style={styles.thNum}>Hosted</th>
              <th style={styles.thNum}>Trips</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.uid}>
                <td style={styles.td}>{u.displayName ?? <span style={styles.muted}>—</span>}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>{u.homeCity ?? <span style={styles.muted}>—</span>}</td>
                <td style={styles.td}>
                  <span style={{ ...styles.badge, color: STATUS_COLORS[u.verificationStatus] }}>
                    {u.verificationStatus}
                  </span>
                  {u.banned && <span style={styles.bannedTag}>BANNED</span>}
                </td>
                <td style={styles.tdNum}>{u.hostsCount}</td>
                <td style={styles.tdNum}>{u.tripsCount}</td>
                <td style={styles.td}>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <div style={styles.actions}>
                    {u.verificationStatus === 'pending' && (
                      <>
                        <button
                          style={styles.approveBtn}
                          disabled={busy === u.uid}
                          onClick={() => void runAction(u.uid, () => approveUser(u.uid))}
                        >
                          Approve
                        </button>
                        <button
                          style={styles.rejectBtn}
                          disabled={busy === u.uid}
                          onClick={() => {
                            const reason = window.prompt('Rejection reason:');
                            if (reason && reason.trim()) {
                              void runAction(u.uid, () => rejectUser(u.uid, reason.trim()));
                            }
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {u.banned ? (
                      <button
                        style={styles.unbanBtn}
                        disabled={busy === u.uid}
                        onClick={() => void runAction(u.uid, () => unbanUser(u.uid))}
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        style={styles.banBtn}
                        disabled={busy === u.uid}
                        onClick={() => {
                          if (window.confirm('Ban this user? They lose access until unbanned.')) {
                            void runAction(u.uid, () => banUser(u.uid));
                          }
                        }}
                      >
                        Ban
                      </button>
                    )}
                  </div>
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
  refreshButton: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#6200ea',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid #ddd',
    marginBottom: 16,
    fontSize: 14,
  },
  error: { color: '#d32f2f' },
  empty: { color: '#888' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #eee', color: '#555' },
  thNum: { textAlign: 'right', padding: '10px 8px', borderBottom: '2px solid #eee', color: '#555' },
  td: { padding: '10px 8px', borderBottom: '1px solid #f0f0f0' },
  tdNum: { padding: '10px 8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' },
  muted: { color: '#bbb' },
  badge: { fontWeight: 700, textTransform: 'capitalize' },
  bannedTag: {
    marginLeft: 6,
    fontSize: 10,
    fontWeight: 700,
    color: '#fff',
    background: '#b91c1c',
    padding: '1px 5px',
    borderRadius: 4,
  },
  actions: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  approveBtn: {
    padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: '#15803d', color: '#fff', fontWeight: 600, fontSize: 12,
  },
  rejectBtn: {
    padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: '#b45309', color: '#fff', fontWeight: 600, fontSize: 12,
  },
  banBtn: {
    padding: '5px 10px', borderRadius: 5, border: '1px solid #b91c1c', cursor: 'pointer',
    background: '#fff', color: '#b91c1c', fontWeight: 600, fontSize: 12,
  },
  unbanBtn: {
    padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: '#374151', color: '#fff', fontWeight: 600, fontSize: 12,
  },
};
