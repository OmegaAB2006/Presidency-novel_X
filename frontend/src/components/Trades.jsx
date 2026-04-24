import { useState, useEffect, useCallback } from 'react';
import { trades } from '../api';

const API_BASE = '';

const STATUS_BADGE = {
  pending: 'badge-yellow',
  accepted: 'badge-green',
  rejected: 'badge-red',
  cancelled: 'badge-gray'
};

function ItemThumb({ item }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--bg)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {item?.image_url
          ? <img src={`${API_BASE}${item.image_url}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span>📦</span>
        }
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: 14 }}>{item?.name || '—'}</p>
        <p style={{ color: 'var(--muted)', fontSize: 12 }}>{item?.category} · ${item?.value_estimate}</p>
      </div>
    </div>
  );
}

function RateModal({ trade, userId, onClose, onRated }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    try {
      await trades.rate(trade.id, { rating, comment });
      onRated();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h2>⭐ Rate Trade</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>How was your trading experience?</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setRating(s)}
                style={{
                  fontSize: 28, background: 'transparent', padding: 4,
                  color: s <= rating ? '#f59e0b' : '#cbd5e1'
                }}
              >★</button>
            ))}
          </div>
          <div className="form-group">
            <label>Comment (optional)</label>
            <textarea placeholder="Great trade! Very responsive..." value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <div className="error-msg">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="spinner" /> : '⭐ Submit Rating'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Trades({ user }) {
  const [data, setData] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [responding, setResponding] = useState(null);
  const [ratingTrade, setRatingTrade] = useState(null);
  const [rated, setRated] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    trades.list()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (tradeId, action) => {
    setResponding(tradeId + action);
    try {
      await trades.respond(tradeId, action);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setResponding(null);
    }
  };

  const list = tab === 'received' ? data.received : data.sent;
  const pendingReceived = data.received.filter((t) => t.status === 'pending').length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Trade Requests</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage incoming and outgoing trade offers</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 20 }}>
        {['received', 'sent'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: tab === t ? 'var(--surface)' : 'transparent',
              color: tab === t ? 'var(--primary)' : 'var(--muted)',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
              fontWeight: 600, textTransform: 'capitalize'
            }}
          >
            {t}
            {t === 'received' && pendingReceived > 0 && (
              <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: 11, marginLeft: 6 }}>
                {pendingReceived}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="empty-state">
          <div className="icon">{tab === 'received' ? '📬' : '📤'}</div>
          <p>No {tab} trade requests yet</p>
        </div>
      )}

      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.map((trade) => (
            <div key={trade.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                {/* Trade items */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <ItemThumb item={trade.requester_item} />
                  <div style={{ color: 'var(--muted)', fontSize: 20 }}>⇄</div>
                  <ItemThumb item={trade.target_item} />
                </div>

                {/* Meta */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span className={`badge ${STATUS_BADGE[trade.status] || 'badge-gray'}`}>{trade.status}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Match: <strong style={{ color: 'var(--primary)' }}>{Math.round(trade.match_score * 100)}%</strong>
                  </span>
                  {tab === 'received' && (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>from <strong>{trade.requester_username}</strong></span>
                  )}
                </div>
              </div>

              {/* Message */}
              {trade.message && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                  "{trade.message}"
                </div>
              )}

              {/* Actions */}
              {trade.status === 'pending' && tab === 'received' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    className="btn-success btn-sm"
                    onClick={() => respond(trade.id, 'accept')}
                    disabled={!!responding}
                  >
                    {responding === trade.id + 'accept' ? <span className="spinner" /> : '✓ Accept'}
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => respond(trade.id, 'reject')}
                    disabled={!!responding}
                  >
                    {responding === trade.id + 'reject' ? <span className="spinner" /> : '✕ Decline'}
                  </button>
                </div>
              )}

              {/* Rate button */}
              {trade.status === 'accepted' && !rated[trade.id] && (
                <div style={{ marginTop: 12 }}>
                  <button className="btn-warning btn-sm" onClick={() => setRatingTrade(trade)}>
                    ⭐ Leave Rating
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {ratingTrade && (
        <RateModal
          trade={ratingTrade}
          userId={user.id}
          onClose={() => setRatingTrade(null)}
          onRated={() => setRated((r) => ({ ...r, [ratingTrade.id]: true }))}
        />
      )}
    </div>
  );
}
