'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Save, Trophy, Loader2 } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, doc, setDoc, query, where, onSnapshot, getDoc } from 'firebase/firestore';
import { useAppStore } from '@/lib/store';

const EVENT_OPTIONS = ['1', '2', '3'];
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

interface RacingResult {
  id: string;
  eventId: string;
  series: string;
  raceNumber: string;
  results: Record<string, number>; // carNumber -> rank
}

export default function RacingResultTab() {
  const [selectedEvent, setSelectedEvent] = useState('1');
  const [selectedSeries, setSelectedSeries] = useState(SERIES_CATEGORIES[1]); // Default to first actual series
  const [searchCar, setSearchCar] = useState('');

  const { entries, userRole } = useAppStore();
  const [racingResults, setRacingResults] = useState<RacingResult[]>([]);
  const [successBallastRules, setSuccessBallastRules] = useState<Record<string, { rank1: number, rank2: number, rank3: number }>>({});
  
  // Local state: carNumber -> raceNumber -> rank
  const [localRanks, setLocalRanks] = useState<Record<string, Record<string, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = userRole && !['competitor', 'user'].includes(userRole);

  // Fetch Rules
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
  }, []);

  // Fetch Racing Results
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'racing_results'),
      where('eventId', '==', selectedEvent)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: RacingResult[] = [];
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() as Omit<RacingResult, 'id'> });
      });
      setRacingResults(data);
    });
    return () => unsubscribe();
  }, [selectedEvent]);

  // Sync local state: Fetch everything for current event/series
  useEffect(() => {
    const seriesResults = racingResults.filter(r => r.series === selectedSeries);
    const newLocalRanks: Record<string, Record<string, string>> = {};

    seriesResults.forEach(r => {
      if (r.results) {
        Object.entries(r.results).forEach(([car, rank]) => {
          if (!newLocalRanks[car]) newLocalRanks[car] = {};
          newLocalRanks[car][r.raceNumber] = rank.toString();
        });
      }
    });

    setLocalRanks(newLocalRanks);
  }, [selectedEvent, selectedSeries, racingResults]);

  // Derived Cumulative Ballast (up to current race index)
  const calculateBallastForRace = (carNumber: string, upToRaceNumber: string) => {
    let total = 0;
    const rules = successBallastRules[selectedSeries] || { rank1: 30, rank2: 20, rank3: 10 };
    
    // Sort results by race number
    const sortedResults = [...racingResults]
      .filter(r => r.series === selectedSeries && Number(r.raceNumber) < Number(upToRaceNumber))
      .sort((a, b) => Number(a.raceNumber) - Number(b.raceNumber));

    sortedResults.forEach(r => {
      const rank = r.results?.[carNumber];
      if (rank === 1) total += rules.rank1;
      else if (rank === 2) total += rules.rank2;
      else if (rank === 3) total += rules.rank3;
    });
    return total;
  };

  // View entries for selected Series
  const tableData = useMemo(() => {
    let filtered = entries.filter(e => e.carNumber && e.seriesRace === selectedSeries);
    if (searchCar) {
      filtered = filtered.filter(e => e.carNumber.includes(searchCar));
    }
    return filtered.sort((a, b) => a.carNumber.localeCompare(b.carNumber, undefined, { numeric: true }));
  }, [entries, selectedSeries, searchCar]);

  const handleSave = async () => {
    if (!auth.currentUser || !canEdit) return;
    setIsSaving(true);
    try {
      const racesToSave = RACE_OPTIONS;
      
      for (const raceNum of racesToSave) {
        const docId = `${selectedEvent}_${raceNum}_${selectedSeries}`;
        const docRef = doc(db, 'racing_results', docId);

        const numericResults: Record<string, number> = {};
        Object.entries(localRanks).forEach(([car, races]) => {
          const rank = races[raceNum];
          if (rank) {
            const parsed = parseInt(rank, 10);
            if (!isNaN(parsed) && parsed > 0) {
              numericResults[car] = parsed;
            }
          }
        });

        // Only save if there's data or it already exists (to allow clearing)
        // For simplicity, we save all 7 docs if we have any ranks for them
        await setDoc(docRef, {
          eventId: selectedEvent,
          series: selectedSeries,
          raceNumber: raceNum,
          results: numericResults
        }, { merge: true });
      }
      
    } catch (error) {
      console.error('Failed to save racing result:', error);
      alert('Failed to save result.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-[1400px] mx-auto">
      <div className="mb-4 sm:mb-8 flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-end justify-between">
        <div>
          <h1 className="text-2xl sm:text-4xl font-light tracking-tight text-slate-900 mb-2 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500" />
            Racing Results
          </h1>
          <p className="text-slate-500 font-light text-sm">Input race placements to auto-calculate success ballast for upcoming races.</p>
        </div>
        
        {canEdit && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Results
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Series</label>
          <select 
            value={selectedSeries}
            onChange={(e) => setSelectedSeries(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium text-slate-700"
          >
            {SERIES_CATEGORIES.filter(s => s !== 'All Series').map(series => (
              <option key={series} value={series}>{series}</option>
            ))}
          </select>
        </div>

        <div className="w-24">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Event</label>
          <select 
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-medium text-slate-700"
          >
            {EVENT_OPTIONS.map(opt => <option key={opt} value={opt}>No. {opt}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Search Car</label>
          <Search className="w-4 h-4 absolute left-3 top-[30px] text-slate-400" />
          <input 
            type="text" 
            placeholder="Car Number..." 
            value={searchCar}
            onChange={(e) => setSearchCar(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-24 sticky left-0 bg-slate-50 z-10">Car No.</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest min-w-[200px]">Details</th>
                {RACE_OPTIONS.map(num => (
                   <th key={num} className="px-4 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center border-l border-slate-200">
                     Race {num}
                   </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={2 + RACE_OPTIONS.length} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No competitors found in {selectedSeries}.
                  </td>
                </tr>
              ) : (
                tableData.map(entry => {
                  const carNo = entry.carNumber;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10">
                        <span className="text-xl font-black text-slate-900 group-hover:text-orange-600 transition-colors">
                          {carNo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{entry.nameEn}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-tight">{entry.formData?.teamName || '-'}</p>
                      </td>
                      {RACE_OPTIONS.map(raceNum => {
                         const currentRank = localRanks[carNo]?.[raceNum] || '';
                         const ballast = calculateBallastForRace(carNo, raceNum);
                         
                         return (
                           <td key={raceNum} className="px-2 py-4 border-l border-slate-100">
                             <div className="flex flex-col items-center gap-1.5">
                               {canEdit ? (
                                 <input 
                                   type="text"
                                   placeholder="-"
                                   value={currentRank}
                                   onChange={(e) => setLocalRanks(prev => ({ 
                                     ...prev, 
                                     [carNo]: { ...(prev[carNo] || {}), [raceNum]: e.target.value } 
                                   }))}
                                   className={`w-14 text-center font-bold text-sm bg-slate-50 border ${currentRank && Number(currentRank) <= 3 ? 'border-orange-200 text-orange-600' : 'border-slate-200 text-slate-900 focus:border-orange-500'} rounded-lg py-1 px-1 focus:outline-none transition-all shadow-sm`}
                                 />
                               ) : (
                                 <span className="font-bold text-slate-900">{currentRank || '-'}</span>
                               )}
                               <span className={`text-[10px] font-bold ${ballast > 0 ? 'text-orange-500' : 'text-slate-300'}`}>
                                 {ballast > 0 ? `+${ballast}kg` : '-'}
                               </span>
                             </div>
                           </td>
                         );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
