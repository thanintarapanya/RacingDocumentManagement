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
  FileText,
  Settings,
  X,
  Plus,
  History
} from 'lucide-react';

const SERIES_CATEGORIES = [
  'SIAM GTMC',
  'SIAM GTRC',
  'SIAM TRUCK',
  'SIAM Group A',
  'SIAM Group N',
  'SIAM ECO',
  'ISUZU Challenge Thailand'
];
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, query, arrayUnion } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { createNotification } from '@/lib/notifications';

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort,
  className = ''
}: { 
  label: string, 
  sortKey: string, 
  align?: 'left' | 'right' | 'center',
  sortConfig: { key: string, direction: 'asc' | 'desc' } | null,
  requestSort: (key: string) => void,
  className?: string
}) => {
  const isActive = sortConfig?.key === sortKey;
  return (
    <th 
      className={`px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:text-slate-700 hover:bg-slate-50/50 transition-colors select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
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

interface ChecklistData {
  topics: Record<string, { checked: boolean; timestamp: string; updatedBy: string }>;
  changelog: Array<{
    topic: string;
    checked: boolean;
    timestamp: string;
    userId: string;
    userName: string;
  }>;
}

export default function ChecklistTab() {
  const { entries } = useAppStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [eventFilter, setEventFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [checklists, setChecklists] = useState<Record<number, ChecklistData>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [logModalEntryId, setLogModalEntryId] = useState<number | null>(null);

  const userRole = useAppStore(state => state.userRole);
  const canManageTopics = ['admin', 'president', 'secretary'].includes(userRole || '');
  const canEditChecklist = ['admin', 'president', 'secretary', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');

  // Topics Management
  const [topics, setTopics] = useState<string[]>(['Track Day Check']);
  const [isManageTopicsOpen, setIsManageTopicsOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Topics
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'settings', 'checklist'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().topics?.length > 0) {
        setTopics(docSnap.data().topics);
      } else {
        const defaultTopics = ['Track Day Check', 'Event 1 Register', 'Attendant Racer Meeting', 'Receive Document'];
        setTopics(defaultTopics);
        setDoc(doc(db, 'settings', 'checklist'), { topics: defaultTopics }).catch(console.error);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/checklist');
    });
    return () => unsubscribe();
  }, []);

  // Fetch Checklists
  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'checklists'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<number, ChecklistData> = {};
      snapshot.docs.forEach(doc => {
        const docData = doc.data();
        const entryTopics = docData.topics || {};
        const parsedTopics: Record<string, any> = {};
        
        Object.keys(entryTopics).forEach(key => {
          if (typeof entryTopics[key] === 'boolean') {
            parsedTopics[key] = { 
              checked: entryTopics[key], 
              timestamp: docData.updatedAt || '', 
              updatedBy: docData.userId || '' 
            };
          } else {
            parsedTopics[key] = entryTopics[key];
          }
        });

        data[Number(doc.id)] = {
          topics: parsedTopics,
          changelog: docData.changelog || []
        };
      });
      setChecklists(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'checklists');
    });
    return () => unsubscribe();
  }, []);

  const handleToggleCheck = async (id: number, topic: string, newValue: boolean) => {
    try {
      const docRef = doc(db, 'checklists', id.toString());
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email || 'Unknown User';
      const timestamp = new Date().toISOString();
      
      const logEntry = {
        topic,
        checked: newValue,
        timestamp,
        userId: currentUser?.uid || '',
        userName
      };

      await setDoc(docRef, {
        topics: {
          [topic]: {
            checked: newValue,
            timestamp,
            updatedBy: currentUser?.uid || ''
          }
        },
        changelog: arrayUnion(logEntry),
        updatedAt: timestamp,
        userId: currentUser?.uid
      }, { merge: true });

      createNotification({
        targetRole: 'admin',
        title: 'Checklist Updated',
        message: `${userName} updated the checklist for entry #${id} (${topic}: ${newValue ? 'Passed' : 'Revoked'}).`,
        type: 'checklist_update',
        link: 'checklist',
      });
      
      showToast(`Marked as ${newValue ? 'Checked' : 'Not Checked'}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'checklists');
    }
  };

  const handleAddTopic = async () => {
    if (!newTopic.trim()) return;
    if (topics.includes(newTopic.trim())) {
      showToast('Topic already exists');
      return;
    }
    const updatedTopics = [...topics, newTopic.trim()];
    try {
      await setDoc(doc(db, 'settings', 'checklist'), { topics: updatedTopics }, { merge: true });
      setNewTopic('');
      showToast('Topic added');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    }
  };

  const handleDeleteTopic = async (topicToDelete: string) => {
    if (topics.length === 1) {
      showToast('Cannot delete the last topic');
      return;
    }
    const updatedTopics = topics.filter(t => t !== topicToDelete);
    try {
      await setDoc(doc(db, 'settings', 'checklist'), { topics: updatedTopics }, { merge: true });
      showToast('Topic deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
    }
  };

  const handleMoveTopic = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === topics.length - 1) return;

    const newTopics = [...topics];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newTopics[index], newTopics[targetIndex]] = [newTopics[targetIndex], newTopics[index]];

    try {
      await setDoc(doc(db, 'settings', 'checklist'), { topics: newTopics }, { merge: true });
      setTopics(newTopics);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings');
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
      (activeTab === 'All' || (entry.seriesRace || '').toLowerCase() === activeTab.toLowerCase()) &&
      (eventFilter === '' || (entry.formData?.event || '').toLowerCase() === eventFilter.toLowerCase()) &&
      (yearFilter === '' || (entry.formData?.eventYear || '').toLowerCase() === yearFilter.toLowerCase())
    );

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof Entry];
        let bValue: any = b[sortConfig.key as keyof Entry];

        if (sortConfig.key === 'licenseNumber') {
          aValue = a.formData?.competitionLicenseNo || '';
          bValue = b.formData?.competitionLicenseNo || '';
        }

        if (sortConfig.key.startsWith('topic_')) {
          const topic = sortConfig.key.replace('topic_', '');
          aValue = checklists[a.id]?.topics?.[topic]?.checked ? 1 : 0;
          bValue = checklists[b.id]?.topics?.[topic]?.checked ? 1 : 0;
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
  }, [search, sortConfig, entries, activeTab, eventFilter, yearFilter, checklists]);

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
    window.print();
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
            <p className="text-slate-500 font-light text-sm">Manage and verify checks for candidates.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto print:hidden">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 min-w-[150px] sm:min-w-[200px]">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-full py-2 pl-11 pr-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all placeholder:text-slate-400"
                />
              </div>
              <div className="relative flex-1 min-w-[120px] sm:min-w-[150px]">
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-full py-2 px-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all appearance-none text-slate-700"
                >
                  <option value="">All Events</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              <div className="relative flex-1 min-w-[120px] sm:min-w-[150px]">
                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-full py-2 px-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all appearance-none text-slate-700"
                >
                  <option value="">All Years</option>
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>

              <button 
                onClick={exportToPDF}
                disabled={isExporting || sortedAndFilteredEntries.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-orange-200 hover:bg-orange-50 text-slate-700 rounded-full text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 text-orange-500 animate-spin" /> : <FileText className="w-4 h-4 text-orange-500" />}
                <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full sm:w-auto">
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
        </div>

        <div id="checklist-table-container" className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print-page landscape print-scale-down">
          <div className="print-content-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr>
                  <SortableHeader label="CAR NUMBER / หมายเลขรถ" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} className="sticky left-0 z-20 bg-white shadow-[1px_0_0_0_#f1f5f9]" />
                  <SortableHeader label="NAME (EN) / ชื่อ (ภาษาอังกฤษ)" sortKey="nameEn" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="NAME (TH) / ชื่อ (ภาษาไทย)" sortKey="nameTh" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="LICENSE NUMBER / หมายเลขใบอนุญาต" sortKey="licenseNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="SERIES RACE / รุ่นการแข่งขัน" sortKey="seriesRace" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="GRADE RACE / คลาส" sortKey="gradeRace" sortConfig={sortConfig} requestSort={requestSort} />
                  {topics.map(topic => (
                    <SortableHeader 
                      key={topic}
                      label={topic} 
                      sortKey={`topic_${topic}`} 
                      sortConfig={sortConfig} 
                      requestSort={requestSort} 
                      align="center"
                    />
                  ))}
                  <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-center">
                    LOGS
                  </th>
                  {canManageTopics && (
                    <th className="px-6 py-5 border-b border-slate-100 w-16 text-right">
                      <button 
                        onClick={() => setIsManageTopicsOpen(true)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors inline-flex"
                        title="Manage Topics"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {groupedEntries.map((group) => (
                    <Fragment key={group.category}>
                      <tr className="bg-slate-50/80 border-y border-slate-100">
                        <td colSpan={7 + topics.length + (canManageTopics ? 1 : 0)} className="px-6 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                          {group.category} <span className="text-slate-400 font-normal ml-2">({group.entries.length})</span>
                        </td>
                      </tr>
                      {group.entries.map((entry) => {
                        
                        return (
                          <motion.tr 
                            layout
                            key={entry.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative`}
                            style={{ pageBreakInside: 'avoid' }}
                          >
                        <td className="px-6 py-5 sticky left-0 z-10 bg-white group-hover:bg-slate-50/50 shadow-[1px_0_0_0_#f1f5f9] transition-colors">
                          <span className="text-sm text-slate-900 font-medium">{entry.carNumber}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-900 font-medium uppercase">{entry.nameEn}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{entry.nameTh}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{entry.formData?.competitionLicenseNo || '-'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light uppercase">{entry.seriesRace}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light uppercase">{entry.gradeRace}</span>
                        </td>
                        {topics.map(topic => {
                          const topicData = checklists[entry.id]?.topics?.[topic] || { checked: false, timestamp: '', updatedBy: '' };
                          const isChecked = topicData.checked;
                          return (
                            <td key={topic} className="px-6 py-3 text-center min-w-[120px]">
                              <div className="flex flex-col items-center justify-center gap-1.5">
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => handleToggleCheck(entry.id, topic, e.target.checked)}
                                  disabled={!canEditChecklist}
                                  className={`w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 bg-slate-50 ${!canEditChecklist ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                />
                                {isChecked && topicData.timestamp && (
                                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                    {new Date(topicData.timestamp).toLocaleString('th-TH', { 
                                      day: '2-digit', month: '2-digit', year: '2-digit', 
                                      hour: '2-digit', minute: '2-digit' 
                                    })}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-5 text-center">
                          <button 
                            onClick={() => setLogModalEntryId(entry.id)}
                            className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                            title="View History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        </td>
                        {canManageTopics && <td className="px-6 py-5"></td>}
                          </motion.tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </AnimatePresence>
                
                {sortedAndFilteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={7 + topics.length + (canManageTopics ? 1 : 0)} className="px-6 py-12 text-center text-slate-500 font-light">
                      No candidates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {isManageTopicsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900">Manage Topics</h2>
                <button 
                  onClick={() => setIsManageTopicsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2 scrollbar-hide">
                {topics.map((topic, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <span className="text-sm font-medium text-slate-700">{topic}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleMoveTopic(idx, 'up')}
                        disabled={idx === 0}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors p-1"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleMoveTopic(idx, 'down')}
                        disabled={idx === topics.length - 1}
                        className="text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors p-1"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTopic(topic)} 
                        className="text-slate-400 hover:text-rose-500 transition-colors p-1 ml-1"
                        title="Delete Topic"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <input 
                  value={newTopic} 
                  onChange={e => setNewTopic(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                  placeholder="New topic name..." 
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                />
                <button 
                  onClick={handleAddTopic} 
                  disabled={!newTopic.trim()}
                  className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {logModalEntryId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Change Log</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {entries.find(e => e.id === logModalEntryId)?.nameEn} 
                    <span className="mx-2">•</span>
                    Car #{entries.find(e => e.id === logModalEntryId)?.carNumber}
                  </p>
                </div>
                <button 
                  onClick={() => setLogModalEntryId(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 pr-2 scrollbar-hide">
                {logModalEntryId && checklists[logModalEntryId]?.changelog?.length > 0 ? (
                  <div className="space-y-4">
                    {[...checklists[logModalEntryId].changelog].reverse().map((log, idx) => (
                      <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.checked ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {log.checked ? <CheckCircle2 className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {log.topic} <span className="text-slate-500 font-normal">was marked as</span> <span className={log.checked ? 'text-emerald-600' : 'text-rose-600'}>{log.checked ? 'Checked' : 'Not Checked'}</span>
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>By {log.userName}</span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleString('th-TH')}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    No history available for this candidate.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {renderToast()}
    </>
  );
}
