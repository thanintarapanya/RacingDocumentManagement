'use client';

import { motion } from 'motion/react';
import { 
  Users, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  ArrowUpRight,
  ArrowDownRight
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

const data = [
  { name: 'Mon', entries: 40, approved: 24 },
  { name: 'Tue', entries: 30, approved: 13 },
  { name: 'Wed', entries: 20, approved: 98 },
  { name: 'Thu', entries: 27, approved: 39 },
  { name: 'Fri', entries: 18, approved: 48 },
  { name: 'Sat', entries: 23, approved: 38 },
  { name: 'Sun', entries: 34, approved: 43 },
];

export default function DashboardTab() {
  const { entries } = useAppStore();

  const stats = [
    { title: 'Total Entries', value: entries.length.toString(), icon: Users, trend: '+12%', positive: true },
    { title: 'Approved', value: '184', icon: CheckCircle, trend: '+5%', positive: true },
    { title: 'Pending Review', value: '42', icon: Clock, trend: '-2%', positive: false },
    { title: 'Issues Found', value: '12', icon: AlertTriangle, trend: '+1%', positive: false },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-500 font-light text-sm">Overview of 24H Series - Dubai 2026</p>
        </div>
        <button className="px-4 py-2 bg-orange-500/20 text-orange-500 border border-orange-500/30 rounded-lg hover:bg-orange-500/30 transition-colors text-sm font-medium">
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="glass-panel p-6 lg:col-span-2"
        >
          <h3 className="text-lg font-medium text-slate-900 mb-6">Entry Submissions</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
            {[
              { text: 'New entry submitted by Team Porsche', time: '10 mins ago', type: 'entry' },
              { text: 'Scrutineering passed for Car #42', time: '1 hour ago', type: 'success' },
              { text: 'Missing roll cage cert for Car #12', time: '2 hours ago', type: 'warning' },
              { text: 'Competitor request: Number change', time: '3 hours ago', type: 'info' },
            ].map((activity, i) => (
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
    </div>
  );
}
