import { useState } from 'react';
import { items } from '../api';

const CATEGORIES = ['Electronics', 'Sports', 'Books', 'Clothing', 'Furniture', 'Tools', 'Music', 'Art', 'Games', 'Other'];
const CONDITIONS = ['like_new', 'excellent', 'good', 'fair', 'poor'];
const CONDITION_LABELS = { like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };

export default function AddItemModal({ onClose, onAdded }) {
  const [step, setStep] = useState(1); // 1=item details, 2=what you want
  const [form, setForm] = useState({
    name: '', description: '', category: '', condition: 'good',
    value_estimate: '', wanted_category: '', wanted_description: '', image: null
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm((f) => ({ ...f, image: file }));
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const next = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category) { setError('Name and category are required'); return; }
    setError('');
    setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'image' && v) fd.append('image', v);
        else if (k !== 'image') fd.append(k, v ?? '');
      });
      const item = await items.create(fd);
      onAdded(item);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2>{step === 1 ? '📦 Add Item to Inventory' : '🔍 What Do You Want?'}</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>Step {step} of 2</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px 0' }}>
          {[1, 2].map((s) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'background 0.2s'
            }} />
          ))}
        </div>

        {step === 1 ? (
          <form onSubmit={next}>
            <div className="modal-body">
              {/* Image upload */}
              <div style={{ textAlign: 'center' }}>
                <label style={{
                  display: 'block', width: '100%', height: 160,
                  border: '2px dashed var(--border)', borderRadius: 12, cursor: 'pointer',
                  background: preview ? 'transparent' : 'var(--bg)',
                  overflow: 'hidden', position: 'relative'
                }}>
                  {preview
                    ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ paddingTop: 50, color: 'var(--muted)', fontSize: 14 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                        Click to upload image
                      </div>
                  }
                  <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
                </label>
              </div>

              <div className="form-group">
                <label>Item Name *</label>
                <input placeholder="e.g. Vintage Bicycle" value={form.name} onChange={set('name')} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Category *</label>
                  <select value={form.category} onChange={set('category')} required>
                    <option value="">Select...</option>
                    {CATEGORIES.map((c) => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select value={form.condition} onChange={set('condition')}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Estimated Value ($)</label>
                <input type="number" min="0" placeholder="50" value={form.value_estimate} onChange={set('value_estimate')} />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea placeholder="Describe your item — age, features, any defects..." value={form.description} onChange={set('description')} />
              </div>

              {error && <div className="error-msg">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary">Next: What I Want →</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit}>
            <div className="modal-body">
              <p style={{ color: 'var(--muted)', fontSize: 14, padding: '4px 0' }}>
                Tell others what you'd like in return. This improves match quality.
              </p>
              <div className="form-group">
                <label>Preferred Category</label>
                <select value={form.wanted_category} onChange={set('wanted_category')}>
                  <option value="">Any category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c.toLowerCase()}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Describe What You Want</label>
                <textarea
                  placeholder="e.g. Looking for electronics or sports gear in good condition..."
                  value={form.wanted_description}
                  onChange={set('wanted_description')}
                  style={{ minHeight: 120 }}
                />
              </div>
              {error && <div className="error-msg">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><span className="spinner" /> Saving...</> : '✓ Add to Inventory'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
