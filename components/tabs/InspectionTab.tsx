'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, AlertTriangle, CheckCircle, ChevronDown, ChevronUp, UserPlus, Loader2 } from 'lucide-react';
import { db, auth } from '@/firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

const SECTIONS = [
  { id: 'surface', title: 'Track Surface Condition', items: ['Turn 1-3 Asphalt', 'Main Straight Grip', 'Pit Lane Entry'] },
  { id: 'barriers', title: 'Safety Barriers & Fencing', items: ['Tire Walls Sector 1', 'Catch Fencing Main', 'Tecpro Barriers'] },
  { id: 'timing', title: 'Timing & Systems', items: ['Start/Finish Loops', 'Sector 1 Split', 'Pit Speed Cameras'] },
];

export default function InspectionTab() {
  const [expanded, setExpanded] = useState<string | null>('surface');
  const [status, setStatus] = useState<Record<string, 'pass' | 'fail' | null>>({});
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    
    // We use a single document for the facility audit for simplicity in this prototype
    const docRef = doc(db, 'inspections', 'facility-audit');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        try {
          setStatus(JSON.parse(data.statusData || '{}'));
          setIssues(JSON.parse(data.issuesData || '{}'));
        } catch (e) {
          console.error('Failed to parse inspection data', e);
        }
      } else {
        // Initialize if it doesn't exist
        setDoc(docRef, {
          statusData: '{}',
          issuesData: '{}',
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'inspections'));
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'inspections');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleStatus = (itemId: string, val: 'pass' | 'fail') => {
    setStatus(prev => ({ ...prev, [itemId]: val }));
  };

  const handleIssueChange = (itemId: string, val: string) => {
    setIssues(prev => ({ ...prev, [itemId]: val }));
  };

  const saveAudit = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const docRef = doc(db, 'inspections', 'facility-audit');
      await updateDoc(docRef, {
        statusData: JSON.stringify(status),
        issuesData: JSON.stringify(issues),
        updatedAt: new Date().toISOString(),
        userId: auth.currentUser.uid
      });
      // Show a brief success state if desired
      setTimeout(() => setIsSaving(false), 500);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'inspections');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12 flex justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Facility Inspection</h1>
          <p className="text-slate-500 font-light text-sm">Track and safety audit form.</p>
        </div>
        <button 
          onClick={saveAudit}
          disabled={isSaving}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm shadow-orange-500/20 font-medium flex items-center gap-2 disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {isSaving ? 'Saving...' : 'Save Audit'}
        </button>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.id} className="glass-panel overflow-hidden transition-all duration-300">
            <button 
              onClick={() => setExpanded(expanded === section.id ? null : section.id)}
              className="w-full p-6 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-100"
            >
              <h3 className="text-lg font-medium text-slate-900">{section.title}</h3>
              {expanded === section.id ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
            </button>
            
            <AnimatePresence>
              {expanded === section.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 space-y-6">
                    {section.items.map((item) => {
                      const itemId = `${section.id}-${item}`;
                      const itemStatus = status[itemId];
                      
                      return (
                        <div key={item} className="p-4 bg-white rounded-xl border border-slate-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-800">{item}</p>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleStatus(itemId, 'pass')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                                  itemStatus === 'pass' 
                                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.2)]' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                Pass
                              </button>
                              <button 
                                onClick={() => handleStatus(itemId, 'fail')}
                                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 border ${
                                  itemStatus === 'fail' 
                                    ? 'bg-rose-500/20 text-rose-500 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' 
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                Issue
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {itemStatus === 'fail' && (
                              <motion.div 
                                initial={{ opacity: 0, y: -10, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -10, height: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                className="pt-4 border-t border-slate-100 space-y-4"
                              >
                                <div className="space-y-2">
                                  <label className="text-xs text-rose-500 uppercase tracking-wider flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Describe Issue
                                  </label>
                                  <textarea 
                                    rows={2}
                                    value={issues[itemId] || ''}
                                    onChange={(e) => handleIssueChange(itemId, e.target.value)}
                                    className="w-full bg-slate-100 border border-rose-500/30 rounded-lg px-4 py-2 text-sm font-light focus:outline-none focus:border-rose-500/60 transition-colors resize-none text-slate-800"
                                    placeholder="E.g., Deep rut on apex curb..."
                                  />
                                </div>
                                <div className="flex items-center gap-4">
                                  <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition-colors">
                                    <Camera className="w-4 h-4" /> Add Photo
                                  </button>
                                  <button className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition-colors">
                                    <UserPlus className="w-4 h-4" /> Assign Fix
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
