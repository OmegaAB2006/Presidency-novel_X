import { useState, useEffect } from 'react';
import { trades } from '../api';

const CONDITION_LABELS = { like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };
const API_BASE = '';

export default function MatchesModal({ myItem, onClose, onTradeCreated }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState({});

  useEffect(() => {
    trades.matches(myItem.id)
      .then(setMatches)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [myItem.id]);

  const sendRequest = async (match) => {
    setSending(match.id);
    try {
      await trades.create({
        requester_item_id: myItem.id,
        target_item_id: match.id,
        message
      });
      setSent((s) => ({ ...s, [match.id]: true }));
      onTradeCreated && onTradeCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <div>
            <h2>🔍 Matches for "{myItem.name}"</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>
              Ranked by compatibility score
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <span className="spinner" style={{ width: 32, height: 32 }} />
              <p style={{ marginTop: 12, color: 'var(--muted)' }}>Finding best matches...</p>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {!loading && matches.length === 0 && (
            <div className="empty-state">
              <div className="icon">🔍</div>
              <p>No matches in the {myItem.category} category yet.</p>
              <p style={{ fontSize: 13 }}>Check back once more items are listed.</p>
            </div>
          )}

          {!loading && matches.length > 0 && (
            <>
              <div className="form-group">
                <label>Trade Message (optional)</label>
                <input
                  placeholder="Hi! I'd love to trade my item for yours..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {matches.map((m) => (
                  <div key={m.id} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {/* Image */}
                    <div style={{
                      width: 80, height: 80, borderRadius: 10, overflow: 'hidden',
                      background: 'var(--bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {m.image_url
                        ? <img src={`${API_BASE}${m.image_url}`} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: 28 }}>📦</span>
                      }
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700 }}>{m.name}</h3>
                          <p style={{ color: 'var(--muted)', fontSize: 13 }}>by {m.owner?.username}</p>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15, whiteSpace: 'nowrap' }}>
                          ${m.value_estimate}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 6, margin: '6px 0', flexWrap: 'wrap' }}>
                        <span className="tag">{m.category}</span>
                        <span className="tag">{CONDITION_LABELS[m.condition] || m.condition}</span>
                      </div>

                      {/* Match score bar */}
                      <div className="score-bar" style={{ marginTop: 8 }}>
                        <span>{Math.round(m.match_score * 100)}%</span>
                        <div className="score-bar-track">
                          <div className="score-bar-fill" style={{ width: `${m.match_score * 100}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>match</span>
                      </div>
                    </div>

                    {/* Action */}
                    <div style={{ flexShrink: 0 }}>
                      {sent[m.id] ? (
                        <span className="badge badge-green">✓ Sent</span>
                      ) : (
                        <button
                          className="btn-primary btn-sm"
                          onClick={() => sendRequest(m)}
                          disabled={sending === m.id}
                        >
                          {sending === m.id ? <span className="spinner" /> : '🤝 Trade'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
