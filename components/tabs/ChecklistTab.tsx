'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore, type Entry } from '@/lib/store';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  FileText
} from 'lucide-react';

const SERIES_CATEGORIES = [
  'Siam GT', 
  'Siam1500', 
  'Siam Group N', 
  'Siam Group A', 
  'Siam Truck', 
  'Siam Eco'
];
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, query } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort
}: { 
  label: string, 
  sortKey: string, 
  align?: 'left' | 'right' | 'center',
  sortConfig: { key: string, direction: 'asc' | 'desc' } | null,
  requestSort: (key: string) => void
}) => {
  const isActive = sortConfig?.key === sortKey;
  return (
    <th 
      className={`px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:text-slate-700 hover:bg-slate-50/50 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
        {label}
        <span className="flex flex-col">
          <ChevronUp className={`w-2 h-2 ${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2 h-2 -mt-0.5 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
};

export default function ChecklistTab() {
  const { entries } = useAppStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [checklists, setChecklists] = useState<Record<number, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'checklists'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<number, boolean> = {};
      snapshot.docs.forEach(doc => {
        data[Number(doc.id)] = doc.data().isChecked;
      });
      setChecklists(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'checklists');
    });
    return () => unsubscribe();
  }, []);

  const handleConfirmCheck = async () => {
    if (selectedEntries.length === 0) return;
    setIsSubmitting(true);
    try {
      for (const id of selectedEntries) {
        const docRef = doc(db, 'checklists', id.toString());
        await setDoc(docRef, {
          isChecked: true,
          updatedAt: new Date().toISOString(),
          userId: auth.currentUser?.uid
        }, { merge: true });
      }
      setSelectedEntries([]);
      showToast('Candidates successfully checked');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'checklists');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredEntries = useMemo(() => {
    let filtered = entries.filter(entry => 
      (entry.nameEn.toLowerCase().includes(search.toLowerCase()) || 
      entry.nameTh.includes(search) ||
      entry.carNumber.includes(search)) &&
      (activeTab === 'All' || (entry.seriesRace || '').toLowerCase() === activeTab.toLowerCase())
    );

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Entry];
        let bValue: any = b[sortConfig.key as keyof Entry];

        if (sortConfig.key === 'licenseNumber') {
          aValue = a.formData?.competitionLicenseNo || '';
          bValue = b.formData?.competitionLicenseNo || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return filtered;
  }, [search, sortConfig, entries]);

  const groupedEntries = useMemo(() => {
    const grouped = SERIES_CATEGORIES.map(category => ({
      category,
      entries: [] as Entry[]
    }));
    const otherGroup = { category: 'Other', entries: [] as Entry[] };

    sortedAndFilteredEntries.forEach(entry => {
      const catIndex = SERIES_CATEGORIES.findIndex(
        c => c.toLowerCase() === (entry.seriesRace || '').toLowerCase()
      );
      if (catIndex !== -1) {
        grouped[catIndex].entries.push(entry);
      } else {
        otherGroup.entries.push(entry);
      }
    });

    if (otherGroup.entries.length > 0) {
      grouped.push(otherGroup);
    }

    return grouped.filter(g => g.entries.length > 0);
  }, [sortedAndFilteredEntries]);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('checklist-table-container');
      
      const opt = {
        margin:       0.4,
        filename:     `candidate-checklist-${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' }
      };
      
      await html2pdf().set(opt).from(element).save();
      showToast('PDF Exported Successfully');
    } catch (error) {
      console.error('PDF Export Error:', error);
      showToast('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === sortedAndFilteredEntries.length && sortedAndFilteredEntries.length > 0) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(sortedAndFilteredEntries.map(e => e.id));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedEntries(prev => 
      prev.includes(id) ? prev.filter(entryId => entryId !== id) : [...prev, id]
    );
  };

  const renderToast = () => (
    <AnimatePresence>
      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium">{toastMessage}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.div 
        key="checklist-view"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="space-y-8 pb-12 max-w-[1400px] mx-auto"
      >
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Candidate Checklist</h1>
            <p className="text-slate-500 font-light text-sm">Manage and verify track day checks for candidates.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <button 
              onClick={exportToPDF}
              disabled={isExporting || sortedAndFilteredEntries.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-orange-200 hover:bg-orange-50 text-slate-700 rounded-full text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? <Loader2 className="w-4 h-4 text-orange-500 animate-spin" /> : <FileText className="w-4 h-4 text-orange-500" />}
              <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            <button 
              onClick={handleConfirmCheck}
              disabled={selectedEntries.length === 0 || isSubmitting}
              className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Check Candidate
            </button>

            <div className="relative flex-1 min-w-[200px] ml-auto xl:ml-4">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search candidates..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-11 pr-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 rounded-full transition-all shadow-sm">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setActiveTab('All')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === 'All' 
                ? 'bg-slate-900 text-white shadow-md' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            All Series
          </button>
          {SERIES_CATEGORIES.map(category => (
            <button
              key={category}
              onClick={() => setActiveTab(category)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === category 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div id="checklist-table-container" className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr>
                  <th data-html2canvas-ignore className="px-6 py-5 border-b border-slate-100 w-16">
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={selectedEntries.length > 0 && selectedEntries.length === sortedAndFilteredEntries.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 accent-orange-500 cursor-pointer"
                      />
                    </div>
                  </th>
                  <SortableHeader label="NAME (EN)" sortKey="nameEn" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="NAME (TH)" sortKey="nameTh" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="SERIES RACE" sortKey="seriesRace" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="GRADE RACE" sortKey="gradeRace" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="CAR NUMBER" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="LICENSE NUMBER" sortKey="licenseNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-center">
                    TRACK DAY CHECK
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {groupedEntries.map((group) => (
                    <Fragment key={group.category}>
                      <tr className="bg-slate-50/80 border-y border-slate-100">
                        <td colSpan={8} className="px-6 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {group.category} <span className="text-slate-400 font-normal ml-2">({group.entries.length})</span>
                        </td>
                      </tr>
                      {group.entries.map((entry) => {
                        const isChecked = checklists[entry.id] || false;
                        const isSelected = selectedEntries.includes(entry.id);
                        
                        return (
                          <motion.tr 
                            layout
                            key={entry.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative ${isSelected ? 'bg-orange-50/30' : ''}`}
                            style={{ pageBreakInside: 'avoid' }}
                          >
                            <td data-html2canvas-ignore className="px-6 py-5">
                          <div className="flex items-center justify-center">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleSelect(entry.id)}
                              className="w-4 h-4 rounded border-slate-300 accent-orange-500 cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-900 font-medium uppercase">{entry.nameEn}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{entry.nameTh}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light uppercase">{entry.seriesRace}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light uppercase">{entry.gradeRace}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-900 font-medium">{entry.carNumber}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{entry.formData?.competitionLicenseNo || '-'}</span>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <div className="flex justify-center">
                            {isChecked ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                Checked
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                                Not Checked
                              </span>
                            )}
                          </div>
                        </td>
                          </motion.tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </AnimatePresence>
                
                {sortedAndFilteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-light">
                      No candidates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {renderToast()}
    </>
  );
}
