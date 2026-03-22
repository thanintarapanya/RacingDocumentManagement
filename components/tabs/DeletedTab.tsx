'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { Trash2, RotateCcw, FileText, AlertTriangle, Clock } from 'lucide-react';

export default function DeletedTab() {
  const { deletedItems, restoreItem } = useAppStore();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = (id: string) => {
    setRestoringId(id);
    setTimeout(() => {
      restoreItem(id);
      setRestoringId(null);
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2 flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-rose-500" /> Recently Deleted
          </h1>
          <p className="text-slate-500 font-light text-sm">Recover soft-deleted documents within 7 days.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-500 font-medium">
          <AlertTriangle className="w-4 h-4" /> Items permanently deleted after 7 days
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        {deletedItems.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Trash2 className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">Trash is Empty</h3>
            <p className="text-sm text-slate-500 font-light">No recently deleted items found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Document Type</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Name / Reference</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Deleted By</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Deleted At</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap">Expires In</th>
                  <th className="p-4 font-medium text-sm text-slate-700 whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {deletedItems.map((item) => (
                    <motion.tr 
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-50 flex items-center justify-center text-slate-500">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-medium text-slate-800">{item.type}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-700">{item.name}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-500">{item.deletedBy}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-slate-500">{item.deletedAt}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-rose-500 text-sm">
                          <Clock className="w-4 h-4" /> {item.expires}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleRestore(item.id)}
                          disabled={restoringId === item.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg transition-all text-sm font-medium disabled:opacity-50"
                        >
                          {restoringId === item.id ? (
                            <motion.div animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <RotateCcw className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                          Restore
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
