'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Scale, Plus, Trash2, Save, Loader2, X, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { db } from '@/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

const SERIES_CATEGORIES = [
  'SIAM GTMC',
  'SIAM GTRC',
  'SIAM TRUCK',
  'SIAM Group A',
  'SIAM Group N',
  'SIAM ECO',
  'ISUZU Challenge Thailand'
];

interface BaseWeightOption {
  title: string;
  condition: string;
  weight: number;
}

interface DynamicWeightOption {
  title: string;
  condition: string;
  weight: number;
}

export default function RulesSettings() {
  const [activeRuleTab, setActiveRuleTab] = useState('weighting');
  const [activeSeriesTab, setActiveSeriesTab] = useState(SERIES_CATEGORIES[0]);
  const [activeYearTab, setActiveYearTab] = useState(new Date().getFullYear().toString());
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [promptModal, setPromptModal] = useState<{isOpen: boolean, title: string, placeholder: string, value: string, onConfirm: (val: string) => void}>({
    isOpen: false, title: '', placeholder: '', value: '', onConfirm: () => {}
  });
  const [config, setConfig] = useState<any>({
    baseWeightPresets: {},
    weightPresets: {},
    customTables: {},
    sponsorStickers: {}
  });
  const [tireBrands, setTireBrands] = useState<string[]>(['Yokohama', 'Hankook', 'Giti']);

  useEffect(() => {
    fetchRules();
    fetchTireRules();
  }, []);

  const fetchTireRules = async () => {
    try {
      const docRef = doc(db, 'settings', 'tire_rules');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().brands) {
        setTireBrands(docSnap.data().brands);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, 'settings', 'weight_rules');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfig(docSnap.data());
      } else {
        // Fallback to empty if nothing exists yet
        setConfig({
          baseWeightPresets: {},
          weightPresets: {},
          customTables: {}
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/weight_rules');
    } finally {
      setIsLoading(false);
    }
  };

  const saveRules = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'weight_rules'), config);
      await setDoc(doc(db, 'settings', 'tire_rules'), { brands: tireBrands });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/weight_rules');
    } finally {
      setIsSaving(false);
    }
  };

  const getBaseWeightsConf = (series: string) => {
    let conf = config.baseWeightPresets[series];
    // Migrate old array into new format if necessary
    if (!conf || Array.isArray(conf)) {
      const rows: any[] = [];
      if (Array.isArray(conf)) {
        conf.forEach((item: any) => {
          rows.push({
            id: Math.random().toString(36).substr(2, 9),
            values: {
              'Category': item.title || '',
              'Condition Details': item.condition || ''
            },
            weight: String(item.weight || ''),
            committeeWeight: ''
          });
        });
      }
      return {
        columns: Array.isArray(conf) && conf.length > 0 ? ['Category', 'Condition Details'] : [],
        rows: rows
      };
    }
    return conf;
  };

  const handleBaseWeightAddColumn = () => {
    setPromptModal({
      isOpen: true,
      title: 'Enter new condition column name',
      placeholder: 'e.g. Engine Capacity, Drivetrain',
      value: '',
      onConfirm: (colName) => {
        if (!colName || colName.trim() === '') return;
        const newConfig = { ...config };
        const conf = getBaseWeightsConf(activeSeriesTab);
        if (!conf.columns.includes(colName)) {
          conf.columns.push(colName);
          newConfig.baseWeightPresets[activeSeriesTab] = conf;
          setConfig(newConfig);
        }
      }
    });
  };

  const handleBaseWeightRemoveColumn = (colName: string) => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.columns = conf.columns.filter((c: string) => c !== colName);
    conf.rows.forEach((r: any) => delete r.values[colName]);
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const moveBaseWeightColumn = (colIdx: number, direction: 'left' | 'right') => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    const newColIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (newColIdx < 0 || newColIdx >= conf.columns.length) return;
    
    const columns = [...conf.columns];
    const temp = columns[colIdx];
    columns[colIdx] = columns[newColIdx];
    columns[newColIdx] = temp;
    conf.columns = columns;
    
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const handleBaseWeightAddRow = () => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.rows.push({
      id: Math.random().toString(36).substr(2, 9),
      values: {},
      weight: '',
      committeeWeight: ''
    });
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const handleBaseWeightRemoveRow = (idx: number) => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.rows.splice(idx, 1);
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const handleBaseWeightRowChange = (idx: number, field: 'weight'|'committeeWeight', value: string) => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.rows[idx][field] = value;
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const handleBaseWeightValueChange = (idx: number, colName: string, value: string) => {
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.rows[idx].values[colName] = value;
    newConfig.baseWeightPresets[activeSeriesTab] = conf;
    setConfig(newConfig);
  };

  const handleDynamicWeightChange = (series: string, index: number, field: string, value: any) => {
    const newConfig = { ...config };
    if (!newConfig.weightPresets[series]) newConfig.weightPresets[series] = [];
    newConfig.weightPresets[series][index] = { ...newConfig.weightPresets[series][index], [field]: value };
    setConfig(newConfig);
  };

  const addDynamicWeight = (series: string) => {
    const newConfig = { ...config };
    if (!newConfig.weightPresets[series]) newConfig.weightPresets[series] = [];
    newConfig.weightPresets[series].push({ title: '', condition: '', weight: 0 });
    setConfig(newConfig);
  };

  const removeDynamicWeight = (series: string, index: number) => {
    const newConfig = { ...config };
    if (newConfig.weightPresets[series]) {
      newConfig.weightPresets[series].splice(index, 1);
      setConfig(newConfig);
    }
  };

  // --- CUSTOM TABLES LOGIC ---
  const getCustomTables = (series: string) => {
    return config.customTables?.[series] || [];
  };

  const addCustomTable = () => {
    const title = `New Section ${Math.floor(Math.random() * 100)}`;
    const newConfig = { ...config };
    if (!newConfig.customTables) newConfig.customTables = {};
    if (!newConfig.customTables[activeSeriesTab]) newConfig.customTables[activeSeriesTab] = [];
    newConfig.customTables[activeSeriesTab].push({
      id: Math.random().toString(36).substr(2, 9),
      title: title,
      selectionType: 'single', // 'single' = radio, 'multiple' = checkbox
      columns: [],
      hasWeight: true,
      hasCommitteeWeight: true,
      rows: []
    });
    setConfig(newConfig);
  };

  const removeCustomTable = (tableIdx: number) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab].splice(tableIdx, 1);
    setConfig(newConfig);
  };

  const updateCustomTableField = (tableIdx: number, field: string, value: any) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab][tableIdx][field] = value;
    setConfig(newConfig);
  };

  const addCustomTableColumn = (tableIdx: number) => {
    setPromptModal({
      isOpen: true,
      title: 'Enter new category column name',
      placeholder: 'e.g. Restrictor Size',
      value: '',
      onConfirm: (colName) => {
        if (!colName || colName.trim() === '') return;
        const newConfig = { ...config };
        const table = newConfig.customTables[activeSeriesTab][tableIdx];
        if (!table.columns.includes(colName)) {
          table.columns.push(colName);
          setConfig(newConfig);
        }
      }
    });
  };

  const removeCustomTableColumn = (tableIdx: number, colName: string) => {
    const newConfig = { ...config };
    const table = newConfig.customTables[activeSeriesTab][tableIdx];
    table.columns = table.columns.filter((c: string) => c !== colName);
    table.rows.forEach((r: any) => delete r.values[colName]);
    setConfig(newConfig);
  };

  const moveCustomTableColumn = (tableIdx: number, colIdx: number, direction: 'left' | 'right') => {
    const newConfig = { ...config };
    const table = newConfig.customTables[activeSeriesTab][tableIdx];
    const newColIdx = direction === 'left' ? colIdx - 1 : colIdx + 1;
    if (newColIdx < 0 || newColIdx >= table.columns.length) return;
    
    const columns = [...table.columns];
    const temp = columns[colIdx];
    columns[colIdx] = columns[newColIdx];
    columns[newColIdx] = temp;
    table.columns = columns;
    
    setConfig(newConfig);
  };

  const addCustomTableRow = (tableIdx: number) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab][tableIdx].rows.push({
      id: Math.random().toString(36).substr(2, 9),
      values: {},
      weight: '',
      committeeWeight: ''
    });
    setConfig(newConfig);
  };

  const removeCustomTableRow = (tableIdx: number, rowIdx: number) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab][tableIdx].rows.splice(rowIdx, 1);
    setConfig(newConfig);
  };

  const updateCustomTableRow = (tableIdx: number, rowIdx: number, field: 'weight'|'committeeWeight', value: string) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab][tableIdx].rows[rowIdx][field] = value;
    setConfig(newConfig);
  };

  const updateCustomTableValue = (tableIdx: number, rowIdx: number, colName: string, value: string) => {
    const newConfig = { ...config };
    newConfig.customTables[activeSeriesTab][tableIdx].rows[rowIdx].values[colName] = value;
    setConfig(newConfig);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const currentBaseWeightsConf = getBaseWeightsConf(activeSeriesTab);
  const currentDynamicWeights = config.weightPresets[activeSeriesTab] || [];
  const currentCustomTables = getCustomTables(activeSeriesTab);

  return (
    <div className="space-y-6 relative">
      {/* Prompt Modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-800">{promptModal.title}</h3>
              <button 
                onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <input
                type="text"
                autoFocus
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all font-medium text-slate-800"
                placeholder={promptModal.placeholder}
                value={promptModal.value}
                onChange={(e) => setPromptModal(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    promptModal.onConfirm(promptModal.value);
                    setPromptModal(prev => ({ ...prev, isOpen: false, value: '' }));
                  }
                }}
              />
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
              <button
                onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors border border-transparent"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  promptModal.onConfirm(promptModal.value);
                  setPromptModal(prev => ({ ...prev, isOpen: false, value: '' }));
                }}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-lg transition-colors shadow-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tabs for rule types */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveRuleTab('weighting')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeRuleTab === 'weighting'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Scale className="w-4 h-4" />
          Weighting Rules
        </button>
        <button
          onClick={() => setActiveRuleTab('marking_tire')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeRuleTab === 'marking_tire'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Plus className="w-4 h-4" />
          Marking Tire
        </button>
        <button
          onClick={() => setActiveRuleTab('sponsor_sticker')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeRuleTab === 'sponsor_sticker'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Tag className="w-4 h-4" />
          Sponsor Sticker
        </button>
      </div>

      {activeRuleTab === 'weighting' && (
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Series Navigation */}
          <div className="xl:w-64 flex-shrink-0">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Series</h3>
            <div className="flex flex-row xl:flex-col gap-1 overflow-x-auto xl:overflow-x-visible pb-2 xl:pb-0 scrollbar-hide">
              {SERIES_CATEGORIES.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveSeriesTab(category)}
                  className={`flex-shrink-0 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeSeriesTab === category
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Configuration Form */}
          <div className="flex-1 space-y-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-light text-slate-900">{activeSeriesTab} Weight Rules</h3>
                <p className="text-sm text-slate-500 mt-1">Configure base minimum weights and dynamic penalties.</p>
              </div>
              <button 
                onClick={saveRules}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>

            {/* Base Minimum Weights */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <div className="flex flex-col">
                  <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Base Minimum Weights</h4>
                  <p className="text-xs text-slate-500 mt-1">Configure columns based on the series&apos; unique conditions.</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleBaseWeightAddColumn}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Category Column
                  </button>
                  <button 
                    onClick={handleBaseWeightAddRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 border border-orange-200 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Rule Row
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {currentBaseWeightsConf.columns.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-xs font-medium text-slate-500 mr-2 flex items-center">Active Condition Columns:</span>
                    {currentBaseWeightsConf.columns.map((col: string, colIdx: number) => (
                      <div key={col} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                        {colIdx > 0 && (
                          <button onClick={() => moveBaseWeightColumn(colIdx, 'left')} className="text-slate-400 hover:text-orange-500 -ml-0.5">
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                        )}
                        <span className="text-xs font-medium text-slate-700">{col}</span>
                        {colIdx < currentBaseWeightsConf.columns.length - 1 && (
                          <button onClick={() => moveBaseWeightColumn(colIdx, 'right')} className="text-slate-400 hover:text-orange-500">
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => handleBaseWeightRemoveColumn(col)} className="text-slate-400 hover:text-red-500 ml-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {currentBaseWeightsConf.rows.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No base weights configured.</p>
                ) : currentBaseWeightsConf.columns.length === 0 ? (
                  <p className="text-sm text-amber-500 py-4 text-center border border-dashed border-amber-200 bg-amber-50 rounded-xl">Please add a Condition Column first to start defining rules.</p>
                ) : (
                  <div className="overflow-x-auto pb-4">
                    <table className="w-full text-left bg-white border border-slate-200 rounded-xl text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-xs uppercase tracking-wider">
                        <tr>
                          {currentBaseWeightsConf.columns.map((col: string) => (
                            <th key={col} className="px-4 py-3 min-w-[150px]">{col}</th>
                          ))}
                          <th className="px-4 py-3 min-w-[120px] border-l border-slate-200">Fix weight (kg)</th>
                          <th className="px-4 py-3 min-w-[150px]">Vary Weight (+kg)</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentBaseWeightsConf.rows.map((row: any, idx: number) => (
                          <tr key={row.id || idx} className="hover:bg-slate-50/50">
                            {currentBaseWeightsConf.columns.map((col: string) => (
                              <td key={col} className="px-4 py-2">
                                <input 
                                  type="text" 
                                  value={row.values[col] || ''} 
                                  onChange={(e) => handleBaseWeightValueChange(idx, col, e.target.value)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder-slate-300"
                                  placeholder="e.g. 4 สูบ / Turbo"
                                />
                              </td>
                            ))}
                            <td className="px-4 py-2 border-l border-slate-200">
                              <input 
                                type="text" 
                                value={row.weight || ''} 
                                onChange={(e) => handleBaseWeightRowChange(idx, 'weight', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono placeholder-slate-300"
                                placeholder="e.g. 1040 or -"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input 
                                type="text" 
                                value={row.committeeWeight || ''} 
                                onChange={(e) => handleBaseWeightRowChange(idx, 'committeeWeight', e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono placeholder-slate-300"
                                placeholder="e.g. +100kg"
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button 
                                onClick={() => handleBaseWeightRemoveRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Weights */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Dynamic Rules</h4>
                <button 
                  onClick={() => addDynamicWeight(activeSeriesTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Rule
                </button>
              </div>
              
              <div className="space-y-3">
                {currentDynamicWeights.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No dynamic weights configured.</p>
                )}
                {currentDynamicWeights.map((w: DynamicWeightOption, idx: number) => (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex-1 w-full relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Category</label>
                      <input 
                        type="text" 
                        value={w.title} 
                        onChange={(e) => handleDynamicWeightChange(activeSeriesTab, idx, 'title', e.target.value)}
                        className="w-full pl-3 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                        placeholder="e.g. รายการ"
                      />
                    </div>
                    <div className="flex-[2] w-full relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Rule</label>
                      <input 
                        type="text" 
                        value={w.condition} 
                        onChange={(e) => handleDynamicWeightChange(activeSeriesTab, idx, 'condition', e.target.value)}
                        className="w-full pl-3 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                        placeholder="e.g. ระบบเบรก ABS"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Weight (+/-)</label>
                      <input 
                        type="number" 
                        value={w.weight} 
                        onChange={(e) => handleDynamicWeightChange(activeSeriesTab, idx, 'weight', Number(e.target.value))}
                        className={`w-full pl-8 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all ${w.weight > 0 ? 'text-rose-600' : w.weight < 0 ? 'text-emerald-600' : ''}`}
                      />
                      <span className="absolute left-3 top-1/2 mt-1 -translate-y-1/2 text-sm font-medium text-slate-400">
                        {w.weight > 0 ? '+' : ''}
                      </span>
                    </div>
                    <button 
                      onClick={() => removeDynamicWeight(activeSeriesTab, idx)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Extra Tables */}
            <div className="pt-8 mb-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-medium text-slate-900 tracking-tight">Additional Rules & Specifics</h4>
                  <p className="text-xs text-slate-500 mt-1">Create multiple tables for specific series requirements (e.g. Restrictor rules).</p>
                </div>
                <button 
                  onClick={addCustomTable}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Add New Table
                </button>
              </div>

              <div className="space-y-8">
                {currentCustomTables.length === 0 && (
                  <p className="text-sm text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50">No additional rule tables configured yet.</p>
                )}
                {currentCustomTables.map((table: any, tableIdx: number) => (
                  <div key={table.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Table Header Section */}
                    <div className="bg-slate-50 border-b border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={table.title}
                            onChange={(e) => updateCustomTableField(tableIdx, 'title', e.target.value)}
                            className="text-base font-semibold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-orange-500 focus:bg-white outline-none px-2 py-1 transition-all w-full md:w-1/2"
                            placeholder="Table Title (e.g., Restrictor Rules)"
                          />
                        </div>
                        <button 
                          onClick={() => removeCustomTable(tableIdx)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete Table"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-4 text-sm bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-700">Selection Type:</span>
                          <select 
                            value={table.selectionType} 
                            onChange={(e) => updateCustomTableField(tableIdx, 'selectionType', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="single">Single Choice (Radio)</option>
                            <option value="multiple">Multiple Choice (Checkboxes)</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-4 ml-auto">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={table.hasWeight} 
                              onChange={(e) => updateCustomTableField(tableIdx, 'hasWeight', e.target.checked)}
                              className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-slate-600">Fix weight</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={table.hasCommitteeWeight} 
                              onChange={(e) => updateCustomTableField(tableIdx, 'hasCommitteeWeight', e.target.checked)}
                              className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                            />
                            <span className="text-slate-600">Vary Weight</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Table Controls */}
                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs font-medium text-slate-500 mr-2 flex items-center">Active Columns:</span>
                        {table.columns.map((col: string, colIdx: number) => (
                          <div key={col} className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                            {colIdx > 0 && (
                              <button onClick={() => moveCustomTableColumn(tableIdx, colIdx, 'left')} className="text-slate-400 hover:text-orange-500 -ml-1">
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}
                            {col}
                            {colIdx < table.columns.length - 1 && (
                              <button onClick={() => moveCustomTableColumn(tableIdx, colIdx, 'right')} className="text-slate-400 hover:text-orange-500 ml-0.5">
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            <button onClick={() => removeCustomTableColumn(tableIdx, col)} className="text-slate-400 hover:text-red-500 ml-1">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => addCustomTableColumn(tableIdx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Column
                        </button>
                        <button 
                          onClick={() => addCustomTableRow(tableIdx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 border border-orange-200 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Row
                        </button>
                      </div>
                    </div>

                    {/* Table Data */}
                    <div className="p-4">
                      {table.rows.length === 0 ? (
                        <p className="text-sm text-slate-400 py-4 text-center">No rows added yet.</p>
                      ) : table.columns.length === 0 ? (
                        <p className="text-sm text-amber-500 py-4 text-center bg-amber-50 rounded border border-amber-100">Please add a Category Column first.</p>
                      ) : (
                        <div className="overflow-x-auto pb-2">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="text-slate-500 font-medium text-xs uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                {table.columns.map((col: string) => (
                                  <th key={col} className="px-3 py-2 pb-3 min-w-[150px]">{col}</th>
                                ))}
                                {table.hasWeight && <th className="px-3 py-2 pb-3 min-w-[120px] border-l border-slate-200">Fix weight (kg)</th>}
                                {table.hasCommitteeWeight && <th className="px-3 py-2 pb-3 min-w-[150px] border-l border-slate-200">Vary Weight (+kg)</th>}
                                <th className="px-3 py-2 pb-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {table.rows.map((row: any, rowIdx: number) => (
                                <tr key={row.id || rowIdx} className="hover:bg-slate-50/50">
                                  {table.columns.map((col: string) => (
                                    <td key={col} className="px-3 py-2">
                                      <input 
                                        type="text" 
                                        value={row.values[col] || ''} 
                                        onChange={(e) => updateCustomTableValue(tableIdx, rowIdx, col, e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder-slate-300"
                                      />
                                    </td>
                                  ))}
                                  {table.hasWeight && (
                                    <td className="px-3 py-2 border-l border-slate-200">
                                      <input 
                                        type="text" 
                                        value={row.weight || ''} 
                                        onChange={(e) => updateCustomTableRow(tableIdx, rowIdx, 'weight', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono placeholder-slate-300"
                                      />
                                    </td>
                                  )}
                                  {table.hasCommitteeWeight && (
                                    <td className="px-3 py-2 border-l border-slate-200">
                                      <input 
                                        type="text" 
                                        value={row.committeeWeight || ''} 
                                        onChange={(e) => updateCustomTableRow(tableIdx, rowIdx, 'committeeWeight', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-200 rounded focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all font-mono placeholder-slate-300"
                                      />
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-right">
                                    <button 
                                      onClick={() => removeCustomTableRow(tableIdx, rowIdx)}
                                      className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
      {activeRuleTab === 'sponsor_sticker' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-light text-slate-900">Sponsor Sticker Guides</h3>
                <p className="text-sm text-slate-500 mt-1">Upload and manage sticker layout guides for each series and year.</p>
              </div>
              <button 
                onClick={saveRules}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              <div className="lg:w-48 flex-shrink-0 space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Year</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                    {['2024', '2025', '2026', '2027', '2028'].map(year => (
                      <button
                        key={year}
                        onClick={() => setActiveYearTab(year)}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          activeYearTab === year
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Series</h4>
                  <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
                    {SERIES_CATEGORIES.map(category => (
                      <button
                        key={category}
                        onClick={() => setActiveSeriesTab(category)}
                        className={`flex-shrink-0 text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                          activeSeriesTab === category
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 underline decoration-orange-500/0 hover:decoration-orange-500/50 underline-offset-4'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-6 border-l border-slate-100 lg:pl-8">
                <div className="bg-slate-50/50 rounded-2xl p-8 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center group transition-all hover:border-orange-200">
                  <div className="mb-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Tag className="w-8 h-8 text-orange-500" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-slate-900 mb-2">Guide for {activeSeriesTab} ({activeYearTab})</h4>
                  <p className="text-sm text-slate-500 max-w-xs mb-6 font-light">Upload the sponsor sticker placement layout. This will be visible to scrutineers during inspection.</p>
                  
                  {config.sponsorStickers?.[activeYearTab]?.[activeSeriesTab] ? (
                    <div className="relative w-full max-w-md aspect-[3/2] rounded-xl overflow-hidden border border-slate-200 shadow-lg group-hover:shadow-xl transition-all mb-4">
                      <Image 
                        src={config.sponsorStickers[activeYearTab][activeSeriesTab]} 
                        alt="Sticker Guide Preview" 
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-slate-900/40 transition-opacity flex items-center justify-center gap-3 z-10">
                        <label className="bg-white text-slate-900 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-50 transition-colors">
                          Replace Image
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const base64 = event.target?.result as string;
                                  const newConfig = { ...config };
                                  if (!newConfig.sponsorStickers) newConfig.sponsorStickers = {};
                                  if (!newConfig.sponsorStickers[activeYearTab]) newConfig.sponsorStickers[activeYearTab] = {};
                                  newConfig.sponsorStickers[activeYearTab][activeSeriesTab] = base64;
                                  setConfig(newConfig);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>
                        <button 
                          onClick={() => {
                            const newConfig = { ...config };
                            delete newConfig.sponsorStickers[activeYearTab][activeSeriesTab];
                            setConfig(newConfig);
                          }}
                          className="bg-white text-red-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-800 transition-all shadow-md active:scale-95">
                      Upload Guide Image
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const base64 = event.target?.result as string;
                              const newConfig = { ...config };
                              if (!newConfig.sponsorStickers) newConfig.sponsorStickers = {};
                              if (!newConfig.sponsorStickers[activeYearTab]) newConfig.sponsorStickers[activeYearTab] = {};
                              newConfig.sponsorStickers[activeYearTab][activeSeriesTab] = base64;
                              setConfig(newConfig);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {activeRuleTab === 'marking_tire' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col md:w-2/3 lg:w-1/2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-light text-slate-900">Marking Tire Configuration</h3>
              <p className="text-sm text-slate-500 mt-1">Configure the tire brands that can be used in the event.</p>
            </div>
            <button 
              onClick={saveRules}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Active Tire Brands</h4>
              <button 
                onClick={() => {
                  setPromptModal({
                    isOpen: true,
                    title: 'Add New Tire Brand',
                    placeholder: 'e.g. Michelin',
                    value: '',
                    onConfirm: (brand) => {
                      if (!brand || brand.trim() === '') return;
                      if (!tireBrands.includes(brand)) {
                        setTireBrands([...tireBrands, brand]);
                      }
                    }
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium hover:bg-orange-100 border border-orange-200 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Brand
              </button>
            </div>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              {tireBrands.length === 0 ? (
                <p className="text-sm text-slate-400 py-2 text-center">No tire brands configured. Add some above.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {tireBrands.map((brand: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm w-full sm:w-auto min-w-[200px]">
                      <span className="font-medium text-slate-700">{brand}</span>
                      <button 
                        onClick={() => {
                          setTireBrands(tireBrands.filter(b => b !== brand));
                        }}
                        className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-md transition-colors ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
