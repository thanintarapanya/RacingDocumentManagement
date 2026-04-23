'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
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
  Scale,
  Save,
  Download,
  Edit2,
  ChevronLeft,
  History,
  Trash2,
  Zap,
  Table
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
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, where, getDoc, addDoc, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { createNotification } from '@/lib/notifications';
import { useAppStore } from '@/lib/store';
import { weightPresets, baseWeightPresets } from './weightPresets';

// Sticker Guide Data Imports
import stickerEco from '../stickers/Sticker_Layout_Eco';
import stickerGTMC from '../stickers/Sticker_Layout_GTMC';
import stickerGTRC from '../stickers/Sticker_Layout_GTRC';
import stickerGroupA from '../stickers/Sticker_Layout_GroupA';
import stickerGroupN from '../stickers/Sticker_Layout_GroupN';
import stickerTruck from '../stickers/Sticker_Layout_Truck';

type ComponentItem = {
  id: string;
  displayName: string;
  type: 'Engine' | 'Gearbox';
  sealNumbers: string[];
  status: 'ACTIVE' | 'SPARE' | 'RETIRED';
  isOffsite: boolean;
  registeredAt: string;
};

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
  status?: 'Draft' | 'Waiting For Inspection' | 'Inspecting' | 'Pass' | 'Not Pass';
  notPassReasons?: string;
  formData?: any;
  createdAt: string;
  updatedAt: string;
};

type InspectionLog = {
  id: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  previousData: any;
  newData: any;
  changes: Record<string, { old: any, new: any }>;
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
  engineSealNumber: '',
  gearSealNumber: '',
  transmission: '',
  drivetrain: '',
  gearShiftPattern: '',
  isOffsiteInspection: false,
  stickers: { haveAllStickers: false, stillNeedSticker: false },
  engineCapacityWeight: {} as Record<string, { checked: boolean, weight: string, committeeWeight: string }>,
  carBrandCapacityRestrictor: {} as Record<string, { checked: boolean, weight: string }>,
  tireMarkAmount: {} as Record<string, string>,

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
  components: [] as ComponentItem[],
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
  }>,
  customTablesData: [] as any[],
  customTablesSelections: {} as Record<string, string | string[]>,
  status: 'Draft' as 'Draft' | 'Waiting For Inspection' | 'Inspecting' | 'Pass' | 'Not Pass',
  notPassReasons: ''
};

export default function InspectionTab() {
  const [view, setView] = useState<'list' | 'form' | 'history-list' | 'history-detail'>('list');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedHistoryCarNumber, setSelectedHistoryCarNumber] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<Inspection | null>(null);
  const [inspectionHistory, setInspectionHistory] = useState<InspectionLog[]>([]);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<InspectionLog | null>(null);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [liveFormData, setLiveFormData] = useState<any>(null);
  
  // Store state
  const entries = useAppStore(state => state.entries);
  const userRole = useAppStore(state => state.userRole);
  const currentUser = auth.currentUser;

  // Form Wizard States
  const [currentStep, setCurrentStep] = useState(1);
  const isCompetitor = userRole === 'competitor' || userRole === 'user';
  const totalSteps = isCompetitor ? 4 : 6;

  // List View States
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [eventFilter, setEventFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Inspection, direction: 'asc' | 'desc' } | null>(null);
  const [recordsPerPage, setRecordsPerPage] = useState(20);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showStickerModal, setShowStickerModal] = useState(false);

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

  const [formData, setFormData] = useState<typeof initialFormData & { updatedAt?: string }>(initialFormData);
  const [showValidation, setShowValidation] = useState(false);
  const [showAddComponentModal, setShowAddComponentModal] = useState(false);
  const [newComponent, setNewComponent] = useState<Partial<ComponentItem>>({
    type: 'Engine',
    status: 'SPARE',
    sealNumbers: [''],
    isOffsite: false
  });

  const canEditAll = ['admin', 'president', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');
  const canEditOwn = userRole === 'competitor' || userRole === 'user';
  const isOwnDoc = editingId ? (inspections.find(i => i.id === editingId)?.userId === currentUser?.uid) : true;
  
  const canEditField = (field: string) => {
    if (selectedHistoryLog) return false;
    if (field === 'eventYear' || field === 'inspectionDate') return false;
    
    const isScrutineerRole = ['admin', 'president', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');
    
    // Status locks competitor edits
    const status = formData.status || 'Draft';
    
    if (isScrutineerRole) {
      // Restriction: Only offsite_scrutineer and admin can check offsite fields
      if (field === 'isOffsiteInspection' || field === 'isOffsite') {
        return ['admin', 'offsite_scrutineer'].includes(userRole || '');
      }
      return true;
    }

    if (isCompetitor && isOwnDoc) {
      if (status !== 'Draft') return false; // Competitors cannot edit after submission or during inspection
      
      // Competitors only edit Step 1-3 fields
      const competitorFields = [
        'series', 'event', 'carNumber', 'stadium', 'grades', 'teamName', 'racerName', 'teamManagerName',
        'carManufacturer', 'otherCarManufacturer', 'model', 'engineDisplacement', 'engineCode', 'transmission', 'drivetrain', 'gearShiftPattern',
        'tireMarkAmount', 'stickers', 'baseWeight', 'dynamicWeights', 'customTablesSelections'
      ];
      
      // Handle nested fields like stickers.haveAllStickers
      const rootField = field.split('.')[0];
      return competitorFields.includes(rootField) || competitorFields.includes(field);
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
  const [tireBrands, setTireBrands] = useState<string[]>(['Yokohama', 'Hankook', 'Giti']);
  
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
    
    const unsubTire = onSnapshot(doc(db, 'settings', 'tire_rules'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().brands) {
        setTireBrands(docSnap.data().brands);
      } else {
        setTireBrands(['Yokohama', 'Hankook', 'Giti']); // Fallback
      }
    }, (error) => {
      console.error('Failed to fetch tire rules', error);
    });
    
    return () => {
      unsub();
      unsubTire();
    };
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
        let currentCustomTables: any[] = [];

        if (fetchedCustomRules) {
          if (fetchedCustomRules.baseWeightPresets?.[formData.series]) {
            const conf = fetchedCustomRules.baseWeightPresets[formData.series];
            if (Array.isArray(conf) && conf.length > 0) {
              currentBase = conf;
            } else if (conf.rows && conf.rows.length > 0) {
              currentBase = conf.rows.map((r: any) => {
                const title = conf.columns.join(' | ');
                let condition = conf.columns.map((c: string) => r.values[c] || '-').join(' | ');
                if (r.committeeWeight && r.committeeWeight.trim() !== '') {
                  condition += ` (Vary: ${r.committeeWeight})`;
                }
                return { title, condition, weight: r.weight };
              });
            }
          }
          if (fetchedCustomRules.weightPresets?.[formData.series]?.length > 0) {
            currentDyn = fetchedCustomRules.weightPresets[formData.series];
          }
          if (fetchedCustomRules.customTables?.[formData.series]?.length > 0) {
             currentCustomTables = fetchedCustomRules.customTables[formData.series];
          }
        }

        setFormData(prev => ({
          ...prev,
          baseWeightOptions: currentBase.map((p: any, i: number) => ({ ...p, id: Date.now() + 'b' + i, isCustom: false })),
          baseWeight: '',
          dynamicWeights: currentDyn.map((p: any, i: number) => ({ ...p, id: Date.now() + 'd' + i, isChecked: false, isCustom: false })),
          customTablesData: currentCustomTables.map(t => ({...t})),
          customTablesSelections: {}
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
          grades: entry.formData.class || entry.formData.grades || entry.formData.grade || entry.gradeRace || '',
          teamName: entry.formData.teamName || '',
          racerName: [entry.formData.nameEnglish, entry.formData.surnameEnglish].filter(Boolean).join(' ') || [entry.formData.nameThai, entry.formData.surnameThai].filter(Boolean).join(' ') || '',
          teamManagerName: entry.formData.teamManagerName || '',
          carManufacturer: entry.formData.carManufacturer || '',
          model: entry.formData.model || '',
        }));
      }
    }
  }, [formData.series, formData.carNumber, entries]);

  // REAL-TIME CONCURRENCY SYNC
  useEffect(() => {
    if (!editingId || view !== 'form' || !auth.currentUser) return;

    const docRef = doc(db, 'car_inspections', editingId);
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const serverFormData = data.formData || data;
        
        // Sync if someone else updated it
        if (data.lastChangedBy && data.lastChangedBy !== auth.currentUser?.uid) {
          setFormData(prev => {
            // Only update if server has a newer timestamp
            if (!prev.updatedAt || (data.updatedAt && data.updatedAt > prev.updatedAt)) {
              // We merge but keep current user's cursor-stable fields if possible
              // For simplicity, we merge all server fields, which is standard for collaborative forms
              // that don't use more granular state.
              return { ...prev, ...serverFormData, updatedAt: data.updatedAt };
            }
            return prev;
          });
        }
      }
    }, (error) => {
      console.error("Concurrency sync error:", error);
    });

    return () => unsub();
  }, [editingId, view]);

  const getChanges = (oldData: any, newData: any) => {
    const changes: Record<string, { old: any, new: any }> = {};
    const compare = (oldObj: any, newObj: any, prefix = '') => {
      if (!oldObj || !newObj) return;
      const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
      allKeys.forEach(key => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const oldVal = oldObj[key];
        const newVal = newObj[key];
        if (key === 'updatedAt' || key === 'createdAt' || key === 'id') return;
        if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
          if (typeof oldVal !== 'object' || oldVal === null || Array.isArray(oldVal)) {
            changes[fullKey] = { old: oldVal, new: newVal };
          } else {
            compare(oldVal, newVal, fullKey);
          }
        } else if (Array.isArray(newVal)) {
          if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
            changes[fullKey] = { old: oldVal, new: newVal };
          }
        } else if (oldVal !== newVal) {
          changes[fullKey] = { old: oldVal, new: newVal };
        }
      });
    };
    compare(oldData, newData);
    return changes;
  };

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
    if (!auth.currentUser || userRole === null) return;
    
    let q;
    if (userRole === 'competitor' || userRole === 'user') {
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

      // Handle sticker exclusivity
      if (field === 'stickers.haveAllStickers' && value === true) {
        return { 
          ...prev, 
          ...extraUpdates,
          stickers: { ...prev.stickers, haveAllStickers: true, stillNeedSticker: false } 
        };
      }
      if (field === 'stickers.stillNeedSticker' && value === true) {
        return { 
          ...prev, 
          ...extraUpdates,
          stickers: { ...prev.stickers, haveAllStickers: false, stillNeedSticker: true } 
        };
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

  const handleComponentSwap = async (oldComponent: ComponentItem | undefined, newComponent: ComponentItem) => {
    const updatedComponents = formData.components.map((c: ComponentItem) => {
      if (oldComponent && c.id === oldComponent.id) return { ...c, status: 'RETIRED' as const };
      if (c.id === newComponent.id) return { ...c, status: 'ACTIVE' as const };
      return c;
    });

    setFormData(prev => ({ ...prev, components: updatedComponents }));

    if (editingId) {
      try {
        const logsRef = collection(db, 'car_inspections', editingId, 'history_logs');
        await addDoc(logsRef, {
          changedBy: auth.currentUser?.uid,
          changedByName: auth.currentUser?.displayName || 'System',
          changedAt: new Date().toISOString(),
          type: 'EQUIPMENT_SWAP',
          message: oldComponent 
            ? `Swapped ${oldComponent.type} from ${oldComponent.displayName || oldComponent.id} to ${newComponent.displayName || newComponent.id}`
            : `Activated ${newComponent.type} ${newComponent.displayName || newComponent.id}`,
          oldComponentId: oldComponent?.id || null,
          newComponentId: newComponent.id,
          newData: { ...formData, components: updatedComponents },
          previousData: formData,
          changes: {
            'components': { old: formData.components, new: updatedComponents }
          }
        });
        showToast(oldComponent ? `Swapped ${oldComponent.type} successfully` : `Activated ${newComponent.type} successfully`);
      } catch (error) {
        console.error('Error logging swap:', error);
      }
    }
  };

  const handleSubmit = async (statusOverride?: 'Draft' | 'Waiting For Inspection' | 'Inspecting' | 'Pass' | 'Not Pass') => {
    if (!auth.currentUser) return;

    if (!statusOverride || statusOverride !== 'Draft') {
      if (!confirm('Are you sure you want to submit? This form will be locked and cannot be changed after submitting.')) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const finalStatus = (typeof statusOverride === 'string' ? statusOverride : formData.status) || 'Draft';
      const docId = editingId || Date.now().toString();
      const docRef = doc(db, 'car_inspections', docId);
      
      const payload: any = {
        inspectionDate: formData.inspectionDate,
        racingModel: formData.series,
        carNumber: formData.carNumber,
        teamName: formData.teamName,
        racerName: formData.racerName,
        brand: formData.carManufacturer,
        carModel: formData.model,
        sealNumber: formData.engineSealNumber,
        status: finalStatus,
        notPassReasons: formData.notPassReasons || '',
        formData: { ...formData, status: finalStatus },
        updatedAt: new Date().toISOString(),
        lastChangedBy: auth.currentUser.uid,
        lastChangedByName: auth.currentUser.displayName || auth.currentUser.email || 'Official',
        userId: editingId ? (inspections.find(i => i.id === editingId)?.userId || auth.currentUser.uid) : auth.currentUser.uid
      };

      if (editingId) {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const oldData = docSnap.data();
          const changes = getChanges(oldData, payload);
          
          if (Object.keys(changes).length > 0) {
            const historyRef = collection(db, 'car_inspections', editingId, 'history');
            await addDoc(historyRef, {
              userId: oldData.userId,
              changedBy: auth.currentUser.uid,
              changedByName: auth.currentUser.displayName || auth.currentUser.email || 'Admin',
              changedAt: new Date().toISOString(),
              previousData: oldData,
              newData: payload,
              changes
            });
          }
        }
      } else {
        Object.assign(payload, { createdAt: new Date().toISOString() });
      }

      await setDoc(docRef, payload, { merge: true });

      // Handle sticker notification
      if (formData.stickers?.stillNeedSticker && finalStatus !== 'Draft') {
        createNotification({
          targetRoles: ['admin', 'head_scrutineer', 'scrutineer_staff', 'secretary'],
          title: 'Sticker Needed / ต้องการสติกเกอร์',
          message: `Competitor Car #${formData.carNumber} (${formData.racerName}) still needs a sticker for ${formData.series}.`,
          type: 'sticker_request',
          link: 'inspection',
        });
      }
      
      createNotification({
        targetRoles: ['admin', 'president', 'secretary', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer', 'steward', 'competitor'],
        title: editingId ? 'Inspection Updated' : 'New Inspection',
        message: `${auth.currentUser.displayName || auth.currentUser.email} ${editingId ? 'updated' : 'started'} an inspection for car number ${formData.carNumber || '-'}.`,
        type: 'inspection_update',
        link: 'inspection',
      });
      
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

  const fetchHistory = async (inspectionId: string) => {
    setIsLoading(true);
    try {
      const historyRef = collection(db, 'car_inspections', inspectionId, 'history');
      const q = query(historyRef, orderBy('changedAt', 'desc'));
      const snapshot = await getDocs(q);
      const logs: InspectionLog[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InspectionLog));
      setInspectionHistory(logs);
      setShowHistorySheet(true);
    } catch (err) {
      console.error("Failed to fetch history", err);
      showToast("Failed to load history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (inspection: Inspection) => {
    setEditingId(inspection.id);
    const data = inspection.formData || {
      ...initialFormData,
      inspectionDate: inspection.inspectionDate || initialFormData.inspectionDate,
      series: inspection.racingModel || '',
      carNumber: inspection.carNumber || '',
      teamName: inspection.teamName || '',
      racerName: inspection.racerName || '',
      carManufacturer: inspection.brand || '',
      model: inspection.carModel || '',
      engineSealNumber: inspection.sealNumber || '',
      status: inspection.status || 'Draft'
    };
    
    setFormData(data);
    
    // Automatic status update if scrutineer opens a "Waiting For Inspection" form
    const isScrutineerRole = ['admin', 'president', 'head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');
    if (isScrutineerRole && inspection.status === 'Waiting For Inspection') {
      try {
        const docRef = doc(db, 'car_inspections', inspection.id);
        await setDoc(docRef, { 
          status: 'Inspecting', 
          updatedAt: new Date().toISOString(),
          formData: { ...data, status: 'Inspecting' }
        }, { merge: true });
        setFormData(prev => ({ ...prev, status: 'Inspecting' }));
      } catch (err) {
        console.error("Failed to update status to Inspecting", err);
      }
    }

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

  const getStickerGuideImage = (series: string, year?: string) => {
    // Priority 1: From Custom Rules (Sponsor Stickers)
    if (fetchedCustomRules?.sponsorStickers && year && series) {
      if (fetchedCustomRules.sponsorStickers[year]?.[series]) {
        return fetchedCustomRules.sponsorStickers[year][series];
      }
    }

    // Priority 2: Fallback to old hardcoded stickers
    const normalized = (series || '').toLowerCase().trim();
    if (normalized.includes('eco')) return stickerEco;
    if (normalized.includes('truck')) return stickerTruck;
    if (normalized.includes('group a')) return stickerGroupA;
    if (normalized.includes('group n')) return stickerGroupN;
    if (normalized.includes('gtmc')) return stickerGTMC;
    if (normalized.includes('gtrc')) return stickerGTRC;
    return 'https://placehold.co/1200x800/64748b/ffffff?text=General+Sticker+Guide';
  };

  const calculateTotalWeight = () => {
    let total = Number(formData.baseWeight || 0);
    
    // Dynamic Weights
    if (formData.dynamicWeights) {
      total += formData.dynamicWeights.reduce((acc: number, curr: { isChecked: boolean, weight: number }) => {
        return acc + (curr.isChecked ? Number(curr.weight) : 0);
      }, 0);
    }

    // Custom Table Selections
    if (formData.customTablesData && formData.customTablesSelections) {
      formData.customTablesData.forEach((table: any) => {
        const selections = formData.customTablesSelections[table.id];
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

    return total;
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

  const isFieldChanged = (field: string) => {
    if (!selectedHistoryLog) return false;
    // Check if the exact field or formData prefixed field changed
    return !!(selectedHistoryLog.changes[field] || selectedHistoryLog.changes[`formData.${field}`]);
  };

  const renderSelect = (label: string, field: string, options: string[], className = '') => {
    const keys = field.split('.');
    let value = formData as any;
    for (const key of keys) {
      value = value?.[key];
    }
    const invalid = isFieldInvalid(field);
    const changed = isFieldChanged(field);
    
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
          {label} 
          {invalid && <span className="text-red-500">*</span>}
          {changed && <span className="ml-2 text-rose-500 text-[9px] font-bold ring-1 ring-rose-500/20 bg-rose-50 px-1 rounded">CHANGED</span>}
        </label>
        <div className="relative">
          <select 
            value={value || ''}
            onChange={(e) => handleChange(field, e.target.value)}
            className={`w-full bg-slate-50/50 border ${invalid ? 'border-red-400 ring-2 ring-red-100/50' : changed ? 'border-rose-400 ring-2 ring-rose-100/50' : 'border-slate-100'} rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed`}
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
    const changed = isFieldChanged(field);
    
    return (
      <div className={`space-y-2 ${className}`}>
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
          {label} 
          {invalid && <span className="text-red-500">*</span>}
          {changed && <span className="ml-2 text-rose-500 text-[9px] font-bold ring-1 ring-rose-500/20 bg-rose-50 px-1 rounded">CHANGED</span>}
        </label>
        <input 
          type={type} 
          value={value || ''}
          onChange={(e) => handleChange(field, e.target.value)}
          className={`w-full bg-slate-50/50 border ${invalid ? 'border-red-400 ring-2 ring-red-100/50' : changed ? 'border-rose-400 ring-2 ring-rose-100/50' : 'border-slate-100'} rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed`}
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
    
    const changed = isFieldChanged(field);
    
    return (
      <label className={`flex items-center gap-3 cursor-pointer group ${className} ${!canEditField(field) ? 'opacity-60 cursor-not-allowed' : ''}`}>
        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? (changed ? 'bg-rose-500 border-rose-500' : 'bg-orange-500 border-orange-500') : (changed ? 'border-rose-400 ring-2 ring-rose-100/50 bg-white' : 'border-slate-300 group-hover:border-orange-400 bg-white')}`}>
          {checked && <Check className="w-3.5 h-3.5 text-white" />}
        </div>
        <span className={`text-sm ${changed ? 'text-rose-600 font-medium' : 'text-slate-700 font-light'} select-none`}>{label}</span>
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

  const renderAddComponentModal = () => (
    <AnimatePresence>
      {showAddComponentModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddComponentModal(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200"
          >
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                   <Plus className="w-5 h-5 text-orange-500" />
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-900">Add New Component</h3>
                   <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Inventory Management</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowAddComponentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Component Type</label>
                  <select 
                    value={newComponent.type}
                    onChange={(e) => setNewComponent(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-slate-100 focus:border-slate-300 outline-none transition-all"
                  >
                    <option value="Engine">Engine</option>
                    <option value="Gearbox">Gearbox</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initial Status</label>
                <div className="flex gap-4">
                  {['ACTIVE', 'SPARE'].map((s) => (
                    <label key={s} className={`flex-1 flex items-center justify-center p-4 rounded-xl border cursor-pointer transition-all ${newComponent.status === s ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}>
                      <input 
                        type="radio" 
                        className="hidden" 
                        name="newCompStatus"
                        checked={newComponent.status === s}
                        onChange={() => setNewComponent(prev => ({ ...prev, status: s as any }))}
                      />
                      <span className="text-xs font-bold uppercase tracking-widest">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seal Numbers ({newComponent.sealNumbers?.length || 0}/4)</label>
                  {(newComponent.sealNumbers?.length || 0) < 4 && (
                    <button 
                      onClick={() => setNewComponent(prev => ({ ...prev, sealNumbers: [...(prev.sealNumbers || []), ''] }))}
                      className="text-[10px] font-bold text-slate-900 uppercase tracking-widest hover:underline"
                    >
                      + Add Another Seal
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(newComponent.sealNumbers || []).map((seal, idx) => (
                    <div key={idx} className="relative group">
                      <input 
                        type="text"
                        placeholder={`Seal #${idx + 1}`}
                        value={seal}
                        onChange={(e) => {
                          const updated = [...(newComponent.sealNumbers || [])];
                          updated[idx] = e.target.value;
                          setNewComponent(prev => ({ ...prev, sealNumbers: updated }));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none transition-all"
                      />
                      {idx > 0 && (
                        <button 
                          onClick={() => {
                            const updated = (newComponent.sealNumbers || []).filter((_, i) => i !== idx);
                            setNewComponent(prev => ({ ...prev, sealNumbers: updated }));
                          }}
                          className="absolute -right-2 -top-2 bg-slate-100 text-slate-400 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-slate-200"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {['admin', 'offsite_scrutineer'].includes(userRole || '') && (
                <div className="pt-4 border-t border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${newComponent.isOffsite ? 'bg-slate-900 border-slate-900' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                      {newComponent.isOffsite && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-sm font-medium text-slate-600">Offsite Inspected / ตรวจสภาพนอกสถานที่แล้ว</span>
                    <input 
                      type="checkbox" 
                      className="hidden"
                      checked={newComponent.isOffsite}
                      onChange={(e) => setNewComponent(prev => ({ ...prev, isOffsite: e.target.checked }))}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
               <button 
                 onClick={() => setShowAddComponentModal(false)}
                 className="px-6 py-2.5 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600"
               >
                 Cancel
               </button>
               <button 
                 onClick={() => {
                   if (!newComponent.type) {
                     showToast('Please select Type');
                     return;
                   }
                   
                   // Auto-generate ID and DisplayName
                   const components = [...(formData.components || [])];
                   const sameTypeAndStatus = components.filter(c => c.type === newComponent.type && c.status === newComponent.status);
                   const nextNum = sameTypeAndStatus.length + 1;
                   const prefix = newComponent.status === 'SPARE' ? 'Spare ' : '';
                   const displayName = `${prefix}${newComponent.type} ${nextNum}`;
                   const id = crypto.randomUUID();

                   const comp: ComponentItem = {
                     id,
                     displayName,
                     type: newComponent.type as 'Engine' | 'Gearbox',
                     sealNumbers: (newComponent.sealNumbers || []).filter(s => s.trim() !== ''),
                     status: newComponent.status as any,
                     isOffsite: !!newComponent.isOffsite,
                     registeredAt: new Date().toISOString()
                   };

                   // Ensure only one ACTIVE per type
                   if (comp.status === 'ACTIVE') {
                     components.forEach(c => {
                       if (c.type === comp.type && c.status === 'ACTIVE') {
                         c.status = 'SPARE';
                         // Recalculate display names for spares of this type?
                         // User said "รันตัวเลขไปเรื่อยๆ" - maybe just keep it simple
                       }
                     });
                   }
                   
                   handleChange('components', [...components, comp]);
                   setShowAddComponentModal(false);
                   setNewComponent({ type: 'Engine', status: 'SPARE', sealNumbers: [''], isOffsite: false });
                   showToast(`${displayName} added to inventory`);
                 }}
                 className="px-8 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 active:scale-95"
               >
                 Register Component
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  const renderHistorySheet = () => (
    <AnimatePresence>
      {showHistorySheet && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistorySheet(false)}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-medium text-slate-900">Audit Log</h2>
                <p className="text-xs text-slate-400 mt-1">History of changes for this inspection</p>
              </div>
              <button 
                onClick={() => setShowHistorySheet(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {inspectionHistory.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-8 h-8 text-slate-300 animate-spin-slow" />
                  </div>
                  <p className="text-slate-500 font-light">No change history found.</p>
                </div>
              ) : (
                inspectionHistory.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => {
                      if (!liveFormData) {
                        setLiveFormData(formData);
                      }
                      setSelectedHistoryLog(log);
                      setFormData(log.newData.formData || log.newData);
                      setShowHistorySheet(false);
                      showToast(`Viewing version from ${new Date(log.changedAt).toLocaleString()}`);
                    }}
                    className={`w-full text-left p-5 rounded-3xl border transition-all duration-300 ${
                      selectedHistoryLog?.id === log.id 
                        ? 'border-orange-500 bg-orange-50/30 ring-4 ring-orange-500/5 shadow-md shadow-orange-500/10' 
                        : 'border-slate-100 hover:border-slate-300 hover:shadow-sm bg-white'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-4">
                       <div className="flex items-center gap-2">
                         <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-slate-200 transition-colors">
                           <History className="w-4 h-4" />
                         </div>
                         <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block leading-none mb-1">
                              {new Date(log.changedAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] font-medium text-slate-500 block leading-none">
                              {new Date(log.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                         </div>
                       </div>
                       <div className="px-2.5 py-1 bg-white border border-slate-100 text-[10px] font-black text-slate-900 rounded-lg uppercase tracking-wider shadow-sm">
                         {Object.keys(log.changes || {}).length} Changes
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-xl mb-4 border border-slate-100">
                      <div className="w-6 h-6 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400">
                        {log.changedByName?.charAt(0) || 'U'}
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{log.changedByName}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {Object.keys(log.changes || {}).slice(0, 3).map(field => (
                        <span key={field} className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[9px] font-bold uppercase tracking-tighter truncate max-w-[120px]">
                          {field.replace('formData.', '')}
                        </span>
                      ))}
                      {Object.keys(log.changes || {}).length > 3 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold uppercase tracking-tighter">
                          +{Object.keys(log.changes || {}).length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {selectedHistoryLog && (
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                <button
                  onClick={() => {
                    if (liveFormData) {
                      setFormData(liveFormData);
                      setLiveFormData(null);
                    }
                    setSelectedHistoryLog(null);
                  }}
                  className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <X className="w-4 h-4" />
                  Exit History Mode
                </button>
                
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to restore this version? All unsaved current changes will be lost.')) {
                      setLiveFormData(null);
                      setSelectedHistoryLog(null);
                      showToast('Version restored to form. Click Save to apply.');
                    }
                  }}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                >
                  <RefreshCw className="w-4 h-4" />
                  Restore This Version
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
                setCurrentStep(['admin', 'offsite_scrutineer'].includes(userRole || '') ? 0 : 1);
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
                  <SortableHeader label="STATUS" sortKey="status" sortConfig={sortConfig} requestSort={requestSort} />
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
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 transition-opacity" />
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
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === 'Pass' ? 'bg-emerald-100 text-emerald-600' :
                          item.status === 'Not Pass' ? 'bg-rose-100 text-rose-600' :
                          item.status === 'Inspecting' ? 'bg-blue-100 text-blue-600' :
                          item.status === 'Waiting For Inspection' ? 'bg-orange-100 text-orange-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {item.status || 'Draft'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-4 transition-opacity">
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
                                className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={isCompetitor && item.status !== 'Draft'}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDelete(item.id)}
                                className="text-[11px] uppercase tracking-wider font-medium text-rose-400 hover:text-rose-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={isCompetitor && item.status !== 'Draft'}
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

      {renderHistorySheet()}
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
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 transition-opacity" />
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
                          <div className="flex items-center justify-end gap-4 transition-opacity">
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
        {renderHistorySheet()}
        {renderAddComponentModal()}
        {renderToast()}
      </>
    );
  }

  if (view === 'history-detail' && selectedHistoryItem) {
    const currentViewData = selectedHistoryLog ? selectedHistoryLog.newData : selectedHistoryItem;
    const data = currentViewData.formData || {};

    const HighlightField = ({ label, value, fieldPath }: { label: string, value: any, fieldPath: string }) => {
      const isChanged = selectedHistoryLog?.changes?.[fieldPath] !== undefined;
      
      return (
        <div className={`p-4 rounded-2xl transition-all ${isChanged ? 'bg-rose-50 border border-rose-200 ring-2 ring-rose-100 ring-offset-2' : 'bg-slate-50/50 border border-transparent'}`}>
          <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1 font-bold">{label}</h4>
          <div className={`text-sm ${isChanged ? 'text-rose-600 font-bold' : 'text-slate-600 font-light'}`}>
            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : (value || '-')}
          </div>
          {isChanged && (
            <div className="mt-2 flex items-center gap-2 text-[10px] bg-white/50 p-2 rounded-xl border border-rose-100">
              <span className="text-slate-400 uppercase font-black text-[8px]">Old Val</span>
              <span className="text-slate-500 line-through font-medium">
                {typeof selectedHistoryLog?.changes?.[fieldPath]?.old === 'boolean' 
                  ? (selectedHistoryLog?.changes?.[fieldPath]?.old ? 'Yes' : 'No') 
                  : (String(selectedHistoryLog?.changes?.[fieldPath]?.old) || 'None')}
              </span>
            </div>
          )}
        </div>
      );
    };

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
          <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
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
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-500 font-light text-sm">View detailed inspection information.</p>
                  <span className="text-slate-300">•</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    selectedHistoryItem?.status === 'Pass' ? 'text-emerald-500' :
                    selectedHistoryItem?.status === 'Not Pass' ? 'text-rose-500' :
                    selectedHistoryItem?.status === 'Inspecting' ? 'text-blue-500' :
                    selectedHistoryItem?.status === 'Waiting For Inspection' ? 'text-orange-500' :
                    'text-slate-400'
                  }`}>
                    {selectedHistoryItem?.status || 'Draft'}
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => fetchHistory(selectedHistoryItem.id)}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Audit Log History
            </button>
          </div>

          <div className="space-y-8">
            {/* Decision Info */}
            {(selectedHistoryItem.status === 'Pass' || selectedHistoryItem.status === 'Not Pass') && (
              <div className={`rounded-3xl border p-8 ${selectedHistoryItem.status === 'Pass' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <h3 className={`text-xs font-semibold uppercase tracking-widest mb-6 border-b pb-4 ${selectedHistoryItem.status === 'Pass' ? 'text-emerald-600 border-emerald-100' : 'text-rose-600 border-rose-100'}`}>
                  Inspection Decision
                </h3>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedHistoryItem.status === 'Pass' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                    {selectedHistoryItem.status === 'Pass' ? <CheckCircle2 className="w-6 h-6" /> : <X className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${selectedHistoryItem.status === 'Pass' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {selectedHistoryItem.status}
                    </div>
                    {selectedHistoryItem.status === 'Not Pass' && selectedHistoryItem.notPassReasons && (
                      <p className="text-sm text-rose-600 mt-1 font-light">{selectedHistoryItem.notPassReasons}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Driver & Series Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <HighlightField label="Inspection Date" value={data.inspectionDate} fieldPath="formData.inspectionDate" />
                <HighlightField label="Stadium" value={data.stadium} fieldPath="formData.stadium" />
                <HighlightField label="Series" value={data.series} fieldPath="formData.series" />
                <HighlightField label="Grades" value={data.grades} fieldPath="formData.grades" />
                <HighlightField label="Car Number" value={data.carNumber} fieldPath="formData.carNumber" />
                <HighlightField label="Team Name" value={data.teamName} fieldPath="formData.teamName" />
                <HighlightField label="Racer Name" value={data.racerName} fieldPath="formData.racerName" />
                <HighlightField label="Team Manager Name" value={data.teamManagerName} fieldPath="formData.teamManagerName" />
              </div>
            </div>

            {/* Car Info */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Car Info</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <HighlightField label="Car Manufacturer" value={data.carManufacturer} fieldPath="formData.carManufacturer" />
                <HighlightField label="Model" value={data.model} fieldPath="formData.model" />
                <HighlightField label="Engine Displacement (CC)" value={data.engineDisplacement} fieldPath="formData.engineDisplacement" />
                <HighlightField label="Engine Code" value={data.engineCode} fieldPath="formData.engineCode" />
                <HighlightField label="Transmission" value={data.transmission} fieldPath="formData.transmission" />
                <HighlightField label="Drivetrain" value={data.drivetrain} fieldPath="formData.drivetrain" />
                <HighlightField label="Gear Shift Pattern" value={data.gearShiftPattern} fieldPath="formData.gearShiftPattern" />
              </div>
            </div>

            {/* Sponsors Sticker Requirements */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Tag className="w-4 h-4" /> Sponsors Sticker Requirements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HighlightField label="Have All Sticker/มีสติกเกอร์ครบแล้ว" value={data.stickers?.haveAllStickers} fieldPath="formData.stickers.haveAllStickers" />
                <HighlightField label="Still Need Sticker/ต้องการสติกเกอร์" value={data.stickers?.stillNeedSticker} fieldPath="formData.stickers.stillNeedSticker" />
              </div>
            </div>

            {/* Weight & BOP Details */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Scale className="w-4 h-4" /> Weight & BOP Configuration
              </h3>
              <div className="space-y-6">
                <HighlightField label="Base Minimum Weight" value={data.baseWeight ? `${data.baseWeight} kg` : 'Not Selected'} fieldPath="formData.baseWeight" />
                
                {data.dynamicWeights && data.dynamicWeights.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Dynamic Adjustments</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.dynamicWeights.map((w: any, idx: number) => (
                        <div key={idx} className={`p-3 rounded-xl border ${w.isChecked ? 'bg-orange-50/30 border-orange-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-700">{w.condition || w.title}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${w.isChecked ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                              {w.weight > 0 ? '+' : ''}{w.weight} kg
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Official Safety Check */}
            {!isCompetitor && (
              <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Official Safety Check
                </h3>
                <div className="space-y-8">
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Car Lights</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <HighlightField label="Head Light" value={data.carLight?.headLight} fieldPath="formData.carLight.headLight" />
                      <HighlightField label="Turn Signal" value={data.carLight?.turnSignal} fieldPath="formData.carLight.turnSignal" />
                      <HighlightField label="Tail Light" value={data.carLight?.tailLight} fieldPath="formData.carLight.tailLight" />
                      <HighlightField label="Break Light" value={data.carLight?.breakLight} fieldPath="formData.carLight.breakLight" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Racer Safety</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <HighlightField label="Helmet" value={data.racerSafety?.helmet} fieldPath="formData.racerSafety.helmet" />
                      <HighlightField label="HANS" value={data.racerSafety?.hans} fieldPath="formData.racerSafety.hans" />
                      <HighlightField label="Balaclava" value={data.racerSafety?.balaclava} fieldPath="formData.racerSafety.balaclava" />
                      <HighlightField label="Glove" value={data.racerSafety?.glove} fieldPath="formData.racerSafety.glove" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Seals & Technical */}
            <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Seals & Technical
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <HighlightField label="Engine Seal" value={data.engineSealNumber} fieldPath="formData.engineSealNumber" />
                <HighlightField label="Gear Seal" value={data.gearSealNumber} fieldPath="formData.gearSealNumber" />
                <HighlightField label="Smoke Detector" value={data.ptrsSmokeDetector} fieldPath="formData.ptrsSmokeDetector" />
                <HighlightField label="Weight Post-Race 2" value={data.weightAddedAfterRace2} fieldPath="formData.weightAddedAfterRace2" />
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
        {renderHistorySheet()}
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
          {editingId && (
            <button
              onClick={() => fetchHistory(editingId)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full text-xs font-bold hover:bg-slate-50 hover:text-orange-500 transition-all uppercase tracking-widest shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Audit Log
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8 md:p-12">
          {selectedHistoryLog && (
            <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-widest">History View Mode</p>
                  <p className="text-[10px] text-rose-500">Viewing version from {new Date(selectedHistoryLog.changedAt).toLocaleString()} by {selectedHistoryLog.changedByName}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (liveFormData) {
                    setFormData(liveFormData);
                    setLiveFormData(null);
                  }
                  setSelectedHistoryLog(null);
                }}
                className="px-4 py-2 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-xl hover:bg-rose-50 transition-colors shadow-sm"
              >
                Back to Live Edit
              </button>
            </div>
          )}
          {/* Stepper */}
          {currentStep > 0 && (
            <div className="mb-12">
              <div className="flex items-center justify-between mb-4 relative">
                {(isCompetitor ? [1, 2, 3, 4] : [1, 2, 3, 4, 5, 6]).map((step) => (
                  <div key={step} className="flex flex-col items-center gap-2 relative z-10">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${currentStep >= step ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-100 text-slate-400'}`}>
                      {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-medium absolute -bottom-6 whitespace-nowrap ${currentStep >= step ? 'text-orange-600' : 'text-slate-400'}`}>
                      {isCompetitor ? (
                        step === 1 ? 'Driver' : step === 2 ? 'Car' : step === 3 ? 'Weight' : 'Preview'
                      ) : (
                        step === 1 ? 'Driver' : step === 2 ? 'Car' : step === 3 ? 'Weight' : step === 4 ? 'Safety' : step === 5 ? 'Seal' : 'Review'
                      )}
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
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-slate-100"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competitor Entries / ข้อมูลจากผู้สมัคร</span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>
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
                  
                  {['admin', 'offsite_scrutineer'].includes(userRole || '') && (
                    <div className="mt-6 p-4 bg-orange-50 border border-orange-100 rounded-xl text-center">
                      {renderCheckbox('Offsite Inspection / ตรวจสภาพนอกสถานที่', 'isOffsiteInspection')}
                      <p className="text-[10px] text-orange-600 mt-2 font-medium">Only Off-site Scrutineers can verify this field.</p>
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
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-slate-100"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Competitor Entries / ข้อมูลจากผู้สมัคร</span>
                    <div className="h-px flex-1 bg-slate-100"></div>
                  </div>
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
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {tireBrands.map(brand => (
                            <div key={brand}>
                              {renderInput(brand, `tireMarkAmount.${brand.toLowerCase()}` as any, 'number', '0')}
                            </div>
                          ))}
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
                  <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative w-full overflow-hidden">
                    <div className="absolute top-0 left-0 w-2 h-full bg-slate-900"></div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                          <Tag className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Sponsors Sticker</h3>
                          <p className="text-[11px] text-slate-400 font-medium">Verify required stickers are placed correctly</p>
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setShowStickerModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 border border-orange-200 transition-all hover:scale-105 active:scale-95 shadow-sm uppercase tracking-wider"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        View Guide
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-2xl border border-slate-100/50">
                      {renderCheckbox('Have All Sticker/มีสติกเกอร์ครบแล้ว', 'stickers.haveAllStickers')}
                      {renderCheckbox('Still Need Sticker/ต้องการสติกเกอร์', 'stickers.stillNeedSticker')}
                    </div>

                    {/* Sticker Modal UI */}
                    <AnimatePresence>
                      {showStickerModal && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-10 pointer-events-auto"
                        >
                          <div 
                            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm cursor-pointer"
                            onClick={() => setShowStickerModal(false)}
                          />
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-full overflow-hidden border border-slate-200 flex flex-col"
                          >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white border border-slate-100">
                                  <Tag className="w-5 h-5 text-orange-500" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-800 tracking-tight">
                                    {formData.series || 'Series'} Sticker Placement Guide
                                  </h3>
                                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                                    Race Year: {formData.eventYear || 'Current'}
                                  </p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setShowStickerModal(false)}
                                className="p-2 bg-white rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-100 transition-all shadow-sm"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="flex-1 overflow-auto bg-slate-100 p-4 md:p-8 flex items-center justify-center min-h-[400px]">
                              {formData.series ? (
                                <Image 
                                  src={getStickerGuideImage(formData.series, formData.eventYear)} 
                                  alt={`${formData.series} Sticker Guide`}
                                  width={1200}
                                  height={800}
                                  className="max-w-full max-h-full object-contain rounded-xl shadow-lg border border-white/50"
                                  unoptimized
                                />
                              ) : (
                                <div className="text-center py-20">
                                  <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center mx-auto mb-6">
                                    <Car className="w-10 h-10 text-slate-300" />
                                  </div>
                                  <h4 className="text-lg font-medium text-slate-700 mb-2">Series Not Selected</h4>
                                  <p className="text-sm text-slate-400 max-w-xs mx-auto">Please select a series in Step 1 to load the specific sticker guide.</p>
                                </div>
                              )}
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
                              <button 
                                onClick={() => setShowStickerModal(false)}
                                className="px-8 py-2.5 bg-slate-900 text-white rounded-full text-sm font-medium hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10 active:scale-95"
                              >
                                Got it
                              </button>
                            </div>
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="stepWeightMinimal"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-6"
                >
                  <div className="pb-4 border-b border-slate-100">
                    <h3 className="text-xl font-medium text-slate-900">Weight & BOP</h3>
                    <p className="text-xs text-slate-500 mt-1">Technical weight balance and dynamic adjustments.</p>
                  </div>
                  
                  {/* Base Weight Table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base Minimum Weight</span>
                      <button 
                        onClick={() => {
                          const newOptions = [...(formData.baseWeightOptions || [])];
                          newOptions.push({ id: Date.now().toString(), title: 'Custom', condition: '', weight: 0, isCustom: true });
                          handleChange('baseWeightOptions', newOptions);
                        }}
                        className="text-[10px] font-bold text-slate-900 uppercase tracking-widest hover:underline"
                      >
                        + Add Custom
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(formData.baseWeightOptions || []).map((opt: any, index: number) => (
                        <div key={opt.id} className={`flex items-center px-6 py-4 hover:bg-slate-50 transition-all ${formData.baseWeight === opt.weight.toString() ? 'bg-slate-50/50' : ''}`}>
                          <label className="flex items-center gap-4 flex-1 cursor-pointer">
                            <input 
                              type="radio" 
                              name="baseWeightSelection"
                              checked={formData.baseWeight === opt.weight.toString()} 
                              onChange={() => handleChange('baseWeight', opt.weight.toString())}
                              className="w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            {opt.isCustom ? (
                              <div className="flex-1 grid grid-cols-2 gap-4">
                                <input type="text" value={opt.title} onChange={e => { const newW = [...formData.baseWeightOptions]; newW[index].title = e.target.value; handleChange('baseWeightOptions', newW); }} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm outline-none focus:border-slate-400" placeholder="Model/CC" />
                                <input type="text" value={opt.condition} onChange={e => { const newW = [...formData.baseWeightOptions]; newW[index].condition = e.target.value; handleChange('baseWeightOptions', newW); }} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm outline-none focus:border-slate-400" placeholder="Condition" />
                              </div>
                            ) : (
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{opt.condition || opt.title}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{opt.title}</p>
                              </div>
                            )}
                          </label>
                          <div className="flex items-center gap-6 ml-4">
                            {opt.isCustom ? (
                              <div className="flex items-center gap-2">
                                <input type="number" value={opt.weight} onChange={e => {
                                    const val = e.target.value;
                                    const newW = [...formData.baseWeightOptions]; 
                                    newW[index].weight = Number(val); 
                                    handleChange('baseWeightOptions', newW);
                                    if (formData.baseWeight === opt.weight.toString()) handleChange('baseWeight', val);
                                }} className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm text-right outline-none focus:border-slate-400" />
                                <span className="text-xs text-slate-400">kg</span>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-slate-900 w-16 text-right">{opt.weight} kg</span>
                            )}
                            {opt.isCustom && (
                              <button onClick={() => { 
                                const newW = formData.baseWeightOptions.filter((_: any, i: number) => i !== index); 
                                handleChange('baseWeightOptions', newW); 
                                if (formData.baseWeight === opt.weight.toString()) handleChange('baseWeight', '');
                              }} className="text-slate-300 hover:text-rose-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Weights Table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adjustments & Penalties</span>
                      <button 
                        onClick={() => {
                          const newWeights = [...(formData.dynamicWeights || [])];
                          newWeights.push({ id: Date.now().toString(), title: 'Custom', condition: '', weight: 0, isChecked: true, isCustom: true });
                          handleChange('dynamicWeights', newWeights);
                        }}
                        className="text-[10px] font-bold text-slate-900 uppercase tracking-widest hover:underline"
                      >
                        + Add Adjustment
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(formData.dynamicWeights || []).map((wItem: any, index: number) => (
                        <div key={wItem.id} className={`flex items-center px-6 py-3 hover:bg-slate-50 transition-all ${wItem.isChecked ? 'bg-slate-50/30' : ''}`}>
                          <label className="flex items-center gap-4 flex-1 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={wItem.isChecked} 
                              onChange={(e) => {
                                const newW = [...formData.dynamicWeights];
                                newW[index].isChecked = e.target.checked;
                                handleChange('dynamicWeights', newW);
                              }}
                              className="w-4 h-4 border-slate-300 rounded text-slate-900 focus:ring-slate-900"
                            />
                            {wItem.isCustom ? (
                              <div className="flex-1 grid grid-cols-2 gap-4">
                                <input type="text" value={wItem.title} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].title = e.target.value; handleChange('dynamicWeights', newW); }} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm outline-none focus:border-slate-400" placeholder="Adjustment Title" />
                                <input type="text" value={wItem.condition} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].condition = e.target.value; handleChange('dynamicWeights', newW); }} className="px-3 py-1 bg-white border border-slate-200 rounded text-sm outline-none focus:border-slate-400" placeholder="Description" />
                              </div>
                            ) : (
                              <div className="flex-1">
                                <p className="text-sm text-slate-700">{wItem.condition}</p>
                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{wItem.title}</p>
                              </div>
                            )}
                          </label>
                          <div className="flex items-center gap-6 ml-4">
                            {wItem.isCustom ? (
                              <div className="flex items-center gap-2">
                                <input type="number" value={wItem.weight} onChange={e => { const newW = [...formData.dynamicWeights]; newW[index].weight = Number(e.target.value); handleChange('dynamicWeights', newW); }} className="w-20 px-2 py-1 bg-white border border-slate-200 rounded text-sm text-right outline-none focus:border-slate-400" />
                                <span className="text-xs text-slate-400">kg</span>
                              </div>
                            ) : (
                              <span className={`text-sm font-bold w-16 text-right ${wItem.weight > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                                {wItem.weight > 0 ? '+' : ''}{wItem.weight} kg
                              </span>
                            )}
                            {wItem.isCustom && (
                              <button onClick={() => { const newW = formData.dynamicWeights.filter((_: any, i: number) => i !== index); handleChange('dynamicWeights', newW); }} className="text-slate-300 hover:text-rose-500">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Summary Row */}
                  <div className="bg-slate-900 text-white rounded-xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Final Calculated Weight</h4>
                      <p className="text-[10px] text-slate-500">Includes base weights and all technical adjustments.</p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">{calculateTotalWeight()}</span>
                      <span className="text-lg font-medium text-slate-500">kg</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 4 && !isCompetitor && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-px flex-1 bg-rose-100"></div>
                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Official Use Only / สำหรับเจ้าหน้าที่ตรวจสภาพ</span>
                    <div className="h-px flex-1 bg-rose-100"></div>
                  </div>
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
                  key="stepSealInventory"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-10"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-light text-slate-900 tracking-tight">Component Inventory / การจัดการอะไหล่และซีล</h3>
                      <p className="text-sm text-slate-500 mt-1">Manage active and spare engines/gearboxes with associated seals.</p>
                    </div>
                    <button 
                      onClick={() => setShowAddComponentModal(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Add Component
                    </button>
                  </div>

                  <div className="space-y-12">
                    {/* Active Components */}
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                           <CheckCircle2 className="w-4 h-4 text-slate-900" />
                         </div>
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Components</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(formData.components || []).filter((c: ComponentItem) => c.status === 'ACTIVE').map((comp: ComponentItem) => (
                          <div key={comp.id} className="relative group bg-white border border-slate-200 rounded-[20px] p-6 shadow-sm overflow-hidden hover:border-slate-300 transition-all">
                             <div className="relative z-10">
                               <div className="flex justify-between items-start mb-4">
                                 <div>
                                   <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-black rounded uppercase mb-1 inline-block">{comp.type}</span>
                                   <h5 className="text-xl font-bold text-slate-900">{comp.displayName || comp.id}</h5>
                                 </div>
                                 {comp.isOffsite && (
                                   <span className="px-3 py-1 bg-slate-50 border border-slate-100 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                                     <Check className="w-3 h-3" /> Offsite Inspected
                                   </span>
                                 )}
                               </div>
                               <div className="space-y-3">
                                 <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Seal Numbers</p>
                                 <div className="flex flex-wrap gap-2">
                                   {comp.sealNumbers.map((s, idx) => (
                                     <span key={idx} className="bg-white border border-slate-100 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 shadow-sm">
                                       {s}
                                     </span>
                                   ))}
                                 </div>
                               </div>
                             </div>
                          </div>
                        ))}
                        {(formData.components || []).filter((c: ComponentItem) => c.status === 'ACTIVE').length === 0 && (
                          <div className="col-span-full py-10 border border-dashed border-slate-200 rounded-[20px] flex flex-col items-center justify-center text-slate-400 font-light italic">
                            No active components assigned.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Spare Components */}
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                           <RefreshCw className="w-4 h-4 text-slate-900" />
                         </div>
                         <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spare Components</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(formData.components || []).filter((c: ComponentItem) => c.status === 'SPARE').map((comp: ComponentItem) => (
                          <div key={comp.id} className="relative group bg-white border border-slate-200 rounded-[16px] p-5 hover:border-slate-400 transition-all shadow-sm">
                             <div className="flex justify-between items-start mb-4">
                               <div>
                                 <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[9px] font-bold rounded uppercase mb-1 inline-block">{comp.type}</span>
                                 <h5 className="text-lg font-bold text-slate-800">{comp.displayName || comp.id}</h5>
                               </div>
                               <button 
                                 onClick={() => {
                                   const currentActive = formData.components.find((c: ComponentItem) => c.type === comp.type && c.status === 'ACTIVE');
                                   const confirmMsg = currentActive 
                                     ? `Swap ${comp.type}? This will Retire ${currentActive.displayName || currentActive.id} and Activate ${comp.displayName || comp.id}.`
                                     : `Set ${comp.type} ${comp.displayName || comp.id} as Active?`;
                                   
                                   if (confirm(confirmMsg)) {
                                     handleComponentSwap(currentActive, comp);
                                   }
                                 }}
                                 className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-black rounded uppercase tracking-wider hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center gap-1"
                               >
                                 <Zap className="w-3 h-3" /> Set Active
                               </button>
                             </div>
                             <div className="space-y-2">
                               <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest leading-none">Seals</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {comp.sealNumbers.map((s, idx) => (
                                   <span key={idx} className="bg-slate-50 border border-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-500">
                                     {s}
                                   </span>
                                 ))}
                               </div>
                             </div>
                             <button 
                               onClick={() => {
                                 handleChange('components', formData.components.filter((c: ComponentItem) => c.id !== comp.id));
                               }}
                               className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                             >
                               <Trash2 className="w-3.5 h-3.5" />
                             </button>
                          </div>
                        ))}
                        {(formData.components || []).filter((c: ComponentItem) => c.status === 'SPARE').length === 0 && (
                          <div className="col-span-full py-8 border border-dashed border-slate-200 rounded-[16px] flex items-center justify-center text-slate-300 text-sm font-light">
                            No spare components available.
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Retired Components (Optional/Foldable if needed, but let's just list briefly) */}
                    {(formData.components || []).filter((c: ComponentItem) => c.status === 'RETIRED').length > 0 && (
                      <section className="opacity-60">
                        <div className="flex items-center gap-3 mb-6">
                           <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                             <Trash2 className="w-4 h-4 text-slate-500" />
                           </div>
                           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Retired History</h4>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          {(formData.components || []).filter((c: ComponentItem) => c.status === 'RETIRED').map((comp: ComponentItem) => (
                            <div key={comp.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                 {comp.type === 'Engine' ? <Zap className="w-4 h-4 text-slate-300" /> : <Settings2 className="w-4 h-4 text-slate-300" />}
                               </div>
                               <div>
                                 <p className="text-[10px] font-bold text-slate-300 uppercase leading-none mb-1">{comp.type}</p>
                                 <p className="text-sm font-medium text-slate-400">{comp.displayName || comp.id}</p>
                               </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </motion.div>
              )}

              {(currentStep === 6 || (isCompetitor && currentStep === 4)) && (
                <motion.div
                  key="step5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-8"
                >
                  <div>
                    <h3 className="text-2xl font-light text-slate-900 mb-8 pb-4 border-b border-slate-100">{isCompetitor ? 'Full Inspection Review' : 'Final Verification & Decision'}</h3>
                    <div className="space-y-10">
                      {/* Section 1: Driver & Event */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">1. Driver & Event Information</h4>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 text-sm">
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Date</span> <p className="font-medium text-slate-900">{formData.inspectionDate || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Stadium</span> <p className="font-medium text-slate-900">{formData.stadium || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Series</span> <p className="font-medium text-slate-900">{formData.series || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Grades/Class</span> <p className="font-medium text-slate-900">{formData.grades || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Car Number</span> <p className="font-medium text-slate-900">{formData.carNumber || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Racer</span> <p className="font-medium text-slate-900">{formData.racerName || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Team</span> <p className="font-medium text-slate-900">{formData.teamName || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Manager</span> <p className="font-medium text-slate-900">{formData.teamManagerName || '-'}</p></div>
                        </div>
                      </section>

                      {/* Section 2: Technical Specifications */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">2. Technical Specifications</h4>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8 text-sm">
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Manufacturer</span> <p className="font-medium text-slate-900">{formData.carManufacturer || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Model</span> <p className="font-medium text-slate-900">{formData.model || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Displacement</span> <p className="font-medium text-slate-900">{formData.engineDisplacement ? `${formData.engineDisplacement} CC` : '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Engine Code</span> <p className="font-medium text-slate-900">{formData.engineCode || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Transmission</span> <p className="font-medium text-slate-900">{formData.transmission || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Drivetrain</span> <p className="font-medium text-slate-900">{formData.drivetrain || '-'}</p></div>
                          <div><span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Gear Shift</span> <p className="font-medium text-slate-900">{formData.gearShiftPattern || '-'}</p></div>
                        </div>
                      </section>

                      {/* Section 3: Tires & Stickers */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3. Tires & Compliance</h4>
                        </div>
                        <div className="p-6 space-y-6">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {Object.entries(formData.tireMarkAmount || {}).map(([brand, amount]) => (
                              amount ? (
                                <div key={brand} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                  <span className="text-[10px] text-slate-400 font-bold uppercase block">{brand}</span>
                                  <p className="text-lg font-bold text-slate-900">{amount} marks</p>
                                </div>
                              ) : null
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <div className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${formData.stickers?.haveAllStickers ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                              All Stickers Placed
                            </div>
                            <div className={`px-4 py-2 rounded-full border text-xs font-bold uppercase tracking-wider ${formData.stickers?.stillNeedSticker ? 'bg-rose-50 border-rose-200 text-rose-500' : 'bg-white border-slate-200 text-slate-300'}`}>
                              Requires Replacement
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section 4: Weight & BOP */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">4. Weight & Balance (BOP)</h4>
                        </div>
                        <div className="p-6 space-y-4">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500 font-medium italic">Selected Base Minimum Weight</span>
                            <span className="font-bold text-slate-900">{formData.baseWeight || 0} kg</span>
                          </div>
                          <div className="space-y-2">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Applied Adjustments</p>
                             {(formData.dynamicWeights || []).filter((w: any) => w.isChecked).map((w: any) => (
                               <div key={w.id} className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                                 <span className="text-slate-600">{w.condition || w.title}</span>
                                 <span className="font-bold text-slate-900">{w.weight > 0 ? '+' : ''}{w.weight} kg</span>
                                </div>
                             ))}
                             {(formData.dynamicWeights || []).filter((w: any) => w.isChecked).length === 0 && <p className="text-xs text-slate-300 italic">No adjustments applied</p>}
                          </div>
                          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-900">Total Calculated Inspection Weight</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-2xl font-black text-slate-900">{calculateTotalWeight()}</span>
                              <span className="text-sm font-medium text-slate-400">kg</span>
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Section 5: Safety Checks (Official Only) */}
                      {!isCompetitor && (
                        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">5. Safety & Equipment Inspection</h4>
                          </div>
                          <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                               {Object.entries(formData.carLight || {}).map(([key, val]) => (
                                 <div key={key} className={`p-2 rounded border text-[10px] font-bold uppercase text-center ${val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-300 border-slate-100'}`}>
                                   {key.replace(/([A-Z])/g, ' $1')}
                                 </div>
                               ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Object.entries(formData.carEquipment || {}).map(([key, equip]: [string, any]) => (
                                <div key={key} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                  <span className="text-xs font-bold text-slate-500 uppercase">{key.replace(/([A-Z])/g, ' $1')}</span>
                                  <div className="flex gap-2">
                                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${equip.installed ? 'bg-slate-900 text-white' : 'bg-white text-slate-200'}`}>INST</span>
                                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${equip.sticker ? 'bg-slate-900 text-white' : 'bg-white text-slate-200'}`}>STIC</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Section 6: Component Inventory */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">6. Component Inventory (Active)</h4>
                        </div>
                        <div className="p-6 space-y-4">
                          {(formData.components || []).filter((c: ComponentItem) => c.status === 'ACTIVE').map((comp: ComponentItem) => (
                            <div key={comp.id} className="flex justify-between items-start text-sm border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                               <div>
                                 <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-widest">{comp.type}</span>
                                 <h6 className="font-bold text-slate-900 text-base">{comp.displayName || comp.id}</h6>
                                 <div className="flex flex-wrap gap-1.5 mt-2">
                                   {comp.sealNumbers.map((s, i) => <span key={i} className="px-2 py-1 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-600 font-medium">{s}</span>)}
                                 </div>
                               </div>
                               {comp.isOffsite && <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[8px] font-bold border border-slate-200 shadow-sm">OFFSITE ASSIGNED</span>}
                            </div>
                          ))}
                          {(formData.components || []).filter((c: ComponentItem) => c.status === 'ACTIVE').length === 0 && <p className="text-sm text-slate-300 italic">No active components registered</p>}
                        </div>
                      </section>

                      {/* Section 7: Photos & Remarks */}
                      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">7. Supplementary Actions</h4>
                        </div>
                        <div className="p-6 space-y-4">
                           <div className="space-y-1">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inspector Remarks</p>
                             <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{formData.remark || '-'}</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                             {Object.entries(uploadedFiles).map(([label, files]) => (
                               <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-2">{label}</p>
                                 <div className="text-[10px] text-slate-900 font-bold">{files.length} Files Attached</div>
                               </div>
                             ))}
                           </div>
                        </div>
                      </section>

                      {/* Decision Panel (Official only or during history view) */}
                      {!isCompetitor && (
                        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-8 text-center italic">Official Inspection Final Verdict</h4>
                          <div className="grid grid-cols-2 gap-6">
                            <button
                              onClick={() => handleChange('status', 'Pass')}
                              className={`flex items-center justify-center gap-4 p-5 rounded-2xl border transition-all ${
                                formData.status === 'Pass' 
                                  ? 'bg-white text-slate-900 border-white shadow-lg' 
                                  : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'
                              }`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                              <span className="font-black uppercase tracking-widest text-xs">Verify Pass</span>
                            </button>
                            <button
                              onClick={() => handleChange('status', 'Not Pass')}
                              className={`flex items-center justify-center gap-4 p-5 rounded-2xl border transition-all ${
                                formData.status === 'Not Pass' 
                                  ? 'bg-rose-500 text-white border-rose-500 shadow-lg' 
                                  : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'
                              }`}
                            >
                              <X className="w-5 h-5" />
                              <span className="font-black uppercase tracking-widest text-xs">Reject Form</span>
                            </button>
                          </div>
                          
                          {formData.status === 'Not Pass' && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-8 space-y-3"
                            >
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center block">Deficiency Notice Details</label>
                              <textarea 
                                value={formData.notPassReasons || ''}
                                onChange={(e) => handleChange('notPassReasons', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-sm font-medium text-white focus:outline-none focus:border-rose-500 transition-all min-h-[120px] placeholder:text-slate-600"
                                placeholder="State exact reasons for rejection (e.g. Safety harness expired)..."
                              />
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row justify-between pt-6 border-t border-slate-100 gap-4">
            <div className="flex gap-3">
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
              
              {isCompetitor && currentStep < 4 && (
                <button 
                  onClick={() => handleSubmit('Draft')}
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-full text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>
              )}
            </div>
            
            {currentStep < totalSteps ? (
              <button 
                onClick={handleNextStep}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Continue
              </button>
            ) : (
              <button 
                onClick={() => handleSubmit(isCompetitor ? 'Waiting For Inspection' : (formData.status || 'Draft'))}
                disabled={isSubmitting || (isCompetitor && formData.status !== 'Draft' && !editingId)}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-orange-500/20 flex items-center gap-2 disabled:opacity-70"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isCompetitor ? 'Submit for Inspection' : (editingId ? 'Update Inspection' : 'Submit Inspection')}
              </button>
            )}
          </div>
        </div>
      </motion.div>
      {renderHistorySheet()}
      {renderAddComponentModal()}
      {renderToast()}
    </>
  );
}
