'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Scale, Plus, Trash2, Save, Loader2 } from 'lucide-react';
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
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<any>({
    baseWeightPresets: {},
    weightPresets: {}
  });

  useEffect(() => {
    fetchRules();
  }, []);

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
          weightPresets: {}
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
    const colName = window.prompt('Enter new condition column name (e.g. Engine Capacity, Drivetrain):');
    if (!colName || colName.trim() === '') return;
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    if (!conf.columns.includes(colName)) {
      conf.columns.push(colName);
      newConfig.baseWeightPresets[activeSeriesTab] = conf;
      setConfig(newConfig);
    }
  };

  const handleBaseWeightRemoveColumn = (colName: string) => {
    if (!window.confirm(`Remove column "${colName}"?`)) return;
    const newConfig = { ...config };
    const conf = getBaseWeightsConf(activeSeriesTab);
    conf.columns = conf.columns.filter((c: string) => c !== colName);
    conf.rows.forEach((r: any) => delete r.values[colName]);
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const currentBaseWeightsConf = getBaseWeightsConf(activeSeriesTab);
  const currentDynamicWeights = config.weightPresets[activeSeriesTab] || [];

  return (
    <div className="space-y-6">
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
                    {currentBaseWeightsConf.columns.map((col: string) => (
                      <div key={col} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded shadow-sm">
                        <span className="text-xs font-medium text-slate-700">{col}</span>
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
                          <th className="px-4 py-3 min-w-[120px] border-l border-slate-200">Min. Weight (kg)</th>
                          <th className="px-4 py-3 min-w-[150px]">Committee Weight (+kg)</th>
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
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Dynamic Penalties / Bonuses</h4>
                <button 
                  onClick={() => addDynamicWeight(activeSeriesTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Penalty
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
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Rule / Penalty</label>
                      <input 
                        type="text" 
                        value={w.condition} 
                        onChange={(e) => handleDynamicWeightChange(activeSeriesTab, idx, 'condition', e.target.value)}
                        className="w-full pl-3 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                        placeholder="e.g. ระบบเบรก ABS"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Value (+/-)</label>
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

          </div>
        </div>
      )}
    </div>
  );
}
