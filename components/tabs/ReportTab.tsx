'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, Printer, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { db, auth } from '@/firebase';
import { collection, onSnapshot, query, orderBy, setDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

interface Report {
  id: string;
  team: string;
  car: string;
  class: string;
  status: string;
  date: string;
  weight: string;
  restrictor: string;
  userId?: string;
}

export default function ReportTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'reports'), orderBy('date', 'desc'));
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

  const generateDummyReport = async () => {
    if (!auth.currentUser) return;
    const newId = `RPT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    const statuses = ['Passed', 'Failed', 'Pending'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    try {
      await setDoc(doc(db, 'reports', newId), {
        team: 'Team ' + Math.floor(Math.random() * 100),
        car: '#' + Math.floor(Math.random() * 99),
        class: Math.random() > 0.5 ? 'GT3' : 'GT4',
        status: randomStatus,
        date: new Date().toISOString().split('T')[0],
        weight: randomStatus === 'Failed' ? '1245kg (Under)' : '1260kg',
        restrictor: '38mm',
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Scrutineering Reports</h1>
          <p className="text-slate-500 font-light text-sm">Post-inspection compliance documents.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={generateDummyReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-sm text-slate-700"
          >
            <FileText className="w-4 h-4" /> Generate Report
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors text-sm text-slate-700 hidden md:flex">
            <Download className="w-4 h-4" /> Export All
          </button>
          <button className="flex items-center gap-2 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all shadow-sm shadow-orange-500/20 text-sm font-medium">
            <Printer className="w-4 h-4" /> Print Batch
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : reports.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-500 font-light">
          No reports found. Click &quot;Generate Report&quot; to create one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report, i) => (
            <motion.div 
              key={report.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 30 }}
              className="glass-panel p-6 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-medium text-sm border ${
                    report.status === 'Passed' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' :
                    report.status === 'Failed' ? 'bg-rose-500/20 text-rose-500 border-rose-500/30' :
                    'bg-amber-500/20 text-amber-500 border-amber-500/30'
                  }`}>
                    {report.car}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-slate-800">{report.id}</h3>
                    <p className="text-xs text-slate-500">{report.date}</p>
                  </div>
                </div>
                {report.status === 'Passed' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                ) : report.status === 'Failed' ? (
                  <XCircle className="w-5 h-5 text-rose-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                )}
              </div>

              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-slate-900">{report.team}</p>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Class</p>
                    <p className="text-sm text-slate-700">{report.class}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Weight</p>
                    <p className={`text-sm ${report.weight.includes('Under') ? 'text-rose-500' : 'text-slate-700'}`}>{report.weight}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Restrictor</p>
                    <p className="text-sm text-slate-700">{report.restrictor}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Seals</p>
                    <p className="text-sm text-emerald-500">Intact</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition-colors flex items-center justify-center gap-2">
                  <FileText className="w-3 h-3" /> View PDF
                </button>
                <button className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition-colors flex items-center justify-center gap-2">
                  <Printer className="w-3 h-3" /> Print
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
