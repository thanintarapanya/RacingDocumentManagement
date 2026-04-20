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

  const handleBaseWeightChange = (series: string, index: number, field: string, value: any) => {
    const newConfig = { ...config };
    if (!newConfig.baseWeightPresets[series]) newConfig.baseWeightPresets[series] = [];
    newConfig.baseWeightPresets[series][index] = { ...newConfig.baseWeightPresets[series][index], [field]: value };
    setConfig(newConfig);
  };

  const addBaseWeight = (series: string) => {
    const newConfig = { ...config };
    if (!newConfig.baseWeightPresets[series]) newConfig.baseWeightPresets[series] = [];
    newConfig.baseWeightPresets[series].push({ title: '', condition: '', weight: 0 });
    setConfig(newConfig);
  };

  const removeBaseWeight = (series: string, index: number) => {
    const newConfig = { ...config };
    if (newConfig.baseWeightPresets[series]) {
      newConfig.baseWeightPresets[series].splice(index, 1);
      setConfig(newConfig);
    }
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

  const currentBaseWeights = config.baseWeightPresets[activeSeriesTab] || [];
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
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-widest">Base Minimum Weights</h4>
                <button 
                  onClick={() => addBaseWeight(activeSeriesTab)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Base Weight
                </button>
              </div>
              
              <div className="space-y-3">
                {currentBaseWeights.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No base weights configured.</p>
                )}
                {currentBaseWeights.map((w: BaseWeightOption, idx: number) => (
                  <div key={idx} className="flex flex-wrap md:flex-nowrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div className="flex-1 w-full relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Category</label>
                      <input 
                        type="text" 
                        value={w.title} 
                        onChange={(e) => handleBaseWeightChange(activeSeriesTab, idx, 'title', e.target.value)}
                        className="w-full pl-3 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                        placeholder="e.g. ความจุรถ"
                      />
                    </div>
                    <div className="flex-[2] w-full relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Condition Details</label>
                      <input 
                        type="text" 
                        value={w.condition} 
                        onChange={(e) => handleBaseWeightChange(activeSeriesTab, idx, 'condition', e.target.value)}
                        className="w-full pl-3 pr-3 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                        placeholder="e.g. ไม่เกิน 1,210 cc."
                      />
                    </div>
                    <div className="flex-1 min-w-[120px] relative">
                      <label className="text-[10px] uppercase font-bold text-slate-400 absolute left-3 top-1.5">Weight (kg)</label>
                      <input 
                        type="number" 
                        value={w.weight} 
                        onChange={(e) => handleBaseWeightChange(activeSeriesTab, idx, 'weight', Number(e.target.value))}
                        className="w-full pl-3 pr-8 pt-6 pb-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all" 
                      />
                      <span className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-xs text-slate-400">kg</span>
                    </div>
                    <button 
                      onClick={() => removeBaseWeight(activeSeriesTab, idx)}
                      className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
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
