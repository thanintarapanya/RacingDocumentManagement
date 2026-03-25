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
  Loader2,
  Eye,
  Edit,
  Trash2,
  Printer,
  MoreVertical
} from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { useAppStore } from '@/lib/store';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { PORTRAIT_BG } from '@/lib/base64-bg';

interface RequestItem {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt?: string;
  updatedAt?: string;
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
  remark?: string;

  // Additional Approvals
  requireChairmanApproval?: boolean;
  requireStewardApproval?: boolean;
  chairmanStatus?: 'Pending' | 'Approved' | 'Rejected';
  stewardStatus?: 'Pending' | 'Approved' | 'Rejected';
  chairmanComment?: string;
  chairmanSignName?: string;
  chairmanSignDate?: string;
  stewardComment?: string;
  stewardSignName?: string;
  stewardSignDate?: string;

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
    requestPermissionDetail: '',
    remark: '',
    requireChairmanApproval: false,
    requireStewardApproval: false,
    chairmanStatus: 'Pending' as 'Pending' | 'Approved' | 'Rejected',
    stewardStatus: 'Pending' as 'Pending' | 'Approved' | 'Rejected',
    chairmanComment: '',
    chairmanSignName: '',
    chairmanSignDate: '',
    stewardComment: '',
    stewardSignName: '',
    stewardSignDate: '',
    status: 'Pending' as 'Pending' | 'Approved' | 'Rejected' | 'Cancelled'
  };
  
  const [newRequest, setNewRequest] = useState(initialRequestState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<boolean>(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState<boolean>(false);
  
  // List View States
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof RequestItem, direction: 'asc' | 'desc' } | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(20);

  const entries = useAppStore((state) => state.entries);

  const handlePrintPDF = () => {
    window.print();
  };

  useEffect(() => {
    if (newRequest.series && newRequest.carNumber) {
      const entry = entries.find(e => e.seriesRace === newRequest.series && e.carNumber === newRequest.carNumber);
      if (entry && entry.formData) {
        setNewRequest(prev => ({
          ...prev,
          driverName: entry.formData.nameEnglish || entry.formData.nameThai || '',
          licenseDriverNo: entry.formData.competitionLicenseNo || '',
          licenseTeamManagerNo: entry.formData.licenseTeamManagerNo || '',
          nameRequestPermission: entry.formData.teamManagerName || '',
          mobileNo: entry.formData.managerMobileNo || '',
        }));
      }
    }
  }, [newRequest.series, newRequest.carNumber, entries]);

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
        (req.series || '')?.toLowerCase().includes(searchLower) ||
        (req.remark || '')?.toLowerCase().includes(searchLower) ||
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

  const handleApprove = () => {
    setShowApproveConfirm(true);
  };

  const confirmApprove = async () => {
    if (!auth.currentUser || !editingId) return;
    setIsSubmitting(true);
    
    try {
      await updateDoc(doc(db, 'requests', editingId), {
        ...newRequest,
        status: 'Approved',
        updatedAt: new Date().toISOString()
      });
      
      setNewRequest(initialRequestState);
      setCurrentStep(1);
      setEditingId(null);
      setViewMode(false);
      setShowApproveConfirm(false);
      setActiveTab('inbox');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (newStatus: 'Pending' | 'Cancelled') => {
    if (!auth.currentUser || !editingId) return;
    setIsSubmitting(true);
    
    try {
      await updateDoc(doc(db, 'requests', editingId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      setNewRequest(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleApproval = async (type: 'chairman' | 'steward') => {
    if (!auth.currentUser || !editingId) return;
    setIsSubmitting(true);
    
    try {
      const updates: any = {
        updatedAt: new Date().toISOString()
      };
      
      if (type === 'chairman') {
        updates.requireChairmanApproval = !newRequest.requireChairmanApproval;
        if (updates.requireChairmanApproval) updates.chairmanStatus = 'Pending';
      } else {
        updates.requireStewardApproval = !newRequest.requireStewardApproval;
        if (updates.requireStewardApproval) updates.stewardStatus = 'Pending';
      }
      
      await updateDoc(doc(db, 'requests', editingId), updates);
      
      setNewRequest(prev => ({ 
        ...prev, 
        ...updates
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChairmanApprove = async () => {
    if (!auth.currentUser || !editingId) return;
    setIsSubmitting(true);
    
    try {
      const updates = {
        chairmanStatus: 'Approved',
        chairmanSignName: auth.currentUser.displayName || auth.currentUser.email || 'Chairman',
        chairmanSignDate: new Date().toISOString().split('T')[0],
        chairmanComment: newRequest.chairmanComment || '',
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'requests', editingId), updates);
      
      setNewRequest(prev => ({ 
        ...prev, 
        ...updates
      } as any));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStewardApprove = async () => {
    if (!auth.currentUser || !editingId) return;
    setIsSubmitting(true);
    
    try {
      const updates = {
        stewardStatus: 'Approved',
        stewardSignName: auth.currentUser.displayName || auth.currentUser.email || 'Steward',
        stewardSignDate: new Date().toISOString().split('T')[0],
        stewardComment: newRequest.stewardComment || '',
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'requests', editingId), updates);
      
      setNewRequest(prev => ({ 
        ...prev, 
        ...updates
      } as any));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    
    try {
      if (editingId) {
        await updateDoc(doc(db, 'requests', editingId), {
          ...newRequest,
          updatedAt: new Date().toISOString()
        });
      } else {
        const newId = `REQ-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        await setDoc(doc(db, 'requests', newId), {
          ...newRequest,
          status: 'Pending',
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      setNewRequest(initialRequestState);
      setCurrentStep(1);
      setEditingId(null);
      setViewMode(false);
      setActiveTab('inbox');
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (req: RequestItem) => {
    setNewRequest({
      race: req.race || '',
      circuit: req.circuit || '',
      driverName: req.driverName || req.team || '',
      carNumber: req.carNumber || req.car || '',
      series: req.series || '',
      licenseDriverNo: req.licenseDriverNo || '',
      licenseTeamManagerNo: req.licenseTeamManagerNo || '',
      nameRequestPermission: req.nameRequestPermission || '',
      mobileNo: req.mobileNo || '',
      requestPermissionTopic: req.requestPermissionTopic || req.type || '',
      requestPermissionDetail: req.requestPermissionDetail || req.desc || '',
      remark: req.remark || '',
      requireChairmanApproval: req.requireChairmanApproval || false,
      requireStewardApproval: req.requireStewardApproval || false,
      chairmanStatus: req.chairmanStatus || 'Pending',
      stewardStatus: req.stewardStatus || 'Pending',
      chairmanComment: req.chairmanComment || '',
      chairmanSignName: req.chairmanSignName || '',
      chairmanSignDate: req.chairmanSignDate || '',
      stewardComment: req.stewardComment || '',
      stewardSignName: req.stewardSignName || '',
      stewardSignDate: req.stewardSignDate || '',
      status: req.status || 'Pending'
    });
    setEditingId(req.id);
    setViewMode(false);
    setCurrentStep(1);
    setActiveTab('new');
  };

  const handleView = (req: RequestItem) => {
    setNewRequest({
      race: req.race || '',
      circuit: req.circuit || '',
      driverName: req.driverName || req.team || '',
      carNumber: req.carNumber || req.car || '',
      series: req.series || '',
      licenseDriverNo: req.licenseDriverNo || '',
      licenseTeamManagerNo: req.licenseTeamManagerNo || '',
      nameRequestPermission: req.nameRequestPermission || '',
      mobileNo: req.mobileNo || '',
      requestPermissionTopic: req.requestPermissionTopic || req.type || '',
      requestPermissionDetail: req.requestPermissionDetail || req.desc || '',
      remark: req.remark || '',
      requireChairmanApproval: req.requireChairmanApproval || false,
      requireStewardApproval: req.requireStewardApproval || false,
      chairmanStatus: req.chairmanStatus || 'Pending',
      stewardStatus: req.stewardStatus || 'Pending',
      chairmanComment: req.chairmanComment || '',
      chairmanSignName: req.chairmanSignName || '',
      chairmanSignDate: req.chairmanSignDate || '',
      stewardComment: req.stewardComment || '',
      stewardSignName: req.stewardSignName || '',
      stewardSignDate: req.stewardSignDate || '',
      status: req.status || 'Pending'
    });
    setEditingId(req.id);
    setViewMode(true);
    setCurrentStep(1);
    setActiveTab('new');
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    if (confirm('Are you sure you want to delete this request?')) {
      try {
        const itemToDelete = requests.find(r => r.id === id);
        if (itemToDelete) {
          const newDeletedItem = {
            id: `DEL-REQ-${itemToDelete.id}`,
            type: 'Competitor Request',
            name: itemToDelete.driverName || itemToDelete.team || `Request #${itemToDelete.id}`,
            deletedBy: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
            deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            expires: '7 days',
            originalData: itemToDelete,
            userId: auth.currentUser.uid
          };
          
          const delRef = doc(db, 'deletedItems', newDeletedItem.id);
          await setDoc(delRef, newDeletedItem);
        }
        
        await deleteDoc(doc(db, 'requests', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'requests');
      }
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

          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr>
                    <SortableHeader label="CREATE" sortKey="createdAt" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="LASTUPDATE" sortKey="updatedAt" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="NO" sortKey="id" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="RACE SERIES" sortKey="series" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="CAR NUMBER" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="REQUEST TOPIC" sortKey="requestPermissionTopic" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="REMARK" sortKey="remark" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="STATUS" sortKey="status" sortConfig={sortConfig} requestSort={requestSort} />
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center">
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
                          <span className="text-sm text-slate-600 font-light">
                            {req.createdAt ? new Date(req.createdAt).toLocaleString() : req.date}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">
                            {req.updatedAt ? new Date(req.updatedAt).toLocaleString() : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-900 font-medium">{req.id}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{req.series || '-'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{req.carNumber || req.car || '-'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">
                            {(req.requestPermissionTopic || req.type) === 'อื่นๆ' || (req.requestPermissionTopic || req.type) === 'Others' 
                              ? (req.requestPermissionDetail || req.desc || 'อื่นๆ')
                              : (req.requestPermissionTopic || req.type || '-')}
                          </span>
                        </td>
                        <td className="px-6 py-5 max-w-[200px] truncate">
                          <span className="text-sm text-slate-600 font-light">{req.remark || '-'}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                            req.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 
                            req.status === 'Approved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                            req.status === 'Cancelled' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                            'bg-rose-50 text-rose-600 border border-rose-200'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleView(req)}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                            >
                              View
                            </button>
                            <button 
                              onClick={() => handleEdit(req)}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(req.id)}
                              className="text-[11px] uppercase tracking-wider font-medium text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {!isLoading && sortedAndFilteredRequests.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-light">
                          No requests found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
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

  if (activeTab === 'new' && viewMode) {
    return (
      <>
        <motion.div 
          key="view-mode"
          id="print-content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="max-w-4xl mx-auto pb-12 print-page print-scale-down relative"
        >
        {/* Background Image for Print */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={PORTRAIT_BG} 
          alt="PDF Background" 
          className="hidden print:block absolute top-0 left-0 w-[210mm] h-[297mm] object-cover z-0 pointer-events-none"
        />
        <div className="w-full h-full relative z-10 print-content-wrapper">
        <div className="mb-8 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => {
                setActiveTab('inbox');
                setViewMode(false);
                setEditingId(null);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500 print:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-light tracking-tight text-slate-900">
              Competitor Request Form : {editingId}
            </h1>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 mb-6">
          <button 
            onClick={handlePrintPDF}
            className="px-5 py-2.5 bg-slate-500 hover:bg-slate-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 w-fit print:hidden"
          >
            <Printer className="w-4 h-4" />
            Print PDF
          </button>
          
          <div className="flex-1 flex justify-end items-center gap-4 print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Secretary Comment <span className="text-rose-500">*</span></span>
              <input 
                type="text" 
                placeholder="Please enter comment" 
                value={newRequest.remark}
                onChange={(e) => setNewRequest({...newRequest, remark: e.target.value})}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-light text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 w-64"
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleApprove}
                disabled={isSubmitting || newRequest.status === 'Cancelled'}
                className="px-6 py-2.5 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-70 flex items-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {newRequest.status === 'Approved' ? 'Update Request' : 'Approve Request'}
              </button>
              
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button 
                    disabled={isSubmitting}
                    className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all shadow-sm disabled:opacity-70 print:hidden"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content 
                    align="end"
                    className="min-w-[220px] bg-white rounded-xl shadow-lg border border-slate-100 p-1 z-50 animate-in fade-in zoom-in-95"
                  >
                    {newRequest.status === 'Approved' && (
                      <DropdownMenu.Item 
                        onClick={() => handleStatusChange('Pending')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer outline-none transition-colors"
                      >
                        Unapprove Request
                      </DropdownMenu.Item>
                    )}
                    
                    {newRequest.status !== 'Cancelled' && (
                      <DropdownMenu.Item 
                        onClick={() => handleStatusChange('Cancelled')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer outline-none transition-colors"
                      >
                        Cancel Request
                      </DropdownMenu.Item>
                    )}

                    {newRequest.status === 'Cancelled' && (
                      <DropdownMenu.Item 
                        onClick={() => handleStatusChange('Pending')}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer outline-none transition-colors"
                      >
                        Restore Request
                      </DropdownMenu.Item>
                    )}

                    <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                    
                    <DropdownMenu.Item 
                      onClick={() => handleToggleApproval('chairman')}
                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer outline-none transition-colors"
                    >
                      <span>Request Chairman Approval</span>
                      {newRequest.requireChairmanApproval && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </DropdownMenu.Item>
                    
                    <DropdownMenu.Item 
                      onClick={() => handleToggleApproval('steward')}
                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg cursor-pointer outline-none transition-colors"
                    >
                      <span>Request Steward Approval</span>
                      {newRequest.requireStewardApproval && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
        </div>

        {newRequest.status === 'Approved' ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-6 flex items-center gap-3 print:hidden">
            <AlertCircle className="w-5 h-5 text-emerald-500" />
            <span className="text-sm text-emerald-800 font-medium">Approved by Secretary</span>
          </div>
        ) : newRequest.status === 'Cancelled' ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex items-center gap-3 print:hidden">
            <AlertCircle className="w-5 h-5 text-slate-500" />
            <span className="text-sm text-slate-700 font-medium">Request Cancelled</span>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 flex items-center gap-3 print:hidden">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <span className="text-sm text-amber-800 font-medium">Wait for approved by Secretary</span>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden mb-6">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-medium text-slate-800">Request Info</h2>
          </div>
          <div className="p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-y-8 gap-x-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">ID</div>
                <div className="text-sm text-slate-900">{editingId}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Create Date</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Update Date</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Stadium Number</div>
                <div className="text-sm text-slate-900">-</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Photo</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Stadium Name</div>
                <div className="text-sm text-slate-900">{newRequest.circuit || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Racer Name</div>
                <div className="text-sm text-slate-900">{newRequest.driverName || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Racing Car Number</div>
                <div className="text-sm text-slate-900">{newRequest.carNumber || '-'}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Model</div>
                <div className="text-sm text-slate-900">{newRequest.series || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Race Ticket Number</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Team Collector Number</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Permit Applicant Name</div>
                <div className="text-sm text-slate-900">{newRequest.nameRequestPermission || '-'}</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Phone</div>
                <div className="text-sm text-slate-900">{newRequest.mobileNo || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Subject Topic</div>
                <div className="text-sm text-slate-900">{newRequest.requestPermissionTopic || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Subject Detail</div>
                <div className="text-sm text-slate-900">{newRequest.requestPermissionDetail || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Chairman</div>
                <div className="text-sm text-slate-900">-</div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Date of Finepaid</div>
                <div className="text-sm text-slate-900">-</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-6">
          {/* Racer Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-medium text-slate-800">Racer</h3>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium border border-emerald-100">Approved</span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-auto">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                <div className="text-sm font-medium text-blue-600">{newRequest.driverName || '-'}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
            </div>
          </div>

          {/* Team Manager Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-medium text-slate-800">Team Manager</h3>
              <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium border border-amber-100">Waiting for approve</span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
            </div>
            <div className="mt-auto flex justify-end print:hidden">
              <button className="px-6 py-2 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
                Approve
              </button>
            </div>
          </div>

          {/* Chief Inspection Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-medium text-slate-800">Chief Inspection</h3>
              <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium border border-amber-100">Waiting for approve</span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
            </div>
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Comment</div>
              <input 
                type="text" 
                placeholder="Comment" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-light text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 print:border-none print:bg-transparent print:p-0 print:h-auto print:placeholder-transparent"
              />
            </div>
            <div className="mt-auto flex justify-end print:hidden">
              <button className="px-6 py-2 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
                Approve
              </button>
            </div>
          </div>

          {/* Field Master Card */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-medium text-slate-800">Field Master</h3>
              <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-medium border border-amber-100">Waiting for approve</span>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                <div className="text-sm text-blue-600">-</div>
              </div>
            </div>
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Comment</div>
              <input 
                type="text" 
                placeholder="Comment" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-light text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 print:border-none print:bg-transparent print:p-0 print:h-auto print:placeholder-transparent"
              />
            </div>
            <div className="mt-auto flex justify-end print:hidden">
              <button className="px-6 py-2 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm">
                Approve
              </button>
            </div>
          </div>

          {/* Chairman Card */}
          {newRequest.requireChairmanApproval && (
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-medium text-slate-800">Chairman</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  newRequest.chairmanStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  newRequest.chairmanStatus === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                  'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  {newRequest.chairmanStatus === 'Approved' ? 'Approved' : 
                   newRequest.chairmanStatus === 'Rejected' ? 'Rejected' : 
                   'Waiting for approve'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                  <div className="text-sm text-blue-600">{newRequest.chairmanSignName || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                  <div className="text-sm text-blue-600">{newRequest.chairmanSignDate || '-'}</div>
                </div>
              </div>
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Comment</div>
                <input 
                  type="text" 
                  placeholder="Comment" 
                  value={newRequest.chairmanComment || ''}
                  onChange={(e) => setNewRequest({ ...newRequest, chairmanComment: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-light text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 print:border-none print:bg-transparent print:p-0 print:h-auto print:placeholder-transparent"
                  disabled={newRequest.chairmanStatus === 'Approved' || isSubmitting}
                />
              </div>
              <div className="mt-auto flex justify-end print:hidden">
                <button 
                  onClick={handleChairmanApprove}
                  className="px-6 py-2 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                  disabled={newRequest.chairmanStatus === 'Approved' || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {newRequest.chairmanStatus === 'Approved' ? 'Approved' : 'Approve'}
                </button>
              </div>
            </div>
          )}

          {/* Steward Card */}
          {newRequest.requireStewardApproval && (
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-medium text-slate-800">Steward</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  newRequest.stewardStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  newRequest.stewardStatus === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                  'bg-amber-50 text-amber-600 border-amber-100'
                }`}>
                  {newRequest.stewardStatus === 'Approved' ? 'Approved' : 
                   newRequest.stewardStatus === 'Rejected' ? 'Rejected' : 
                   'Waiting for approve'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Name</div>
                  <div className="text-sm text-blue-600">{newRequest.stewardSignName || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Sign Date</div>
                  <div className="text-sm text-blue-600">{newRequest.stewardSignDate || '-'}</div>
                </div>
              </div>
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">Comment</div>
                <input 
                  type="text" 
                  placeholder="Comment" 
                  value={newRequest.stewardComment || ''}
                  onChange={(e) => setNewRequest({ ...newRequest, stewardComment: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-light text-slate-900 focus:outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100/50 print:border-none print:bg-transparent print:p-0 print:h-auto print:placeholder-transparent"
                  disabled={newRequest.stewardStatus === 'Approved' || isSubmitting}
                />
              </div>
              <div className="mt-auto flex justify-end print:hidden">
                <button 
                  onClick={handleStewardApprove}
                  className="px-6 py-2 bg-[#1864c2] hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                  disabled={newRequest.stewardStatus === 'Approved' || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {newRequest.stewardStatus === 'Approved' ? 'Approved' : 'Approve'}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
        </motion.div>

        <AnimatePresence>
          {showApproveConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-md w-full"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-medium text-slate-800">Confirm Action</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Are you sure you want to {newRequest.status === 'Approved' ? 'update' : 'approve'} this request?
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 mt-8">
                  <button
                    onClick={() => setShowApproveConfirm(false)}
                    className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmApprove}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-all shadow-sm disabled:opacity-70 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8 md:p-12">
          {/* Stepper */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4 relative max-w-xl mx-auto">
              {[1, 2].map((step) => (
                <div key={step} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= step ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-400'}`}>
                    {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-medium absolute -bottom-6 whitespace-nowrap ${currentStep >= step ? 'text-orange-600' : 'text-slate-400'}`}>
                    {step === 1 ? 'Request / Permission' : 'Punishment Rule'}
                  </span>
                </div>
              ))}
              <div className="absolute left-12 right-12 h-1 bg-slate-100 rounded-full z-0 top-5">
                <motion.div 
                  className="h-full bg-orange-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((currentStep - 1) / (2 - 1)) * 100}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              </div>
            </div>
          </div>

          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-10"
                >
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
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        placeholder="Race"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Circuit</label>
                      <div className="relative">
                        <select 
                          value={newRequest.circuit}
                          onChange={(e) => setNewRequest({...newRequest, circuit: e.target.value})}
                          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                          disabled={viewMode}
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
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Car Number</label>
                      <input 
                        type="text"
                        placeholder="Car Number"
                        value={newRequest.carNumber}
                        onChange={(e) => setNewRequest({...newRequest, carNumber: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Series</label>
                      <div className="relative">
                        <select 
                          value={newRequest.series}
                          onChange={(e) => setNewRequest({...newRequest, series: e.target.value})}
                          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                          disabled={viewMode}
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
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">License Team Manager No.</label>
                      <input 
                        type="text"
                        placeholder="License Team Manager No."
                        value={newRequest.licenseTeamManagerNo}
                        onChange={(e) => setNewRequest({...newRequest, licenseTeamManagerNo: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
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
                        placeholder="Requester Name"
                        value={newRequest.nameRequestPermission}
                        onChange={(e) => setNewRequest({...newRequest, nameRequestPermission: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Mobile No.</label>
                      <input 
                        type="text"
                        placeholder="Mobile No."
                        value={newRequest.mobileNo}
                        onChange={(e) => setNewRequest({...newRequest, mobileNo: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                        disabled={viewMode}
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
                          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                          disabled={viewMode}
                        >
                          <option value="" disabled></option>
                          <option value="เปลี่ยนเครื่องยนต์">เปลี่ยนเครื่องยนต์</option>
                          <option value="ตัดซีลเครื่องยนต์">ตัดซีลเครื่องยนต์</option>
                          <option value="เปลี่ยนเกียร์">เปลี่ยนเกียร์</option>
                          <option value="ตัดซีลเกียร์">ตัดซีลเกียร์</option>
                          <option value="นำรถออกนอกสนาม">นำรถออกนอกสนาม</option>
                          <option value="ขอตรวจสภาพรถแข่ง/ชุดแข่งล่าช้า">ขอตรวจสภาพรถแข่ง/ชุดแข่งล่าช้า</option>
                          <option value="ขอไม่จับเวลาการแข่งขัน (Qualify)">ขอไม่จับเวลาการแข่งขัน (Qualify)</option>
                          <option value="มาร์กยาง">มาร์กยาง</option>
                          <option value="ขออนุญาตใช้อุปกรณ์ที่หมดอายุ">ขออนุญาตใช้อุปกรณ์ที่หมดอายุ</option>
                          <option value="ขออนุญาตใช้/ไม่ใช้ อุปกรณ์ที่ตรวจ / สภาพอนุญาตเป็นกรณีพิเศษ">ขออนุญาตใช้/ไม่ใช้ อุปกรณ์ที่ตรวจ / สภาพอนุญาตเป็นกรณีพิเศษ</option>
                          <option value="เปลี่ยนชื่อทีมแข่ง">เปลี่ยนชื่อทีมแข่ง</option>
                          <option value="เปลี่ยนนักแข่งระหว่าง event">เปลี่ยนนักแข่งระหว่าง event</option>
                          <option value="เปลี่ยนรถแข่งระหว่าง event">เปลี่ยนรถแข่งระหว่าง event</option>
                          <option value="ขอไม่เข้าร่วมประชุมนักแข่ง">ขอไม่เข้าร่วมประชุมนักแข่ง</option>
                          <option value="ขอส่งตัวแทนเข้าประชุมนักแข่ง">ขอส่งตัวแทนเข้าประชุมนักแข่ง</option>
                          <option value="ขอไม่เข้าร่วมการแข่งขัน">ขอไม่เข้าร่วมการแข่งขัน</option>
                          <option value="อื่นๆ (โปรดระบุ)">อื่นๆ (โปรดระบุ)</option>
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
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all resize-none placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Remark</label>
                      <textarea 
                        rows={2}
                        placeholder="Enter any additional remarks..."
                        value={newRequest.remark}
                        onChange={(e) => setNewRequest({...newRequest, remark: e.target.value})}
                        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all resize-none placeholder:text-slate-300"
                        disabled={viewMode}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="space-y-8"
              >
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
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          <div className="mt-12 flex justify-between pt-6 border-t border-slate-100">
            {currentStep === 1 ? (
              <>
                <button
                  onClick={() => setActiveTab('inbox')}
                  className="px-8 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors bg-white"
                >
                  Back
                </button>
                <button 
                  onClick={() => setCurrentStep(2)}
                  className="px-8 py-2.5 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-orange-500/20"
                >
                  Next
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-8 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors bg-white"
                >
                  Back
                </button>
                {!viewMode && (
                  <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-2.5 bg-[#FF6B00] hover:bg-[#e66000] text-white rounded-xl text-sm font-medium transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Submit Request
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
