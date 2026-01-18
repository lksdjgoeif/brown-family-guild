import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { 
  Crown, 
  Coins, 
  LayoutGrid, 
  DraftingCompass, 
  FlaskConical, 
  Shield, 
  Sparkles, 
  Home, 
  ScrollText, 
  Zap, 
  Check, 
  CheckCircle, 
  Trash2, 
  XCircle, 
  Plus 
} from 'lucide-react';

// --- SKYRIM THEME CONFIG & CONSTANTS ---
const TIER_COSTS = { Common: 10, Unusual: 25, Rare: 100, Epic: 400, Legendary: 1000, Mythic: 2500 };

const rooms_list = [
  "Kitchen", "Upstairs Bath", "Downstairs Bath", "Laundry Room", 
  "Dining Room", "Living Room", "Eric's Office", "Catie's Office", 
  "Theatre Room", "Rory's Room", "Olive's Room", "Primary Bedroom", "General"
];

// Map string names to the imported Lucide components for the dynamic Icon component
const IconMap = {
  Crown, Coins, LayoutGrid, DraftingCompass, FlaskConical, Shield, 
  Sparkles, Home, ScrollText, Zap, Check, CheckCircle, Trash2, XCircle, Plus
};

const Icon = ({ name, size = 20, className = "" }) => {
  const LucideIcon = IconMap[name];
  if (!LucideIcon) return null;
  return <LucideIcon size={size} className={className} />;
};

const Avatar = ({ id, size = "md" }) => {
  const dim = size === "lg" ? "w-12 h-12" : "w-10 h-10";
  const iconSize = size === "lg" ? 22 : 18;
  const configMap = {
    Eric: { icon: "DraftingCompass", bg: "bg-zinc-800" },
    Catie: { icon: "FlaskConical", bg: "bg-zinc-800" },
    Rory: { icon: "Shield", bg: "bg-zinc-800" },
    Olive: { icon: "Sparkles", bg: "bg-zinc-800" },
    Family: { icon: "Home", bg: "bg-zinc-800" }
  };
  const config = configMap[id] || configMap.Family;
  return (
    <div className={`${dim} rounded-none border border-white/20 ${config.bg} flex items-center justify-center text-white flex-shrink-0 rotate-45 shadow-lg`}>
      <div className="-rotate-45 flex items-center justify-center">
        <Icon name={config.icon} size={iconSize} className="text-white" />
      </div>
    </div>
  );
};

// --- FIREBASE INIT ---
// Guard against missing environment globals in local VS Code environments
const firebaseConfigRaw = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
const firebaseConfig = JSON.parse(firebaseConfigRaw);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'brown-family-guild';

export default function App() {
  const [user, setUser] = useState(null);
  const [isMeetingMode, setIsMeetingMode] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [archiveStatus, setArchiveStatus] = useState("");
  const [importText, setImportText] = useState("");

  // --- GUILD STATE ---
  const [guildData, setGuildData] = useState({
    familyXP: 0,
    familyGold: 0,
    members: [
      { id: 'Eric', name: 'Eric', class: 'Architect', gp: 0, stats: { Fortune: 1, Wisdom: 1, Vitality: 1 }, color: 'blue' },
      { id: 'Catie', name: 'Catie', class: 'Alchemist', gp: 0, stats: { Harmony: 1, Wisdom: 1, Vitality: 1 }, color: 'purple' },
      { id: 'Rory', name: 'Rory', class: 'Squire', gp: 0, stats: { Order: 1, Study: 1 }, color: 'orange' },
      { id: 'Olive', name: 'Olive', class: 'Scout', gp: 0, stats: { Grit: 1, Order: 1 }, color: 'pink' }
    ],
    quests: [],
    reminders: [],
    claimedBonuses: { rooms: [], sanctuary: false },
    rewards: { Family: [], Eric: [], Catie: [], Rory: [], Olive: [] },
    menu: rooms_list.slice(0, 7).map((d, i) => ({ day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i], meal: 'TBD' }))
  });

  // Architect Inputs
  const [newQuest, setNewQuest] = useState({ 
    title: '', description: '', type: 'daily', assignedTo: 'Family', 
    category: 'Personal', resetsMonthly: false, targetValue: 10, unit: 'pts' 
  });
  const [newCleaning, setNewCleaning] = useState({ title: '', room: 'Kitchen', type: 'daily' });
  const [newReward, setNewReward] = useState({ label: '', rarity: 'Common', owner: 'Family' });
  const [newBounty, setNewBounty] = useState("");

  // (1) Authentication
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // (2) Sync & Migration Check
  useEffect(() => {
    if (!user) return;
    const guildDoc = doc(db, 'artifacts', appId, 'public', 'data', 'guildState', 'master');
    const unsubscribe = onSnapshot(guildDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setGuildData(prev => ({ ...prev, ...data }));
      } else {
        // Migration from legacy localStorage
        const localXP = localStorage.getItem('familyXP');
        if (localXP) {
          const migration = {
            familyXP: Number(localStorage.getItem('familyXP')) || 0,
            familyGold: Number(localStorage.getItem('familyGold')) || 0,
            members: JSON.parse(localStorage.getItem('familyMembers')) || guildData.members,
            quests: JSON.parse(localStorage.getItem('familyQuests')) || [],
            reminders: JSON.parse(localStorage.getItem('familyReminders')) || [],
            claimedBonuses: JSON.parse(localStorage.getItem('claimedBonuses')) || { rooms: [], sanctuary: false },
            rewards: JSON.parse(localStorage.getItem('familyRewardsStore')) || guildData.rewards,
            menu: JSON.parse(localStorage.getItem('familyMenu')) || guildData.menu
          };
          setDoc(guildDoc, migration);
        } else {
          setDoc(guildDoc, guildData);
        }
      }
    }, (err) => console.error("Firestore Error:", err));
    return () => unsubscribe();
  }, [user]);

  const syncUpdate = async (update) => {
    if (!user) return;
    const guildDoc = doc(db, 'artifacts', appId, 'public', 'data', 'guildState', 'master');
    try {
      await updateDoc(guildDoc, update);
    } catch (e) {
      console.error("Cloud Sync Update failed:", e);
    }
  };

  const completeQuest = (id) => {
    const quest = guildData.quests.find(q => q.id === id);
    if (!quest || quest.status === 'completed') return;

    const newQuests = guildData.quests.map(q => q.id === id ? { ...q, status: 'completed' } : q);
    const update = { quests: newQuests, familyXP: (guildData.familyXP || 0) + (quest.xp || 20) };

    if (quest.assignedTo === 'Family') {
      update.familyGold = (guildData.familyGold || 0) + (quest.reward || 10);
    } else {
      update.members = guildData.members.map(m => 
        m.id === quest.assignedTo ? { ...m, gp: (m.gp || 0) + (quest.reward || 10) } : m
      );
    }
    syncUpdate(update);
  };

  const updateEpicProgress = (id, amount) => {
    const newQuests = guildData.quests.map(q => {
      if (q.id === id && q.type === 'epic') {
        const newVal = Math.min((q.currentValue || 0) + Number(amount), q.targetValue || 10);
        return { ...q, currentValue: newVal };
      }
      return q;
    });
    syncUpdate({ quests: newQuests });
  };

  const claimRoomBonus = (room) => {
    if ((guildData.claimedBonuses?.rooms || []).includes(room)) return;
    syncUpdate({
      familyGold: (guildData.familyGold || 0) + 50,
      familyXP: (guildData.familyXP || 0) + 100,
      claimedBonuses: { ...guildData.claimedBonuses, rooms: [...(guildData.claimedBonuses?.rooms || []), room] }
    });
  };

  const claimSanctuaryBonus = () => {
    if (guildData.claimedBonuses?.sanctuary) return;
    syncUpdate({
      familyGold: (guildData.familyGold || 0) + 500,
      familyXP: (guildData.familyXP || 0) + 1000,
      claimedBonuses: { ...guildData.claimedBonuses, sanctuary: true }
    });
  };

  const monthlyReset = () => {
    const resetQuests = guildData.quests.map(q => {
      if (q.category === 'Cleaning') return { ...q, status: 'active' };
      if (q.resetsMonthly) return { ...q, status: 'active', currentValue: 0 };
      return q;
    });
    syncUpdate({ quests: resetQuests, claimedBonuses: { rooms: [], sanctuary: false } });
  };

  const exportLedger = () => {
    const blob = JSON.stringify(guildData, null, 2);
    const el = document.createElement('textarea');
    el.value = blob;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    setArchiveStatus("Ledger Copied!");
    setTimeout(() => setArchiveStatus(""), 4000);
  };

  const restoreGuildLedger = async () => {
    try {
      const data = JSON.parse(importText);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guildState', 'master'), data);
      setArchiveStatus("Restored!");
      setImportText("");
      setTimeout(() => setArchiveStatus(""), 4000);
    } catch (e) {
      alert("Invalid Ledger Data.");
    }
  };

  const addNewQuestAction = (e) => {
    e.preventDefault();
    if (!newQuest.title) return;
    const q = { 
      ...newQuest, 
      id: Date.now(), 
      status: 'active', 
      currentValue: 0, 
      reward: newQuest.type === 'daily' ? 10 : 100, 
      xp: 20 
    };
    syncUpdate({ quests: [...guildData.quests, q] });
    setNewQuest({ title: '', description: '', type: 'daily', assignedTo: 'Family', category: 'Personal', resetsMonthly: false, targetValue: 10, unit: 'pts' });
  };

  const addNewCleaningAction = (e) => {
    e.preventDefault();
    if (!newCleaning.title) return;
    const q = { 
      id: Date.now(), 
      assignedTo: 'Family', 
      category: 'Cleaning', 
      room: newCleaning.room, 
      type: newCleaning.type, 
      title: newCleaning.title, 
      description: newCleaning.type[0].toUpperCase(), 
      reward: 10, 
      xp: 10, 
      status: 'active' 
    };
    syncUpdate({ quests: [...guildData.quests, q] });
    setNewCleaning({ title: '', room: 'Kitchen', type: 'daily' });
  };

  const addNewRewardAction = (e) => {
    e.preventDefault();
    if (!newReward.label) return;
    const updated = { ...guildData.rewards };
    updated[newReward.owner] = [...(updated[newReward.owner] || []), { label: newReward.label, cost: TIER_COSTS[newReward.rarity] || 10, rarity: newReward.rarity }];
    syncUpdate({ rewards: updated });
    setNewReward({ label: '', rarity: 'Common', owner: 'Family' });
  };

  const addNewBountyAction = (e) => {
    e.preventDefault();
    if (!newBounty) return;
    syncUpdate({ reminders: [...(guildData.reminders || []), { id: Date.now(), text: newBounty, status: 'active' }] });
    setNewBounty("");
  };

  const deleteQuest = (id) => syncUpdate({ quests: guildData.quests.filter(q => q.id !== id) });
  const deleteReward = (owner, label) => {
    const updated = { ...guildData.rewards };
    updated[owner] = (updated[owner] || []).filter(r => r.label !== label);
    syncUpdate({ rewards: updated });
  };
  const deleteBounty = (id) => syncUpdate({ reminders: guildData.reminders.filter(r => r.id !== id) });

  // Added: completeReminder handler to fix undefined reference / possible parse issues
  const completeReminder = (id) => {
    const rem = (guildData.reminders || []).find(r => r.id === id);
    if (!rem || rem.status === 'completed') return;
    const updated = (guildData.reminders || []).map(r => r.id === id ? { ...r, status: 'completed' } : r);
    syncUpdate({ reminders: updated, familyGold: (guildData.familyGold || 0) + 10 });
  };

  const updateMeal = (idx, val) => {
    const nm = [...guildData.menu];
    nm[idx] = { ...nm[idx], meal: val };
    syncUpdate({ menu: nm });
  };

  const cleaningQuests = guildData.quests.filter(q => q.category === 'Cleaning');
  const globalCleanPercent = cleaningQuests.length > 0 ? Math.round((cleaningQuests.filter(q => q.status === 'completed').length / cleaningQuests.length) * 100) : 0;
  const filteredQuests = guildData.quests.filter(q => q.category !== 'Cleaning' && q.type !== 'epic' && (activeFilter === 'All' || q.assignedTo === activeFilter));
  const filteredEpics = guildData.quests.filter(q => q.type === 'epic' && (activeFilter === 'All' || q.assignedTo === activeFilter));

  const getRarityColor = (r) => {
    switch(r) {
      case 'Common': return 'text-zinc-500';
      case 'Unusual': return 'text-emerald-500';
      case 'Rare': return 'text-blue-500';
      case 'Epic': return 'text-purple-500';
      case 'Legendary': return 'text-amber-500 font-bold';
      case 'Mythic': return 'text-red-500 font-bold italic';
      default: return 'text-zinc-500';
    }
  };

  if (!user) return <div className="min-h-screen bg-black flex items-center justify-center text-amber-500 font-serif uppercase tracking-widest">Entering Skyrim...</div>;

  return (
    <div className="min-h-screen p-4 md:p-8 bg-[#121212] text-[#d1d1d1] font-sans selection:bg-amber-500 selection:text-black">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className="flex flex-col mb-10 gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-4 text-white uppercase tracking-wider" style={{ fontFamily: 'Cinzel, serif' }}>
                <Icon name="Crown" className="text-white opacity-80" size={32} /> 
                <span>Brown Family Guild Hall</span>
              </h1>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Level {Math.floor((guildData.familyXP || 0)/1000)}</div>
                <div className="w-48 bg-zinc-900 h-[2px] relative overflow-hidden">
                  <div className="bg-white h-full shadow-[0_0_8px_white] transition-all duration-1000" style={{ width: `${((guildData.familyXP || 0) % 1000) / 10}%` }}></div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex-1 md:flex-initial flex flex-col items-end">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Treasury</span>
                <div className="flex items-center gap-2 text-amber-500 font-bold text-lg">
                  <Icon name="Coins" size={16} />
                  <span>{String(guildData.familyGold || 0)} GP</span>
                </div>
              </div>
              <button onClick={() => setIsMeetingMode(!isMeetingMode)} className="px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.25em] transition-all border border-zinc-700 text-zinc-400 hover:text-white hover:border-white">
                {isMeetingMode ? 'End Council' : 'Strategic Planning'}
              </button>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4 w-full border-b border-zinc-800 pb-6 relative">
            <button onClick={() => setActiveFilter('All')} className={`p-4 border transition-all min-w-[100px] flex flex-col items-center justify-center ${activeFilter === 'All' ? 'border-amber-500 bg-zinc-800 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' : 'bg-transparent border-zinc-800'}`}>
              <Icon name="LayoutGrid" className="mb-1 text-zinc-400" size={24} />
              <span className="text-[10px] font-bold uppercase tracking-widest">General</span>
            </button>
            {(guildData.members || []).map(m => (
              <button key={m.id} onClick={() => setActiveFilter(m.id)} className={`flex-1 min-w-[150px] p-4 border transition-all text-left ${activeFilter === m.id ? 'border-amber-500 bg-zinc-800 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' : 'bg-transparent border-zinc-800'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Avatar id={m.id} />
                  <div>
                    <span className="font-bold text-sm block leading-tight text-white uppercase tracking-wider">{String(m.name)}</span>
                    <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-tighter">{String(m.class)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm"><Icon name="Coins" size={14} /> <span>{String(m.gp || 0)}</span></div>
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-12">
            
            {isMeetingMode && (
              <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Quest Architect */}
                  <section className="p-6 bg-black/80 border border-amber-900/50 flex flex-col text-white backdrop-blur-md">
                    <h2 className="text-[10px] font-bold mb-4 text-blue-400 uppercase tracking-widest">Missions</h2>
                    <form onSubmit={addNewQuestAction} className="space-y-3 flex-1 flex flex-col">
                      <input className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-white" placeholder="Task name..." value={newQuest.title} onChange={e => setNewQuest({...newQuest, title: e.target.value})}/>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newQuest.assignedTo} onChange={e => setNewQuest({...newQuest, assignedTo: e.target.value})}>
                        <option value="Family">Family</option>{guildData.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newQuest.type} onChange={e => setNewQuest({...newQuest, type: e.target.value})}>
                        <option value="daily">Daily Bounty</option><option value="weekly">Weekly Quest</option><option value="epic">Epic Campaign</option>
                      </select>
                      {newQuest.type === 'epic' && (
                        <div className="grid grid-cols-2 gap-2">
                          <input type="number" className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-white" placeholder="Target" value={newQuest.targetValue} onChange={e => setNewQuest({...newQuest, targetValue: Number(e.target.value)})}/>
                          <input className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-white" placeholder="Unit" value={newQuest.unit} onChange={e => setNewQuest({...newQuest, unit: e.target.value})}/>
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-[9px] uppercase font-bold text-zinc-500 cursor-pointer">
                        <input type="checkbox" checked={newQuest.resetsMonthly} onChange={e => setNewQuest({...newQuest, resetsMonthly: e.target.checked})} /> Resets Monthly?
                      </label>
                      <button type="submit" className="w-full border border-white text-white font-bold py-2 text-[10px] uppercase hover:bg-white hover:text-black mt-auto transition-all">Summon</button>
                    </form>
                  </section>

                  {/* Sanctuary Tool */}
                  <section className="p-6 bg-black/80 border border-amber-900/50 flex flex-col text-white backdrop-blur-md">
                    <h2 className="text-[10px] font-bold mb-4 text-emerald-400 uppercase tracking-widest">Sanctuary</h2>
                    <form onSubmit={addNewCleaningAction} className="space-y-3 flex-1 flex flex-col">
                      <input className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-white" placeholder="Clean task..." value={newCleaning.title} onChange={e => setNewCleaning({...newCleaning, title: e.target.value})}/>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newCleaning.room} onChange={e => setNewCleaning({...newCleaning, room: e.target.value})}>
                        {rooms_list.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newCleaning.type} onChange={e => setNewCleaning({...newCleaning, type: e.target.value})}>
                        <option value="daily">Daily (D)</option><option value="weekly">Weekly (W)</option><option value="monthly">Monthly (M)</option>
                      </select>
                      <button type="submit" className="w-full border border-white text-white font-bold py-2 text-[10px] uppercase hover:bg-white hover:text-black mt-auto transition-all">Cast</button>
                      <button type="button" onClick={monthlyReset} className="w-full border border-red-900 text-red-500 py-1 text-[9px] uppercase mt-2">Reset House</button>
                    </form>
                  </section>

                  {/* Treasury Tool */}
                  <section className="p-6 bg-black/80 border border-amber-900/50 flex flex-col text-white backdrop-blur-md">
                    <h2 className="text-[10px] font-bold mb-4 text-amber-400 uppercase tracking-widest">Treasury</h2>
                    <form onSubmit={addNewRewardAction} className="space-y-3 flex-1 flex flex-col">
                      <input className="w-full bg-zinc-900/50 border border-zinc-800 p-2 text-xs text-white" placeholder="Reward name..." value={newReward.label} onChange={e => setNewReward({...newReward, label: e.target.value})}/>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newReward.owner} onChange={e => setNewReward({...newReward, owner: e.target.value})}>
                        <option value="Family">Vault</option>{guildData.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                      <select className="w-full border border-zinc-800 p-2 text-xs bg-zinc-900 text-white" value={newReward.rarity} onChange={e => setNewReward({...newReward, rarity: e.target.value})}>
                        {Object.keys(TIER_COSTS).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <button type="submit" className="w-full border border-white text-white font-bold py-2 text-[10px] uppercase hover:bg-white hover:text-black mt-auto transition-all">Mint</button>
                    </form>
                  </section>
                </div>
                
                {/* ARCHIVE TOOLS */}
                <section className="p-6 bg-black border border-amber-900 grid grid-cols-1 md:grid-cols-2 gap-8 text-white">
                  <div>
                    <h2 className="text-[10px] font-bold mb-4 text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      <Icon name="ScrollText" size={14} /> Guild Ledger Tools
                    </h2>
                    <button onClick={exportLedger} className="w-full border border-amber-700 text-amber-600 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-amber-900/20 transition-all">
                      {String(archiveStatus || "Export Guild Ledger")}
                    </button>
                  </div>
                  <div>
                    <h2 className="text-[10px] font-bold mb-4 text-purple-400 uppercase tracking-widest">Restore Archive</h2>
                    <div className="flex gap-2">
                      <input className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-[10px] text-white" placeholder="Paste ledger text..." value={importText} onChange={e => setImportText(e.target.value)} />
                      <button onClick={restoreGuildLedger} className="border border-purple-900 text-purple-400 px-4 py-2 text-[10px] uppercase hover:bg-purple-900/20 transition-all font-bold">Restore</button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* LEGENDARY CAMPAIGNS */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest" style={{ fontFamily: 'Cinzel, serif' }}>Legendary Campaigns</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredEpics.map(q => {
                  const percent = Math.min(Math.round(((q.currentValue || 0) / (q.targetValue || 1)) * 100), 100);
                  return (
                    <div key={q.id} className="p-6 border border-zinc-800 bg-black/40 group transition-all relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div>
                          <h3 className="font-bold text-sm text-white uppercase tracking-wider">{String(q.title)}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">{String(q.assignedTo)}</span>
                            {q.resetsMonthly && <span className="text-[8px] border border-amber-900 text-amber-700 px-1 uppercase tracking-tighter">Monthly</span>}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-zinc-400">{String(q.currentValue || 0)}/{String(q.targetValue || 0)} {String(q.unit || '')}</span>
                      </div>
                      <div className="bg-zinc-900 h-[2px] mb-6 relative z-10">
                        <div className="bg-amber-500 h-full shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                      </div>
                      <div className="flex gap-2 relative z-10">
                        <button onClick={() => updateEpicProgress(q.id, 1)} className="flex-1 py-2 border border-zinc-800 text-[9px] uppercase font-bold hover:border-zinc-500 transition-all">+1 Progress</button>
                        <button onClick={() => updateEpicProgress(q.id, 10)} className="px-4 py-2 border border-zinc-800 text-[9px] uppercase font-bold hover:border-zinc-500 transition-all">+10</button>
                        {isMeetingMode && <button onClick={() => deleteQuest(q.id)} className="p-2 text-red-900"><Icon name="Trash2" size={14}/></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SANCTUARY */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-white uppercase tracking-widest" style={{ fontFamily: 'Cinzel, serif' }}>Sanctuary</h2>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Clearance: {String(globalCleanPercent)}%</span>
                  <div className="w-48 bg-zinc-900 h-[2px] mt-1 relative">
                    <div className="bg-amber-500 h-full shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-1000" style={{ width: `${globalCleanPercent}%` }}></div>
                  </div>
                  {globalCleanPercent === 100 && !guildData.claimedBonuses.sanctuary && (
                    <button onClick={claimSanctuaryBonus} className="mt-2 text-amber-500 text-[10px] font-bold border border-amber-500 px-4 py-1 animate-pulse uppercase tracking-widest">Claim Sanctuary Clear Bonus</button>
                  )}
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {rooms_list.map(room => {
                    const roomQuests = guildData.quests.filter(q => q.room === room);
                    const roomCompleted = roomQuests.filter(q => q.status === 'completed').length;
                    const roomPercent = roomQuests.length > 0 ? Math.round((roomCompleted / roomQuests.length) * 100) : 0;
                    const isCleared = roomPercent === 100;
                    const bonusClaimed = (guildData.claimedBonuses?.rooms || []).includes(room);

                    return (
                      <div key={room} className={`p-4 border transition-all ${isCleared ? 'border-amber-900 bg-amber-950/10 shadow-[inset_0_0_10px_rgba(120,53,15,0.1)]' : 'border-zinc-800 bg-black/20'}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className={`font-bold text-[10px] uppercase tracking-wider ${isCleared ? 'text-amber-500' : 'text-zinc-300'}`}>{String(room)}</h3>
                          <span className="text-[9px] font-bold text-zinc-500">{String(roomPercent)}%</span>
                        </div>
                        <div className="bg-zinc-900 h-[1px] mb-3">
                          <div className={`h-full transition-all duration-1000 ${isCleared ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-white/40'}`} style={{ width: `${roomPercent}%` }}></div>
                        </div>
                        <div className="space-y-1.5">
                          {roomQuests.map(q => (
                            <div key={q.id} className="flex items-center gap-2 text-[9px] group">
                              <button onClick={() => completeQuest(q.id)} className={`p-0.5 border transition-all ${q.status === 'completed' ? 'border-amber-500 text-amber-500' : 'border-zinc-700 text-zinc-600 hover:border-zinc-400'}`}><Icon name="Check" size={8} /></button>
                              <span className={`truncate ${q.status === 'completed' ? 'line-through text-zinc-600 font-normal' : 'text-zinc-400 font-medium'}`}>{String(q.title)}</span>
                              {isMeetingMode && <button onClick={() => deleteQuest(q.id)} className="ml-auto opacity-0 group-hover:opacity-100 text-red-900"><Icon name="Trash2" size={10}/></button>}
                            </div>
                          ))}
                        </div>
                        {isCleared && !bonusClaimed && (
                          <button onClick={() => claimRoomBonus(room)} className="mt-3 w-full border border-amber-700 text-amber-600 text-[8px] font-bold py-1 uppercase tracking-widest hover:bg-amber-700 hover:text-black transition-all">Collect Room Bonus</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest" style={{ fontFamily: 'Cinzel, serif' }}>Active Missions</h2>
              <div className="max-h-[350px] overflow-y-auto pr-4 custom-scrollbar">
                <div className="space-y-2">
                  {filteredQuests.map(q => (
                    <div key={q.id} className={`flex items-center justify-between p-4 border transition-all ${q.status === 'completed' ? 'border-zinc-900 bg-zinc-950/20' : 'border-zinc-800 bg-black/40'}`}>
                      <div className="flex items-center gap-4">
                        <Icon name={q.status === 'completed' ? 'CheckCircle' : 'Zap'} size={18} className={q.status === 'completed' ? 'text-zinc-800' : 'text-zinc-300'} />
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className={`font-bold text-xs uppercase tracking-wider ${q.status === 'completed' ? 'text-zinc-700' : 'text-white'}`}>{String(q.title)}</h3>
                            {isMeetingMode && <button onClick={() => deleteQuest(q.id)} className="text-red-900 transition-colors"><Icon name="Trash2" size={12}/></button>}
                          </div>
                          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{String(q.assignedTo)} • (+{String(q.reward || 0)} GP)</div>
                        </div>
                      </div>
                      {q.status === 'active' && <button onClick={() => completeQuest(q.id)} className="text-[9px] uppercase font-bold border border-zinc-700 px-4 py-2 hover:border-white hover:text-white transition-all">Claim</button>}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-widest" style={{ fontFamily: 'Cinzel, serif' }}>Bounties</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(guildData.reminders || []).map(r => (
                  <div key={r.id} className="flex items-center justify-between p-3 border border-zinc-800 bg-black/20 transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <button onClick={() => completeReminder(r.id)} className={`p-1 border transition-all ${r.status === 'completed' ? 'border-zinc-800 text-zinc-800' : 'border-zinc-600 text-zinc-400 hover:border-white hover:text-white'}`}><Icon name="Check" size={10} /></button>
                      <span className={`text-[11px] truncate uppercase tracking-wide ${r.status === 'completed' ? 'text-zinc-700 font-normal' : 'text-zinc-300 font-medium'}`}>{String(r.text)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.status === 'active' && <span className="text-[8px] font-bold text-amber-700 tracking-tighter">+10G</span>}
                      {isMeetingMode && <button onClick={() => deleteBounty(r.id)} className="text-red-900"><Icon name="Trash2" size={12}/></button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-10">
            <section className="p-8 border border-zinc-800 bg-black/40">
              <h2 className="text-xs font-bold mb-6 text-white uppercase tracking-[0.3em]" style={{ fontFamily: 'Cinzel, serif' }}>Ration Plan</h2>
              <div className="space-y-5">
                {(guildData.menu || []).map((m, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{String(m.day)}</div>
                    {isMeetingMode ? (
                      <input className="bg-black/60 border-b border-zinc-800 text-xs py-1.5 px-2 text-white outline-none focus:border-amber-500 transition-all" value={String(m.meal || '')} onChange={e => updateMeal(i, e.target.value)} />
                    ) : ( <div className="text-xs font-bold truncate tracking-widest text-zinc-300 uppercase">{String(m.meal || 'TBD')}</div> )}
                  </div>
                ))}
              </div>
            </section>

            <section className="p-8 border border-zinc-800 bg-black/60 flex flex-col max-h-[450px]">
              <h2 className="text-xs font-bold mb-8 text-white uppercase tracking-[0.3em]" style={{ fontFamily: 'Cinzel, serif' }}>Treasury</h2>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-10">
                {Object.entries(guildData.rewards || {}).map(([owner, items]) => {
                  if (activeFilter !== 'All' && activeFilter !== owner) return null;
                  return (
                    <div key={owner} className="fade-enter">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-4 border-l border-amber-900 pl-2">{String(owner === 'Family' ? 'Guild Vault' : owner)}</div>
                      <div className="space-y-4">
                        {(items || []).map(r => (
                          <div key={r.label} className="group relative border-b border-zinc-900 pb-3 flex justify-between items-center hover:bg-white/5 transition-all px-2">
                            <div>
                              <div className="text-xs font-bold text-white uppercase tracking-wider">{String(r.label)}</div>
                              <div className={`text-[8px] uppercase tracking-[0.2em] mt-0.5 ${getRarityColor(r.rarity)}`}>{String(r.rarity)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-amber-500 text-xs font-bold tracking-tighter">{String(r.cost)} GP</span>
                              {isMeetingMode && <button onClick={() => deleteReward(owner, r.label)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-all"><Icon name="XCircle" size={14}/></button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}