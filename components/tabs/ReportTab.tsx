'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  ArrowLeft, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Minus,
  Check,
  Loader2
} from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

interface PassedCar {
  carNumber: string;
  remark: string;
}

interface FailedCar {
  carNumber: string;
  reason: string;
}

interface Report {
  id: string;
  stadium: string;
  reportSession: string;
  race: string;
  series: string;
  grades: string;
  status: string;
  passedCars: PassedCar[];
  failedCars: FailedCar[];
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

const initialFormData = {
  stadium: '',
  reportSession: '',
  race: '',
  series: '',
  grades: '',
  passedCars: [] as PassedCar[],
  failedCars: [] as FailedCar[],
};

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort
}: { 
  label: string, 
  sortKey: keyof Report, 
  align?: 'left' | 'right',
  sortConfig: { key: keyof Report, direction: 'asc' | 'desc' } | null,
  requestSort: (key: keyof Report) => void
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

export default function ReportTab() {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);
  
  // Form Wizard States
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 2;
  
  // List View States
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Report, direction: 'asc' | 'desc' } | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedReports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Report[];
      
      setReports(fetchedReports);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reports');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 4000);
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

  const requestSort = (key: keyof Report) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredReports = useMemo(() => {
    let filtered = reports.filter(report => {
      const searchLower = search.toLowerCase();
      return (
        report.series?.toLowerCase().includes(searchLower) ||
        report.grades?.toLowerCase().includes(searchLower) ||
        report.stadium?.toLowerCase().includes(searchLower) ||
        report.reportSession?.toLowerCase().includes(searchLower)
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
  }, [reports, search, sortConfig]);

  const handleEdit = (report: Report) => {
    setFormData({
      stadium: report.stadium || '',
      reportSession: report.reportSession || '',
      race: report.race || '',
      series: report.series || '',
      grades: report.grades || '',
      passedCars: report.passedCars || [],
      failedCars: report.failedCars || [],
    });
    setEditingId(report.id);
    setViewMode(false);
    setCurrentStep(1);
    setView('form');
  };

  const handleView = (report: Report) => {
    setFormData({
      stadium: report.stadium || '',
      reportSession: report.reportSession || '',
      race: report.race || '',
      series: report.series || '',
      grades: report.grades || '',
      passedCars: report.passedCars || [],
      failedCars: report.failedCars || [],
    });
    setEditingId(report.id);
    setViewMode(true);
    setCurrentStep(1);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!auth.currentUser) return;
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        const itemToDelete = reports.find(r => r.id === id);
        if (itemToDelete) {
          const newDeletedItem = {
            id: `DEL-RPT-${itemToDelete.id}`,
            type: 'Scrutineering Report',
            name: itemToDelete.stadium || `Report #${itemToDelete.id}`,
            deletedBy: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
            deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            expires: '7 days',
            originalData: itemToDelete,
            userId: auth.currentUser.uid
          };
          
          const delRef = doc(db, 'deletedItems', newDeletedItem.id);
          await setDoc(delRef, newDeletedItem);
        }
        
        await deleteDoc(doc(db, 'reports', id));
        showToast('Report deleted successfully');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `reports/${id}`);
      }
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);

    try {
      const reportId = editingId || `RPT-${Date.now()}`;
      const now = new Date().toISOString();
      
      const reportData: Partial<Report> = {
        stadium: formData.stadium,
        reportSession: formData.reportSession,
        race: formData.race,
        series: formData.series,
        grades: formData.grades,
        passedCars: formData.passedCars,
        failedCars: formData.failedCars,
        status: 'Submitted',
        updatedAt: now,
        userId: auth.currentUser.uid
      };

      if (!editingId) {
        reportData.createdAt = now;
      }

      await setDoc(doc(db, 'reports', reportId), reportData, { merge: true });
      
      showToast(editingId ? 'Report updated successfully' : 'Report created successfully');
      setView('list');
      setFormData(initialFormData);
      setEditingId(null);
      setCurrentStep(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addPassedCar = () => {
    setFormData(prev => ({
      ...prev,
      passedCars: [...prev.passedCars, { carNumber: '', remark: '' }]
    }));
  };

  const removePassedCar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      passedCars: prev.passedCars.filter((_, i) => i !== index)
    }));
  };

  const updatePassedCar = (index: number, field: keyof PassedCar, value: string) => {
    setFormData(prev => {
      const newCars = [...prev.passedCars];
      newCars[index] = { ...newCars[index], [field]: value };
      return { ...prev, passedCars: newCars };
    });
  };

  const addFailedCar = () => {
    setFormData(prev => ({
      ...prev,
      failedCars: [...prev.failedCars, { carNumber: '', reason: '' }]
    }));
  };

  const removeFailedCar = (index: number) => {
    setFormData(prev => ({
      ...prev,
      failedCars: prev.failedCars.filter((_, i) => i !== index)
    }));
  };

  const updateFailedCar = (index: number, field: keyof FailedCar, value: string) => {
    setFormData(prev => {
      const newCars = [...prev.failedCars];
      newCars[index] = { ...newCars[index], [field]: value };
      return { ...prev, failedCars: newCars };
    });
  };

  const renderInput = (label: string, field: keyof typeof formData, type = 'text') => (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
      <input
        type={type}
        value={formData[field] as string}
        onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
        className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
        placeholder={`Enter ${label.toLowerCase()}`}
        disabled={viewMode}
      />
    </div>
  );

  const renderSelect = (label: string, field: keyof typeof formData, options: string[]) => (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
      <div className="relative">
        <select
          value={formData[field] as string}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
          disabled={viewMode}
        >
          <option value="">Select {label}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );

  const renderRadioGroup = (label: string, field: keyof typeof formData, options: string[]) => (
    <div className="space-y-3">
      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map(opt => (
          <label 
            key={opt}
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              formData[field] === opt 
                ? 'bg-orange-50 border-orange-200' 
                : 'bg-white border-slate-200 hover:border-orange-200'
            }`}
          >
            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
              formData[field] === opt ? 'border-orange-500' : 'border-slate-300'
            }`}>
              {formData[field] === opt && <div className="w-2 h-2 rounded-full bg-orange-500" />}
            </div>
            <span className={`text-sm ${formData[field] === opt ? 'text-orange-700 font-medium' : 'text-slate-600'}`}>
              {opt}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  if (view === 'list') {
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
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Scrutineering Report</h1>
              <p className="text-slate-500 font-light text-sm">Manage and review post-qualify scrutineering reports.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search reports..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-11 pr-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all placeholder:text-slate-400"
                />
              </div>
              <button 
                onClick={() => {
                  setFormData(initialFormData);
                  setEditingId(null);
                  setCurrentStep(1);
                  setView('form');
                }}
                className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Create Scrutineering Report
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr>
                    <SortableHeader label="CREATED" sortKey="createdAt" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="LAST UPDATE" sortKey="updatedAt" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="REPORT SESSION" sortKey="reportSession" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="RACE" sortKey="race" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="SERIES RACE" sortKey="series" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader label="GRADE RACE" sortKey="grades" sortConfig={sortConfig} requestSort={requestSort} />
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
                    ) : sortedAndFilteredReports.map((item) => (
                      <motion.tr 
                        layout
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative"
                      >
                        <td className="px-6 py-5 relative">
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="text-sm text-slate-900 font-medium">
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">
                            {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.reportSession}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.race}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.series}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.grades}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                            item.status === 'Submitted' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleView(item)}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                            >
                              View
                            </button>
                            <button 
                              onClick={() => handleEdit(item)}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="text-[11px] uppercase tracking-wider font-medium text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {!isLoading && sortedAndFilteredReports.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-light">
                          No data found.
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

        {renderToast()}
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
              onClick={() => setView('list')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
                {editingId ? 'Edit Scrutineering Report' : 'Create Scrutineering Report'}
              </h1>
              <p className="text-slate-500 font-light text-sm">Fill in the scrutineering details.</p>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-12">
          <div className="flex items-center justify-center max-w-2xl mx-auto">
            {[
              { num: 1, label: 'Race Info' },
              { num: 2, label: 'Report' }
            ].map((step, i) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors z-10 ${
                    currentStep >= step.num 
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' 
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    {currentStep > step.num ? <Check className="w-5 h-5" /> : step.num}
                  </div>
                  <span className={`absolute -bottom-6 text-[11px] uppercase tracking-wider font-medium whitespace-nowrap ${
                    currentStep >= step.num ? 'text-orange-600' : 'text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {i < 1 && (
                  <div className={`w-32 sm:w-64 h-0.5 mx-2 transition-colors ${
                    currentStep > step.num ? 'bg-orange-500' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
          <div className="p-8 sm:p-10">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <h2 className="text-xl font-light text-slate-900 mb-6">Race Information</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      {renderSelect('Stadium', 'stadium', ['Chang International Circuit', 'Bira Circuit', 'Bangsaen Street Circuit'])}
                      {renderSelect('Report Session', 'reportSession', ['Qualify', 'Post-Qualify', 'Post-Race', 'Special Case'])}
                      {renderInput('Race', 'race')}
                    </div>
                    <div className="space-y-6">
                      {renderRadioGroup('Series', 'series', ['SIAM GT', 'SIAM 1500', 'SIAM GROUP N', 'SIAM GROUP A', 'SIAM TRUCK', 'SIAM ECO'])}
                      {renderRadioGroup('Grades', 'grades', ['PRO', 'AM', 'GT PRO CLASS 1', 'GT PRO CLASS 2', 'Overall'])}
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
                  className="space-y-10"
                >
                  <h2 className="text-xl font-light text-slate-900 mb-6">Scrutineering Report</h2>

                  {/* Passed Cars Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700">The following cars have pass post-qualify scrutineering</h3>
                      {!viewMode && (
                        <button 
                          onClick={addPassedCar}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {formData.passedCars.length > 0 && (
                      <div className="grid grid-cols-[1fr_2fr_auto] gap-4 mb-2 px-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Car Number</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Remark</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium text-center w-10">Action</div>
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      {formData.passedCars.map((car, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <input
                            type="text"
                            value={car.carNumber}
                            onChange={(e) => updatePassedCar(index, 'carNumber', e.target.value)}
                            placeholder="Car Number"
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                            disabled={viewMode}
                          />
                          <input
                            type="text"
                            value={car.remark}
                            onChange={(e) => updatePassedCar(index, 'remark', e.target.value)}
                            placeholder="Remark"
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                            disabled={viewMode}
                          />
                          {!viewMode && (
                            <button 
                              onClick={() => removePassedCar(index)}
                              className="w-12 h-[46px] shrink-0 flex items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {formData.passedCars.length === 0 && (
                        <div className="text-sm text-slate-400 font-light italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                          No cars added yet. Click the + button to add.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Failed Cars Section */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-700">The following cars have not pass post-qualify scrutineering for the reason stated</h3>
                      {!viewMode && (
                        <button 
                          onClick={addFailedCar}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {formData.failedCars.length > 0 && (
                      <div className="grid grid-cols-[1fr_2fr_auto] gap-4 mb-2 px-2">
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Car Number</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Reason</div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium text-center w-10">Action</div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {formData.failedCars.map((car, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <input
                            type="text"
                            value={car.carNumber}
                            onChange={(e) => updateFailedCar(index, 'carNumber', e.target.value)}
                            placeholder="Car Number"
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                            disabled={viewMode}
                          />
                          <input
                            type="text"
                            value={car.reason}
                            onChange={(e) => updateFailedCar(index, 'reason', e.target.value)}
                            placeholder="Reason"
                            className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
                            disabled={viewMode}
                          />
                          {!viewMode && (
                            <button 
                              onClick={() => removeFailedCar(index)}
                              className="w-12 h-[46px] shrink-0 flex items-center justify-center rounded-xl border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {formData.failedCars.length === 0 && (
                        <div className="text-sm text-slate-400 font-light italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
                          No cars added yet. Click the + button to add.
                        </div>
                      )}
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-6 sm:p-8 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <button
              onClick={() => currentStep > 1 ? setCurrentStep(prev => prev - 1) : setView('list')}
              className="px-6 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Back
            </button>
            
            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-8 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20"
              >
                Next
              </button>
            ) : (
              !viewMode && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Submit</>
                  )}
                </button>
              )
            )}
          </div>
        </div>
      </motion.div>

      {renderToast()}
    </>
  );
}
