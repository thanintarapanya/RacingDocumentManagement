'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  FileText, 
  X, 
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Check,
  UploadCloud
} from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

type Inspection = {
  id: string;
  inspectionDate: string;
  racingModel: string;
  carNumber: string;
  teamName: string;
  racerName: string;
  brand: string;
  carModel: string;
  sealNumber: string;
  formData?: any;
  createdAt: string;
  updatedAt: string;
};

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort
}: { 
  label: string, 
  sortKey: keyof Inspection, 
  align?: 'left' | 'right',
  sortConfig: { key: keyof Inspection, direction: 'asc' | 'desc' } | null,
  requestSort: (key: keyof Inspection) => void
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

const initialFormData = {
  // Step 1: Series / Driver Info
  inspectionDate: new Date().toISOString().split('T')[0],
  stadium: '',
  series: '',
  grades: '',
  carNumber: '',
  teamName: '',
  racerName: '',
  teamManagerName: '',

  // Step 2: Car Info
  carManufacturer: '',
  model: '',
  engineDisplacement: '',
  engineCode: '',
  transmission: '',
  drivetrain: '',
  gearShiftPattern: '',
  autoGearMoreThan6: false,
  paddleShift: false,
  engineCapacityWeight: {} as Record<string, { checked: boolean, weight: string, committeeWeight: string }>,
  carBrandCapacityRestrictor: {} as Record<string, { checked: boolean, weight: string }>,
  tireMarkAmount: { yokohama: '', hankook: '', giti: '' },

  // Step 3: Inspection
  carLight: { headLight: false, turnSignal: false, tailLight: false, breakLight: false },
  carEquipment: {
    towPoint: { installed: false, sticker: false },
    bonnetLock: { installed: false, sticker: false },
    extinguisher: { installed: false, sticker: false },
    outsideKillSwitch: { installed: false, sticker: false },
    insideKillSwitch: { installed: false, sticker: false },
    seat: { installed: false, sticker: false },
    harnesses: { installed: false, sticker: false },
    rollOverBar: { installed: false, sticker: false },
  },
  racerSafety: {
    helmet: false,
    hans: false,
    balaclava: false,
    glove: false,
    raceSuite: false,
    sponsorTag: false,
    shoes: false,
  },
  remark: '',
  engineSealNumber: '',
  gearSealNumber: '',
  tireMarkAmountStep3: '',
  ptrsSmokeDetector: false,
  weightAddedAfterRace2: false,
  balanceOfPerformance: '',

  // Step 4: Change Engine Seal
  changeSeal: 'Not Change Seal',
  currentEngineSealNumber: '',
  newEngineSealNumber: '',
  reasonForChangingSeal: ''
};

export default function InspectionTab() {
  const [view, setView] = useState<'list' | 'form' | 'history-list' | 'history-detail'>('list');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedHistoryCarNumber, setSelectedHistoryCarNumber] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Inspection | null>(null);
  
  // Form Wizard States
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // List View States
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Inspection, direction: 'asc' | 'desc' } | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const [formData, setFormData] = useState(initialFormData);

  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});

  const handleFileChange = (label: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setUploadedFiles(prev => ({
        ...prev,
        [label]: [...(prev[label] || []), ...filesArray]
      }));
    }
  };

  const removeFile = (label: string, index: number) => {
    setUploadedFiles(prev => ({
      ...prev,
      [label]: prev[label].filter((_, i) => i !== index)
    }));
  };

  const renderFileUpload = (label: string, hint?: string) => {
    const files = uploadedFiles[label] || [];
    return (
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
        <label className="border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:bg-orange-50/30 hover:border-orange-200 transition-colors cursor-pointer group relative block">
          <input 
            type="file" 
            multiple 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={(e) => handleFileChange(label, e)}
          />
          <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-all mx-auto">
            <UploadCloud className="w-5 h-5 text-slate-500 group-hover:text-orange-500" />
          </div>
          <span className="text-sm font-medium text-slate-700 block">Click to upload</span>
          <span className="text-xs font-light text-slate-400 mt-1 block">or drag and drop (multiple files allowed)</span>
        </label>
        {hint && <p className="text-[11px] text-slate-400 mt-2">{hint}</p>}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                <span className="text-xs text-slate-600 truncate max-w-[200px]">{file.name}</span>
                <button 
                  type="button" 
                  onClick={(e) => { e.preventDefault(); removeFile(label, idx); }}
                  className="text-slate-400 hover:text-rose-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const q = query(collection(db, 'car_inspections'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Inspection[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Inspection);
      });
      setInspections(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'car_inspections');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value };
      }
      
      const newState = { ...prev };
      let current: any = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newState;
    });
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    try {
      const docId = editingId || Date.now().toString();
      const docRef = doc(db, 'car_inspections', docId);
      
      const payload = {
        inspectionDate: formData.inspectionDate,
        racingModel: formData.series,
        carNumber: formData.carNumber,
        teamName: formData.teamName,
        racerName: formData.racerName,
        brand: formData.carManufacturer,
        carModel: formData.model,
        sealNumber: formData.engineSealNumber,
        formData: formData,
        updatedAt: new Date().toISOString(),
        userId: auth.currentUser.uid
      };

      if (!editingId) {
        Object.assign(payload, { createdAt: new Date().toISOString() });
      }

      await setDoc(docRef, payload, { merge: true });
      
      showToast(editingId ? 'Inspection updated successfully' : 'Inspection created successfully');
      setView('list');
      setEditingId(null);
      setFormData(initialFormData);
      setCurrentStep(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'car_inspections');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (inspection: Inspection) => {
    setEditingId(inspection.id);
    setFormData(inspection.formData || {
      ...initialFormData,
      inspectionDate: inspection.inspectionDate || initialFormData.inspectionDate,
      series: inspection.racingModel || '',
      carNumber: inspection.carNumber || '',
      teamName: inspection.teamName || '',
      racerName: inspection.racerName || '',
      carManufacturer: inspection.brand || '',
      model: inspection.carModel || '',
      engineSealNumber: inspection.sealNumber || ''
    });
    setCurrentStep(1);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this inspection?')) {
      try {
        await deleteDoc(doc(db, 'car_inspections', id));
        showToast('Inspection deleted successfully');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'car_inspections');
      }
    }
  };

  // Sorting Logic
  const requestSort = (key: keyof Inspection) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredInspections = useMemo(() => {
    let filtered = inspections.filter(item => 
      (item.racerName || '').toLowerCase().includes(search.toLowerCase()) || 
      (item.teamName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.carNumber || '').includes(search) ||
      (item.racingModel || '').toLowerCase().includes(search.toLowerCase())
    );

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        if (aVal < bVal) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return filtered;
  }, [search, sortConfig, inspections]);

  const renderInput = (label: string, field: string, type = 'text', placeholder = '', className = '') => {
    const keys = field.split('.');
    let value = formData as any;
    for (const key of keys) {
      value = value?.[key];
    }
    
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
        <input 
          type={type} 
          value={value || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300"
          placeholder={placeholder || label}
        />
      </div>
    );
  };

  const renderCheckbox = (label: string, field: string, className = '') => {
    const keys = field.split('.');
    let checked = formData as any;
    for (const key of keys) {
      checked = checked?.[key];
    }
    
    return (
      <label className={`flex items-center gap-3 cursor-pointer group ${className}`}>
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-orange-500 border-orange-500' : 'border-slate-300 group-hover:border-orange-400 bg-white'}`}>
          {checked && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <span className="text-sm text-slate-700 font-light select-none">{label}</span>
        <input 
          type="checkbox" 
          className="hidden"
          checked={!!checked}
          onChange={(e) => handleChange(field, e.target.checked)}
        />
      </label>
    );
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-12 flex justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

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
            <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Inspection Form</h1>
            <p className="text-slate-500 font-light text-sm">Manage and review car inspection forms.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search inspections..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-2.5 pl-11 pr-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all placeholder:text-slate-400"
              />
            </div>
            
            <button 
              onClick={() => {
                setEditingId(null);
                setFormData(initialFormData);
                setCurrentStep(1);
                setView('form');
              }}
              className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
            >
              Create Inspection Form
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr>
                  <SortableHeader label="ID" sortKey="id" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="INSPECTION DATE" sortKey="inspectionDate" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="RACING MODEL" sortKey="racingModel" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="CAR NUMBER" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="TEAM NAME" sortKey="teamName" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="RACER NAME" sortKey="racerName" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="BRAND" sortKey="brand" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="CAR MODEL" sortKey="carModel" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="SEAL NUMBER" sortKey="sealNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sortedAndFilteredInspections.map((item, index) => (
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
                        <span className="text-sm text-slate-500 font-light">{index + 1}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.inspectionDate}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-900 font-medium">{item.racingModel}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-900 font-medium">{item.carNumber}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.teamName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.racerName}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.brand}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.carModel}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{item.sealNumber}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setSelectedHistoryCarNumber(item.carNumber);
                              setView('history-list');
                            }}
                            className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                          >
                            History
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
                  {sortedAndFilteredInspections.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-light">
                        No inspections found.
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center">
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
          </div>
        </div>
      </motion.div>

      {renderToast()}
    </>
    );
  }

  if (view === 'history-list') {
    const historyInspections = inspections.filter(i => i.carNumber === selectedHistoryCarNumber);
    return (
      <>
        <motion.div 
          key="history-list-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="space-y-8 pb-12 max-w-[1400px] mx-auto"
        >
          <div className="mb-10 flex items-center gap-6">
            <button 
              onClick={() => setView('list')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
                Inspection History
              </h1>
              <p className="text-slate-500 font-light text-sm">History for Car Number: {selectedHistoryCarNumber}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">ID</th>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">INSPECTION DATE</th>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">RACING MODEL</th>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">TEAM NAME</th>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100">RACER NAME</th>
                    <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {historyInspections.map((item, index) => (
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
                          <span className="text-sm text-slate-500 font-light">{index + 1}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.inspectionDate}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-900 font-medium">{item.racingModel}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.teamName}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm text-slate-600 font-light">{item.racerName}</span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setSelectedHistoryItem(item);
                                setView('history-detail');
                              }}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                    {historyInspections.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-light">
                          No history found.
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
        {renderToast()}
      </>
    );
  }

  if (view === 'history-detail' && selectedHistoryItem) {
    const data = selectedHistoryItem.formData || {};
    return (
      <>
        <motion.div 
          key="history-detail-view"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="max-w-4xl mx-auto pb-12"
        >
          <div className="mb-10 flex items-center gap-6">
            <button 
              onClick={() => setView('history-list')}
              className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
                Inspection Details
              </h1>
              <p className="text-slate-500 font-light text-sm">View detailed inspection information.</p>
            </div>
          </div>

          <div className="space-y-8">
            {/* Driver Info */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Driver & Series Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Inspection Date</h4>
                  <div className="text-sm font-light text-slate-600">{data.inspectionDate || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Stadium</h4>
                  <div className="text-sm font-light text-slate-600">{data.stadium || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Series</h4>
                  <div className="text-sm font-light text-slate-600">{data.series || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Grades</h4>
                  <div className="text-sm font-light text-slate-600">{data.grades || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Car Number</h4>
                  <div className="text-sm font-light text-slate-600">{data.carNumber || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team Name</h4>
                  <div className="text-sm font-light text-slate-600">{data.teamName || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Racer Name</h4>
                  <div className="text-sm font-light text-slate-600">{data.racerName || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team Manager Name</h4>
                  <div className="text-sm font-light text-slate-600">{data.teamManagerName || '-'}</div>
                </div>
              </div>
            </div>

            {/* Car Info */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Car Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Car Manufacturer</h4>
                  <div className="text-sm font-light text-slate-600">{data.carManufacturer || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Model</h4>
                  <div className="text-sm font-light text-slate-600">{data.model || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Engine Displacement (CC)</h4>
                  <div className="text-sm font-light text-slate-600">{data.engineDisplacement || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Engine Code</h4>
                  <div className="text-sm font-light text-slate-600">{data.engineCode || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Transmission</h4>
                  <div className="text-sm font-light text-slate-600">{data.transmission || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Drivetrain</h4>
                  <div className="text-sm font-light text-slate-600">{data.drivetrain || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Gear Shift Pattern</h4>
                  <div className="text-sm font-light text-slate-600">{data.gearShiftPattern || '-'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Auto Gear more than 6 Speed</h4>
                  <div className="text-sm font-light text-slate-600">{data.autoGearMoreThan6 ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Paddle Shift</h4>
                  <div className="text-sm font-light text-slate-600">{data.paddleShift ? 'Yes' : 'No'}</div>
                </div>
              </div>
            </div>

            {/* Uploaded Pictures */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Uploaded Pictures</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {['Car Photo', 'Inspection Document'].map((docType) => (
                  <div key={docType} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <FileText className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-700">{docType}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Document</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-slate-200/50 text-slate-500 rounded-full text-[10px] uppercase tracking-wider font-medium">
                      Not Provided
                    </span>
                  </div>
                ))}
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
                {editingId ? 'Edit Inspection' : 'New Inspection'}
              </h1>
              <p className="text-slate-500 font-light text-sm">Fill in the car inspection details.</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8 md:p-12">
          {/* Stepper */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4 relative">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex flex-col items-center gap-2 relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= step ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-400'}`}>
                    {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-medium absolute -bottom-6 whitespace-nowrap ${currentStep >= step ? 'text-orange-600' : 'text-slate-400'}`}>
                    {step === 1 ? 'Driver' : step === 2 ? 'Car' : step === 3 ? 'Inspection' : 'Seal'}
                  </span>
                </div>
              ))}
              <div className="absolute left-12 right-12 h-1 bg-slate-100 rounded-full z-0 top-5">
                <motion.div 
                  className="h-full bg-orange-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
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
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderInput('Inspection Date', 'inspectionDate', 'date')}
                    {renderInput('Stadium', 'stadium')}
                    {renderInput('Series', 'series')}
                    {renderInput('Grades', 'grades')}
                    {renderInput('Car Number', 'carNumber')}
                    {renderInput('Team Name', 'teamName')}
                    {renderInput('Racer Name', 'racerName')}
                    {renderInput('Team Manager Name', 'teamManagerName')}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderInput('Car Manufacturer', 'carManufacturer')}
                    {renderInput('Model', 'model')}
                    {renderInput('Engine Displacement (CC)', 'engineDisplacement')}
                    {renderInput('Engine Code', 'engineCode')}
                    {renderInput('Transmission', 'transmission')}
                    {renderInput('Drivetrain', 'drivetrain')}
                    {renderInput('Gear Shift Pattern', 'gearShiftPattern')}
                  </div>
                  
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderCheckbox('Auto Gear more than 6 Speed', 'autoGearMoreThan6')}
                    {renderCheckbox('Paddle Shift', 'paddleShift')}
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Tire Mark Amount</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {renderInput('Yokohama', 'tireMarkAmount.yokohama')}
                      {renderInput('Hankook', 'tireMarkAmount.hankook')}
                      {renderInput('Giti', 'tireMarkAmount.giti')}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Car Light</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderCheckbox('Head Light', 'carLight.headLight')}
                      {renderCheckbox('Turn Signal', 'carLight.turnSignal')}
                      {renderCheckbox('Tail Light', 'carLight.tailLight')}
                      {renderCheckbox('Break Light', 'carLight.breakLight')}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Car Equipment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Tow Point</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.towPoint.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.towPoint.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Bonnet Lock</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.bonnetLock.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.bonnetLock.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Extinguisher</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.extinguisher.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.extinguisher.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Outside Kill Switch</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.outsideKillSwitch.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.outsideKillSwitch.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Inside Kill Switch</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.insideKillSwitch.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.insideKillSwitch.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Seat</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.seat.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.seat.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Harnesses</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.harnesses.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.harnesses.sticker')}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Roll Over Bar</span>
                        <div className="flex gap-4">
                          {renderCheckbox('Installed', 'carEquipment.rollOverBar.installed')}
                          {renderCheckbox('Sticker', 'carEquipment.rollOverBar.sticker')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Racer Safety</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderCheckbox('Helmet', 'racerSafety.helmet')}
                      {renderCheckbox('HANS', 'racerSafety.hans')}
                      {renderCheckbox('Balaclava', 'racerSafety.balaclava')}
                      {renderCheckbox('Glove', 'racerSafety.glove')}
                      {renderCheckbox('Race Suite', 'racerSafety.raceSuite')}
                      {renderCheckbox('Sponsor Tag', 'racerSafety.sponsorTag')}
                      {renderCheckbox('Shoes', 'racerSafety.shoes')}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderInput('Engine Seal Number', 'engineSealNumber')}
                    {renderInput('Gear Seal Number', 'gearSealNumber')}
                    {renderInput('Tire Mark Amount', 'tireMarkAmountStep3')}
                    {renderInput('Balance of Performance', 'balanceOfPerformance')}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderCheckbox('PTRS Smoke Detector', 'ptrsSmokeDetector')}
                    {renderCheckbox('Weight Added After Race 2', 'weightAddedAfterRace2')}
                  </div>

                  {renderInput('Remark', 'remark')}
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Change Engine Seal</h3>
                    <div className="flex gap-6 mb-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="changeSeal" 
                          value="Not Change Seal"
                          checked={formData.changeSeal === 'Not Change Seal'}
                          onChange={(e) => handleChange('changeSeal', e.target.value)}
                          className="text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-slate-700">Not Change Seal</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="radio" 
                          name="changeSeal" 
                          value="Change Seal"
                          checked={formData.changeSeal === 'Change Seal'}
                          onChange={(e) => handleChange('changeSeal', e.target.value)}
                          className="text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-sm text-slate-700">Change Seal</span>
                      </label>
                    </div>

                    {formData.changeSeal === 'Change Seal' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderInput('Current Engine Seal Number', 'currentEngineSealNumber')}
                        {renderInput('New Engine Seal Number', 'newEngineSealNumber')}
                        <div className="md:col-span-2">
                          {renderInput('Reason for changing seal', 'reasonForChangingSeal')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Uploaded Pictures</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderFileUpload('Car Photo', 'Upload a photo of the car')}
                      {renderFileUpload('Inspection Document', 'Upload any relevant inspection documents')}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-12 flex justify-between pt-6 border-t border-slate-100">
            {currentStep > 1 ? (
              <button 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="px-8 py-3 rounded-full text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            ) : (
              <button 
                onClick={() => setView('list')}
                className="px-8 py-3 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            )}
            
            {currentStep < totalSteps ? (
              <button 
                onClick={() => setCurrentStep(prev => prev + 1)}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Continue
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update Inspection' : 'Submit Inspection'}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {renderToast()}
    </>
  );
}
