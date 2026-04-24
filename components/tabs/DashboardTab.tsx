'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Wallet,
  Grid
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, auth } from '@/firebase';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';

export default function DashboardTab() {
  const { entries, userRole } = useAppStore();
  
  const [requests, setRequests] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [racingResults, setRacingResults] = useState<any[]>([]);
  const [successBallastRules, setSuccessBallastRules] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!auth.currentUser || userRole === null) return;

    let requestsQuery;
    let inspectionsQuery;

    if (userRole === 'competitor' || userRole === 'user') {
      requestsQuery = query(collection(db, 'requests'), where('userId', '==', auth.currentUser.uid));
      inspectionsQuery = query(collection(db, 'car_inspections'), where('userId', '==', auth.currentUser.uid));
    } else {
      requestsQuery = query(collection(db, 'requests'));
      inspectionsQuery = query(collection(db, 'car_inspections'));
    }

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      setRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'requests'));

    const unsubInspections = onSnapshot(inspectionsQuery, (snapshot) => {
      setInspections(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'car_inspections'));

    const unsubResults = onSnapshot(collection(db, 'racing_results'), (snapshot) => {
      setRacingResults(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const fetchRules = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const docSnap = await getDoc(doc(db, 'settings', 'success_ballast_rules'));
        if (docSnap.exists()) {
          setSuccessBallastRules(docSnap.data().rules || {});
        }
      } catch (e) {
        console.error("Error fetching rules:", e);
      }
    };
    fetchRules();

    let unsubReports = () => {};
    if (userRole !== 'competitor' && userRole !== 'user') {
      unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
        setReports(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'reports'));
    }

    // Role Update logic
    const handleRoleUpdate = async () => {
      const { getDocs, updateDoc, doc } = await import('firebase/firestore');
      
      const email1 = 'tartib.thanintarapanya@gmail.com'; // Try lowercase
      const q1 = query(collection(db, 'users'), where('email', '==', email1));
      const qs1 = await getDocs(q1);
      qs1.forEach(async (userDoc) => {
        if (userDoc.data().role !== 'competitor') {
          await updateDoc(doc(db, 'users', userDoc.id), { role: 'competitor' });
          console.log('Role updated for ' + email1);
        }
      });
      // Try capitalized just in case
      const email1_alt = 'Tartib.thanintarapanya@gmail.com';
      const q1_alt = query(collection(db, 'users'), where('email', '==', email1_alt));
      const qs1_alt = await getDocs(q1_alt);
      qs1_alt.forEach(async (userDoc) => {
        if (userDoc.data().role !== 'competitor') {
          await updateDoc(doc(db, 'users', userDoc.id), { role: 'competitor' });
          console.log('Role updated for ' + email1_alt);
        }
      });

      const email2 = 'info@embeddedlinuxgroup.com';
      const q2 = query(collection(db, 'users'), where('email', '==', email2));
      const qs2 = await getDocs(q2);
      qs2.forEach(async (userDoc) => {
        if (userDoc.data().role !== 'admin') {
          await updateDoc(doc(db, 'users', userDoc.id), { role: 'admin' });
          console.log('Role updated for ' + email2);
        }
      });
    };
    handleRoleUpdate();

    return () => {
      unsubRequests();
      unsubReports();
      unsubInspections();
      unsubResults();
    };
  }, [userRole]);

  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => setNow(Date.now()), 0);
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const activities = useMemo(() => {
    const allActivities = [
      ...entries.map(e => ({
        text: `New entry submitted by ${e.nameEn || 'Unknown'}`,
        time: new Date((e as any).createdAt || e.created || now).getTime(),
        type: 'entry'
      })),
      ...inspections.map(i => ({
        text: `Inspection created for Car #${i.carNumber}`,
        time: new Date(i.createdAt || now).getTime(),
        type: 'success'
      })),
      ...reports.map(r => ({
        text: `Scrutineering report for ${r.stadium}`,
        time: new Date(r.createdAt || now).getTime(),
        type: r.failedCars?.length > 0 ? 'warning' : 'success'
      })),
      ...requests.map(r => ({
        text: `Competitor request: ${r.status}`,
        time: new Date(r.createdAt || now).getTime(),
        type: 'info'
      }))
    ];

    allActivities.sort((a, b) => b.time - a.time);
    
    const formattedActivities = allActivities.slice(0, 4).map(a => {
      const diff = now - a.time;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      const days = Math.floor(hours / 24);
      
      let timeStr = 'Just now';
      if (days > 0) timeStr = `${days} days ago`;
      else if (hours > 0) timeStr = `${hours} hours ago`;
      else if (mins > 0) timeStr = `${mins} mins ago`;

      return { ...a, time: timeStr };
    });

    if (formattedActivities.length === 0) {
      return [{ text: 'No recent activity', time: '', type: 'info' }];
    }
    return formattedActivities;
  }, [entries, inspections, reports, requests, now]);

  const chartData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const newData = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);
      
      const dayName = days[d.getDay()];
      
      const dayEntries = entries.filter(e => {
        const time = new Date((e as any).createdAt || e.created || now).getTime();
        return time >= d.getTime() && time < nextD.getTime();
      }).length;
      
      const dayApproved = requests.filter(r => {
        const time = new Date(r.createdAt || now).getTime();
        return r.status === 'Approved' && time >= d.getTime() && time < nextD.getTime();
      }).length;
      
      newData.push({
        name: dayName,
        entries: dayEntries,
        approved: dayApproved
      });
    }
    
    return newData;
  }, [entries, requests, now]);

  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const issuesFoundCount = reports.reduce((acc, r) => acc + (r.failedCars?.length || 0), 0);
  const inspectionsSubmittedCount = inspections.filter(i => i.status !== 'Draft').length;

  const isCompetitor = userRole === 'competitor' || userRole === 'user';

  const competitorWeightData = useMemo(() => {
    if (!isCompetitor || inspections.length === 0) return null;
    
    // We assume the competitor has at least one inspection they are looking at
    // Usually a competitor sees their own car's requirement
    const ins = inspections[0]; // Current competitor's car inspection
    if (!ins || !ins.formData) return null;

    const calculateWeight = (raceNum: number) => {
      let bop = Number(ins.formData.baseWeight || 0);
      ins.formData.dynamicWeights?.forEach((d: any) => {
        if (d.isChecked) bop += Number(d.weight || 0);
      });
      if (ins.formData.customTablesData && ins.formData.customTablesSelections) {
        ins.formData.customTablesData.forEach((table: any) => {
          const selections = ins.formData.customTablesSelections[table.id];
          if (selections) {
            table.rows.forEach((row: any) => {
              const isSelected = table.selectionType === 'single' ? selections === row.id : (Array.isArray(selections) && selections.includes(row.id));
              if (isSelected) {
                if (table.hasWeight) bop += Number(row.weight || 0);
                if (table.hasCommitteeWeight) bop += Number(row.committeeWeight || 0);
              }
            });
          }
        });
      }

      let autoBallast = 0;
      const rules = successBallastRules[ins.series] || { rank1: 30, rank2: 20, rank3: 10 };
      racingResults.forEach(r => {
        if (r.series === ins.series && Number(r.raceNumber) < raceNum) {
          const rank = r.results?.[ins.carNumber];
          if (rank === 1) autoBallast += rules.rank1;
          else if (rank === 2) autoBallast += rules.rank2;
          else if (rank === 3) autoBallast += rules.rank3;
        }
      });
      return bop + autoBallast + Number(ins.formData.successBallast || 0);
    };

    // Current race is usually the one after the last recorded result or default to 1
    const lastRaceNum = racingResults.reduce((max, r) => Math.max(max, Number(r.raceNumber)), 0);
    const currentRace = lastRaceNum + 1;
    
    return {
      current: calculateWeight(currentRace),
      next: calculateWeight(currentRace + 1)
    };
  }, [isCompetitor, inspections, racingResults, successBallastRules]);

  const stats = isCompetitor ? [
    { title: 'My Entries', value: entries.length.toString(), icon: Users, trend: '+0%', positive: true },
    { title: 'My Total Inspections', value: inspections.length.toString(), icon: CheckCircle, trend: '+0%', positive: true },
    { title: 'My Pending Requests', value: pendingCount.toString(), icon: Clock, trend: 'Active', positive: true },
    { title: 'Approved Requests', value: approvedCount.toString(), icon: CheckCircle, trend: 'Final', positive: true },
  ] : [
    { title: 'Total Entries', value: entries.length.toString(), icon: Users, trend: '+12%', positive: true },
    { title: 'Approved Requests', value: approvedCount.toString(), icon: CheckCircle, trend: '+5%', positive: true },
    { title: 'Pending Requests', value: pendingCount.toString(), icon: Clock, trend: '-2%', positive: false },
    { title: 'Submited Inspections', value: inspectionsSubmittedCount.toString(), icon: AlertTriangle, trend: '+1%', positive: false },
  ];

  return (
    <div className="print-page print-scale-down portrait">
    <div className="space-y-8 w-full h-full print-content-wrapper">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-500 font-light text-sm">Overview of 24H Series - Dubai 2026</p>
        </div>
        {!isCompetitor && (
          <button onClick={() => window.print()} className="px-4 py-2 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors text-sm font-medium print:hidden">
            Export Report
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <stat.icon className="w-16 h-16 text-orange-500" />
            </div>
            <div className="relative z-10">
              <p className="text-sm text-slate-500 font-light mb-1">{stat.title}</p>
              <h3 className="text-3xl font-medium text-slate-900 mb-4">{stat.value}</h3>
              <div className={`flex items-center text-xs ${stat.positive ? 'text-emerald-500' : 'text-rose-500'}`}>
                {stat.positive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                <span>{stat.trend} from last week</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {isCompetitor ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel p-6 lg:col-span-2"
          >
            <h3 className="text-lg font-medium text-slate-900 mb-6">Race Summary & Requirements</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Details</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Current Race Req.</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Next Race Req.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {requests.filter(r => r.fineAmount > 0 || r.gridPenalty > 0 || r.penalty).length > 0 ? (
                    requests.filter(r => r.fineAmount > 0 || r.gridPenalty > 0 || r.penalty).map(r => (
                      <tr key={r.id}>
                        <td className="py-4 font-medium text-slate-900 text-sm">Penalty / {r.requestPermissionTopic}</td>
                        <td className="py-4 text-sm text-slate-600">
                          <div className="space-y-1">
                            {r.fineAmount > 0 && <p>Fine: {r.fineAmount.toLocaleString()} THB</p>}
                            {r.gridPenalty > 0 && <p>Grid: {r.gridPenalty} Positions</p>}
                            {r.penalty && <p>Reason: {r.penalty}</p>}
                          </div>
                        </td>
                        <td className="py-4 text-center text-slate-900 font-bold">
                          {competitorWeightData?.current ? `${competitorWeightData.current.toFixed(1)} kg` : '-'}
                        </td>
                        <td className="py-4 text-center text-slate-900 font-bold">
                          {competitorWeightData?.next ? `${competitorWeightData.next.toFixed(1)} kg` : '-'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-sm italic">No active penalties or requirements found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel p-6"
          >
            <h3 className="text-lg font-medium text-slate-900 mb-6">Recent Activity</h3>
            <div className="space-y-6">
              {activities.map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                    activity.type === 'entry' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' :
                    activity.type === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                    activity.type === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                    'bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.8)]'
                  }`} />
                  <div>
                    <p className="text-sm text-slate-800 font-light">{activity.text}</p>
                    <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 print:grid-cols-3 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel p-6 lg:col-span-2 print:col-span-2"
          >
            <h3 className="text-lg font-medium text-slate-900 mb-6">Entry Submissions</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEntries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', backdropFilter: 'blur(8px)' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Area type="monotone" dataKey="entries" stroke="#f97316" fillOpacity={1} fill="url(#colorEntries)" />
                  <Area type="monotone" dataKey="approved" stroke="#10b981" fillOpacity={1} fill="url(#colorApproved)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 300, damping: 30 }}
            className="glass-panel p-6"
          >
            <h3 className="text-lg font-medium text-slate-900 mb-6">Recent Activity</h3>
            <div className="space-y-6">
              {activities.map((activity, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`w-2 h-2 mt-2 rounded-full flex-shrink-0 ${
                    activity.type === 'entry' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' :
                    activity.type === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                    activity.type === 'warning' ? 'bg-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                    'bg-indigo-500 shadow-[0_0_8px_rgba(129,140,248,0.8)]'
                  }`} />
                  <div>
                    <p className="text-sm text-slate-800 font-light">{activity.text}</p>
                    <p className="text-xs text-slate-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Removed separate penalty section as it's now integrated or redundant for competitor */}
      {!isCompetitor && requests.some(r => r.fineAmount > 0 || r.gridPenalty > 0 || r.penalty) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 30 }}
          className="glass-panel p-6 border-rose-100 bg-rose-50/10"
        >
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-medium text-slate-900">Current Penalties & Fines</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {requests.filter(r => r.fineAmount > 0 || r.gridPenalty > 0 || r.penalty).map((r, i) => (
              <div key={r.id} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <AlertTriangle className="w-12 h-12 text-rose-500" />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Request #{r.id}</span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.requestPermissionTopic}</span>
                  </div>
                  
                  {r.fineAmount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium leading-none mb-1">Fine Amount</p>
                        <p className="text-sm font-semibold text-slate-900">{r.fineAmount.toLocaleString()} THB</p>
                      </div>
                    </div>
                  )}

                  {r.gridPenalty > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                        <Grid className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium leading-none mb-1">Grid Penalty</p>
                        <p className="text-sm font-semibold text-slate-900">{r.gridPenalty} Positions</p>
                      </div>
                    </div>
                  )}

                  {r.penalty && (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-medium leading-none mb-1">Other Punishment</p>
                        <p className="text-sm font-medium text-slate-700">{r.penalty}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
    </div>
  );
}
