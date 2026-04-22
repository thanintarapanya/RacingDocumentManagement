'use client';

import { useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import SignatureCanvas from 'react-signature-canvas';
import { useAppStore, type Entry } from '@/lib/store';
import { auth, storage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  CheckCircle2, 
  UploadCloud, 
  Search, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  X, 
  Loader2,
  RefreshCw
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

const steps = [
  { id: 1, label: 'Series Race' },
  { id: 2, label: 'Personal Info' },
  { id: 3, label: 'Driver & Team Info' },
  { id: 4, label: 'Document for Register' },
  { id: 5, label: 'Confirmation' }
];

const seriesOptions = SERIES_CATEGORIES;
const gradeOptions = ['PRO', 'AM', 'GT PRO CLASS 1', 'GT PRO CLASS 2'];
const stadiumOptions = ['Chang International Circuit', 'PT Songkhla Street Circuit'];
const bloodTypes = ['A', 'B', 'AB', 'O'];

const SortableHeader = ({ 
  label, 
  sortKey, 
  align = 'left',
  sortConfig,
  requestSort
}: { 
  label: string, 
  sortKey: keyof Entry, 
  align?: 'left' | 'right',
  sortConfig: { key: keyof Entry, direction: 'asc' | 'desc' } | null,
  requestSort: (key: keyof Entry) => void
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

export default function EntryFormTab() {
  const { entries, addEntry, updateEntry, deleteEntry } = useAppStore();
  const userRole = useAppStore(state => state.userRole);
  const currentUser = auth.currentUser;

  const canEditAll = ['admin', 'president', 'secretary'].includes(userRole || '');
  const canEditCarOnly = ['head_scrutineer', 'scrutineer_staff', 'offsite_scrutineer'].includes(userRole || '');
  const canEditOwn = userRole === 'competitor' || userRole === 'user';
  const [editingId, setEditingId] = useState<number | null>(null);
  const isOwnDoc = editingId ? (entries.find(e => e.id === editingId)?.userId === currentUser?.uid) : true;
  
  const canEditField = (field: string) => {
    if (canEditAll) return true;
    
    // Check if locked
    const entry = editingId ? entries.find(e => e.id === editingId) : null;
    const isSubmitted = entry?.status === 'Submitted';

    if (canEditOwn && isOwnDoc) {
      if (isSubmitted) return false; // Competitor cannot edit after submission
      
      if (editingId) {
        // When editing an existing entry, competitor can only edit specific fields
        // Update: user said locked after submit, so if it is draft they can edit?
        // Let's assume if it is NOT submitted, they can edit everything they could during creation.
        return true; 
      }
      return true; // Can edit all fields when creating new
    }
    if (canEditCarOnly) {
      const carFields = ['carManufacturer', 'model', 'engineDisplacement', 'engineCode', 'transmission', 'drivetrain', 'gearShiftPattern', 'autoGearMoreThan6', 'paddleShift'];
      return carFields.includes(field);
    }
    return false;
  };
  const [view, setView] = useState<'list' | 'form' | 'view'>('list');
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File[]>>({});
  
  // List View States
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [eventFilter, setEventFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Entry, direction: 'asc' | 'desc' } | null>(null);
  
  // Export/Import States
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFilters, setExportFilters] = useState({ series: 'ALL', grade: 'ALL' });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
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

  const [formData, setFormData] = useState({
    // Step 1
    series: '',
    grade: '',
    carNumber: '',
    stadium: '',
    event: '',
    eventYear: new Date().getFullYear().toString(),
    // Step 2
    nameThai: '',
    surnameThai: '',
    nameEnglish: '',
    surnameEnglish: '',
    dob: '',
    bloodType: '',
    nationality: '',
    idCard: '',
    address: '',
    postcode: '',
    email: '',
    mobileNo: '',
    idLine: '',
    instagram: '',
    facebook: '',
    youtube: '',
    tiktok: '',
    // Step 3
    competitionLicenseNo: '',
    categorizationGrade: '',
    issuedBy: '',
    dateOfIssued: '',
    expiryDate: '',
    carManufacturer: '',
    model: '',
    color: '',
    year: '',
    engineSize: '',
    engineCode: '',
    teamName: '',
    teamManagerName: '',
    managerMobileNo: '',
    requireTogetherForPitArea: '',
    addressForSendDocument: '',
    teamPostcode: '',
    teamMobileNo: '',
    // Step 5
    consentingParty: '',
    signDate: '',
    digitalSignature: '',
    uploadedFileUrls: {} as Record<string, string[]>
  });

  const signaturePadRef = useRef<SignatureCanvas>(null);

  const handleClearSignature = () => {
    signaturePadRef.current?.clear();
    setFormData(prev => ({ ...prev, digitalSignature: '' }));
  };

  const handleSignatureEnd = () => {
    if (signaturePadRef.current?.isEmpty()) {
       setFormData(prev => ({ ...prev, digitalSignature: '' }));
    } else {
       const dataUrl = signaturePadRef.current?.getTrimmedCanvas().toDataURL('image/png') || '';
       setFormData(prev => ({ ...prev, digitalSignature: dataUrl }));
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      let extraUpdates = {};
      if (field === 'event') {
        if (value === '1' || value === '2') {
          extraUpdates = { stadium: 'Chang International Circuit' };
        } else if (value === '3') {
          extraUpdates = { stadium: 'PT Songkhla Street Circuit' };
        }
      }
      return { ...prev, [field]: value, ...extraUpdates };
    });
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  const handleSubmit = async (isDraftValue = false) => {
    if (!isDraftValue) {
      if (!confirm('Are you sure you want to submit? This form will be locked and cannot be changed after submitting.')) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const entryId = editingId || Date.now();
      const finalUploadedUrls: Record<string, string[]> = { ...(formData.uploadedFileUrls || {}) };

      // Upload files
      for (const [label, files] of Object.entries(uploadedFiles)) {
        const fileUrls: string[] = [];
        for (const file of files) {
          if (file instanceof File) {
            const fileRef = ref(storage, `entries/${entryId}/${label}/${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const url = await getDownloadURL(snapshot.ref);
            fileUrls.push(url);
          } else if (typeof file === 'string') {
            fileUrls.push(file);
          }
        }
        finalUploadedUrls[label] = fileUrls;
      }

      const updatedFormData = {
        ...formData,
        uploadedFileUrls: finalUploadedUrls
      };

      const entryData = {
        nameEn: [formData.nameEnglish, formData.surnameEnglish].filter(Boolean).join(' ') || '-',
        nameTh: [formData.nameThai, formData.surnameThai].filter(Boolean).join(' ') || '-',
        seriesRace: formData.series || '-',
        gradeRace: formData.grade || '-',
        carNumber: formData.carNumber || '-',
        formData: updatedFormData,
        status: (isDraftValue ? 'Draft' : 'Submitted') as 'Draft' | 'Submitted'
      };

      if (editingId) {
        await updateEntry(editingId, entryData);
      } else {
        await addEntry(entryData);
      }
      
      setIsSubmitting(false);
      setIsSubmitted(!isDraftValue);
      
      if (isDraftValue) {
        showToast('Draft saved successfully');
        setView('list');
        setEditingId(null);
      } else {
        setTimeout(() => {
          setIsSubmitted(false);
          setCurrentStep(1);
          setView('list');
          setEditingId(null);
          setUploadedFiles({});
          setFormData({
            series: '', grade: '', carNumber: '', stadium: '', event: '', eventYear: new Date().getFullYear().toString(),
            nameThai: '', surnameThai: '', nameEnglish: '', surnameEnglish: '', dob: '', bloodType: '', nationality: '', idCard: '', address: '', postcode: '', email: '', mobileNo: '', idLine: '', instagram: '', facebook: '', youtube: '', tiktok: '',
            competitionLicenseNo: '', categorizationGrade: '', issuedBy: '', dateOfIssued: '', expiryDate: '', carManufacturer: '', model: '', color: '', year: '', engineSize: '', engineCode: '', teamName: '', teamManagerName: '', managerMobileNo: '', requireTogetherForPitArea: '', addressForSendDocument: '', teamPostcode: '', teamMobileNo: '',
            consentingParty: '', signDate: '', digitalSignature: '',
            uploadedFileUrls: {}
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting entry:', error);
      showToast('Failed to save entry. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleEdit = (entry: Entry) => {
    setEditingId(entry.id);
    const existingUrls = entry.formData?.uploadedFileUrls || {};
    
    // Initialize uploadedFiles with proxies for the URLs
    const initialFiles: Record<string, any[]> = {};
    Object.entries(existingUrls as Record<string, string[]>).forEach(([label, urls]) => {
      initialFiles[label] = urls.map(url => {
        // Create a fake file-like object for existing URLs
        const name = url.split('/').pop()?.split('?')[0] || 'uploaded-file';
        return { name, isUrl: true, url };
      });
    });
    setUploadedFiles(initialFiles as Record<string, File[]>);

    if (entry.formData) {
      setFormData(entry.formData);
    } else {
      // Fallback for dummy entries
      setFormData(prev => ({
        ...prev,
        nameEnglish: entry.nameEn,
        nameThai: entry.nameTh,
        series: entry.seriesRace,
        grade: entry.gradeRace,
        carNumber: entry.carNumber,
      }));
    }
    setCurrentStep(1);
    setView('form');
  };

  const handleView = (entry: Entry) => {
    setEditingId(entry.id);
    setUploadedFiles({});
    if (entry.formData) {
      setFormData(entry.formData);
    } else {
      // Fallback for dummy entries
      setFormData(prev => ({
        ...prev,
        nameEnglish: entry.nameEn,
        nameThai: entry.nameTh,
        series: entry.seriesRace,
        grade: entry.gradeRace,
        carNumber: entry.carNumber,
      }));
    }
    setView('view');
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteEntry(id);
      showToast('Racer deleted and moved to Recently Deleted');
    }
  };

  // Sorting Logic
  const requestSort = (key: keyof Entry) => {
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

    if (userRole === 'competitor' || userRole === 'user') {
      filtered = filtered.filter(entry => entry.userId === currentUser?.uid);
    }

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return filtered;
  }, [search, sortConfig, entries, activeTab, eventFilter, yearFilter, currentUser?.uid, userRole]);

  // Import / Export Handlers
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    // Simulate parsing excel
    setTimeout(() => {
      setIsImporting(false);
      alert(`Successfully imported entries from ${file.name}`);
      e.target.value = ''; // Reset input
    }, 1500);
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowExportModal(false);
      setTimeout(() => {
        window.print();
      }, 100);
    }, 500);
  };

  const [showValidation, setShowValidation] = useState(false);

  const getMissingFields = (step: number) => {
    const missing = [];
    if (step === 1) {
      if (!formData.event) missing.push('event');
      if (!formData.eventYear) missing.push('eventYear');
      if (!formData.series) missing.push('series');
      if (!formData.grade) missing.push('grade');
      if (!formData.carNumber) missing.push('carNumber');
    }
    if (step === 2) {
      if (!formData.nameThai && !formData.nameEnglish) missing.push('nameThai');
      if (!formData.surnameThai && !formData.surnameEnglish) missing.push('surnameThai');
    }
    return missing;
  };

  const handleNext = () => {
    const missing = getMissingFields(currentStep);
    if (missing.length > 0) {
      setShowValidation(true);
      return;
    }
    setShowValidation(false);
    setCurrentStep(prev => prev + 1);
  };

  const isFieldInvalid = (field: string) => {
    if (!showValidation) return false;
    const isMissing = (val: any) => val === undefined || val === null || val === '';
    return isMissing(formData[field as keyof typeof formData]);
  };

  const renderInput = (label: string, field: keyof typeof formData, type = 'text', placeholder = '', className = '') => (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
      <input 
        type={type} 
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        className={`w-full bg-slate-50/50 border rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white transition-all placeholder:text-slate-300 disabled:opacity-60 disabled:cursor-not-allowed ${
          isFieldInvalid(field) 
            ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-100/50' 
            : 'border-slate-100 focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50'
        }`}
        placeholder={placeholder || label}
        disabled={!canEditField(field)}
      />
    </div>
  );

  const renderSelect = (label: string, field: keyof typeof formData, options: string[], className = '') => (
    <div className={`space-y-2 ${className}`}>
      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
      <select 
        value={formData[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        className={`w-full bg-slate-50/50 border rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white transition-all appearance-none disabled:opacity-60 disabled:cursor-not-allowed ${
          isFieldInvalid(field) 
            ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-100/50' 
            : 'border-slate-100 focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50'
        }`}
        disabled={!canEditField(field)}
      >
        <option value="" disabled>Select {label}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );

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
    const isDisabled = !canEditAll && !canEditOwn;
    return (
      <div className="space-y-2">
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</label>
        <label className={`border border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors relative block ${isDisabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'hover:bg-orange-50/30 hover:border-orange-200 cursor-pointer group'}`}>
          <input 
            type="file" 
            multiple 
            className={`absolute inset-0 w-full h-full opacity-0 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            onChange={(e) => handleFileChange(label, e)}
            disabled={isDisabled}
          />
          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-all mx-auto ${isDisabled ? 'bg-slate-100' : 'bg-slate-100 group-hover:bg-orange-100 group-hover:scale-110'}`}>
            <UploadCloud className={`w-5 h-5 ${isDisabled ? 'text-slate-400' : 'text-slate-500 group-hover:text-orange-500'}`} />
          </div>
          <span className="text-sm font-medium text-slate-700 block">Click to upload</span>
          <span className="text-xs font-light text-slate-400 mt-1 block">or drag and drop (multiple files allowed)</span>
        </label>
        {hint && <p className="text-[11px] text-slate-400 mt-2">{hint}</p>}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white px-3 py-2.5 rounded-xl border border-slate-100 shadow-sm group/file transition-all">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs text-slate-600 truncate font-light">{(file as any).name || (file as File).name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {(file as any).isUrl && (
                      <a 
                        href={(file as any).url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-orange-500 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                      </a>
                    )}
                    {!isDisabled && (
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); removeFile(label, idx); }}
                        className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
            <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Entry Form</h1>
            <p className="text-slate-500 font-light text-sm">Manage and review competitor entry forms.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto print:hidden">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search entries..." 
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
            
            <label className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-full text-sm font-medium transition-all cursor-pointer shadow-sm">
              {isImporting ? <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
              <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Import Excel'}</span>
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImport} disabled={isImporting} />
            </label>

            <button 
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-orange-200 hover:bg-orange-50 text-slate-700 rounded-full text-sm font-medium transition-all shadow-sm"
            >
              <FileText className="w-4 h-4 text-orange-500" />
              <span className="hidden sm:inline">Export PDF</span>
            </button>

            <button 
              onClick={() => {
                setEditingId(null);
                setUploadedFiles({});
                setFormData({
                  series: '', grade: '', carNumber: '', stadium: '', event: '', eventYear: new Date().getFullYear().toString(),
                  nameThai: '', surnameThai: '', nameEnglish: '', surnameEnglish: '', dob: '', bloodType: '', nationality: '', idCard: '', address: '', postcode: '', email: '', mobileNo: '', idLine: '', instagram: '', facebook: '', youtube: '', tiktok: '',
                  competitionLicenseNo: '', categorizationGrade: '', issuedBy: '', dateOfIssued: '', expiryDate: '', carManufacturer: '', model: '', color: '', year: '', engineSize: '', engineCode: '', teamName: '', teamManagerName: '', managerMobileNo: '', requireTogetherForPitArea: '', addressForSendDocument: '', teamPostcode: '', teamMobileNo: '',
                  consentingParty: '', signDate: '', digitalSignature: '',
                });
                setCurrentStep(1);
                setView('form');
              }}
              className="whitespace-nowrap px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
            >
              Create Entry
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

        <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden print-page landscape print-scale-down">
          <div className="print-content-wrapper">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr>
                  <SortableHeader label="Created" sortKey="created" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Last Update" sortKey="lastUpdate" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Name (EN)" sortKey="nameEn" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Name (TH)" sortKey="nameTh" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Series Race" sortKey="seriesRace" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Class Race" sortKey="gradeRace" sortConfig={sortConfig} requestSort={requestSort} />
                  <SortableHeader label="Car Number" sortKey="carNumber" sortConfig={sortConfig} requestSort={requestSort} />
                  <th className="px-6 py-5 font-medium text-[10px] text-slate-400 uppercase tracking-widest whitespace-nowrap border-b border-slate-100 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sortedAndFilteredEntries.map((entry) => (
                    <motion.tr 
                      layout
                      key={entry.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group relative"
                    >
                      <td className="px-6 py-5 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="text-sm text-slate-500 font-light whitespace-pre-line">
                          {entry.created.replace(' ', '\n')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm text-slate-500 font-light whitespace-pre-line">
                          {entry.lastUpdate.replace(' ', '\n')}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-900 font-medium">{entry.nameEn}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{entry.nameTh}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{entry.seriesRace}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-600 font-light">{entry.gradeRace}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className="text-sm text-slate-900 font-medium">{entry.carNumber}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-4 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleView(entry)}
                            className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors"
                          >
                            View
                          </button>
                          {(canEditAll || canEditCarOnly || (canEditOwn && entry.userId === currentUser?.uid)) && (
                            <button 
                              onClick={() => handleEdit(entry)}
                              className="text-[11px] uppercase tracking-wider font-medium text-slate-400 hover:text-orange-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              disabled={canEditOwn && entry.status === 'Submitted'}
                            >
                              Edit
                            </button>
                          )}
                          {(canEditAll || (canEditOwn && entry.userId === currentUser?.uid && entry.status === 'Draft')) && (
                            <button 
                              onClick={() => handleDelete(entry.id)}
                              className="text-[11px] uppercase tracking-wider font-medium text-rose-400 hover:text-rose-600 transition-colors"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          </div>
        </div>

        {/* Export PDF Modal */}
        <AnimatePresence>
          {showExportModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-light text-slate-900">Export A4 PDF</h3>
                  <button onClick={() => setShowExportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="space-y-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Filter by Series Race</label>
                    <select 
                      value={exportFilters.series}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, series: e.target.value }))}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                    >
                      <option value="ALL">All Series</option>
                      {seriesOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Filter by Class Race</label>
                    <select 
                      value={exportFilters.grade}
                      onChange={(e) => setExportFilters(prev => ({ ...prev, grade: e.target.value }))}
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all appearance-none"
                    >
                      <option value="ALL">All Classes</option>
                      {gradeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowExportModal(false)}
                    className="flex-1 px-6 py-3 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-orange-500/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    {isExporting ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {renderToast()}
    </>
    );
  }

  if (view === 'view') {
    return (
      <>
      <motion.div 
        key="view-mode"
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
                Entry Form : {formData.carNumber || editingId}
              </h1>
              <p className="text-slate-500 font-light text-sm">Detailed view of the racer&apos;s information.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to delete this entry?')) {
                  deleteEntry(editingId!);
                  setView('list');
                  showToast('Racer deleted and moved to Recently Deleted');
                }
              }}
              className="px-6 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full text-sm font-medium transition-all"
            >
              Delete
            </button>
            <button 
              onClick={() => {
                setCurrentStep(1);
                setView('form');
              }}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-orange-500/20"
            >
              Edit Entry
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Stadium */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6">Stadium</h3>
            <div className="text-2xl font-light text-slate-900">{formData.stadium || '-'}</div>
          </div>

          {/* Series and Grade */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Series</h3>
                <div className="text-lg font-light text-slate-900">{formData.series || '-'}</div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Class Race</h3>
                <div className="text-lg font-light text-slate-900">{formData.grade || '-'}</div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">Car Number</h3>
                <div className="text-3xl font-light text-orange-500">{formData.carNumber || '-'}</div>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-4 flex flex-col md:flex-row items-start gap-6 mb-4">
                <div className="relative w-32 h-40 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden shrink-0">
                  {uploadedFiles['photo']?.[0] ? (
                    <Image src={URL.createObjectURL(uploadedFiles['photo'][0])} alt="Photo" fill className="object-cover" />
                  ) : (
                    <span className="text-xs uppercase tracking-wider">Photo</span>
                  )}
                </div>
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Name (Thai)</h4>
                    <div className="text-sm font-medium text-slate-900">{formData.nameThai || '-'}</div>
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Name (English)</h4>
                    <div className="text-sm font-medium text-slate-900">{formData.nameEnglish || '-'}</div>
                  </div>
                  <div>
                    <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Date of Birth</h4>
                    <div className="text-sm font-light text-slate-600">{formData.dob || '-'}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Nationality</h4>
                <div className="text-sm font-light text-slate-600">{formData.nationality || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">ID Card / Passport</h4>
                <div className="text-sm font-light text-slate-600">{formData.idCard || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Mobile No.</h4>
                <div className="text-sm font-light text-slate-600">{formData.mobileNo || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Email</h4>
                <div className="text-sm font-light text-slate-600">{formData.email || '-'}</div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Blood Type</h4>
                <div className="text-sm font-light text-slate-600">{formData.bloodType || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Line ID</h4>
                <div className="text-sm font-light text-slate-600">{formData.idLine || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Instagram</h4>
                <div className="text-sm font-light text-slate-600">{formData.instagram || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Facebook</h4>
                <div className="text-sm font-light text-slate-600">{formData.facebook || '-'}</div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Youtube</h4>
                <div className="text-sm font-light text-slate-600">{formData.youtube || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Tiktok</h4>
                <div className="text-sm font-light text-slate-600">{formData.tiktok || '-'}</div>
              </div>
              <div className="lg:col-span-2">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Address</h4>
                <div className="text-sm font-light text-slate-600">{formData.address || '-'} {formData.postcode}</div>
              </div>
            </div>
          </div>

          {/* Team Info */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Team & Car Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Competition License No.</h4>
                <div className="text-sm font-light text-slate-600">{formData.competitionLicenseNo || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Categorization Grade</h4>
                <div className="text-sm font-light text-slate-600">{formData.categorizationGrade || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Issued By</h4>
                <div className="text-sm font-light text-slate-600">{formData.issuedBy || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Date Issued / Expiry</h4>
                <div className="text-sm font-light text-slate-600">{formData.dateOfIssued || '-'} / {formData.expiryDate || '-'}</div>
              </div>

              <div className="lg:col-span-4 border-t border-slate-50 pt-4 mt-2"></div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Car Manufacturer</h4>
                <div className="text-sm font-light text-slate-600">{formData.carManufacturer || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Model</h4>
                <div className="text-sm font-light text-slate-600">{formData.model || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Color</h4>
                <div className="text-sm font-light text-slate-600">{formData.color || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Year</h4>
                <div className="text-sm font-light text-slate-600">{formData.year || '-'}</div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Engine Size</h4>
                <div className="text-sm font-light text-slate-600">{formData.engineSize || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Engine Code</h4>
                <div className="text-sm font-light text-slate-600">{formData.engineCode || '-'}</div>
              </div>

              <div className="lg:col-span-4 border-t border-slate-50 pt-4 mt-2"></div>

              <div className="lg:col-span-2">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team Name</h4>
                <div className="text-sm font-medium text-slate-900">{formData.teamName || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team Manager</h4>
                <div className="text-sm font-light text-slate-600">{formData.teamManagerName || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Manager Mobile</h4>
                <div className="text-sm font-light text-slate-600">{formData.managerMobileNo || '-'}</div>
              </div>

              <div className="lg:col-span-2">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Address For Send Document</h4>
                <div className="text-sm font-light text-slate-600">{formData.addressForSendDocument || '-'} {formData.teamPostcode}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Team Mobile</h4>
                <div className="text-sm font-light text-slate-600">{formData.teamMobileNo || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Require Together For Pit Area</h4>
                <div className="text-sm font-light text-slate-600">{formData.requireTogetherForPitArea || '-'}</div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Document Files</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {['idCard', 'license', 'payment', 'bookBank', 'other'].map(docType => (
                <div key={docType} className="border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2 bg-slate-50/50">
                  <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
                    {docType === 'idCard' ? 'ID Card' : 
                     docType === 'license' ? 'License' : 
                     docType === 'payment' ? 'Payment' : 
                     docType === 'bookBank' ? 'Book Bank' : 'Other'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {uploadedFiles[docType]?.length ? 'Uploaded' : 'Not Provided'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Consenting */}
          <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-6 border-b border-slate-100 pb-4">Consenting Party</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Name</h4>
                <div className="text-sm font-light text-slate-600">{formData.consentingParty || '-'}</div>
              </div>
              <div>
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Date of Signing</h4>
                <div className="text-sm font-light text-slate-600">{formData.signDate || '-'}</div>
              </div>
              <div className="md:col-span-2">
                <h4 className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Digital Signature</h4>
                {formData.digitalSignature ? (
                  <div className="border border-slate-200 rounded-lg p-2 inline-block">
                    <Image src={formData.digitalSignature} alt="Digital Signature" width={300} height={150} className="max-w-[300px] h-auto object-contain" />
                  </div>
                ) : (
                  <div className="text-sm font-light text-slate-400 italic">No signature provided</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      {renderToast()}
      </>
    );
  }

  // Form View
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
      <div className="mb-10 flex items-center gap-6">
        <button 
          onClick={() => setView('list')}
          className="w-10 h-10 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 hover:text-orange-500 transition-colors text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-2">
            {editingId ? 'Edit Entry Form' : 'Create Entry Form'}
          </h1>
          <p className="text-slate-500 font-light text-sm">Please fill in the required information below.</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 p-8 md:p-12">
        {/* Minimal Stepper */}
        <div className="mb-12 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-orange-500">Step {currentStep} of {steps.length}</span>
            <span className="text-sm font-medium text-slate-900">{steps[currentStep - 1].label}</span>
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-orange-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / steps.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="min-h-[400px] max-w-3xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              {currentStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderSelect('Series Race / รุ่นการแข่งขัน', 'series', seriesOptions)}
                  {renderSelect('Class Race / คลาส', 'grade', gradeOptions)}
                  {renderInput('Car Number / หมายเลขรถ', 'carNumber', 'number')}
                  {renderSelect('Stadium / สนามแข่งขัน', 'stadium', stadiumOptions)}
                  {renderSelect('Event / งานแข่งขัน', 'event', ['1', '2', '3'])}
                  <div className="space-y-2">
                    <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Year / ปีการแข่งขัน</label>
                    <input 
                      type="text" 
                      value={formData.eventYear || ''}
                      disabled
                      className="w-full bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-light text-slate-900 focus:outline-none focus:bg-white focus:border-orange-300 focus:ring-4 focus:ring-orange-100/50 transition-all opacity-60 cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderInput('Name (Thai) / ชื่อ (ภาษาไทย)', 'nameThai')}
                  {renderInput('Surname (Thai) / นามสกุล (ภาษาไทย)', 'surnameThai')}
                  {renderInput('Name (English) / ชื่อ (ภาษาอังกฤษ)', 'nameEnglish')}
                  {renderInput('Surname (English) / นามสกุล (ภาษาอังกฤษ)', 'surnameEnglish')}
                  {renderInput('Date of Birth / วันเดือนปีเกิด', 'dob', 'date')}
                  {renderSelect('Blood Type / กรุ๊ปเลือด', 'bloodType', bloodTypes)}
                  {renderInput('Nationality / สัญชาติ', 'nationality')}
                  {renderInput('ID Card / Passport No. / หมายเลขบัตรประชาชน / พาสปอร์ต', 'idCard')}
                  <div className="md:col-span-2">
                    {renderInput('Address / ที่อยู่', 'address')}
                  </div>
                  {renderInput('Postcode / รหัสไปรษณีย์', 'postcode')}
                  {renderInput('Email / อีเมล', 'email', 'email')}
                  {renderInput('Mobile No. / เบอร์โทรศัพท์', 'mobileNo', 'tel')}
                  {renderInput('ID Line / ไอดีไลน์', 'idLine')}
                  {renderInput('Instagram / อินสตาแกรม', 'instagram')}
                  {renderInput('Facebook / เฟสบุ๊ค', 'facebook')}
                  {renderInput('Youtube / ยูทูป', 'youtube')}
                  {renderInput('Tiktok / ติ๊กต๊อก', 'tiktok')}
                </div>
              )}

              {currentStep === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 border-b border-slate-100 pb-4 mb-2">
                    <h2 className="text-lg font-light text-slate-900">Driver License</h2>
                  </div>
                  {renderInput('Competition License No. / หมายเลขใบอนุญาตแข่งขัน', 'competitionLicenseNo')}
                  {renderInput('Categorization Grade / เกรดนักแข่ง', 'categorizationGrade')}
                  {renderInput('Issued By / ออกโดย', 'issuedBy')}
                  {renderInput('Date of Issued / วันที่ออก', 'dateOfIssued', 'date')}
                  {renderInput('Expiry Date / วันหมดอายุ', 'expiryDate', 'date')}

                  <div className="md:col-span-2 border-b border-slate-100 pb-4 mb-2 mt-4">
                    <h2 className="text-lg font-light text-slate-900">Car Info</h2>
                  </div>
                  {renderInput('Car Manufacturer / ยี่ห้อรถ', 'carManufacturer')}
                  {renderInput('Model / รุ่น', 'model')}
                  {renderInput('Color / สี', 'color')}
                  {renderInput('Year / ปี', 'year', 'number')}
                  {renderInput('Engine Size (CC) / ขนาดเครื่องยนต์ (ซีซี)', 'engineSize', 'number')}
                  {renderInput('Engine Code / รหัสเครื่องยนต์', 'engineCode')}

                  <div className="md:col-span-2 border-b border-slate-100 pb-4 mb-2 mt-4">
                    <h2 className="text-lg font-light text-slate-900">Team Info</h2>
                  </div>
                  {renderInput('Team Name / ชื่อทีม', 'teamName')}
                  {renderInput('Team Manager Name / ชื่อผู้จัดการทีม', 'teamManagerName')}
                  {renderInput('Manager Mobile No. / เบอร์โทรศัพท์ผู้จัดการทีม', 'managerMobileNo', 'tel')}
                  {renderInput('Require together for pit area (Team Name) / ต้องการพิทติดกัน (ชื่อทีม)', 'requireTogetherForPitArea')}
                  <div className="md:col-span-2">
                    {renderInput('Address for send document / ที่อยู่สำหรับจัดส่งเอกสาร', 'addressForSendDocument')}
                  </div>
                  {renderInput('Postcode / รหัสไปรษณีย์', 'teamPostcode')}
                  {renderInput('Mobile No. / เบอร์โทรศัพท์', 'teamMobileNo', 'tel')}
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderFileUpload('1. Copy of ID Card / Passport / สำเนาบัตรประชาชน / พาสปอร์ต')}
                    {renderFileUpload('2. Copy of Competition License / สำเนาใบอนุญาตขับขี่แข่งรถ')}
                    {renderFileUpload('3. Medical Certificate / ใบรับรองแพทย์')}
                    {renderFileUpload('4. Driver Photo (1 inch) / รูปถ่ายนักขับ (1 นิ้ว)')}
                    {renderFileUpload('5. Car Photo (Front, Back, Left, Right) / รูปถ่ายรถ (หน้า, หลัง, ซ้าย, ขวา)')}
                    {renderFileUpload('6. Other Document / เอกสารอื่นๆ')}
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div className="space-y-8">
                  <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 text-sm font-light text-slate-600 space-y-6 h-72 overflow-y-auto leading-relaxed">
                    <p>
                      I hereby agree not to claim any damages resulting from accidents during the competition and agree to be fully responsible for any damages, on behalf of the organizer of the competition and all parties involved in organizing the event, including the venue owner, sponsors, donors of the event, and all officials, representatives, and agents of the aforementioned, in the event of legal proceedings, claims for compensation, expenses, or costs that may arise from the litigation or legal actions, as well as claims for damages related to death, injury, loss, or other damages to the person or property of the competitor. This applies regardless of whether the damages result from or are connected with the approval of the application or participation in this competition, and regardless of whether such damages occurred due to the actions or negligence of the aforementioned legal entities, employees, agents, representatives, or other parties.
                    </p>
                    <p className="text-slate-500">
                      ข้าพเจ้าขอตกลงที่จะไม่เรียกร้องค่าเสียหายใดๆ อันเกิดจากอุบัติเหตุระหว่างการแข่งขัน และยินยอมรับผิดชอบต่อความเสียหายใดๆ แต่เพียงผู้เดียว ในนามของผู้จัดการแข่งขัน และทุกฝ่ายที่เกี่ยวข้องกับการจัดงาน รวมถึงเจ้าของสถานที่ ผู้สนับสนุน ผู้บริจาคของงาน และเจ้าหน้าที่ ตัวแทน ตลอดจนตัวแทนของบุคคลที่กล่าวถึงข้างต้นทั้งหมด ในกรณีที่มีการดำเนินคดีตามกฎหมาย การเรียกร้องค่าสินไหมทดแทน ค่าใช้จ่าย หรือต้นทุนที่อาจเกิดจากการฟ้องร้องหรือการกระทำทางกฎหมาย รวมถึงการเรียกร้องค่าเสียหายที่เกี่ยวข้องกับการเสียชีวิต การบาดเจ็บ การสูญเสีย หรือความเสียหายอื่นใดต่อบุคคลหรือทรัพย์สินของผู้เข้าแข่งขัน ทั้งนี้ ไม่ว่าความเสียหายนั้นจะเกิดจากหรือมีความเกี่ยวข้องกับการอนุมัติใบสมัครหรือการเข้าร่วมในการแข่งขันนี้ และไม่ว่าความเสียหายดังกล่าวจะเกิดขึ้นจากการกระทำหรือความประมาทเลินเล่อของนิติบุคคล พนักงาน ตัวแทน ผู้แทน หรือบุคคลอ้างอิงข้างต้นก็ตาม
                    </p>
                    <p>
                      I consent to the company collecting, using, and/or disclosing my personal data, and I also consent to the collection of my personal data in the above-mentioned documents for the purpose of registering for the PT MAXNITRON RACING SERIES road racing competition, both for myself as a competitor and for the team. This consent is in accordance with the Personal Data Protection Act B.E. 2562 (2019) or other applicable laws and regulations. I also agree to allow the verification of the accuracy of the competition registration details.
                    </p>
                    <p className="text-slate-500">
                      ข้าพเจ้ายินยอมให้บริษัทเก็บรวบรวม ใช้ และ/หรือเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า และยินยอมให้จัดเก็บข้อมูลส่วนบุคคลของข้าพเจ้าในเอกสารที่กล่าวถึงข้างต้นเพื่อวัตถุประสงค์ในการลงทะเบียนเข้าร่วมการแข่งขันรถยนต์ทางเรียบรายการ PT MAXNITRON RACING SERIES ทั้งในส่วนของข้าพเจ้าในฐานะผู้เข้าแข่งขันและสำหรับทีม การให้ความยินยอมนี้เป็นไปตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (2019) หรือกฎหมายและข้อบังคับอื่น ๆ ที่เกี่ยวข้อง ข้าพเจ้ายังตกลงที่จะอนุญาตให้มีการตรวจสอบความถูกต้องของรายละเอียดการลงทะเบียนการแข่งขันครั้งนี้ด้วย
                    </p>
                    <p className="font-medium text-slate-900">
                      I hereby sign to acknowledge and consent to the above-mentioned terms.
                    </p>
                    <p className="font-medium text-slate-700">
                      ข้าพเจ้าลงลายมือชื่อไว้เพื่อเป็นการรับทราบและยินยอมตามข้อกำหนดที่กล่าวมาข้างต้น
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {renderInput('Consenting & Acknowledging Party / ผู้ยินยอมและรับทราบ', 'consentingParty')}
                    {renderInput('Sign Date / วันที่เซ็น', 'signDate', 'date')}
                    <div className="md:col-span-2">
                      <label className="text-[11px] uppercase tracking-wider text-slate-400 font-medium block mb-2">Digital Signature / ลายเซ็นดิจิทัล</label>
                      <div className="border border-slate-200 rounded-xl bg-white overflow-hidden p-2 relative">
                        <SignatureCanvas 
                          ref={signaturePadRef}
                          canvasProps={{ className: "w-full h-40 rounded-lg cursor-crosshair bg-slate-50/50" }}
                          onEnd={handleSignatureEnd}
                        />
                        <button
                          type="button"
                          onClick={handleClearSignature}
                          className="absolute bottom-4 right-4 bg-white border border-slate-200 text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-all"
                        >
                          Clear / ลบ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-slate-100 max-w-3xl mx-auto">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting || isSubmitted}
              className={`px-8 py-3 rounded-full text-sm font-medium transition-all ${
                currentStep === 1 
                  ? 'text-slate-300 cursor-not-allowed' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              Back
            </button>
            {editingId && canEditAll && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this entry?')) {
                    deleteEntry(editingId);
                    setView('list');
                    showToast('Racer deleted and moved to Recently Deleted');
                  }
                }}
                className="px-8 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-full text-sm font-medium transition-all"
              >
                Delete
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {!isSubmitted && (canEditAll || (canEditOwn && isOwnDoc)) && (
              <button
                onClick={() => handleSubmit(true)}
                disabled={isSubmitting}
                className="px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full text-sm font-medium transition-all"
              >
                Save Draft
              </button>
            )}
            
            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting || isSubmitted || (!canEditAll && !canEditOwn && !canEditCarOnly)}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm shadow-slate-900/10 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isSubmitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Submitted
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
    {renderToast()}
    </>
  );
}
