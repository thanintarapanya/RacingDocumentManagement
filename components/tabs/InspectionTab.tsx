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
  UploadCloud,
  Car,
  Settings2,
  Tag,
  Info,
  RefreshCw,
  Plus,
  Scale
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, where, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { useAppStore } from '@/lib/store';
import { weightPresets, baseWeightPresets } from './weightPresets';

type Inspection = {
  id: string;
  userId?: string;
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
  event: '',
  eventYear: new Date().getFullYear().toString(),
  carNumber: '',
  teamName: '',
  racerName: '',
  teamManagerName: '',

  // Step 2: Car Info
  carManufacturer: '',
  otherCarManufacturer: '',
  model: '',
  engineDisplacement: '',
  engineCode: '',
  transmission: '',
  drivetrain: '',
  gearShiftPattern: '',
  isOffsiteInspection: false,
  stickers: { haveAllStickers: false, stillNeedSticker: false },
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
  reasonForChangingSeal: '',

  // Step 3: Weight
  baseWeight: 0 as string | number,
  baseWeightOptions: [] as Array<{
    id: string;
    title: string;
    condition: string;
    weight: number;
    isCustom?: boolean;
  }>,
  dynamicWeights: [] as Array<{
    id: string;
    title: string;
    condition: string;
    weight: number;
    isChecked: boolean;
    isCustom?: boolean;
  }>
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
  const totalSteps = 6;
  
  // List View States
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [eventFilter, setEventFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
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
  const [showValidation, setShowValidation] = useState(false);

  const entries = useAppStore(state => state.entries);
  const userRole = useAppStore(state => state.userRole);
  const currentUser = auth.currentUser;

  const canEditAll = ['admin', 'president', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');
  const canEditOwn = userRole === 'competitor' || userRole === 'user';
  const isOwnDoc = editingId ? (inspections.find(i => i.id === editingId)?.userId === currentUser?.uid) : true;
  
  const canEditField = (field: string) => {
    if (field === 'eventYear' || field === 'inspectionDate') return false;
    if (canEditAll) return true;
    if (canEditOwn && isOwnDoc) {
      if (editingId) {
        const allowedEditFields = ['driverName', 'carNumber', 'series', 'teamName'];
        return allowedEditFields.includes(field);
      }
      return true;
    }
    return false;
  };
  
  const canEdit = canEditAll || (canEditOwn && isOwnDoc);

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.series || !formData.carNumber || !formData.grades) {
        setShowValidation(true);
        showToast('Please fill in Series, Car Number, and Classes (Auto-fill identifiers).');
        return;
      }
    }
    if (currentStep === 2) {
      if (!formData.carManufacturer || (formData.carManufacturer === 'Other' && !formData.otherCarManufacturer)) {
        setShowValidation(true);
        showToast('Please specify the Car Manufacturer.');
        return;
      }
    }
    setShowValidation(false);
    setCurrentStep(prev => prev + 1);
  };

  // FETCH CUSTOM RULES FOR AUTO SYNC
  const [fetchedCustomRules, setFetchedCustomRules] = useState<any>(null);
  const [customRulesLoaded, setCustomRulesLoaded] = useState(false);
  
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'weight_rules'), (docSnap) => {
      if (docSnap.exists()) {
        setFetchedCustomRules(docSnap.data());
      } else {
        setFetchedCustomRules({});
      }
      setCustomRulesLoaded(true);
    }, (error) => {
      console.error('Failed to fetch custom rules', error);
      setCustomRulesLoaded(true);
    });
    return () => unsub();
  }, []);

  // AUTO SYNC RULES WHEN SERIES CHANGES
  const [lastSyncedSeries, setLastSyncedSeries] = useState<string | null>(null);

  useEffect(() => {
    // Only auto-sync if we have loaded custom rules and the series is new/changed
    // Also skip auto-sync if we are editing an existing record, unless they explicitly
    // change the series via the dropdown AFTER loading
    if (customRulesLoaded && formData.series && formData.series !== lastSyncedSeries) {
      if (!editingId || (editingId && lastSyncedSeries !== null)) {
        const oldBase = baseWeightPresets[formData.series] || [];
        const oldDyn = weightPresets[formData.series] || [];

        let currentBase = oldBase;
        let currentDyn = oldDyn;

        if (fetchedCustomRules) {
          if (fetchedCustomRules.baseWeightPresets?.[formData.series]?.length > 0) {
            currentBase = fetchedCustomRules.baseWeightPresets[formData.series];
          }
          if (fetchedCustomRules.weightPresets?.[formData.series]?.length > 0) {
            currentDyn = fetchedCustomRules.weightPresets[formData.series];
          }
        }

        setFormData(prev => ({
          ...prev,
          baseWeightOptions: currentBase.map((p: any, i: number) => ({ ...p, id: Date.now() + 'b' + i, isCustom: false })),
          baseWeight: '',
          dynamicWeights: currentDyn.map((p: any, i: number) => ({ ...p, id: Date.now() + 'd' + i, isChecked: false, isCustom: false }))
        }));
      }

      setLastSyncedSeries(formData.series);
    }
  }, [formData.series, fetchedCustomRules, customRulesLoaded, lastSyncedSeries, editingId]);

  useEffect(() => {
    if (formData.series && formData.carNumber) {
      const entry = entries.find(e => e.seriesRace === formData.series && e.carNumber === formData.carNumber);
      if (entry && entry.formData) {
        setFormData(prev => ({
          ...prev,
          grades: entry.formData.class || entry.formData.grades || '',
          teamName: entry.formData.teamName || '',
          racerName: [entry.formData.nameEnglish, entry.formData.surnameEnglish].filter(Boolean).join(' ') || [entry.formData.nameThai, entry.formData.surnameThai].filter(Boolean).join(' ') || '',
          teamManagerName: entry.formData.teamManagerName || '',
          carManufacturer: entry.formData.carManufacturer || '',
          model: entry.formData.model || '',
        }));
      }
    }
  }, [formData.series, formData.carNumber, entries]);

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
    if (!auth.currentUser) return;
    
    let q;
    if (userRole === 'competitor') {
      q = query(collection(db, 'car_inspections'), where('userId', '==', auth.currentUser.uid));
    } else {
      q = query(collection(db, 'car_inspections'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Inspection[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Inspection);
      });
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setInspections(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'car_inspections');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [userRole]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      let extraUpdates = {};
      if (field === 'event') {
        if (value === '1' || value === '2') {
          extraUpdates = { stadium: 'Chang International Circuit' };
        } else if (value === '3') {
          extraUpdates = { stadium: 'PT Songkhla Street Circuit' };
        }
      }

      const keys = field.split('.');
      if (keys.length === 1) {
        return { ...prev, [field]: value, ...extraUpdates };
      }
      
      const newState = { ...prev, ...extraUpdates };
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
    if (!auth.currentUser) return;
    if (confirm('Are you sure you want to delete this inspection?')) {
      try {
        const itemToDelete = inspections.find(i => i.id === id);
        if (itemToDelete) {
          const newDeletedItem = {
            id: `DEL-INSP-${itemToDelete.id}`,
            type: 'Inspection Form',
            name: itemToDelete.racerName || `Inspection #${itemToDelete.id}`,
            deletedBy: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
            deletedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            expires: '7 days',
            originalData: itemToDelete,
            userId: auth.currentUser.uid
          };
          
          const delRef = doc(db, 'deletedItems', newDeletedItem.id);
          await setDoc(delRef, newDeletedItem);
        }
        
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
      ((item.racerName || '').toLowerCase().includes(search.toLowerCase()) || 
      (item.teamName || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.carNumber || '').includes(search) ||
      (item.racingModel || '').toLowerCase().includes(search.toLowerCase())) &&
      (activeTab === 'All' || (item.racingModel || '').toLowerCase() === activeTab.toLowerCase()) &&
      (eventFilter === '' || (item.formData?.event || '').toLowerCase() === eventFilter.toLowerCase()) &&
      (yearFilter === '' || (item.formData?.eventYear || '').toLowerCase() === yearFilter.toLowerCase())
    );

    if (userRole === 'competitor' || userRole === 'user') {
      filtered = filtered.filter(item => item.userId === currentUser?.uid);
    }

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
  }, [search, sortConfig, inspections, activeTab, eventFilter, yearFilter, currentUser?.uid, userRole]);

  const getStickerGuideImage = (series: string) => {
    // Note: To use the original images you uploaded, place them in the /public folder of your repo 
    // and replace these placehold URLs with references like '/siam_eco_sticker_guide.png'
    const normalized = (series || '').toLowerCase().trim();
    if (normalized.includes('eco')) return 'https://placehold.co/1200x800/22c55e/ffffff?text=SIAM+ECO+Sticker+Guide';
    if (normalized.includes('truck')) return 'https://placehold.co/1200x800/eab308/ffffff?text=SIAM+TRUCK+Sticker+Guide';
    if (normalized.includes('group a')) return 'https://placehold.co/1200x800/ef4444/ffffff?text=SIAM+Group+A+Sticker+Guide';
    if (normalized.includes('group n')) return 'https://placehold.co/1200x800/3b82f6/ffffff?text=SIAM+Group+N+Sticker+Guide';
    if (normalized.includes('gtmc')) return 'https://placehold.co/1200x800/a855f7/ffffff?text=SIAM+GTMC+Sticker+Guide';
    if (normalized.includes('gtrc')) return 'https://placehold.co/1200x800/f97316/ffffff?text=SIAM+GTRC+Sticker+Guide';
    return 'https://placehold.co/1200x800/64748b/ffffff?text=General+Sticker+Guide';
  };

  const isFieldInvalid = (field: string) => {
    if (!showValidation) return false;
    const isMissing = (val: any) => val === undefined || val === null || val === '';
    if (field === 'series' && isMissing(formData.series)) return true;
    if (field === 'carNumber' && isMissing(formData.carNumber)) return true;
    if (field === 'grades' && isMissing(formData.grades)) return true;
    if (field === 'carManufacturer' && isMissing(formData.carManufacturer)) return true;
    if (field === 'otherCarManufacturer' && formData.carManufacturer === 'Other' && isMissing(formData.otherCarManufacturer)) return true;
    return false;
  };

  const renderSelect = (label: string, field: string, options: string[], className = '') => {
    const keys = field.split('.');
    let value = formData as any;
    for (const key of keys) {
      value = value?.[key];
    }
    const invalid = isFieldInvalid(field);
    
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label} {invalid && <span className="text-red-500">*</span>}</label>
        <div className="relative">
          <select 
            value={value || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            className={`w-full bg-slate-50/50 border ${invalid ? 'border-red-400 ring-2 ring-red-100/50' : 'border-slate-100'} rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed`}
            disabled={!canEditField(field)}
          >
            <option value="" disabled>Select {label.split('/')[0].trim()}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
    );
  };

  const renderInput = (label: string, field: string, type = 'text', placeholder = '', className = '') => {
    const keys = field.split('.');
    let value = formData as any;
    for (const key of keys) {
      value = value?.[key];
    }
    const invalid = isFieldInvalid(field);
    
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label} {invalid && <span className="text-red-500">*</span>}</label>
        <input 
          type={type} 
          value={value || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          className={`w-full bg-slate-50/50 border ${invalid ? 'border-red-400 ring-2 ring-red-100/50' : 'border-slate-100'} rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed`}
          placeholder={placeholder || label}
          disabled={!canEditField(field)}
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
      <label className={`flex items-center gap-3 cursor-pointer group ${className} ${!canEditField(field) ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-orange-500 border-orange-500' : 'border-slate-300 group-hover:border-orange-400 bg-white'}`}>
          {checked && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <span className="text-sm text-slate-700 font-light select-none">{label}</span>
        <input 
          type="checkbox" 
          className="hidden"
          checked={!!checked}
          onChange={(e) => handleChange(field, e.target.checked)}
          disabled={!canEditField(field)}
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
            <div className="relative flex-1 min-w-[150px]">
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-2.5 px-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all appearance-none text-slate-700"
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
            <div className="relative flex-1 min-w-[150px]">
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-full py-2.5 px-5 text-sm font-light focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all appearance-none text-slate-700"
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
              onClick={() => {
                setEditingId(null);
                setFormData(initialFormData);
                setCurrentStep(userRole === 'offsite-scrutineer' || userRole === 'offsite_scrutineer' ? 0 : 1);
                setView('form');
              }}
              className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
            >
              Create Inspection Form
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 print:hidden">
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
                          {(canEditAll || (canEditOwn && item.userId === currentUser?.uid)) && (
                            <>
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
                            </>
                          )}
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
              </div>
            </div>

            {/* Sponsors Sticker Requirements */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Sponsors Sticker Requirements
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Have All Sticker/มีสติกเกอร์ครบแล้ว</h4>
                  <div className="text-sm font-light text-slate-600">{data.stickers?.haveAllStickers ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Still Need Sticker/ต้องการสติกเกอร์</h4>
                  <div className="text-sm font-light text-slate-600">{data.stickers?.stillNeedSticker ? 'Yes' : 'No'}</div>
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
          {currentStep > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4 relative">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= step ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-400'}`}>
                      {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-medium absolute -bottom-6 whitespace-nowrap ${currentStep >= step ? 'text-orange-600' : 'text-slate-400'}`}>
                      {step === 1 ? 'Driver' : step === 2 ? 'Car' : step === 3 ? 'Weight' : step === 4 ? 'Safety' : step === 5 ? 'Seal' : 'Final Check'}
                    </span>
                  </div>
                ))}
                <div className="absolute left-12 right-12 h-1 bg-slate-100 rounded-full z-0 top-5">
                  <motion.div 
                    className="h-full bg-orange-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${Math.max(0, ((currentStep - 1) / (totalSteps - 1)) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {currentStep === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8 flex flex-col items-center justify-center py-16"
                >
                  <h3 className="text-2xl font-light text-slate-900 mb-8 text-center">Please choose the inspection type:</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl px-4">
                    <button 
                      onClick={() => {
                        handleChange('isOffsiteInspection', false);
                        setCurrentStep(1);
                      }}
                      className="py-12 px-6 bg-white border-2 border-slate-200 rounded-3xl hover:border-orange-500 hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-orange-500/10"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-orange-100 border border-slate-100 group-hover:border-orange-200 flex items-center justify-center transition-colors mb-2">
                        <FileText className="w-8 h-8 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <div className="text-xl font-medium text-slate-700 group-hover:text-orange-600 transition-colors">Normal Inspection</div>
                      <p className="text-sm text-slate-500 font-light text-center">Standard scrutineering process at the event.</p>
                    </button>
                    <button 
                      onClick={() => {
                        handleChange('isOffsiteInspection', true);
                        setCurrentStep(1);
                      }}
                      className="py-12 px-6 bg-white border-2 border-slate-200 rounded-3xl hover:border-orange-500 hover:bg-orange-50 transition-all flex flex-col items-center justify-center gap-4 group cursor-pointer shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-orange-500/10"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-slate-50 group-hover:bg-orange-100 border border-slate-100 group-hover:border-orange-200 flex items-center justify-center transition-colors mb-2">
                        <Search className="w-8 h-8 text-slate-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                      <div className="text-xl font-medium text-slate-700 group-hover:text-orange-600 transition-colors">Offsite Inspection</div>
                      <p className="text-sm text-slate-500 font-light text-center">Remote scrutineering prior to or outside the circuit.</p>
                    </button>
                  </div>
                </motion.div>
              )}

              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  {/* Auto-fill Identifiers */}
                  <div>
                    <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Auto-fill Identifiers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                      {renderSelect('Series / รุ่นการแข่งขัน', 'series', SERIES_CATEGORIES)}
                      {renderSelect('Event / งานแข่งขัน', 'event', ['1', '2', '3'])}
                      {renderSelect('Year / ปีการแข่งขัน', 'eventYear', ['2024', '2025', '2026', '2027', '2028'])}
                      {renderInput('Car Number / หมายเลขรถ', 'carNumber')}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-light text-slate-900 mb-6 border-b border-slate-100 pb-2">Inspection Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderInput('Inspection Date / วันที่ตรวจสภาพ', 'inspectionDate', 'date')}
                      {renderSelect('Stadium / สนามแข่งขัน', 'stadium', ['Chang International Circuit', 'PT Songkhla Street Circuit', 'Bira Circuit', 'Bangsaen Street Circuit'])}
                      {renderSelect('Classes / คลาส', 'grades', ['PRO', 'AM', 'GT PRO CLASS 1', 'GT PRO CLASS 2', 'Overall'])}
                      {renderInput('Team Name / ชื่อทีม', 'teamName')}
                      {renderInput('Racer Name / ชื่อนักแข่ง', 'racerName')}
                      {renderInput('Team Manager Name / ชื่อผู้จัดการทีม', 'teamManagerName')}
                    </div>
                  </div>
                  
                  {userRole === 'offsite_scrutineer' && (
                    <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                      {renderCheckbox('Offsite Inspection / ตรวจสภาพนอกสถานที่', 'isOffsiteInspection')}
                    </div>
                  )}
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vehicle Identity */}
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col">
                      <h3 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" /> Vehicle Status
                      </h3>
                      <div className="space-y-4 flex-1">
                        {renderSelect('Car Manufacturer / ยี่ห้อรถ', 'carManufacturer', [
                          'Toyota', 'Honda', 'Nissan', 'Mitsubishi', 'Mazda', 
                          'Subaru', 'Ford', 'Chevrolet', 'BMW', 'Mercedes-Benz', 
                          'Audi', 'Volkswagen', 'Porsche', 'Aston Martin', 'Suzuki', 'Isuzu', 'Peugeot', 'Other'
                        ])}
                        {formData.carManufacturer === 'Other' && renderInput('Specify Car Manufacturer / ระบุยี่ห้อรถ', 'otherCarManufacturer')}
                        {renderInput('Model / รุ่น', 'model')}
                      </div>
                    </div>

                    {/* Tire Marking Amount */}
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 flex flex-col">
                      <h3 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" /> Tire Marking Amount
                      </h3>
                      <div className="flex flex-col justify-center space-y-4 flex-1">
                        <div className="grid grid-cols-3 gap-3">
                          {renderInput('Yokohama', 'tireMarkAmount.yokohama', 'number', '0')}
                          {renderInput('Hankook', 'tireMarkAmount.hankook', 'number', '0')}
                          {renderInput('Giti', 'tireMarkAmount.giti', 'number', '0')}
                        </div>
                      </div>
                    </div>

                    {/* Powertrain */}
                    <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 md:col-span-2">
                      <h3 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
                        <Settings2 className="w-4 h-4 text-slate-400" /> Powertrain & Systems
                      </h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {renderInput('Displacement (CC)', 'engineDisplacement')}
                          {renderInput('Engine Code', 'engineCode')}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           {renderSelect('Transmission', 'transmission', ['AT', 'MT'])}
                           {renderSelect('Drivetrain', 'drivetrain', ['FWD', 'RWD', 'AWD'])}
                           {renderSelect('Gear Shift Pattern', 'gearShiftPattern', ['H Gate', 'Semi Auto', 'Sequential Shift'])}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sponsors Sticker Check */}
                  <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 relative w-full">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" /> Sponsors Sticker Requirements
                      </h3>
                      <div className="relative group flex items-center gap-2 text-sm text-orange-600 font-medium cursor-help">
                        {formData.series ? `${formData.series} Sticker Guide` : 'Sticker Guide'}
                        <Info className="w-4 h-4" />
                        
                        {/* Hover Image Tooltip */}
                        <div className="absolute right-0 bottom-8 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] w-[350px] sm:w-[500px] pointer-events-none bg-white p-2 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-200 origin-bottom-right scale-95 group-hover:scale-100">
                           <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center">
                             {formData.series ? (
                               <img 
                                 src={getStickerGuideImage(formData.series)} 
                                 alt={`${formData.series} Sticker Chart`}
                                 className="w-full h-full object-cover"
                               />
                             ) : (
                               <div className="text-slate-400 text-sm flex flex-col items-center gap-2">
                                 <Car className="w-8 h-8 opacity-50" />
                                 Please select a Series in Step 1
                               </div>
                             )}
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {renderCheckbox('Have All Sticker/มีสติกเกอร์ครบแล้ว', 'stickers.haveAllStickers')}
                      {renderCheckbox('Still Need Sticker/ต้องการสติกเกอร์', 'stickers.stillNeedSticker')}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="stepWeight"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-2xl font-light text-slate-900 tracking-tight">Calculated Weight & BOP</h3>
                      <p className="text-sm text-slate-500 mt-1">Base minimum weights and series-specific penalties are automatically synchronized based on current rules.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-8">
                    {/* Base Minimum Weight Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Base Minimum Weight</h3>
                        <button 
                            onClick={() => {
                              const newOptions = [...(formData.baseWeightOptions || [])];
                              newOptions.push({ id: Date.now().toString(), title: 'Custom', condition: '', weight: 0, isCustom: true });
                              handleChange('baseWeightOptions', newOptions);
                            }}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                           <Plus className="w-3.5 h-3.5" /> Add Options
                        </button>
                      </div>

                      {(formData.baseWeightOptions && formData.baseWeightOptions.length > 0) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                          {formData.baseWeightOptions.map((opt: any, index: number) => {
                            if (!opt.isCustom) {
                              return (
                                <label key={opt.id} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${formData.baseWeight === opt.weight.toString() ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="radio" 
                                      name="baseWeightSelection"
                                      checked={formData.baseWeight === opt.weight.toString()} 
                                      onChange={() => handleChange('baseWeight', opt.weight.toString())}
                                      className="rounded-full border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-slate-900 leading-none mb-1.5">{opt.condition}</p>
                                      <p className="text-xs text-slate-500">{opt.title}</p>
                                    </div>
                                  </div>
                                  <span className="font-mono text-sm font-medium text-slate-700 bg-white border border-slate-200 shadow-sm px-2.5 py-1 rounded-md">{opt.weight} kg</span>
                                </label>
                              );
                            }

                            return (
                              <div key={opt.id} className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200 border-dashed">
                                <label className="flex items-center gap-2 cursor-pointer pl-1">
                                  <input 
                                    type="radio" 
                                    name="baseWeightSelection"
                                    checked={formData.baseWeight === opt.weight.toString()} 
                                    onChange={() => handleChange('baseWeight', opt.weight.toString())}
                                    className="rounded-full border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4"
                                  />
                                </label>
                                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input type="text" value={opt.title} onChange={e => { const newW = [...formData.baseWeightOptions]; newW[index].title = e.target.value; handleChange('baseWeightOptions', newW); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" placeholder="Title (e.g. ความจุระบอกสูบ)" />
                                  <input type="text" value={opt.condition} onChange={e => { const newW = [...formData.baseWeightOptions]; newW[index].condition = e.target.value; handleChange('baseWeightOptions', newW); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" placeholder="Condition" />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <input type="number" value={opt.weight} onChange={e => {
                                      const val = e.target.value;
                                      const newW = [...formData.baseWeightOptions]; 
                                      newW[index].weight = Number(val); 
                                      handleChange('baseWeightOptions', newW);
                                      if (formData.baseWeight === opt.weight.toString()) {
                                        handleChange('baseWeight', val);
                                      }
                                  }} className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-center focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" placeholder="0" />
                                  <button onClick={() => { 
                                    const newW = formData.baseWeightOptions.filter((_: any, i: number) => i !== index); 
                                    handleChange('baseWeightOptions', newW); 
                                    if (formData.baseWeight === opt.weight.toString()) handleChange('baseWeight', '');
                                  }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                          <Scale className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                          <p className="text-sm text-slate-500 font-medium">No base weights loaded</p>
                          <p className="text-xs text-slate-400 mt-1 mb-4">Sync rules or add your own options manually.</p>
                        </div>
                      )}
                    </div>

                    {/* Dynamic Penalty Weights Section */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Dynamic Penalties & Bonuses</h3>
                        <button 
                           onClick={() => {
                             const newWeights = [...(formData.dynamicWeights || [])];
                             newWeights.push({ id: Date.now().toString(), title: 'Custom', condition: '', weight: 0, isChecked: true, isCustom: true });
                             handleChange('dynamicWeights', newWeights);
                           }}
                           className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                           <Plus className="w-3.5 h-3.5" /> Add Rule
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {(formData.dynamicWeights || []).map((wItem: any, index: number) => {
                          if (!wItem.isCustom) {
                            return (
                              <label key={wItem.id} className={`flex items-start justify-between p-4 border rounded-xl cursor-pointer transition-all ${wItem.isChecked ? 'border-orange-500 bg-orange-50/50 ring-1 ring-orange-500 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                <div className="flex items-start gap-3">
                                   <input 
                                     type="checkbox" 
                                     checked={wItem.isChecked} 
                                     onChange={(e) => {
                                       const newW = [...formData.dynamicWeights];
                                       newW[index].isChecked = e.target.checked;
                                       handleChange('dynamicWeights', newW);
                                     }}
                                     className="w-4 h-4 mt-0.5 text-orange-500 border-slate-300 focus:ring-orange-500 rounded" 
                                   />
                                   <div>
                                     <p className="text-sm font-medium text-slate-900 leading-tight mb-1.5 pr-2">{wItem.condition}</p>
                                     {wItem.title && <p className="text-xs text-slate-500">{wItem.title}</p>}
                                   </div>
                                </div>
                                <span className={`font-mono text-sm font-medium px-2.5 py-1 rounded-md shrink-0 border ${wItem.weight > 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : wItem.weight < 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-700 bg-slate-100 border-slate-200'}`}>
                                  {wItem.weight > 0 ? '+' : ''}{wItem.weight}
                                </span>
                              </label>
                            );
                          }
                          
                          return (
                            <div key={wItem.id} className="col-span-1 md:col-span-2 flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200 border-dashed">
                              <label className="flex items-center gap-2 cursor-pointer pl-1">
                                <input 
                                  type="checkbox" 
                                  checked={wItem.isChecked} 
                                  onChange={(e) => {
                                    const newW = [...formData.dynamicWeights];
                                    newW[index].isChecked = e.target.checked;
                                    handleChange('dynamicWeights', newW);
                                  }}
                                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4"
                                />
                              </label>
                              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input type="text" value={wItem.title} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].title = e.target.value; handleChange('dynamicWeights', newW); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" placeholder="Title (e.g. รายการ)" />
                                <input type="text" value={wItem.condition} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].condition = e.target.value; handleChange('dynamicWeights', newW); }} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" placeholder="Condition details" />
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input type="number" value={wItem.weight} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].weight = Number(e.target.value); handleChange('dynamicWeights', newW); }} className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono text-center focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" />
                                <button onClick={() => { const newW = formData.dynamicWeights.filter((_: any, i: number) => i !== index); handleChange('dynamicWeights', newW); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {(!formData.dynamicWeights || formData.dynamicWeights.length === 0) && (
                        <div className="text-center py-8 bg-slate-50 border border-slate-100 border-dashed rounded-xl">
                          <p className="text-sm text-slate-500 font-medium">No penalty/bonus active</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative mt-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-rose-500 rounded-2xl blur opacity-20"></div>
                    <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 shadow-sm p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-400 tracking-widest uppercase mb-1">Final Result</h4>
                        <p className="text-slate-800 font-medium">Total Calculated Balance Of Performance</p>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-rose-600">
                          {Number(formData.baseWeight || 0) + (formData.dynamicWeights || []).reduce((acc: number, curr: { isChecked: boolean, weight: number }) => acc + (curr.isChecked ? Number(curr.weight) : 0), 0)}
                        </span>
                        <span className="text-xl font-bold text-orange-400">kg</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Car Light / ระบบไฟรถยนต์</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderCheckbox('Head Light / ไฟหน้า', 'carLight.headLight')}
                      {renderCheckbox('Turn Signal / ไฟเลี้ยว', 'carLight.turnSignal')}
                      {renderCheckbox('Tail Light / ไฟท้าย', 'carLight.tailLight')}
                      {renderCheckbox('Break Light / ไฟเบรก', 'carLight.breakLight')}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Car Equipment / อุปกรณ์ประจำรถ</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Tow Point / จุดลากจูง</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.towPoint.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.towPoint.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Bonnet Lock / สลักล็อคฝากระโปรง</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.bonnetLock.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.bonnetLock.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Extinguisher / ถังดับเพลิง</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.extinguisher.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.extinguisher.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Outside Kill Switch / สวิตช์ตัดไฟภายนอก</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.outsideKillSwitch.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.outsideKillSwitch.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Inside Kill Switch / สวิตช์ตัดไฟภายใน</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.insideKillSwitch.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.insideKillSwitch.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Seat / เบาะนั่ง</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.seat.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.seat.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Harnesses / เข็มขัดนิรภัย</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.harnesses.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.harnesses.sticker')}
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                        <span className="text-sm font-medium text-slate-900">Roll Over Bar / โรลบาร์</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderCheckbox('Installed / ติดตั้งแล้ว', 'carEquipment.rollOverBar.installed')}
                          {renderCheckbox('Sticker / สติ๊กเกอร์', 'carEquipment.rollOverBar.sticker')}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Racer Safety / อุปกรณ์ความปลอดภัยนักแข่ง</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {renderCheckbox('Helmet / หมวกกันน็อค', 'racerSafety.helmet')}
                      {renderCheckbox('HANS / อุปกรณ์ป้องกันคอและศีรษะ', 'racerSafety.hans')}
                      {renderCheckbox('Balaclava / โม่ง', 'racerSafety.balaclava')}
                      {renderCheckbox('Glove / ถุงมือ', 'racerSafety.glove')}
                      {renderCheckbox('Race Suite / ชุดแข่ง', 'racerSafety.raceSuite')}
                      {renderCheckbox('Sponsor Tag / ป้ายสปอนเซอร์', 'racerSafety.sponsorTag')}
                      {renderCheckbox('Shoes / รองเท้า', 'racerSafety.shoes')}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderCheckbox('PTRS Smoke Detector / เครื่องตรวจจับควัน PTRS', 'ptrsSmokeDetector')}
                  </div>

                  {renderInput('Remark / หมายเหตุ', 'remark')}

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Picture / รูปภาพประกอบ</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderFileUpload('Car Photo', 'Upload a photo of the car')}
                      {renderFileUpload('Inspection Document', 'Upload any relevant inspection documents')}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Seal / ซีล</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {renderInput('Engine Seal Number / หมายเลขซีลเครื่องยนต์', 'engineSealNumber')}
                      {renderInput('Gear Seal Number / หมายเลขซีลเกียร์', 'gearSealNumber')}
                      {renderInput('Tire Mark Amount / จำนวนการมาร์คยาง', 'tireMarkAmountStep3')}
                      {renderCheckbox('Weight Added After Race 2 / น้ำหนักที่ถ่วงเพิ่มหลังเรซ 2', 'weightAddedAfterRace2')}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h3 className="text-sm font-medium text-slate-900 mb-4">Change Engine Seal / เปลี่ยนซีลเครื่องยนต์</h3>
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
                        <span className="text-sm text-slate-700">Not Change Seal / ไม่เปลี่ยนซีล</span>
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
                        <span className="text-sm text-slate-700">Change Seal / เปลี่ยนซีล</span>
                      </label>
                    </div>

                    {formData.changeSeal === 'Change Seal' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderInput('Current Engine Seal Number / หมายเลขซีลเครื่องยนต์เดิม', 'currentEngineSealNumber')}
                        {renderInput('New Engine Seal Number / หมายเลขซีลเครื่องยนต์ใหม่', 'newEngineSealNumber')}
                        <div className="md:col-span-2">
                           {renderInput('Reason for changing seal / เหตุผลที่เปลี่ยนซีล', 'reasonForChangingSeal')}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {currentStep === 6 && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-lg font-medium text-slate-900 mb-6">Final Check</h3>
                    <div className="space-y-6">
                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Driver & Series Info</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div><span className="text-slate-500 block text-xs">Inspection Date</span> {formData.inspectionDate || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Stadium</span> {formData.stadium || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Series</span> {formData.series || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Grades</span> {formData.grades || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Car Number</span> {formData.carNumber || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Team Name</span> {formData.teamName || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Racer Name</span> {formData.racerName || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Team Manager</span> {formData.teamManagerName || '-'}</div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Car Info</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div><span className="text-slate-500 block text-xs">Brand</span> {formData.carManufacturer || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Model</span> {formData.model || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Engine Disp.</span> {formData.engineDisplacement || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Engine Code</span> {formData.engineCode || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Transmission</span> {formData.transmission || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Drivetrain</span> {formData.drivetrain || '-'}</div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Seal</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div><span className="text-slate-500 block text-xs">Engine Seal</span> {formData.engineSealNumber || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">Gear Seal</span> {formData.gearSealNumber || '-'}</div>
                          <div><span className="text-slate-500 block text-xs">BOP</span> {Number(formData.baseWeight || 0) + (formData.dynamicWeights || []).reduce((acc: number, curr: { isChecked: boolean, weight: number }) => acc + (curr.isChecked ? Number(curr.weight) : 0), 0)} kg</div>
                          <div><span className="text-slate-500 block text-xs">Change Seal</span> {formData.changeSeal || '-'}</div>
                          {formData.changeSeal === 'Change Seal' && (
                            <>
                              <div><span className="text-slate-500 block text-xs">New Seal</span> {formData.newEngineSealNumber || '-'}</div>
                              <div className="col-span-2"><span className="text-slate-500 block text-xs">Reason</span> {formData.reasonForChangingSeal || '-'}</div>
                            </>
                          )}
                        </div>
                      </div>
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
                onClick={handleNextStep}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Continue
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting || !canEdit}
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
