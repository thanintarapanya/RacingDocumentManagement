'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronUp,
  ChevronDown, 
  ArrowLeft, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

interface RequestItem {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt?: string;
  userId?: string;
  
  // New fields
  race?: string;
  circuit?: string;
  driverName?: string;
  carNumber?: string;
  series?: string;
  licenseDriverNo?: string;
  licenseTeamManagerNo?: string;
  nameRequestPermission?: string;
  mobileNo?: string;
  requestPermissionTopic?: string;
  requestPermissionDetail?: string;

  // Old fields for backward compatibility
  team?: string;
  car?: string;
  type?: string;
  date?: string;
  desc?: string;
}

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort
}: { 
  label: string, 
  sortKey: keyof RequestItem, 
  align?: 'left' | 'right',
  sortConfig: { key: keyof RequestItem, direction: 'asc' | 'desc' } | null,
  requestSort: (key: keyof RequestItem) => void
}) => {
  const isActive = sortConfig?.key === sortKey;
  return (
    <th 
      className={`px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 cursor-pointer hover:text-slate-700 hover:bg-slate-50/50 transition-colors select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => requestSort(sortKey)}
    >
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {label}
        <span className="flex flex-col">
          <ChevronUp className={`w-2 h-2 ${isActive && sortConfig.direction === 'asc' ? 'text-orange-500' : 'text-slate-300'}`} />
          <ChevronDown className={`w-2 h-2 -mt-0.5 ${isActive && sortConfig.direction === 'desc' ? 'text-orange-500' : 'text-slate-300'}`} />
        </span>
      </div>
    </th>
  );
};

export default function RequestTab() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'new'>('inbox');
  const [currentStep, setCurrentStep] = useState(1);
  
  const initialRequestState = {
    race: '',
    circuit: '',
    driverName: '',
    carNumber: '',
    series: '',
    licenseDriverNo: '',
    licenseTeamManagerNo: '',
    nameRequestPermission: '',
    mobileNo: '',
    requestPermissionTopic: '',
    requestPermissionDetail: ''
  };
  
  const [newRequest, setNewRequest] = useState(initialRequestState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // List View States
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RequestItem, direction: 'asc' | 'desc' } | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

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

  const requestSort = (key: keyof RequestItem) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredRequests = useMemo(() => {
    let filtered = requests.filter(req => {
      const searchLower = search.toLowerCase();
      return (
        (req.nameRequestPermission || req.team || req.driverName || '')?.toLowerCase().includes(searchLower) ||
        (req.carNumber || req.car || '')?.toLowerCase().includes(searchLower) ||
        (req.requestPermissionTopic || req.type || '')?.toLowerCase().includes(searchLower) ||
        (req.requestPermissionDetail || req.desc || '')?.toLowerCase().includes(searchLower) ||
        req.id?.toLowerCase().includes(searchLower)
      );
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key] || '';
        const bValue = b[sortConfig.key] || '';
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [requests, search, sortConfig]);

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    
    const newId = `REQ-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    try {
      await setDoc(doc(db, 'requests', newId), {
        ...newRequest,
        status: 'Pending',
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setNewRequest(initialRequestState);
      setCurrentStep(1);
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

  if (activeTab === 'inbox') {
    return (
      <>
        <motion.div 
          key="list-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="space-y-8 pb-12 max-w-[1400px] mx-auto"
        >
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-10">
            <div>
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Competitor Requests</h1>
              <p className="text-slate-500 font-light text-sm">Manage inquiries, changes, and approvals.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search requests..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-11 pr-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all placeholder:text-slate-400"
                />
              </div>
              <button 
                onClick={() => {
                  setNewRequest(initialRequestState);
                  setCurrentStep(1);
                  setActiveTab('new');
                }}
                className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Create Request
              </button>
            </div>
          </div>

          <div className="glass-panel overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr>
                    <SortableHeader label="ID" sortKey="id" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="TEAM" sortKey="nameRequestPermission" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="CAR" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="TYPE" sortKey="requestPermissionTopic" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="DESCRIPTION" sortKey="requestPermissionDetail" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="DATE" sortKey="createdAt" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="STATUS" sortKey="status" sortConfig={sortConfig} requestSort={requestSort} />
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                        </td>
                      </tr>
                    ) : sortedAndFilteredRequests.map((req) => (
                      <motion.tr 
                        layout
                        key={req.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative"
                      >
                        <td className="px-6 py-5 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="text-sm text-slate-900 font-medium">{req.id}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{req.nameRequestPermission || req.team || req.driverName}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{req.carNumber || req.car}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{req.requestPermissionTopic || req.type}</span>
                        </td>
                        <td className="px-6 py-5 max-w-[200px] truncate">
                          <span className="text-sm text-slate-600 font-light">{req.requestPermissionDetail || req.desc}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">
                            {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : req.date}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                            req.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                            'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {req.status === 'Pending' && (
                            <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleStatusUpdate(req.id, 'Approved')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors text-xs font-medium"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button 
                                onClick={() => handleStatusUpdate(req.id, 'Rejected')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors text-xs font-medium"
                              >
                                <AlertCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                    {!isLoading && sortedAndFilteredRequests.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-light">
                          No requests found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white/30 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                <select 
                  value={recordsPerPage}
                  onChange={(e) => setRecordsPerPage(Number(e.target.value))}
                  className="bg-transparent border-none text-sm text-slate-600 focus:ring-0 outline-none cursor-pointer"
                >
                  <option value={10}>10 records</option>
                  <option value={20}>20 records</option>
                  <option value={50}>50 records</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
                <span className="text-sm text-slate-600 font-medium px-2">1</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50">
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <motion.div 
        key="form-view"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="max-w-4xl mx-auto pb-12"
      >
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveTab('inbox')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
                Create Request
              </h1>
              <p className="text-slate-500 font-light text-sm">Submit a new competitor request.</p>
            </div>
          </div>
        </div>

        <div className="glass-panel overflow-hidden">
          <div className="p-8 sm:p-10">
            
            {/* Stepper */}
            <div className="flex items-center justify-between mb-12 relative max-w-xl mx-auto">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100 z-0"></div>
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-orange-500 z-0 transition-all duration-500"
                style={{ width: currentStep === 1 ? '0%' : '100%' }}
              ></div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= 1 ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                  {currentStep > 1 ? <CheckCircle2 className="w-5 h-5" /> : 1}
                </div>
                <span className={`text-xs font-medium mt-3 absolute top-full whitespace-nowrap ${currentStep >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>Request / Permission</span>
              </div>
              
              <div className="relative z-10 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= 2 ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'bg-white border-2 border-slate-200 text-slate-400'}`}>
                  2
                </div>
                <span className={`text-xs font-medium mt-3 absolute top-full whitespace-nowrap ${currentStep >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>Punishment Rule</span>
              </div>
            </div>

            {currentStep === 1 && (
              <div className="space-y-10">
                {/* Race Information */}
                <div>
                  <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Race Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Race</label>
                      <input 
                        type="text"
                        value={newRequest.race}
                        onChange={(e) => setNewRequest({...newRequest, race: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Circuit</label>
                      <div className="relative">
                        <select 
                          value={newRequest.circuit}
                          onChange={(e) => setNewRequest({...newRequest, circuit: e.target.value})}
                          className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                        >
                          <option value="" disabled></option>
                          <option value="Chang International Circuit">Chang International Circuit</option>
                          <option value="PT Songkhla Street Circuit">PT Songkhla Street Circuit</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver Information */}
                <div>
                  <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Driver Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Name</label>
                      <input 
                        type="text"
                        placeholder="Name"
                        value={newRequest.driverName}
                        onChange={(e) => setNewRequest({...newRequest, driverName: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Car Number</label>
                      <input 
                        type="text"
                        placeholder="Car Number"
                        value={newRequest.carNumber}
                        onChange={(e) => setNewRequest({...newRequest, carNumber: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Series</label>
                      <div className="relative">
                        <select 
                          value={newRequest.series}
                          onChange={(e) => setNewRequest({...newRequest, series: e.target.value})}
                          className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                        >
                          <option value="" disabled></option>
                          <option value="SIAM GT">SIAM GT</option>
                          <option value="SIAM 1500">SIAM 1500</option>
                          <option value="SIAM GROUP N">SIAM GROUP N</option>
                          <option value="SIAM GROUP A">SIAM GROUP A</option>
                          <option value="SIAM TRUCK">SIAM TRUCK</option>
                          <option value="SIAM ECO">SIAM ECO</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">License Driver No.</label>
                      <input 
                        type="text"
                        placeholder="License Driver No."
                        value={newRequest.licenseDriverNo}
                        onChange={(e) => setNewRequest({...newRequest, licenseDriverNo: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">License Team Manager No.</label>
                      <input 
                        type="text"
                        placeholder="License Team Manager No."
                        value={newRequest.licenseTeamManagerNo}
                        onChange={(e) => setNewRequest({...newRequest, licenseTeamManagerNo: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Request and Permission */}
                <div>
                  <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Request and Permission</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Name Request Permission</label>
                      <input 
                        type="text"
                        placeholder="Team Name"
                        value={newRequest.nameRequestPermission}
                        onChange={(e) => setNewRequest({...newRequest, nameRequestPermission: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Mobile No.</label>
                      <input 
                        type="text"
                        placeholder="Mobile No."
                        value={newRequest.mobileNo}
                        onChange={(e) => setNewRequest({...newRequest, mobileNo: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Request Permission Topic</label>
                      <div className="relative">
                        <select 
                          value={newRequest.requestPermissionTopic}
                          onChange={(e) => setNewRequest({...newRequest, requestPermissionTopic: e.target.value})}
                          className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                        >
                          <option value="" disabled></option>
                          <option value="เปลี่ยนนักแข่งระหว่าง event">เปลี่ยนนักแข่งระหว่าง event</option>
                          <option value="Number Change">Number Change</option>
                          <option value="Driver Substitution">Driver Substitution</option>
                          <option value="Late Scrutineering">Late Scrutineering</option>
                          <option value="Other">Other</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Request Permission Detail</label>
                      <textarea 
                        rows={3}
                        placeholder="Request Permission Detail"
                        value={newRequest.requestPermissionDetail}
                        onChange={(e) => setNewRequest({...newRequest, requestPermissionDetail: e.target.value})}
                        className="w-full bg-white/50 border border-white/40 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all resize-none placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Understand the Punishment Rule</h3>
                  <div className="prose prose-sm max-w-none text-slate-600 font-light space-y-4">
                    <p>
                      ข้าพเจ้าจะไม่เรียกร้องค่าเสียหายอันเกิดจากอุบัติเหตุในการแข่งขัน และยินยอมเป็นผู้รับผิดชอบเอง ในความเสียหายแทนผู้จัดการแข่งขันและ คณะกรรมการที่ดำเนินการแข่งขันทุกๆ ฝ่าย รวมไปถึงเจ้าของสนาม ผู้อุปถัมภ์จัดการแข่งขัน ผู้บริจาคเงินเพื่อการแข่งขันตลอดจนเจ้าหน้าที่ต่างๆ บริวารผู้ แทนและตัวแทนนิติบุคคล ดังกล่าวในกรณีที่มี การดำเนินคดี การเรียกร้องค่าตอบแทน ค่าใช้จ่ายต่างๆ รวมถึงค่าใช้จ่ายที่อาจเกิดจากการที่จะต้องดำเนิน คดีหรือถูกดำเนินคดีทางศาลและการเรียกร้องค่าสินไหมทดแทนเกี่ยวกับการตาย การบาดเจ็บ การสูญหาย และความเสียหายต่างๆ ที่เกิดขึ้นกับตัวบุคคล หรือทรัพย์สินของ นักแข่ง ไม่ว่าการดังกล่าวจะเกิดขึ้นเนื่องจาก หรือเกี่ยวกับ หรือสืบเนื่องมาจากการอนุมัติใบสมัคร หรือการร่วมการแข่งขันครั้งนี้และไม่ว่า ความเสียหายดังกล่าวได้เกิดขึ้นเพราะนิติบุคคลดังกล่าว พนักงานของนิติบุคคล บริวารผู้แทน หรือตัวแทน ได้มีส่วนร่วมในการกระทำหรือกระทำโดย ประมาทก็ตาม ข้าพเจ้าจึงลงลายมือชื่อไว้เป็นสำคัญต่อหน้าคณะกรรมการและพยาน
                    </p>
                    <p>
                      ข้าพเจ้ายินยอมให้บริษัทฯ เก็บรวบรวม ใช้ และ/หรือเปิดเผยข้อมูลส่วนบุคคล รวมทั้งยินยอมให้เก็บรวบรวมข้อมูลส่วนบุคคลในเอกสารข้างต้น สำหรับวัตถุประสงค์ในการสมัครแข่งขันรถยนต์ทางเรียบ รายการ PT MAXNITRON RACING SERIES ของนักแข่งและทีมงาน ทั้งนี้เป็นไปตามพระราชบัญญัติ คุ้มครองข้อมูลส่วนบุคคล พ.ศ.2562 หรือกฎหมาย/ระเบียบข้อบังคับอื่นๆ ที่เกี่ยวข้อง รวมถึงยินยอมให้ตรวจสอบความถูกต้องในรายละเอียดใบสมัครแข่งขัน
                    </p>
                    <p>
                      ข้าพเจ้าจึงลงลายมือชื่อเพื่อรับทราบและยินยอมตามข้อความดังกล่าวข้างต้น
                    </p>
                    <p className="mt-6">
                      I hereby agree not to claim any damages resulting from accidents during the competition and agree to be fully responsible for any damages, on behalf of the organizer of the competition and all parties involved in organizing the event, including the venue owner, sponsors, donors of the event, and all officials, representatives, and agents of the aforementioned, in the event of legal proceedings, claims for compensation, expenses, or costs that may arise from the litigation or legal actions, as well as claims for damages related to death, injury, loss, or other damages to the person or property of the competitor. This applies regardless of whether the damages result from or are connected with the approval of the application or participation in this competition, and regardless of whether such damages occurred due to the actions or negligence of the aforementioned legal entities, employees, agents, representatives, or other parties.
                    </p>
                    <p>
                      I consent to the company collecting, using, and/or disclosing my personal data, and I also consent to the collection of my personal data in the above-mentioned documents for the purpose of registering for the PT MAXNITRON RACING SERIES road racing competition, both for myself as a competitor and for the team. This consent is in accordance with the Personal Data Protection Act B.E. 2562 (2019) or other applicable laws and regulations. I also agree to allow the verification of the accuracy of the competition registration details.
                    </p>
                    <p>
                      I hereby sign to acknowledge and consent to the above-mentioned terms.
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          <div className="p-6 sm:p-8 border-t border-slate-100 bg-white/30 flex items-center justify-between">
            {currentStep === 1 ? (
              <>
                <button
                  onClick={() => setActiveTab('inbox')}
                  className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Submit</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
