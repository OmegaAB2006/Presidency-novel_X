import { useState, useEffect, useCallback } from 'react';
import { items } from '../api';
import AddItemModal from './AddItemModal';
import MatchesModal from './MatchesModal';

const API_BASE = '';
const CONDITION_LABELS = { like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };
const STATUS_BADGE = { available: 'badge-green', traded: 'badge-purple', reserved: 'badge-yellow' };

export default function Inventory({ user }) {
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [matchItem, setMatchItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    items.list()
      .then(setMyItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdded = (item) => {
    setMyItems((prev) => [item, ...prev]);
    setShowAdd(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this item from inventory?')) return;
    setDeleteId(id);
    try {
      await items.delete(id);
      setMyItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleteId(null);
    }
  };

  const available = myItems.filter((i) => i.status === 'available');
  const traded = myItems.filter((i) => i.status !== 'available');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>My Inventory</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{available.length} available · {traded.length} traded</p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)}>
          + Add Item
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner" style={{ width: 36, height: 36 }} />
        </div>
      )}

      {!loading && myItems.length === 0 && (
        <div className="empty-state">
          <div className="icon">📦</div>
          <p>Your inventory is empty</p>
          <button className="btn-primary" onClick={() => setShowAdd(true)}>Add your first item</button>
        </div>
      )}

      {!loading && myItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {myItems.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Image */}
              <div style={{ height: 160, background: 'var(--bg)', overflow: 'hidden', position: 'relative' }}>
                {item.image_url
                  ? <img src={`${API_BASE}${item.image_url}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📦</div>
                }
                <span className={`badge ${STATUS_BADGE[item.status] || 'badge-gray'}`} style={{ position: 'absolute', top: 10, right: 10 }}>
                  {item.status}
                </span>
              </div>

              {/* Body */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: 16 }}>{item.name}</h3>
                  {item.description && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2, lineHeight: 1.4 }}>{item.description.slice(0, 80)}{item.description.length > 80 ? '…' : ''}</p>}
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="tag">{item.category}</span>
                  <span className="tag">{CONDITION_LABELS[item.condition] || item.condition}</span>
                  {item.value_estimate > 0 && <span className="tag">${item.value_estimate}</span>}
                </div>

                {item.wanted_category && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', borderRadius: 6, padding: '6px 10px' }}>
                    🔍 Wants: <strong>{item.wanted_category}</strong>
                    {item.wanted_description && ` — ${item.wanted_description.slice(0, 40)}…`}
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
                  {item.status === 'available' && (
                    <button className="btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMatchItem(item)}>
                      Find Matches
                    </button>
                  )}
                  <button
                    className="btn-danger btn-sm"
                    onClick={() => handleDelete(item.id)}
                    disabled={deleteId === item.id}
                  >
                    {deleteId === item.id ? <span className="spinner" /> : '🗑'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      {matchItem && (
        <MatchesModal
          myItem={matchItem}
          onClose={() => setMatchItem(null)}
          onTradeCreated={() => {}}
        />
      )}
    </div>
  );
}
