'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

interface RequestItem {
  id: string;
  team: string;
  type: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  time: string;
  desc: string;
  userId?: string;
  createdAt?: string;
}

export default function RequestTab() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [newRequest, setNewRequest] = useState({ type: '', desc: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RequestItem[];
      
      setRequests(fetchedRequests);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'requests');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (!auth.currentUser || !newRequest.type || !newRequest.desc) return;
    setIsSubmitting(true);
    
    const newId = `REQ-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    try {
      await setDoc(doc(db, 'requests', newId), {
        team: auth.currentUser.displayName || auth.currentUser.email || 'Unknown Team',
        type: newRequest.type,
        status: 'Pending',
        time: new Date().toLocaleDateString(),
        desc: newRequest.desc,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setNewRequest({ type: '', desc: '' });
      setActiveTab('inbox');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'requests', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Competitor Requests</h1>
          <p className="text-slate-500 font-light text-sm">Manage inquiries, changes, and approvals.</p>
        </div>
        <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'inbox' ? 'bg-slate-100 text-slate-900 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Inbox
          </button>
          <button 
            onClick={() => setActiveTab('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'new' ? 'bg-slate-100 text-slate-900 shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:text-slate-800'}`}
          >
            New Request
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'inbox' ? (
          <motion.div 
            key="inbox"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="space-y-4"
          >
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : requests.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 font-light">
                No requests found. Click &quot;New Request&quot; to submit one.
              </div>
            ) : (
              requests.map((req, i) => (
                <div key={req.id} className="glass-panel p-6 flex flex-col md:flex-row gap-6 hover:bg-slate-50 transition-colors group">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                        req.status === 'Pending' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' :
                        req.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                        'bg-rose-500/20 text-rose-500 border-rose-500/30'
                      }`}>
                        {req.status}
                      </span>
                      <h3 className="text-lg font-medium text-slate-800">{req.type}</h3>
                      <span className="text-xs text-slate-500 flex items-center gap-1 ml-auto">
                        <Clock className="w-3 h-3" /> {req.time}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 font-light">{req.team} ({req.id})</p>
                    <p className="text-sm text-slate-700 mt-2">{req.desc}</p>
                  </div>
                  
                  {req.status === 'Pending' && (
                    <div className="flex items-center gap-3 md:border-l md:border-slate-200 md:pl-6">
                      <button 
                        onClick={() => handleStatusUpdate(req.id, 'Approved')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-500 border border-emerald-500/30 rounded-lg transition-colors text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(req.id, 'Rejected')}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-500 border border-rose-500/30 rounded-lg transition-colors text-sm font-medium"
                      >
                        <AlertCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="new"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="max-w-2xl mx-auto glass-panel p-8 space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Request Type</label>
                <select 
                  value={newRequest.type}
                  onChange={(e) => setNewRequest({...newRequest, type: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-light focus:outline-none focus:border-orange-500/50 transition-colors appearance-none text-slate-800"
                >
                  <option value="" disabled>Select Type</option>
                  <option value="Number Change">Number Change</option>
                  <option value="Driver Substitution">Driver Substitution</option>
                  <option value="Late Scrutineering">Late Scrutineering</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase tracking-wider">Description & Justification</label>
                <textarea 
                  rows={5}
                  value={newRequest.desc}
                  onChange={(e) => setNewRequest({...newRequest, desc: e.target.value})}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-3 text-sm font-light focus:outline-none focus:border-orange-500/50 transition-colors resize-none text-slate-800"
                  placeholder="Provide detailed reasoning for your request..."
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !newRequest.type || !newRequest.desc}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                {isSubmitting ? 'Sending...' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
