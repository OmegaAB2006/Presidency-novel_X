import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Search, ArrowRightLeft, TrendingUp, Activity, Bell, CheckCircle2,
  Star, ChevronDown, SlidersHorizontal, Plus, LogOut, X, Upload,
  Package, MapPin, Wallet, User as UserIcon, Award, Clock,
  ChevronRight, Video, ShoppingCart, ChevronLeft, Filter
} from 'lucide-react';
import { auth as authApi, items as itemsApi, trades as tradesApi, profile as profileApi } from './api';
import { io } from 'socket.io-client';

/* ─── Helpers ────────────────────────────────────────────────── */
const formatINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const CATEGORIES = ['All', 'Electronics', 'Sports', 'Books', 'Clothing', 'Furniture', 'Tools', 'Music', 'Art', 'Games', 'Other'];
const CONDITIONS = ['like_new', 'excellent', 'good', 'fair', 'poor'];
const CONDITION_LABEL = { like_new: 'Like New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor' };
const ITEMS_PER_PAGE = 12;

function StarRating({ value, max = 5, size = 13 }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star key={i} size={size}
          className={i < Math.round(value) ? 'text-yellow-400' : 'text-slate-700'}
          fill={i < Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  );
}

/* ─── Auth Modal ─────────────────────────────────────────────── */
function AuthModal({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ username: '', email: '', password: '', location: '', address: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const goNext = (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim() || !form.password) { setError('All fields required'); return; }
    if (form.password.length < 6) { setError('Password min 6 chars'); return; }
    setError(''); setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login({ email: form.email, password: form.password })
        : await authApi.register(form);
      localStorage.setItem('token', res.token);
      onLogin(res.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const switchMode = (m) => { setMode(m); setStep(1); setError(''); };

  return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.04] border border-white/10 rounded-3xl p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
            <ArrowRightLeft className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-black tracking-tighter text-xl text-white leading-none">NOVELX</h1>
            <p className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold mt-0.5">Trade Intelligence</p>
          </div>
        </div>

        <div className="flex border-b border-white/10 mb-6">
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className={`flex-1 pb-3 text-sm font-bold capitalize transition-colors ${mode === m ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500'}`}>
              {m}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <div className="flex gap-3 mb-4">
            {['Account', 'Location'].map((label, i) => (
              <div key={i} className={`flex items-center gap-1.5 text-xs font-bold ${step === i + 1 ? 'text-cyan-400' : 'text-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border ${step === i + 1 ? 'border-cyan-400' : step > i + 1 ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-slate-700'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                {label}
              </div>
            ))}
          </div>
        )}

        {(mode === 'login' || step === 1) ? (
          <form onSubmit={mode === 'login' ? submit : goNext} className="space-y-4">
            {mode === 'register' && (
              <input value={form.username} onChange={set('username')} placeholder="Username" required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
            )}
            <input type="email" value={form.email} onChange={set('email')} placeholder="Email" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
            <input type="password" value={form.password} onChange={set('password')} placeholder="Password (min 6 chars)" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Next →'}
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-slate-400 text-xs">Your location helps find nearby trades faster.</p>
            <input value={form.location} onChange={set('location')} placeholder="City / Area (e.g. Bangalore, Koramangala)" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
            <textarea value={form.address} onChange={set('address')} placeholder="Full address (optional)" rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 resize-none" />
            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all">← Back</button>
              <button type="submit" disabled={loading} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl transition-all disabled:opacity-50">
                {loading ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

/* ─── Add Item Modal ─────────────────────────────────────────── */
function AddItemModal({ onClose, onAdded }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', description: '', category: '', condition: 'good',
    value_estimate: '', wanted_category: '', wanted_description: '', min_want_value: ''
  });
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaPreviews, setMediaPreviews] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleMedia = (e) => {
    const files = Array.from(e.target.files || []);
    const toAdd = files.slice(0, 5 - mediaFiles.length);
    if (!toAdd.length) return;
    setMediaFiles(p => [...p, ...toAdd]);
    toAdd.forEach(file => {
      if (file.type.startsWith('video/')) {
        setMediaPreviews(p => [...p, { type: 'video', name: file.name }]);
      } else {
        const reader = new FileReader();
        reader.onload = ev => setMediaPreviews(p => [...p, { type: 'image', src: ev.target.result }]);
        reader.readAsDataURL(file);
      }
    });
    e.target.value = '';
  };

  const removeMedia = (idx) => {
    setMediaFiles(f => f.filter((_, i) => i !== idx));
    setMediaPreviews(f => f.filter((_, i) => i !== idx));
  };

  const next = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category) { setError('Name and category are required'); return; }
    setError(''); setStep(2);
  };

  const submit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
      mediaFiles.forEach(f => fd.append('media', f));
      const item = await itemsApi.create(fd);
      onAdded(item);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div>
            <h2 className="text-white font-black text-lg">{step === 1 ? '📦 List Your Item' : '🔍 What Do You Want?'}</h2>
            <div className="flex gap-2 mt-2">{[1, 2].map(s => <div key={s} className={`h-1 w-10 rounded-full ${s <= step ? 'bg-cyan-500' : 'bg-white/10'}`} />)}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>

        {step === 1 ? (
          <form onSubmit={next} className="p-5 space-y-3 max-h-[78vh] overflow-y-auto">
            {/* Media */}
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Photos / Videos ({mediaFiles.length}/5)</p>
              <div className="flex flex-wrap gap-2 mb-1">
                {mediaPreviews.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-800 border border-white/10">
                    {p.type === 'image'
                      ? <img src={p.src} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1"><Video size={18} /><span className="text-[9px] px-1 truncate w-full text-center">{p.name}</span></div>}
                    <button type="button" onClick={() => removeMedia(i)} className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 text-red-400"><X size={10} /></button>
                  </div>
                ))}
                {mediaFiles.length < 5 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-500/50 transition-colors text-slate-600">
                    <Upload size={16} /><span className="text-[9px] mt-1">Add</span>
                    <input type="file" accept="image/*,video/*" multiple onChange={handleMedia} className="hidden" />
                  </label>
                )}
              </div>
              <p className="text-[10px] text-slate-600">Max 5 files (images or videos)</p>
            </div>

            <input value={form.name} onChange={set('name')} placeholder="Item name *" required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />

            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={set('category')} required
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50">
                <option value="">Category *</option>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
              </select>
              <select value={form.condition} onChange={set('condition')}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50">
                {CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">My Item Value (₹)</label>
              <input type="number" min="0" value={form.value_estimate} onChange={set('value_estimate')} placeholder="e.g. 15000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
            </div>

            <textarea value={form.description} onChange={set('description')} placeholder="Describe your item — age, features, defects…" rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 resize-none" />

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl">Cancel</button>
              <button type="submit" className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl">Next →</button>
            </div>
          </form>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-3">
            <p className="text-slate-400 text-sm">Tell others what you'd like in return — boosts match quality.</p>

            <select value={form.wanted_category} onChange={set('wanted_category')}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50">
              <option value="">Any category</option>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c.toLowerCase()}>{c}</option>)}
            </select>

            <textarea value={form.wanted_description} onChange={set('wanted_description')}
              placeholder="e.g. Looking for a laptop in good condition, preferably Dell or HP…" rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 resize-none" />

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Minimum value you'll accept (₹)</label>
              <input type="number" min="0" value={form.min_want_value} onChange={set('min_want_value')} placeholder="e.g. 10000"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
              <p className="text-[10px] text-slate-600 mt-1">Items below this value won't rank as high matches for you.</p>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setStep(1)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl">← Back</button>
              <button type="submit" disabled={loading} className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl disabled:opacity-50">
                {loading ? 'Saving…' : '✓ Add to Inventory'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Trade Modal ────────────────────────────────────────────── */
function TradeModal({ targetItem, myItems, onClose, onSent, currentUser }) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [balanceTab, setBalanceTab] = useState('wallet'); // 'wallet' | 'items'
  const [walletAmount, setWalletAmount] = useState(0);
  const [extraIds, setExtraIds] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const available = myItems.filter(i => i.status === 'available');
  const selectedItem = available.find(i => i.id === selectedItemId);
  const tgtVal = targetItem.value_estimate || 0;
  const myVal = selectedItem ? (selectedItem.value_estimate || 0) : 0;
  const extraItemsVal = extraIds.reduce((sum, eid) => {
    const it = available.find(i => i.id === eid);
    return sum + (it ? (it.value_estimate || 0) : 0);
  }, 0);
  const totalOffer = myVal + walletAmount + extraItemsVal;
  const gap = tgtVal - myVal; // positive = requester needs to add more
  const remainingGap = tgtVal - totalOffer;
  const showBalancer = selectedItem && gap > Math.max(500, tgtVal * 0.1);
  const walletBalance = currentUser?.wallet_balance || 0;

  const toggleExtra = (id) => {
    setExtraIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev.slice(0, 2), id]);
  };

  const send = async () => {
    if (!selectedItemId) { setError('Select an item to offer'); return; }
    if (walletAmount > walletBalance) { setError('Wallet amount exceeds your balance'); return; }
    setLoading(true); setError('');
    try {
      await tradesApi.create({
        requester_item_id: selectedItemId,
        target_item_id: targetItem.id,
        message,
        wallet_payment: walletAmount,
        extra_item_ids: extraIds,
      });
      setDone(true);
      onSent && onSent();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">🤝 Request Trade</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>

        {done ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-white font-black text-xl mb-2">Trade Request Sent!</h3>
            <p className="text-slate-400 text-sm mb-6">Check the Trades tab for updates.</p>
            <button onClick={onClose} className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-8 py-3 rounded-xl">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Target item */}
            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/5">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                {targetItem.image_url
                  ? <img src={targetItem.image_url} alt={targetItem.name} className="w-full h-full object-cover" />
                  : <Package size={22} className="text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate">{targetItem.name}</p>
                <p className="text-slate-500 text-xs">{targetItem.category} · {CONDITION_LABEL[targetItem.condition] || targetItem.condition}</p>
                <p className="text-emerald-400 text-sm font-black">{formatINR(tgtVal)}</p>
              </div>
            </div>

            {targetItem.owner && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/[0.02] rounded-xl px-3 py-2 border border-white/5">
                <UserIcon size={11} />
                <span className="font-bold text-slate-300">{targetItem.owner.username}</span>
                {targetItem.owner.reputation > 0 && <><StarRating value={targetItem.owner.reputation} size={10} /><span className="text-yellow-400 font-bold">{targetItem.owner.reputation.toFixed(1)}</span></>}
                {targetItem.owner.location && <><MapPin size={10} /><span>{targetItem.owner.location}</span></>}
              </div>
            )}

            {(targetItem.wanted_category || targetItem.wanted_description) && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2 text-xs text-blue-300">
                🎯 They want: <strong>{targetItem.wanted_category}</strong>
                {targetItem.wanted_description && <span className="text-slate-400 block mt-0.5">{targetItem.wanted_description}</span>}
              </div>
            )}

            {/* Main item selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Your main item</label>
              {available.length === 0
                ? <p className="text-slate-500 text-sm bg-white/5 rounded-xl p-3 border border-white/5">No available items. Add items first.</p>
                : <select value={selectedItemId} onChange={e => { setSelectedItemId(e.target.value); setWalletAmount(0); setExtraIds([]); }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50">
                    <option value="">Select item to offer…</option>
                    {available.map(i => <option key={i.id} value={i.id}>{i.name} — {formatINR(i.value_estimate)}</option>)}
                  </select>
              }
            </div>

            {/* Value gap balancer */}
            {showBalancer && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-amber-400 text-sm font-bold">⚖️ Value gap: {formatINR(gap)}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${remainingGap <= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    {remainingGap <= 0 ? '✓ Balanced' : `${formatINR(remainingGap)} short`}
                  </span>
                </div>
                <p className="text-slate-400 text-xs">Your item is worth {formatINR(gap)} less. Balance the offer so the other party is more likely to accept.</p>

                {/* Tabs */}
                <div className="flex border border-white/10 rounded-xl overflow-hidden">
                  {[['wallet', '💳 Add Wallet Funds'], ['items', '📦 Add More Items']].map(([tab, label]) => (
                    <button key={tab} onClick={() => setBalanceTab(tab)}
                      className={`flex-1 py-2 text-xs font-bold transition-colors ${balanceTab === tab ? 'bg-amber-500/20 text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {balanceTab === 'wallet' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Amount to add</span>
                      <span>Balance: {formatINR(walletBalance)}</span>
                    </div>
                    <input
                      type="number" min={0} max={Math.min(gap, walletBalance)} step={100}
                      value={walletAmount || ''}
                      onChange={e => setWalletAmount(Math.min(parseFloat(e.target.value) || 0, Math.min(gap, walletBalance)))}
                      placeholder={`0 – ${formatINR(Math.min(gap, walletBalance))}`}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50"
                    />
                    <input type="range" min={0} max={Math.min(gap, walletBalance)} step={100}
                      value={walletAmount}
                      onChange={e => setWalletAmount(parseFloat(e.target.value))}
                      className="w-full accent-amber-500" />
                    {walletAmount > 0 && <p className="text-amber-400 text-xs">₹{walletAmount.toLocaleString('en-IN')} will be deducted from your wallet now and credited to them on acceptance.</p>}
                  </div>
                )}

                {balanceTab === 'items' && (
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {available.filter(i => i.id !== selectedItemId).length === 0
                      ? <p className="text-slate-600 text-xs">No other available items to add.</p>
                      : available.filter(i => i.id !== selectedItemId).map(i => (
                        <label key={i.id} className="flex items-center gap-3 cursor-pointer bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5 hover:border-amber-500/30">
                          <input type="checkbox" checked={extraIds.includes(i.id)} onChange={() => toggleExtra(i.id)}
                            className="w-4 h-4 accent-amber-500 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-bold truncate">{i.name}</p>
                            <p className="text-slate-500 text-[10px]">{i.category} · {CONDITION_LABEL[i.condition] || i.condition}</p>
                          </div>
                          <span className="text-emerald-400 text-xs font-bold flex-shrink-0">{formatINR(i.value_estimate)}</span>
                        </label>
                      ))
                    }
                    {extraIds.length === 3 && <p className="text-slate-500 text-xs text-center">Max 3 extra items</p>}
                  </div>
                )}

                {/* Offer summary */}
                <div className="bg-white/5 rounded-xl px-3 py-2 text-xs space-y-1 border border-white/5">
                  <div className="flex justify-between text-slate-400"><span>Main item</span><span className="text-white">{formatINR(myVal)}</span></div>
                  {walletAmount > 0 && <div className="flex justify-between text-slate-400"><span>Wallet</span><span className="text-amber-400">+{formatINR(walletAmount)}</span></div>}
                  {extraItemsVal > 0 && <div className="flex justify-between text-slate-400"><span>Extra items ({extraIds.length})</span><span className="text-amber-400">+{formatINR(extraItemsVal)}</span></div>}
                  <div className="flex justify-between font-bold border-t border-white/10 pt-1 mt-1">
                    <span className="text-white">Total offer</span>
                    <span className={remainingGap <= 0 ? 'text-emerald-400' : 'text-amber-400'}>{formatINR(totalOffer)}</span>
                  </div>
                </div>
              </div>
            )}

            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Optional message to the owner…" rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 resize-none" />

            {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl">Cancel</button>
              <button onClick={send} disabled={loading || available.length === 0}
                className="flex-1 bg-white text-black font-black py-3 rounded-xl hover:bg-cyan-400 transition-all disabled:opacity-40">
                {loading ? 'Sending…' : 'Send Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Accept Trade Modal ─────────────────────────────────────── */
function AcceptTradeModal({ trade, onClose, onAccepted }) {
  const [meetup, setMeetup] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reqVal = trade.requester_item?.value_estimate || 0;
  const tgtVal = trade.target_item?.value_estimate || 0;
  const walletPaid = trade.requester_wallet_payment || 0;
  const extraItems = trade.requester_extra_items || [];
  const extraVal = extraItems.reduce((s, i) => s + (i.value_estimate || 0), 0);
  const totalOffer = reqVal + walletPaid + extraVal;
  const remainingGap = tgtVal - totalOffer;

  const accept = async () => {
    setLoading(true); setError('');
    try {
      await tradesApi.respond(trade.id, 'accept', meetup, 0);
      onAccepted();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">✅ Review Trade Offer</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* What they're offering vs what you give */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Their offer to you</p>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                {trade.requester_item?.image_url
                  ? <img src={trade.requester_item.image_url} alt="" className="w-full h-full object-cover" />
                  : <Package size={16} className="text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-bold truncate">{trade.requester_item?.name}</p>
                <p className="text-emerald-400 text-xs font-bold">{formatINR(reqVal)}</p>
              </div>
            </div>

            {walletPaid > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                <Wallet size={13} className="text-amber-400 flex-shrink-0" />
                <p className="text-amber-400 text-xs font-bold">+ {formatINR(walletPaid)} wallet top-up</p>
              </div>
            )}

            {extraItems.map(ei => (
              <div key={ei.id} className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                  {ei.image_url ? <img src={ei.image_url} alt="" className="w-full h-full object-cover" /> : <Package size={12} className="text-slate-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">+ {ei.name}</p>
                  <p className="text-emerald-400 text-[10px]">{formatINR(ei.value_estimate)}</p>
                </div>
              </div>
            ))}

            <div className="flex justify-between text-sm border-t border-white/10 pt-2">
              <span className="text-slate-400 font-bold">Total offer value</span>
              <span className="text-white font-black">{formatINR(totalOffer)}</span>
            </div>
          </div>

          {/* What you give */}
          <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3 border border-white/5">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
              {trade.target_item?.image_url
                ? <img src={trade.target_item.image_url} alt="" className="w-full h-full object-cover" />
                : <Package size={16} className="text-slate-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">You give</p>
              <p className="text-white text-sm font-bold truncate">{trade.target_item?.name}</p>
              <p className="text-emerald-400 text-xs font-bold">{formatINR(tgtVal)}</p>
            </div>
          </div>

          {/* Remaining gap notice */}
          {Math.abs(remainingGap) > 200 && (
            <div className={`rounded-xl px-3 py-2 text-xs border ${remainingGap > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              {remainingGap > 0
                ? `⚠️ Their offer is still ${formatINR(remainingGap)} short — you can accept as-is or decline.`
                : `✓ Their offer exceeds your item's value by ${formatINR(-remainingGap)}.`}
            </div>
          )}

          {trade.message && (
            <div className="bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Message</p>
              <p className="text-slate-300 text-sm">{trade.message}</p>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Meetup Location <span className="text-slate-700">(optional)</span></label>
            <input value={meetup} onChange={e => setMeetup(e.target.value)}
              placeholder="Google Maps link or meetup spot…"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => { tradesApi.respond(trade.id, 'reject').then(() => { onAccepted(); onClose(); }).catch(e => setError(e.message)); }}
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-3 rounded-xl border border-red-500/20">
              Decline
            </button>
            <button onClick={accept} disabled={loading}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl transition-all disabled:opacity-50">
              {loading ? 'Accepting…' : '✓ Accept'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Review Modal ───────────────────────────────────────────── */
function ReviewModal({ trade, currentUserId, onClose, onReviewed }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otherName = currentUserId === trade.requester_id
    ? (trade.target_item?.owner?.username || 'the trader')
    : trade.requester_username;

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await tradesApi.rate(trade.id, { rating, comment });
      onReviewed(); onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">⭐ Rate Your Trade</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <p className="text-slate-400 text-sm">How was trading with <strong className="text-white">{otherName}</strong>?</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" onClick={() => setRating(n)} className="transition-transform hover:scale-110 active:scale-95">
                <Star size={32} className={n <= rating ? 'text-yellow-400' : 'text-slate-700'} fill={n <= rating ? 'currentColor' : 'none'} />
              </button>
            ))}
          </div>
          <p className="text-center text-sm font-bold text-slate-400">{['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}</p>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience (optional)…" rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50 resize-none" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl">Skip</button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl disabled:opacity-50">
              {loading ? 'Submitting…' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Wallet Modal ───────────────────────────────────────────── */
function WalletModal({ user, onClose, onUpdated }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const presets = [500, 1000, 2000, 5000, 10000];

  const topup = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Enter a valid amount'); return; }
    setLoading(true); setError('');
    try {
      const res = await profileApi.topup(val);
      onUpdated(res.wallet_balance);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">💰 Top Up Wallet</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Balance</p>
            <p className="text-2xl font-black text-cyan-400">{formatINR(user?.wallet_balance || 0)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map(p => (
              <button key={p} type="button" onClick={() => setAmount(String(p))}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${amount === String(p) ? 'bg-cyan-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                +{formatINR(p)}
              </button>
            ))}
          </div>
          <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Or custom amount (₹)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button onClick={topup} disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black py-3 rounded-xl disabled:opacity-50">
            {loading ? 'Adding…' : `Add ${amount ? formatINR(parseFloat(amount)) : 'funds'}`}
          </button>
          <p className="text-[10px] text-slate-600 text-center">Demo mode — no real payment.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Inventory Drawer ───────────────────────────────────────── */
function InventoryDrawer({ user, onClose, onRefreshMarket }) {
  const [myItems, setMyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    itemsApi.list().then(setMyItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = myItems.filter(i => i.status === 'available').reduce((s, i) => s + (i.value_estimate || 0), 0);

  const handleAdded = (item) => { setMyItems(p => [item, ...p]); onRefreshMarket && onRefreshMarket(); };
  const handleDelete = async (id) => {
    if (!confirm('Remove this item?')) return;
    try { await itemsApi.delete(id); setMyItems(p => p.filter(i => i.id !== id)); onRefreshMarket && onRefreshMarket(); }
    catch (e) { alert(e.message); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0d1117] border-l border-white/10 z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">📦 My Inventory</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(true)} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5">
              <Plus size={14} /> Add Item
            </button>
            <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <div className="flex justify-center pt-12"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}
          {!loading && myItems.length === 0 && (
            <div className="text-center pt-16 text-slate-500">
              <Package size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No items yet</p>
              <button onClick={() => setShowAdd(true)} className="mt-4 text-cyan-400 text-sm font-bold hover:underline">Add your first item</button>
            </div>
          )}

          {myItems.map(item => (
            <div key={item.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-3 flex gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 flex items-center justify-center">
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  : <Package size={18} className="text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate text-sm">{item.name}</p>
                <p className="text-slate-500 text-xs">{item.category} · {CONDITION_LABEL[item.condition] || item.condition}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>{item.status}</span>
                  <span className="text-cyan-400 text-xs font-mono">{formatINR(item.value_estimate)}</span>
                </div>
                {item.wanted_category && (
                  <p className="text-[10px] text-slate-600 mt-0.5">Wants: {item.wanted_category}</p>
                )}
              </div>
              <button onClick={() => handleDelete(item.id)} className="text-slate-600 hover:text-red-400 transition-colors self-start mt-1"><X size={15} /></button>
            </div>
          ))}
        </div>

        {/* Total value footer */}
        {myItems.length > 0 && (
          <div className="border-t border-white/5 p-4 bg-white/[0.02]">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-sm">Total available value</span>
              <span className="text-cyan-400 font-black text-lg font-mono">{formatINR(totalValue)}</span>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </>
  );
}

/* ─── Trades Panel ───────────────────────────────────────────── */
function TradesPanel({ currentUser, onClose, onTradeUpdate }) {
  const [data, setData] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('received');
  const [responding, setResponding] = useState(null);
  const [acceptingTrade, setAcceptingTrade] = useState(null);
  const [reviewingTrade, setReviewingTrade] = useState(null);

  const load = useCallback(() => {
    tradesApi.list().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const reject = async (id) => {
    setResponding(id);
    try { await tradesApi.respond(id, 'reject'); load(); onTradeUpdate && onTradeUpdate(); }
    catch (e) { alert(e.message); }
    finally { setResponding(null); }
  };

  const confirmPickup = async (id) => {
    setResponding(id);
    try { await tradesApi.confirm(id); load(); onTradeUpdate && onTradeUpdate(); }
    catch (e) { alert(e.message); }
    finally { setResponding(null); }
  };

  const list = tab === 'received' ? data.received : data.sent;
  const pending = data.received.filter(t => t.status === 'pending').length;
  const STATUS_COLOR = {
    pending: 'text-yellow-400 bg-yellow-500/10',
    accepted: 'text-emerald-400 bg-emerald-500/10',
    completed: 'text-blue-400 bg-blue-500/10',
    rejected: 'text-red-400 bg-red-500/10',
    cancelled: 'text-slate-400 bg-slate-700'
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0d1117] border-l border-white/10 z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">🤝 Trade Requests</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>
        <div className="flex border-b border-white/5">
          {['received', 'sent'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-bold capitalize transition-colors relative ${tab === t ? 'text-cyan-400' : 'text-slate-500'}`}>
              {t}
              {t === 'received' && pending > 0 && <span className="ml-1.5 bg-cyan-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{pending}</span>}
              {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <div className="flex justify-center pt-12"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}
          {!loading && list.length === 0 && (
            <div className="text-center pt-16 text-slate-500">
              <p className="text-3xl mb-3">{tab === 'received' ? '📬' : '📤'}</p>
              <p className="text-sm">No {tab} trade requests</p>
            </div>
          )}

          {list.map(trade => (
            <div key={trade.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2 justify-between">
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate">{trade.requester_item?.name} ⇄ {trade.target_item?.name}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{formatINR(trade.requester_item?.value_estimate)} ⇄ {formatINR(trade.target_item?.value_estimate)}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_COLOR[trade.status] || 'text-slate-400 bg-slate-700'}`}>{trade.status}</span>
              </div>

              {tab === 'received' && trade.requester_username && (
                <p className="text-slate-500 text-xs">from <strong className="text-slate-300">{trade.requester_username}</strong></p>
              )}

              {trade.wallet_adjustment > 0 && (
                <p className="text-[11px] text-cyan-400 bg-cyan-500/10 rounded-lg px-2 py-1">💰 +{formatINR(trade.wallet_adjustment)} wallet top-up</p>
              )}

              {trade.message && <p className="text-slate-500 text-xs italic bg-white/5 rounded-lg px-3 py-2">"{trade.message}"</p>}

              {trade.status === 'accepted' && trade.meetup_location && (
                <div className="text-xs text-emerald-400 bg-emerald-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                  <MapPin size={11} />
                  {trade.meetup_location.startsWith('http')
                    ? <a href={trade.meetup_location} target="_blank" rel="noreferrer" className="underline">View meetup location</a>
                    : <span>{trade.meetup_location}</span>}
                </div>
              )}

              {/* Wanted items display */}
              {trade.target_item?.wanted_category && (
                <p className="text-[10px] text-blue-400 bg-blue-500/10 rounded-lg px-2 py-1">
                  🎯 They want: {trade.target_item.wanted_category}
                  {trade.target_item.wanted_description && <span className="text-slate-500"> — {trade.target_item.wanted_description}</span>}
                </p>
              )}

              {trade.status === 'pending' && tab === 'received' && (
                <div className="flex gap-2">
                  <button onClick={() => setAcceptingTrade(trade)} disabled={!!responding}
                    className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold py-2 rounded-xl text-sm disabled:opacity-50">✓ Accept</button>
                  <button onClick={() => reject(trade.id)} disabled={!!responding}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2 rounded-xl text-sm disabled:opacity-50">✕ Decline</button>
                </div>
              )}

              {/* Confirm pickup */}
              {trade.status === 'accepted' && !trade.my_confirmed && (
                <button onClick={() => confirmPickup(trade.id)} disabled={!!responding}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle2 size={14} /> Mark as Picked Up / Done
                </button>
              )}
              {trade.status === 'accepted' && trade.my_confirmed && (
                <p className="text-center text-[11px] text-slate-600">✓ You confirmed pickup — waiting for other party</p>
              )}
              {trade.status === 'completed' && (
                <p className="text-center text-[11px] text-blue-400 font-bold">✅ Trade completed!</p>
              )}

              {/* Rate */}
              {(trade.status === 'accepted' || trade.status === 'completed') && !trade.rated_by_me && (
                <button onClick={() => setReviewingTrade(trade)}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-bold py-2 rounded-xl text-sm flex items-center justify-center gap-2">
                  <Star size={13} /> Leave a Review
                </button>
              )}
              {(trade.status === 'accepted' || trade.status === 'completed') && trade.rated_by_me && (
                <p className="text-center text-[11px] text-slate-600">✓ You reviewed this trade</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {acceptingTrade && (
        <AcceptTradeModal trade={acceptingTrade} onClose={() => setAcceptingTrade(null)}
          onAccepted={() => { load(); onTradeUpdate && onTradeUpdate(); }} />
      )}
      {reviewingTrade && (
        <ReviewModal trade={reviewingTrade} currentUserId={currentUser?.id}
          onClose={() => setReviewingTrade(null)} onReviewed={load} />
      )}
    </>
  );
}

/* ─── Cart Drawer ────────────────────────────────────────────── */
function CartDrawer({ currentUser, onClose, onTradeUpdate }) {
  const [data, setData] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pickup');
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(() => {
    tradesApi.list().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id) => {
    try { await tradesApi.confirm(id); load(); onTradeUpdate && onTradeUpdate(); }
    catch (e) { alert(e.message); }
  };

  const now = Date.now();
  const allTrades = [...data.sent, ...data.received];
  const seen = new Set();
  const unique = allTrades.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

  const pendingTrades = data.sent.filter(t => t.status === 'pending');
  const pickupTrades = unique.filter(t =>
    (t.status === 'accepted' || t.status === 'completed') && !t.my_confirmed
  );
  const recentTrades = unique.filter(t => {
    const at = t.accepted_at ? new Date(t.accepted_at).getTime() : 0;
    return (t.status === 'accepted' || t.status === 'completed') && (now - at < 24 * 60 * 60 * 1000);
  });

  const tabs = [
    { key: 'pickup', label: 'Pick Up', count: pickupTrades.length, items: pickupTrades },
    { key: 'pending', label: 'Pending', count: pendingTrades.length, items: pendingTrades },
    { key: 'recent', label: 'Recent 24h', count: recentTrades.length, items: recentTrades },
  ];

  const currentTab = tabs.find(t => t.key === tab);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0d1117] border-l border-white/10 z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">🛒 Trade Cart</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>

        <div className="flex border-b border-white/5 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-xs font-bold whitespace-nowrap px-3 relative transition-colors ${tab === t.key ? 'text-cyan-400' : 'text-slate-500'}`}>
              {t.label}
              {t.count > 0 && <span className="ml-1 bg-cyan-500/20 text-cyan-400 text-[9px] font-black px-1.5 py-0.5 rounded-full">{t.count}</span>}
              {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <div className="flex justify-center pt-12"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>}

          {!loading && currentTab?.items.length === 0 && (
            <div className="text-center pt-16 text-slate-500">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">
                {tab === 'pickup' && 'No trades waiting to pick up.'}
                {tab === 'pending' && 'No pending sent requests.'}
                {tab === 'recent' && 'No trades in the last 24 hours.'}
              </p>
            </div>
          )}

          {currentTab?.items.map(trade => (
            <div key={trade.id} className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 justify-between">
                <p className="text-white font-bold text-sm truncate">{trade.requester_item?.name} ⇄ {trade.target_item?.name}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  trade.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400' :
                  trade.status === 'accepted' ? 'bg-emerald-500/10 text-emerald-400' :
                  'bg-blue-500/10 text-blue-400'
                }`}>{trade.status}</span>
              </div>
              <p className="text-slate-600 text-xs">{formatINR(trade.requester_item?.value_estimate)} ⇄ {formatINR(trade.target_item?.value_estimate)}</p>

              {trade.meetup_location && (
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <MapPin size={10} />
                  {trade.meetup_location.startsWith('http')
                    ? <a href={trade.meetup_location} target="_blank" rel="noreferrer" className="underline">Meetup location</a>
                    : trade.meetup_location}
                </div>
              )}

              {tab === 'pickup' && !trade.my_confirmed && (
                <button onClick={() => confirm(trade.id)}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 size={13} /> Confirm Pickup Done
                </button>
              )}

              {(trade.status === 'accepted' || trade.status === 'completed') && !trade.rated_by_me && (
                <button onClick={() => setReviewing(trade)}
                  className="w-full bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 font-bold py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5">
                  <Star size={11} /> Rate this trade
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {reviewing && (
        <ReviewModal trade={reviewing} currentUserId={currentUser?.id}
          onClose={() => setReviewing(null)} onReviewed={load} />
      )}
    </>
  );
}

/* ─── Profile Drawer ─────────────────────────────────────────── */
function ProfileDrawer({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    profileApi.get(userId).then(setData).catch(console.error).finally(() => setLoading(false));
  }, [userId]);

  if (loading) return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0d1117] border-l border-white/10 z-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </>
  );
  if (!data) return null;

  const { user, past_trades, active_trades, trade_success_rate, reviews } = data;
  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[#0d1117] border-l border-white/10 z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-white font-black text-lg">👤 Trader Profile</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white bg-white/5 p-2 rounded-xl"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 border-b border-white/5 space-y-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-black text-white flex-shrink-0">
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-white font-black text-xl">{user.username}</h3>
                {user.location && (
                  <div className="flex items-center gap-1 text-slate-500 text-xs mt-1"><MapPin size={11} />{user.location}</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <StarRating value={user.reputation} size={11} />
                <p className="text-white font-black text-lg mt-1">{user.reputation > 0 ? user.reputation.toFixed(1) : '—'}</p>
                <p className="text-slate-500 text-[10px]">{user.total_ratings} reviews</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Award size={16} className="text-cyan-400 mx-auto mb-1" />
                <p className="text-white font-black text-lg">{user.trade_count}</p>
                <p className="text-slate-500 text-[10px]">Trades done</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
                <p className="text-white font-black text-lg">{trade_success_rate}%</p>
                <p className="text-slate-500 text-[10px]">Success rate</p>
              </div>
            </div>
          </div>

          {active_trades.length > 0 && (
            <div className="p-4 border-b border-white/5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Clock size={12} /> Active Trades ({active_trades.length})</h4>
              {active_trades.map(t => (
                <div key={t.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 flex items-center gap-2 text-sm mb-2">
                  <span className="text-slate-300 truncate">{t.requester_item?.name}</span>
                  <ArrowRightLeft size={11} className="text-cyan-400 flex-shrink-0" />
                  <span className="text-slate-300 truncate">{t.target_item?.name}</span>
                  <span className="ml-auto text-yellow-400 text-[10px] font-bold bg-yellow-500/10 px-2 py-0.5 rounded-full">pending</span>
                </div>
              ))}
            </div>
          )}

          {past_trades.length > 0 && (
            <div className="p-4 border-b border-white/5">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><CheckCircle2 size={12} /> Past Trades ({past_trades.length})</h4>
              {past_trades.map(t => (
                <div key={t.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-300 font-bold truncate">{t.requester_item?.name}</span>
                    <ArrowRightLeft size={11} className="text-cyan-400 flex-shrink-0" />
                    <span className="text-slate-300 font-bold truncate">{t.target_item?.name}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-slate-600 mt-1">
                    <span>{formatINR(t.requester_item?.value_estimate)} ⇄ {formatINR(t.target_item?.value_estimate)}</span>
                    <span className="ml-auto">{new Date(t.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="p-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2"><Star size={12} /> Reviews ({reviews.length})</h4>
            {reviews.length === 0 && <p className="text-slate-600 text-sm text-center py-4">No reviews yet.</p>}
            {reviews.map(r => (
              <div key={r.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 mb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300 text-sm font-bold">{r.rater_username}</span>
                    <StarRating value={r.rating} size={11} />
                  </div>
                  <span className="text-[10px] text-slate-600">{new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                </div>
                {r.comment && <p className="text-slate-400 text-xs italic mt-1">"{r.comment}"</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main App ───────────────────────────────────────────────── */
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [marketItems, setMarketItems] = useState([]);
  const [myItems, setMyItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState(null);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [viewProfile, setViewProfile] = useState(null);
  const [showWallet, setShowWallet] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setAuthLoading(false); return; }
    authApi.me().then(u => setUser(u)).catch(() => localStorage.removeItem('token')).finally(() => setAuthLoading(false));
  }, []);

  const loadMarket = useCallback(() => {
    if (!user) return;
    setLoading(true);
    const cat = selectedCategory !== 'All' ? selectedCategory.toLowerCase() : '';
    itemsApi.marketplace(cat)
      .then(items => { setMarketItems(items); setLoading(false); })
      .catch(() => setLoading(false));
    itemsApi.list().then(setMyItems).catch(console.error);
  }, [user, selectedCategory]);

  const refreshPendingCount = useCallback(() => {
    tradesApi.list()
      .then(d => setPendingCount(d.received.filter(t => t.status === 'pending').length))
      .catch(() => {});
  }, []);

  // Initial load
  useEffect(() => { if (user) { loadMarket(); refreshPendingCount(); } }, [loadMarket, refreshPendingCount]);

  // WebSocket — replaces all polling
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    const BACKEND = import.meta.env.VITE_API_URL || '';
    const socket = io(BACKEND, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('marketplace_update', () => loadMarket());
    socket.on('trade_update', () => refreshPendingCount());

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [user, loadMarket, refreshPendingCount]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [selectedCategory, search, priceMin, priceMax]);

  const logout = async () => {
    try { await authApi.logout(); } catch (_) {}
    if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
    localStorage.removeItem('token');
    setUser(null); setMarketItems([]); setMyItems([]);
  };
  const updateUserWallet = (bal) => setUser(u => ({ ...u, wallet_balance: bal }));

  const filteredItems = useMemo(() => {
    let items = [...marketItems];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
      );
    }
    const mn = priceMin !== '' ? parseFloat(priceMin) : null;
    const mx = priceMax !== '' ? parseFloat(priceMax) : null;
    if (mn !== null) items = items.filter(m => (m.value_estimate || 0) >= mn);
    if (mx !== null) items = items.filter(m => (m.value_estimate || 0) <= mx);
    // Already sorted by affinity from backend
    return items;
  }, [marketItems, search, priceMin, priceMax]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const pagedItems = filteredItems.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  if (authLoading) return (
    <div className="min-h-screen bg-[#050810] flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <AuthModal onLogin={(u) => { setUser(u); setLoading(true); }} />;

  return (
    <div className="min-h-screen bg-[#050810] text-slate-100 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 border-b border-white/5 bg-[#050810]/90 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center">
              <ArrowRightLeft className="text-white" size={18} />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-black tracking-tighter text-xl leading-none">NOVELX</h1>
              <p className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold mt-0.5">Trade Intelligence</p>
            </div>
          </div>

          <div className="flex-1 max-w-lg relative">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
              className="w-full rounded-xl bg-white/5 pl-9 pr-4 py-2 text-sm outline-none border border-white/10 focus:border-cyan-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600" />
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setShowWallet(true)}
              className="hidden sm:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-cyan-400 transition-all">
              <Wallet size={13} /><span>{formatINR(user.wallet_balance || 0)}</span>
            </button>

            <button onClick={() => setPanel('inventory')}
              className="hidden sm:flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 transition-all">
              <Package size={13} /> Inventory
            </button>

            <button onClick={() => setPanel('cart')} className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
              <ShoppingCart size={18} className="text-slate-400 hover:text-white" />
            </button>

            <button onClick={() => setPanel('trades')} className="relative p-2 rounded-lg hover:bg-white/5 transition-colors">
              <Bell size={18} className="text-slate-400 hover:text-white" />
              {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#050810]" />}
            </button>

            <button onClick={() => setViewProfile(user.id)}
              className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-all">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                {user.username[0].toUpperCase()}
              </div>
              <span className="hidden sm:block text-xs font-bold text-slate-300">{user.username}</span>
            </button>

            <button onClick={logout} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-red-400 transition-colors">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-screen-xl mx-auto px-6 py-6 grid lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="lg:col-span-2 space-y-4">
          {/* Category filter */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <SlidersHorizontal size={12} /> Categories
            </h3>
            <div className="space-y-0.5">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between ${
                    selectedCategory === cat
                      ? 'bg-cyan-500 text-black font-bold shadow-lg shadow-cyan-500/20'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}>
                  <span>{cat}</span>
                  {selectedCategory === cat && <CheckCircle2 size={11} />}
                </button>
              ))}
            </div>
          </div>

          {/* Price range filter */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Filter size={12} /> Price Range (₹)
            </h3>
            <div className="space-y-2">
              <input type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)}
                placeholder="Min ₹"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
              <input type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)}
                placeholder="Max ₹"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500/50" />
              {(priceMin || priceMax) && (
                <button onClick={() => { setPriceMin(''); setPriceMax(''); }}
                  className="w-full text-[10px] text-slate-500 hover:text-cyan-400 transition-colors">Clear filter</button>
              )}
            </div>
          </div>

          {/* Network stats */}
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Activity size={12} /> Network
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Active Items', val: marketItems.length, color: 'text-emerald-400' },
                { label: 'My Items', val: `${myItems.filter(i => i.status === 'available').length} avail`, color: 'text-cyan-400' },
                { label: 'Pending', val: pendingCount, color: pendingCount > 0 ? 'text-yellow-400' : 'text-slate-500' },
                { label: 'Wallet', val: formatINR(user.wallet_balance || 0), color: 'text-cyan-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className={`font-mono font-bold ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setPanel('inventory')}
            className="w-full bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-4 relative overflow-hidden group text-left">
            <h3 className="font-black text-sm mb-1 relative z-10">My Inventory</h3>
            <p className="text-blue-100 text-[10px] opacity-80 relative z-10">Add items to start trading</p>
            <TrendingUp className="absolute -bottom-3 -right-3 w-16 h-16 text-white/10 group-hover:scale-110 transition-transform duration-700" />
          </button>
        </aside>

        {/* Main Feed */}
        <section className="lg:col-span-10 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
                {search ? `"${search}"` : selectedCategory === 'All' ? 'Best Matches For You' : selectedCategory}
                <span className="text-xs font-medium text-slate-500 bg-white/5 px-2 py-1 rounded-lg">{filteredItems.length}</span>
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Sorted by compatibility with your inventory</p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse" />)}
            </div>
          ) : pagedItems.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] rounded-2xl border border-dashed border-white/10 flex flex-col items-center col-span-3">
              <Search size={28} className="text-slate-700 mb-4" />
              <h3 className="text-xl font-black mb-2">{search ? `No results for "${search}"` : 'No items available'}</h3>
              <p className="text-slate-500 text-sm">Add items to your inventory to start trading.</p>
              {(search || priceMin || priceMax) && (
                <button onClick={() => { setSearch(''); setPriceMin(''); setPriceMax(''); }}
                  className="mt-4 text-cyan-400 text-sm font-bold hover:underline">Clear all filters</button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pagedItems.map(item => (
                  <div key={item.id} className="group bg-white/[0.03] border border-white/5 rounded-2xl p-3 hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all duration-300 flex flex-col">
                    {/* Image */}
                    <div className="relative h-44 rounded-xl overflow-hidden mb-3 bg-slate-800">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                        : <div className="w-full h-full flex items-center justify-center"><Package size={36} className="text-slate-700" /></div>}
                      {(item.media_urls || []).length > 1 && (
                        <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[9px] text-slate-300 font-bold border border-white/10">+{item.media_urls.length - 1}</div>
                      )}
                      <div className="absolute bottom-2 left-2 flex gap-1.5">
                        <div className="bg-cyan-500 text-black font-black text-[8px] px-1.5 py-0.5 rounded">{(item.category || '').toUpperCase()}</div>
                        <div className="bg-white/10 backdrop-blur-md text-white font-bold text-[8px] px-1.5 py-0.5 rounded border border-white/10">
                          {(CONDITION_LABEL[item.condition] || '').toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2">
                      {/* Title + price */}
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm leading-tight group-hover:text-cyan-400 transition-colors flex-1 min-w-0 truncate">{item.name}</h3>
                        <p className="text-emerald-400 font-black text-sm flex-shrink-0">{formatINR(item.value_estimate)}</p>
                      </div>

                      {item.description && (
                        <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{item.description}</p>
                      )}

                      {/* Owner row — rating prominent */}
                      {item.owner && (
                        <button onClick={() => setViewProfile(item.owner.id)}
                          className="flex items-center gap-1.5 text-xs bg-white/[0.02] rounded-lg px-2.5 py-1.5 border border-white/5 w-full text-left hover:bg-white/5 transition-colors group/owner">
                          <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-[8px] font-black text-white flex-shrink-0">
                            {item.owner.username[0].toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-300 truncate text-[11px]">{item.owner.username}</span>
                          {item.owner.reputation > 0 ? (
                            <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                              <StarRating value={item.owner.reputation} size={10} />
                              <span className="text-yellow-400 font-black text-[10px]">{item.owner.reputation.toFixed(1)}</span>
                            </span>
                          ) : (
                            <span className="ml-auto text-slate-600 text-[10px]">New</span>
                          )}
                          {item.owner.location && (
                            <span className="text-[9px] text-slate-600 flex items-center gap-0.5 flex-shrink-0 ml-1">
                              <MapPin size={8} />{item.owner.location}
                            </span>
                          )}
                        </button>
                      )}

                      {/* Wants */}
                      {(item.wanted_category || item.wanted_description) && (
                        <div className="text-[10px] text-blue-400 bg-blue-500/10 rounded-lg px-2.5 py-1.5 border border-blue-500/20">
                          🎯 Wants: <strong>{item.wanted_category}</strong>
                          {item.wanted_description && <span className="text-slate-400 ml-1">{item.wanted_description}</span>}
                        </div>
                      )}

                      {item.min_want_value > 0 && (
                        <div className="text-[10px] text-amber-400 bg-amber-500/10 rounded-lg px-2.5 py-1 border border-amber-500/20">
                          Min value: <strong>{formatINR(item.min_want_value)}</strong>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-auto pt-1">
                        <button onClick={() => setTradeTarget(item)}
                          className="flex-[2] bg-white text-black font-bold py-2.5 rounded-xl text-xs hover:bg-cyan-400 transition-all active:scale-95">
                          Request Trade
                        </button>
                        <button onClick={() => item.owner && setViewProfile(item.owner.id)}
                          className="flex-1 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 flex items-center justify-center text-slate-400 hover:text-white active:scale-95">
                          <UserIcon size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-all">
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-400 font-bold">
                    Page {page} of {totalPages}
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-30 transition-all">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      <footer className="mt-16 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-screen-xl mx-auto px-6 py-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-40">
            <ArrowRightLeft size={15} />
            <span className="font-black tracking-tighter">NOVELX</span>
          </div>
          <div className="flex gap-6 text-xs font-bold text-slate-500 uppercase tracking-widest">
            <a href="#" className="hover:text-cyan-400">Privacy</a>
            <a href="#" className="hover:text-cyan-400">Terms</a>
            <a href="#" className="hover:text-cyan-400">Security</a>
          </div>
          <p className="text-[9px] text-slate-700 font-mono uppercase tracking-widest">Currency: INR • Algorithm-ranked</p>
        </div>
      </footer>

      {panel === 'inventory' && <InventoryDrawer user={user} onClose={() => setPanel(null)} onRefreshMarket={loadMarket} />}
      {panel === 'trades' && <TradesPanel currentUser={user} onClose={() => setPanel(null)} onTradeUpdate={loadMarket} />}
      {panel === 'cart' && <CartDrawer currentUser={user} onClose={() => setPanel(null)} onTradeUpdate={loadMarket} />}
      {tradeTarget && <TradeModal targetItem={tradeTarget} myItems={myItems} currentUser={user} onClose={() => setTradeTarget(null)} onSent={loadMarket} />}
      {viewProfile && <ProfileDrawer userId={viewProfile} onClose={() => setViewProfile(null)} />}
      {showWallet && <WalletModal user={user} onClose={() => setShowWallet(false)} onUpdated={updateUserWallet} />}
    </div>
  );
}
