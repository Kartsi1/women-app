import { useState } from 'react';
import { approveUser, rejectUser, type PendingUser } from '../api/adminApi';

interface VerificationCardProps {
  user: PendingUser;
  onActionComplete: () => void;
}

export default function VerificationCard({ user, onActionComplete }: VerificationCardProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setActionError(null);
    try {
      const result = await approveUser(user.uid);
      if (result.error) {
        setActionError(result.error);
      } else {
        onActionComplete();
      }
    } catch {
      setActionError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return; // guard — button should be disabled, but double-check
    setLoading(true);
    setActionError(null);
    try {
      const result = await rejectUser(user.uid, rejectReason.trim());
      if (result.error) {
        setActionError(result.error);
      } else {
        onActionComplete();
      }
    } catch {
      setActionError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.email}>{user.email}</h3>
      <p style={styles.meta}>Submitted: {new Date(user.createdAt).toLocaleString()}</p>

      <div style={styles.documents}>
        <div style={styles.docSlot}>
          <p style={styles.docLabel}>ID Document</p>
          {user.docUrl ? (
            <img src={user.docUrl} alt="ID Document" style={styles.docImage} />
          ) : (
            <p style={styles.noDoc}>No document URL</p>
          )}
        </div>
        <div style={styles.docSlot}>
          <p style={styles.docLabel}>Selfie</p>
          {user.selfieUrl ? (
            <img src={user.selfieUrl} alt="Selfie" style={styles.docImage} />
          ) : (
            <p style={styles.noDoc}>No selfie URL</p>
          )}
        </div>
      </div>

      {actionError && <p style={styles.error}>{actionError}</p>}

      <div style={styles.actions}>
        <button
          onClick={handleApprove}
          disabled={loading}
          style={{ ...styles.actionButton, ...styles.approveButton }}
        >
          {loading ? '…' : 'Approve'}
        </button>
      </div>

      {/* Reject requires a reason — Reject button is disabled until non-empty (D-07) */}
      <div style={styles.rejectSection}>
        <input
          type="text"
          placeholder="Rejection reason (required)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          style={styles.rejectInput}
          disabled={loading}
        />
        <button
          onClick={handleReject}
          disabled={loading || !rejectReason.trim()}
          style={{
            ...styles.actionButton,
            ...styles.rejectButton,
            opacity: !rejectReason.trim() ? 0.4 : 1,
            cursor: !rejectReason.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  email: {
    margin: '0 0 4px',
    fontSize: 17,
    color: '#222',
  },
  meta: {
    margin: '0 0 16px',
    fontSize: 13,
    color: '#888',
  },
  documents: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  docSlot: {
    flex: 1,
  },
  docLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#555',
    marginBottom: 6,
  },
  docImage: {
    width: '100%',
    maxHeight: 240,
    objectFit: 'contain',
    border: '1px solid #eee',
    borderRadius: 4,
    backgroundColor: '#f9f9f9',
  },
  noDoc: {
    fontSize: 13,
    color: '#aaa',
    fontStyle: 'italic',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    display: 'flex',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    padding: '8px 20px',
    fontSize: 14,
    border: 'none',
    borderRadius: 4,
    fontWeight: 600,
  },
  approveButton: {
    backgroundColor: '#27ae60',
    color: '#fff',
    cursor: 'pointer',
  },
  rejectSection: {
    display: 'flex',
    gap: 8,
  },
  rejectInput: {
    flex: 1,
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccc',
    borderRadius: 4,
    outline: 'none',
  },
  rejectButton: {
    backgroundColor: '#e74c3c',
    color: '#fff',
  },
};
