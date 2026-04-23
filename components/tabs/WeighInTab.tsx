'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, Save, CheckCircle2, XCircle, Scale, Database } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, doc, setDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';
import { createNotification } from '@/lib/notifications';

const EVENT_OPTIONS = ['1', '2', '3', '4', '5'];
const RACE_OPTIONS = ['1', '2', '3', '4', '5', '6', '7'];
const SERIES_CATEGORIES = [
  'All Series',
  'SIAM GTMC',
  'SIAM GTRC',
  'SIAM TRUCK',
  'SIAM Group A',
  'SIAM Group N',
  'SIAM ECO',
  'ISUZU Challenge Thailand'
];

interface WeighInLog {
  id: string;
  eventId: string;
  raceNumber: string;
  session: string;
  carNumber: string;
  series: string;
  requiredWeight: number;
  actualWeight: number | '';
  status: 'PASSED' | 'FAILED' | 'PENDING';
  updatedAt?: string;
  recordedBy?: string;
}

export default function WeighInTab() {
  const [selectedEvent, setSelectedEvent] = useState('1');
  const [selectedRace, setSelectedRace] = useState('1');
  const [selectedSession, setSelectedSession] = useState<'Pre-Race' | 'Post-Race'>('Pre-Race');
  const [searchCar, setSearchCar] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('All Series');

  const { entries, userRole } = useAppStore();
  const [inspections, setInspections] = useState<any[]>([]);
  const [weighInLogs, setWeighInLogs] = useState<Record<string, WeighInLog>>({});
  
  // Local transient state for inputs before save
  const [localInputs, setLocalInputs] = useState<Record<string, number | ''>>({});

  // Fetch Inspections to calculate required weight
  useEffect(() => {
    if (!auth.currentUser || userRole === null) return;
    
    let q;
    if (userRole === 'competitor' || userRole === 'user') {
      q = query(collection(db, 'car_inspections'), where('userId', '==', auth.currentUser.uid));
    } else {
      q = query(collection(db, 'car_inspections'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });
      setInspections(data);
    }, (error) => {
      console.error('Error fetching inspections:', error);
    });
    return () => unsubscribe();
  }, [userRole]);

  // Fetch Weigh-in Logs for current Event, Race, Session
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'weigh_in_logs'),
      where('eventId', '==', selectedEvent),
      where('raceNumber', '==', selectedRace),
      where('session', '==', selectedSession)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: Record<string, WeighInLog> = {};
      snapshot.forEach(doc => {
        const data = doc.data() as WeighInLog;
        logs[data.carNumber] = { ...data, id: doc.id };
      });
      setWeighInLogs(logs);
    }, (error) => {
      console.error('Error fetching weigh in logs:', error);
    });
    return () => unsubscribe();
  }, [selectedEvent, selectedRace, selectedSession, userRole]);

  // Derived required weights map
  const requiredWeights = useMemo(() => {
    const weights: Record<string, number> = {};
    inspections.forEach(ins => {
      if (ins.carNumber && ins.formData) {
        let total = Number(ins.formData.baseWeight || 0);

        // Dynamic Weights
        ins.formData.dynamicWeights?.forEach((d: any) => {
          if (d.isChecked) total += Number(d.weight || 0);
        });

        // Custom Table Selections
        if (ins.formData.customTablesData && ins.formData.customTablesSelections) {
          ins.formData.customTablesData.forEach((table: any) => {
            const selections = ins.formData.customTablesSelections[table.id];
            if (selections) {
              table.rows.forEach((row: any) => {
                const isSelected = table.selectionType === 'single' ? selections === row.id : (Array.isArray(selections) && selections.includes(row.id));
                if (isSelected) {
                  if (table.hasWeight) total += Number(row.weight || 0);
                  if (table.hasCommitteeWeight) total += Number(row.committeeWeight || 0);
                }
              });
            }
          });
        }

        // Include Success Ballast (placeholder for future)
        const successBallast = Number(ins.formData.successBallast || 0);
        total += successBallast;

        // Prefer latest inspection if multiple (assuming naturally sorted or last overrides)
        weights[ins.carNumber] = total;
      }
    });
    return weights;
  }, [inspections]);

  // Combined data for table
  const tableData = useMemo(() => {
    let filtered = entries.filter(e => e.carNumber);
    if (selectedSeries !== 'All Series') {
      filtered = filtered.filter(e => e.seriesRace === selectedSeries);
    }
    if (searchCar) {
      filtered = filtered.filter(e => e.carNumber.includes(searchCar));
    }

    return filtered.map(entry => {
      const carNumber = entry.carNumber;
      const series = entry.seriesRace;
      const reqWeight = requiredWeights[carNumber] || 0;
      const log = weighInLogs[carNumber];
      
      return {
        carNumber,
        series,
        requiredWeight: reqWeight,
        actualWeight: log ? log.actualWeight : '',
        status: log ? log.status : 'PENDING',
        recordedBy: log ? log.recordedBy : undefined
      };
    }).sort((a, b) => a.carNumber.localeCompare(b.carNumber, undefined, { numeric: true }));
  }, [entries, searchCar, selectedSeries, requiredWeights, weighInLogs]);

  // Handle Save
  const handleSaveResult = async (carNumber: string, series: string, requiredWeight: number, actualWeight: number | '', status: 'PASSED' | 'FAILED') => {
    if (!auth.currentUser) return;
    if (actualWeight === '') return;

    const docId = `${selectedEvent}_${selectedRace}_${selectedSession}_${carNumber}`;
    const docRef = doc(db, 'weigh_in_logs', docId);

    const payload = {
      eventId: selectedEvent,
      raceNumber: selectedRace,
      session: selectedSession,
      carNumber,
      series,
      requiredWeight,
      actualWeight: Number(actualWeight),
      status,
      updatedAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      recordedBy: auth.currentUser.uid,
      recordedByName: auth.currentUser.displayName || auth.currentUser.email || 'Official'
    };

    try {
      await setDoc(docRef, payload, { merge: true });
      
      // Clear local input once saved successfully
      setLocalInputs(prev => ({...prev, [carNumber]: ''}));
    } catch (err) {
      console.error(err);
      alert('Failed to save weigh-in result.');
    }
  };

  return (
    <motion.div 
      key="weigh-in-view"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="space-y-6 pb-12 max-w-[1200px] mx-auto"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2 flex items-center gap-3">
            <Scale className="w-8 h-8 text-orange-500" />
            Weigh-in Station
          </h1>
          <p className="text-slate-500 font-light text-sm">Rapid weigh-in clearing for pre/post-race.</p>
        </div>

        {/* Filters Top Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center w-full xl:w-auto">
            {/* Event Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Event</span>
              <div className="relative">
                <select 
                  value={selectedEvent} 
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-sm font-semibold focus:outline-none focus:border-orange-500 appearance-none"
                >
                  {EVENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Race Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Race</span>
              <div className="relative">
                <select 
                  value={selectedRace} 
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 pl-4 pr-10 text-sm font-semibold focus:outline-none focus:border-orange-500 appearance-none"
                >
                  {RACE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Session Radio */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setSelectedSession('Pre-Race')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedSession === 'Pre-Race' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pre-Race
              </button>
              <button 
                onClick={() => setSelectedSession('Post-Race')}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedSession === 'Post-Race' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Post-Race
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="relative">
              <select
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
                className="bg-white border border-slate-200 rounded-full py-2 pl-5 pr-10 text-sm font-light focus:outline-none focus:border-orange-500 appearance-none"
              >
                {SERIES_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="relative flex-1 min-w-[150px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Car No..." 
                value={searchCar}
                onChange={(e) => setSearchCar(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-2 pl-11 pr-5 text-sm font-bold focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-50 transition-all placeholder:font-light"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto pb-10">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider w-32">Car Number</th>
                <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider">Series</th>
                <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider w-40 text-center">Required (kg)</th>
                <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider w-48 text-center">Actual (kg)</th>
                <th className="px-6 py-4 font-bold text-xs text-slate-500 uppercase tracking-wider w-64 text-center">Action / Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {tableData.map((row) => {
                  const isSaved = row.status !== 'PENDING';
                  const inputValue = localInputs[row.carNumber] !== undefined ? localInputs[row.carNumber] : (row.actualWeight || '');
                  
                  return (
                    <motion.tr 
                      layout
                      key={row.carNumber}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${isSaved ? (row.status === 'PASSED' ? 'bg-emerald-50/30' : 'bg-rose-50/30') : ''}`}
                    >
                      <td className="px-6 py-4">
                        <span className="text-3xl font-black text-slate-900 drop-shadow-sm">{row.carNumber}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">{row.series}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xl font-bold text-slate-400">
                          {row.requiredWeight > 0 ? row.requiredWeight : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center group">
                        <div className="relative flex justify-center">
                          <input 
                            type="number" 
                            className="w-28 text-center text-2xl font-bold bg-white border-2 border-slate-200 rounded-xl py-2 focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-100 transition-all shadow-inner"
                            placeholder="---"
                            value={inputValue}
                            onChange={(e) => setLocalInputs(prev => ({...prev, [row.carNumber]: e.target.value === '' ? '' : Number(e.target.value)}))}
                            disabled={userRole === 'competitor' || userRole === 'user'}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          {userRole !== 'competitor' && userRole !== 'user' && (
                            <>
                              <button
                                onClick={() => handleSaveResult(row.carNumber, row.series, row.requiredWeight, inputValue, 'PASSED')}
                                disabled={inputValue === ''}
                                className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all focus:ring-4 focus:ring-emerald-100 ${
                                  inputValue === '' ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                  : isSaved && row.status === 'PASSED' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400 ring-2 ring-emerald-500 ring-offset-2'
                                  : 'bg-white text-emerald-600 border-2 border-emerald-500 hover:bg-emerald-50'
                                }`}
                              >
                                <CheckCircle2 className="w-5 h-5" />
                                PASS
                              </button>
                              <button
                                onClick={() => handleSaveResult(row.carNumber, row.series, row.requiredWeight, inputValue, 'FAILED')}
                                disabled={inputValue === ''}
                                className={`flex-1 flex justify-center items-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition-all focus:ring-4 focus:ring-rose-100 ${
                                  inputValue === '' ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                                  : isSaved && row.status === 'FAILED' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 border border-rose-400 ring-2 ring-rose-500 ring-offset-2'
                                  : 'bg-white text-rose-600 border-2 border-rose-500 hover:bg-rose-50'
                                }`}
                              >
                                <XCircle className="w-5 h-5" />
                                FAIL
                              </button>
                            </>
                          )}
                          {(userRole === 'competitor' || userRole === 'user') && (
                            <div className="flex-1 flex justify-center items-center">
                               {isSaved ? (
                                  row.status === 'PASSED' ? (
                                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-xl"><CheckCircle2 className="w-4 h-4"/> PASSED</span>
                                  ) : (
                                      <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-100 text-rose-700 font-bold rounded-xl"><XCircle className="w-4 h-4"/> FAILED</span>
                                  )
                               ) : (
                                  <span className="inline-flex items-center px-4 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl">PENDING</span>
                               )}
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}

                {tableData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-light text-lg">
                      <Database className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                      No cars match the selected filters.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
