'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Progress from '@radix-ui/react-progress';
import { Check, AlertCircle, Search, Filter, Loader2 } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

type Checklist = {
  id: string;
  teamName: string;
  carNumber: string;
  className: string;
  items: boolean[];
  userId?: string;
};

const CHECKLIST_ITEMS = [
  'Safety Tank Cert',
  'Roll Cage Cert',
  'Transponder',
  'Driver Gear',
  'Extinguisher'
];

export default function ChecklistTab() {
  const [teams, setTeams] = useState<Checklist[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'checklists'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        let parsedItems = [false, false, false, false, false];
        try {
          parsedItems = JSON.parse(d.items);
        } catch (e) {
          console.error('Failed to parse items', e);
        }
        return {
          id: doc.id,
          teamName: d.teamName,
          carNumber: d.carNumber,
          className: d.className,
          items: parsedItems,
          userId: d.userId
        };
      });
      setTeams(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'checklists');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleItem = async (teamId: string, itemIndex: number) => {
    const team = teams.find(t => t.id === teamId);
    if (!team || !auth.currentUser) return;

    const newItems = [...team.items];
    newItems[itemIndex] = !newItems[itemIndex];

    try {
      const docRef = doc(db, 'checklists', teamId);
      await updateDoc(docRef, {
        items: JSON.stringify(newItems),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'checklists');
    }
  };

  const addDummyTeam = async () => {
    if (!auth.currentUser) return;
    const newId = Date.now().toString();
    try {
      await setDoc(doc(db, 'checklists', newId), {
        teamName: 'New Team ' + Math.floor(Math.random() * 1000),
        carNumber: '#' + Math.floor(Math.random() * 100),
        className: 'GT3',
        items: JSON.stringify([false, false, false, false, false]),
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'checklists');
    }
  };

  const filteredTeams = teams.filter(t => 
    t.teamName.toLowerCase().includes(search.toLowerCase()) || 
    t.carNumber.includes(search)
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Candidate Checklist</h1>
          <p className="text-slate-500 font-light text-sm">Pre-scrutineering compliance matrix.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search teams or cars..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-sm font-light focus:outline-none focus:border-orange-500/50 transition-colors"
            />
          </div>
          <button onClick={addDummyTeam} className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap">
            Add Team
          </button>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : teams.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-light">
            No checklists found. Click &quot;Add Team&quot; to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Team / Car</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap w-48">Progress</th>
                  {CHECKLIST_ITEMS.map((item, i) => (
                    <th key={i} className="p-4 font-medium text-xs text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">
                      {item}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredTeams.map((team) => {
                    const completedCount = team.items.filter(Boolean).length;
                    const progress = (completedCount / CHECKLIST_ITEMS.length) * 100;
                    const isComplete = progress === 100;

                    return (
                      <motion.tr 
                        key={team.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium text-sm border ${
                              isComplete ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {team.carNumber}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800">{team.teamName}</p>
                              <p className="text-xs text-slate-500">{team.className}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <Progress.Root 
                              className="relative overflow-hidden bg-slate-100 rounded-full w-full h-2 border border-slate-100" 
                              value={progress}
                            >
                              <Progress.Indicator
                                className={`h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] ${
                                  isComplete ? 'bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.4)]'
                                }`}
                                style={{ transform: `translateX(-${100 - progress}%)` }}
                              />
                            </Progress.Root>
                            <span className={`text-xs font-medium w-8 text-right ${isComplete ? 'text-emerald-500' : 'text-slate-500'}`}>
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </td>
                        {team.items.map((isChecked, i) => (
                          <td key={i} className="p-4 text-center">
                            <button
                              onClick={() => toggleItem(team.id, i)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-all duration-300 ${
                                isChecked 
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500 shadow-[0_0_15px_rgba(52,211,153,0.2)]' 
                                  : 'bg-white border-slate-200 text-transparent hover:border-slate-300'
                              }`}
                            >
                              <AnimatePresence>
                                {isChecked && (
                                  <motion.div
                                    initial={{ scale: 0, rotate: -45 }}
                                    animate={{ scale: 1.1, rotate: 0 }}
                                    exit={{ scale: 0, rotate: 45 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 15 }}
                                  >
                                    <Check className="w-5 h-5" />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </button>
                          </td>
                        ))}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
