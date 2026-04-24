import { useState, useEffect, useCallback } from 'react';
import { items, trades } from '../api';

const API_BASE = '';
const CATEGORIES = ['', 'electronics', 'sports', 'books', 'clothing', 'furniture', 'tools', 'music', 'art', 'games', 'other'];
const CATEGORY_LABELS = { '': 'All', electronics: 'Electronics', sports: 'Sports', books: 'Books', clothing: 'Clothing', furniture: 'Furniture', tools: 'Tools', music: 'Music', art: 'Art', games: 'Games', other: 'Other' };
const CONDITION_LABELS = { like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };

function TradeOfferModal({ targetItem, myItems, onClose, onSent }) {
  const [selectedItem, setSelectedItem] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableItems = myItems.filter((i) => i.status === 'available');

  const send = async () => {
    if (!selectedItem) { setError('Select an item to offer'); return; }
    setLoading(true);
    try {
      await trades.create({ requester_item_id: selectedItem, target_item_id: targetItem.id, message });
      onSent();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h2>🤝 Make Trade Offer</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg)', padding: 12, borderRadius: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {targetItem.image_url
                ? <img src={`${API_BASE}${targetItem.image_url}`} alt={targetItem.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>📦</span>
              }
            </div>
            <div>
              <p style={{ fontWeight: 700 }}>{targetItem.name}</p>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>{targetItem.category} · ${targetItem.value_estimate}</p>
            </div>
          </div>

          <div className="form-group">
            <label>Offer one of your items</label>
            {availableItems.length === 0
              ? <p style={{ color: 'var(--muted)', fontSize: 13 }}>No available items in your inventory. Add items first.</p>
              : <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}>
                  <option value="">Select item...</option>
                  {availableItems.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} (${i.value_estimate})</option>
                  ))}
                </select>
            }
          </div>

          <div className="form-group">
            <label>Message (optional)</label>
            <textarea placeholder="Introduce yourself and explain why you want to trade..." value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          {error && <div className="error-msg">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={loading || availableItems.length === 0}>
            {loading ? <span className="spinner" /> : '🤝 Send Offer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Marketplace({ user }) {
  const [allItems, setAllItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [offerItem, setOfferItem] = useState(null);
  const [sentTrades, setSentTrades] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([items.marketplace(category), items.list()])
      .then(([market, mine]) => { setAllItems(market); setMyItems(mine); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800 }}>Marketplace</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Browse items available for trade</p>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600,
              background: category === c ? 'var(--primary)' : 'var(--surface)',
              color: category === c ? 'white' : 'var(--muted)',
              border: '1px solid var(--border)',
              transition: 'all 0.15s'
            }}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      )}

      {!loading && allItems.length === 0 && (
        <div className="empty-state">
          <div className="icon">🏪</div>
          <p>No items in the marketplace yet</p>
          <p style={{ fontSize: 13 }}>Add items to your inventory and they'll appear here for others.</p>
        </div>
      )}

      {!loading && allItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {allItems.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', transition: 'transform 0.15s', cursor: 'default' }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = ''}
            >
              <div style={{ height: 170, background: 'var(--bg)', overflow: 'hidden' }}>
                {item.image_url
                  ? <img src={`${API_BASE}${item.image_url}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📦</div>
                }
              </div>

              <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</h3>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>${item.value_estimate}</span>
                </div>

                <p style={{ color: 'var(--muted)', fontSize: 13 }}>by {item.owner?.username}</p>

                {item.description && (
                  <p style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.4 }}>
                    {item.description.slice(0, 70)}{item.description.length > 70 ? '…' : ''}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="tag">{item.category}</span>
                  <span className="tag">{CONDITION_LABELS[item.condition] || item.condition}</span>
                </div>

                {item.wanted_category && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
                    🔍 Wants: <strong>{item.wanted_category}</strong>
                  </div>
                )}

                <button
                  className="btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
                  onClick={() => setOfferItem(item)}
                  disabled={sentTrades[item.id]}
                >
                  {sentTrades[item.id] ? '✓ Offer Sent' : '🤝 Make Offer'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {offerItem && (
        <TradeOfferModal
          targetItem={offerItem}
          myItems={myItems}
          onClose={() => setOfferItem(null)}
          onSent={() => { setSentTrades((s) => ({ ...s, [offerItem.id]: true })); setOfferItem(null); }}
        />
      )}
    </div>
  );
}
