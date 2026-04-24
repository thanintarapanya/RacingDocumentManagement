'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, Save, CheckCircle2, XCircle, Scale, Database, History, X, ArrowUpDown } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, doc, setDoc, query, where, onSnapshot, serverTimestamp, getDoc, arrayUnion } from 'firebase/firestore';
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
  history?: any[];
}

export default function WeighInTab() {
  const [selectedEvent, setSelectedEvent] = useState('1');
  const [selectedRace, setSelectedRace] = useState('1');
  const [selectedSession, setSelectedSession] = useState<'Pre-Race' | 'Post-Race'>('Pre-Race');
  const [searchCar, setSearchCar] = useState('');
  const [selectedSeries, setSelectedSeries] = useState('All Series');
  const [logModalCarNumber, setLogModalCarNumber] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const { entries, userRole } = useAppStore();
  const [inspections, setInspections] = useState<any[]>([]);
  const [weighInLogs, setWeighInLogs] = useState<Record<string, WeighInLog>>({});
  const [racingResults, setRacingResults] = useState<any[]>([]);
  const [successBallastRules, setSuccessBallastRules] = useState<Record<string, { rank1: number, rank2: number, rank3: number }>>({});
  
  // Local transient state for inputs before save
  const [localInputs, setLocalInputs] = useState<Record<string, number | ''>>({});
  const [isEditingRow, setIsEditingRow] = useState<Record<string, boolean>>({});

  // Fetch Inspections
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
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setInspections(data);
    });
    return () => unsubscribe();
  }, [userRole]);

  // Fetch Rules & Racing Results
  useEffect(() => {
    const fetchRules = async () => {
      try {
        const docRef = doc(db, 'settings', 'success_ballast_rules');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSuccessBallastRules(docSnap.data().rules || {});
        }
      } catch (error) {
        console.error("Failed to fetch ballast rules", error);
      }
    };
    fetchRules();

    if (!auth.currentUser) return;
    const q = query(
      collection(db, 'racing_results'),
      where('eventId', '==', selectedEvent)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: any[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));
      setRacingResults(data);
    });
    return () => unsubscribe();
  }, [selectedEvent]);

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
    const weights: Record<string, any> = {};
    inspections.forEach(ins => {
      if (ins.carNumber && ins.formData) {
        let bop = Number(ins.formData.baseWeight || 0);

        // Dynamic Weights (Adjustment & Penalty)
        ins.formData.dynamicWeights?.forEach((d: any) => {
          if (d.isChecked) bop += Number(d.weight || 0);
        });

        // Custom Table Selections (Adjustment & Penalty)
        if (ins.formData.customTablesData && ins.formData.customTablesSelections) {
          ins.formData.customTablesData.forEach((table: any) => {
            const selections = ins.formData.customTablesSelections[table.id];
            if (selections) {
              table.rows.forEach((row: any) => {
                const isSelected = table.selectionType === 'single' ? selections === row.id : (Array.isArray(selections) && selections.includes(row.id));
                if (isSelected) {
                  if (table.hasWeight) bop += Number(row.weight || 0);
                  if (table.hasCommitteeWeight) bop += Number(row.committeeWeight || 0);
                }
              });
            }
          });
        }

        // Calculate auto Success Ballast
        let autoBallast = 0;
        const rules = successBallastRules[ins.series] || { rank1: 30, rank2: 20, rank3: 10 };
        racingResults.forEach(r => {
          if (r.series === ins.series && Number(r.raceNumber) < Number(selectedRace)) {
            const rank = r.results?.[ins.carNumber];
            if (rank === 1) autoBallast += rules.rank1;
            else if (rank === 2) autoBallast += rules.rank2;
            else if (rank === 3) autoBallast += rules.rank3;
          }
        });

        // Include Success Ballast (Auto calculated + manual placeholder if any)
        const manualBallast = Number(ins.formData.successBallast || 0);
        const successBallastTotal = autoBallast + manualBallast;

        // Store the breakdown
        weights[ins.carNumber] = {
           bop,
           successBallast: successBallastTotal,
           total: bop + successBallastTotal
        };
      }
    });
    return weights;
  }, [inspections, racingResults, selectedRace, successBallastRules]);

  const inspectionDataMap = useMemo(() => {
    const sortedInspections = [...inspections].sort((a, b) => 
      new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );

    const dataMap: Record<string, { racerName?: string, engineSeal?: string, gearSeal?: string }> = {};
    sortedInspections.forEach(ins => {
      if (ins.carNumber && !dataMap[ins.carNumber]) {
        dataMap[ins.carNumber] = {
          racerName: ins.racerName || ins.formData?.racerName,
          engineSeal: ins.formData?.engineSealNumber,
          gearSeal: ins.formData?.gearSealNumber,
        };
      }
    });
    return dataMap;
  }, [inspections]);

  // Combined data for table
  const tableData = useMemo(() => {
    let filtered = entries.filter(e => e.carNumber);
    if (userRole === 'competitor' || userRole === 'user') {
      filtered = filtered.filter(e => e.userId === auth.currentUser?.uid);
    }
    if (selectedSeries !== 'All Series') {
      filtered = filtered.filter(e => e.seriesRace === selectedSeries);
    }
    if (searchCar) {
      filtered = filtered.filter(e => e.carNumber.includes(searchCar));
    }

    return filtered.map(entry => {
      const carNumber = entry.carNumber;
      const series = entry.seriesRace;
      const weightData = (requiredWeights[carNumber] as any) || { bop: 0, successBallast: 0, total: 0 };
      const log = weighInLogs[carNumber];
      const insData = inspectionDataMap[carNumber];
      
      return {
        carNumber,
        series,
        racerName: entry.nameEn || insData?.racerName,
        engineSeal: insData?.engineSeal,
        gearSeal: insData?.gearSeal,
        requiredWeight: weightData.total,
        bop: weightData.bop,
        successBallast: weightData.successBallast,
        actualWeight: log ? log.actualWeight : '',
        status: log ? log.status : 'PENDING',
        recordedBy: log ? log.recordedBy : undefined
      };
    }).sort((a, b) => a.carNumber.localeCompare(b.carNumber, undefined, { numeric: true }));
  }, [entries, searchCar, selectedSeries, requiredWeights, weighInLogs, inspectionDataMap]);

  const sortedTableData = useMemo(() => {
    let sortableItems = [...tableData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof typeof a];
        const bValue = b[sortConfig.key as keyof typeof b];
        
        if (aValue === undefined && bValue === undefined) return 0;
        if (aValue === undefined) return 1;
        if (bValue === undefined) return -1;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [tableData, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
      await setDoc(docRef, {
        ...payload,
        history: arrayUnion({
          status,
          actualWeight: Number(actualWeight),
          timestamp: new Date().toISOString(),
          recordedBy: auth.currentUser.uid,
          recordedByName: auth.currentUser.displayName || auth.currentUser.email || 'Official'
        })
      }, { merge: true });
      
      // Clear local input once saved successfully
      setLocalInputs(prev => ({...prev, [carNumber]: ''}));
      setIsEditingRow(prev => ({...prev, [carNumber]: false}));
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
      className="space-y-6 pb-12 w-full max-w-[1400px] mx-auto"
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-slate-900 mb-1 flex items-center gap-2">
              <Scale className="w-6 h-6 text-slate-600" />
              Weight-in Station
            </h1>
            <p className="text-slate-500 font-light text-sm">Rapid weight-in clearing for pre/post-race.</p>
          </div>
          <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setSelectedSession('Pre-Race')}
              className={`px-6 py-2 rounded-lg text-sm transition-all ${selectedSession === 'Pre-Race' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Pre-Race
            </button>
            <button 
              onClick={() => setSelectedSession('Post-Race')}
              className={`px-6 py-2 rounded-lg text-sm transition-all ${selectedSession === 'Post-Race' ? 'bg-white text-slate-900 shadow-sm font-medium' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Post-Race
            </button>
          </div>
        </div>

        {/* Series Navigation Pills */}
        <div className="relative">
          <div className="flex overflow-x-auto hide-scrollbar gap-3 pb-4">
            {SERIES_CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => setSelectedSeries(category)}
                className={`flex-none px-6 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedSeries === category 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          {/* Subtle scrollbar track effect at bottom */}
          <div className="absolute bottom-1 left-0 right-0 h-1 bg-slate-100 rounded-full mx-1">
            <div className="h-full bg-slate-300 rounded-full w-1/4"></div>
          </div>
        </div>

        {/* Filters Top Bar */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center w-full xl:w-auto">
            {/* Event Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Event</span>
              <div className="relative">
                <select 
                  value={selectedEvent} 
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:border-slate-400 appearance-none text-slate-700"
                >
                  {EVENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Race Dropdown */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Race</span>
              <div className="relative">
                <select 
                  value={selectedRace} 
                  onChange={(e) => setSelectedRace(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:border-slate-400 appearance-none text-slate-700"
                >
                  {RACE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="flex items-center w-full xl:w-80">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search car number..." 
                value={searchCar}
                onChange={(e) => setSearchCar(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-11 pr-4 text-sm focus:outline-none focus:border-slate-400 transition-all placeholder:font-light text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="w-1 p-0"></th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 w-20 cursor-pointer hover:text-slate-600 transition-colors select-none" onClick={() => handleSort('carNumber')}>
                  <div className="flex items-center gap-1">CAR NO. <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                </th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 auto cursor-pointer hover:text-slate-600 transition-colors select-none" onClick={() => handleSort('racerName')}>
                  <div className="flex items-center gap-1">COMPETITOR / CATEGORY <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                </th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 text-center">EQUIPMENT SEALS</th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 text-center w-28 cursor-pointer hover:text-slate-600 transition-colors select-none" onClick={() => handleSort('requiredWeight')}>
                  <div className="flex items-center justify-center gap-1">REQ. WEIGHT <ArrowUpDown className="w-3 h-3 opacity-50" /></div>
                </th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 text-center w-36">ACTUAL WEIGHT</th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 text-center w-48">VALIDATION</th>
                <th className="font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap pb-4 px-4 text-center w-16">LOG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {sortedTableData.map((row) => {
                  const isSaved = row.status !== 'PENDING';
                  const inputValue = localInputs[row.carNumber] !== undefined ? localInputs[row.carNumber] : (row.actualWeight || '');
                  
                  return (
                    <motion.tr 
                      layout
                      key={row.carNumber}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`group transition-colors relative ${isSaved && row.status === 'PASSED' ? 'bg-emerald-50/50 hover:bg-emerald-50/80' : isSaved && row.status === 'FAILED' ? 'bg-rose-50/50 hover:bg-rose-50/80' : 'hover:bg-slate-50/30'}`}
                    >
                      {/* Left border indicator for status */}
                      <td className="p-0 relative w-1">
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${isSaved ? (row.status === 'PASSED' ? 'bg-emerald-400' : 'bg-rose-400') : 'bg-transparent group-hover:bg-orange-400'}`}></div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-lg font-bold ${isSaved && row.status === 'PASSED' ? 'text-emerald-900' : isSaved && row.status === 'FAILED' ? 'text-rose-900' : 'text-slate-900'}`}>{row.carNumber}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`text-sm ${isSaved && row.status === 'PASSED' ? 'text-emerald-800' : isSaved && row.status === 'FAILED' ? 'text-rose-800' : 'text-slate-700'}`}>{row.racerName || '-'}</span>
                          <span className={`text-[10px] uppercase tracking-wider ${isSaved && row.status === 'PASSED' ? 'text-emerald-600' : isSaved && row.status === 'FAILED' ? 'text-rose-600' : 'text-slate-400'}`}>{row.series}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col gap-0.5 items-center">
                          <span className={`text-[10px] uppercase tracking-widest ${isSaved && row.status === 'PASSED' ? 'text-emerald-600' : isSaved && row.status === 'FAILED' ? 'text-rose-600' : 'text-slate-500'}`}>ENG: {row.engineSeal || '-'}</span>
                          <span className={`text-[10px] uppercase tracking-widest ${isSaved && row.status === 'PASSED' ? 'text-emerald-600' : isSaved && row.status === 'FAILED' ? 'text-rose-600' : 'text-slate-500'}`}>GR: {row.gearSeal || '-'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-medium ${isSaved && row.status === 'PASSED' ? 'text-emerald-800' : isSaved && row.status === 'FAILED' ? 'text-rose-800' : 'text-slate-700'}`}>
                            {row.requiredWeight > 0 ? row.requiredWeight.toFixed(1) : '-'}
                          </span>
                          {(row.requiredWeight > 0) && (
                            <span className={`text-[9px] tracking-wider ${isSaved && row.status === 'PASSED' ? 'text-emerald-600/70' : isSaved && row.status === 'FAILED' ? 'text-rose-600/70' : 'text-slate-400'}`}>
                              ({row.bop.toFixed(0)} + {row.successBallast.toFixed(0)}SB)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div className="relative group/edit flex justify-center">
                          <input 
                            type="number" 
                            className={`w-full max-w-[100px] text-center text-sm font-medium border rounded-lg py-2 focus:outline-none transition-all disabled:cursor-not-allowed ${
                              isSaved && row.status === 'PASSED' && !isEditingRow[row.carNumber] ? 'bg-emerald-100/50 border-emerald-200 text-emerald-900 placeholder:text-emerald-300 disabled:opacity-100' :
                              isSaved && row.status === 'FAILED' && !isEditingRow[row.carNumber] ? 'bg-rose-100/50 border-rose-200 text-rose-900 placeholder:text-rose-300 disabled:opacity-100' :
                              isEditingRow[row.carNumber] ? 'bg-white border-blue-300 ring-2 ring-blue-50 text-slate-900 shadow-sm' :
                              'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white focus:border-slate-300 focus:shadow-sm'
                            }`}
                            placeholder="00.0"
                            value={inputValue}
                            onChange={(e) => setLocalInputs(prev => ({...prev, [row.carNumber]: e.target.value === '' ? '' : Number(e.target.value)}))}
                            disabled={userRole === 'competitor' || userRole === 'user' || (isSaved && !isEditingRow[row.carNumber])}
                          />
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-2 max-w-[180px] mx-auto">
                          {(userRole !== 'competitor' && userRole !== 'user') ? (
                            <>
                              <button
                                onClick={() => handleSaveResult(row.carNumber, row.series, row.requiredWeight, inputValue, 'PASSED')}
                                disabled={inputValue === '' || (isSaved && !isEditingRow[row.carNumber])}
                                className={`flex-1 flex justify-center items-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                                  inputValue === '' || (isSaved && !isEditingRow[row.carNumber]) ? 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed'
                                  : isSaved && row.status === 'PASSED' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 border border-emerald-600'
                                  : 'text-emerald-600 border-2 border-emerald-100 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer shadow-sm shadow-emerald-900/5 hover:shadow-md hover:shadow-emerald-500/10 hover:-translate-y-0.5'
                                } ${isSaved && !isEditingRow[row.carNumber] && row.status === 'PASSED' ? '!bg-emerald-500 !text-white opacity-100 cursor-default' : ''}`}
                              >

                                {isSaved && row.status === 'PASSED' && !isEditingRow[row.carNumber] && <CheckCircle2 className="w-4 h-4" />}
                                Pass
                              </button>
                              <button
                                onClick={() => handleSaveResult(row.carNumber, row.series, row.requiredWeight, inputValue, 'FAILED')}
                                disabled={inputValue === '' || (isSaved && !isEditingRow[row.carNumber])}
                                className={`flex-1 flex justify-center items-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${
                                  inputValue === '' || (isSaved && !isEditingRow[row.carNumber]) ? 'text-slate-400 bg-slate-50 border border-slate-100 cursor-not-allowed' 
                                  : isSaved && row.status === 'FAILED' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 border border-rose-600'
                                  : 'text-rose-600 border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200 cursor-pointer shadow-sm shadow-rose-900/5 hover:shadow-md hover:shadow-rose-500/10 hover:-translate-y-0.5'
                                } ${isSaved && !isEditingRow[row.carNumber] && row.status === 'FAILED' ? '!bg-rose-500 !text-white opacity-100 cursor-default' : ''}`}
                              >
                                {isSaved && row.status === 'FAILED' && !isEditingRow[row.carNumber] && <XCircle className="w-4 h-4" />}
                                Fail
                              </button>
                            </>
                          ) : (
                            <div className="flex justify-center w-full">
                               {isSaved ? (
                                  row.status === 'PASSED' ? (
                                      <span className="text-[11px] font-bold px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200 uppercase tracking-widest flex items-center gap-1.5 shadow-sm"><CheckCircle2 className="w-4 h-4"/> PASSED</span>
                                  ) : (
                                      <span className="text-[11px] font-bold px-4 py-1.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 uppercase tracking-widest flex items-center gap-1.5 shadow-sm"><XCircle className="w-4 h-4"/> FAILED</span>
                                  )
                               ) : (
                                  <span className="text-[10px] font-medium px-3 py-1 bg-slate-50 text-slate-400 rounded-md border border-slate-100 uppercase tracking-widest">PENDING</span>
                               )}
                            </div>
                          )}
                        </div>
                      </td>
      <td className="py-4 px-4 text-center">
        <div className="flex items-center justify-center gap-1">
          {(!isEditingRow[row.carNumber] && isSaved && userRole !== 'competitor' && userRole !== 'user') && (
            <button 
              onClick={() => setIsEditingRow(prev => ({...prev, [row.carNumber]: true}))}
              className={`p-2 rounded-lg transition-colors ${
                row.status === 'PASSED' ? 'text-emerald-600 hover:bg-emerald-100/50' : 
                row.status === 'FAILED' ? 'text-rose-600 hover:bg-rose-100/50' : 
                'text-slate-400 hover:bg-slate-100'
              }`}
              title="Edit Weight"
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setLogModalCarNumber(row.carNumber)}
            className={`p-2 rounded-lg transition-colors ${
              row.status === 'PASSED' ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100/50' : 
              row.status === 'FAILED' ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-100/50' : 
              'text-slate-300 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title="View History Log"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </td>
                    </motion.tr>
                  );
                })}

                {tableData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-light text-sm">
                      No cars match the selected filters.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {logModalCarNumber && weighInLogs[logModalCarNumber] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 uppercase tracking-tight">Technical Log</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">
                    Car #{logModalCarNumber} &bull; {selectedSession}
                  </p>
                </div>
                <button 
                  onClick={() => setLogModalCarNumber(null)}
                  className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 p-6 scrollbar-hide bg-slate-50/30">
                {weighInLogs[logModalCarNumber].history && weighInLogs[logModalCarNumber].history!.length > 0 ? (
                  <div className="space-y-3">
                    {[...weighInLogs[logModalCarNumber].history!].reverse().map((log, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 rounded-lg bg-white border border-slate-100 shadow-sm">
                        <div className={`mt-0.5 w-6 h-6 rounded flex items-center justify-center shrink-0 ${log.status === 'PASSED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {log.status === 'PASSED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-bold text-slate-800">{log.actualWeight} KG</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${log.status === 'PASSED' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {log.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-medium uppercase">
                            <span>{log.recordedByName}</span>
                            <span>&bull;</span>
                            <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>&bull;</span>
                            <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400 italic text-sm font-light">
                    No history log recorded for this session.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
