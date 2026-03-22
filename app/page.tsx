'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import * as Tabs from '@radix-ui/react-tabs';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FileText, 
  CheckSquare, 
  ClipboardList, 
  FileCheck, 
  MessageSquare, 
  Trash2,
  Bell,
  Search,
  Settings,
  Menu,
  LogOut
} from 'lucide-react';

const LoadingFallback = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
  </div>
);

const DashboardTab = dynamic(() => import('@/components/tabs/DashboardTab'), { loading: LoadingFallback });
const EntryFormTab = dynamic(() => import('@/components/tabs/EntryFormTab'), { loading: LoadingFallback });
const ChecklistTab = dynamic(() => import('@/components/tabs/ChecklistTab'), { loading: LoadingFallback });
const InspectionTab = dynamic(() => import('@/components/tabs/InspectionTab'), { loading: LoadingFallback });
const ReportTab = dynamic(() => import('@/components/tabs/ReportTab'), { loading: LoadingFallback });
const RequestTab = dynamic(() => import('@/components/tabs/RequestTab'), { loading: LoadingFallback });
const DeletedTab = dynamic(() => import('@/components/tabs/DeletedTab'), { loading: LoadingFallback });

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: DashboardTab },
  { id: 'entry-form', label: 'Entry Form', icon: FileText, component: EntryFormTab },
  { id: 'checklist', label: 'Candidate Checklist', icon: CheckSquare, component: ChecklistTab },
  { id: 'inspection', label: 'Inspection Form', icon: ClipboardList, component: InspectionTab },
  { id: 'report', label: 'Scrutineering Report', icon: FileCheck, component: ReportTab },
  { id: 'request', label: 'Competitor Request', icon: MessageSquare, component: RequestTab },
  { id: 'deleted', label: 'Recently Deleted', icon: Trash2, component: DeletedTab },
];

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const ActiveComponent = useMemo(() => {
    return TABS.find(t => t.id === activeTab)?.component || DashboardTab;
  }, [activeTab]);

  if (!isMounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 240 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-panel m-4 mr-2 flex flex-col overflow-hidden border-r border-slate-200 relative z-10"
      >
        <div className="p-6 flex items-center justify-between border-b border-slate-200">
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="font-medium text-lg tracking-wide whitespace-nowrap"
              >
                RaceDoc
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-y-auto py-4 flex flex-col gap-2 px-3" orientation="vertical">
          <Tabs.List className="flex flex-col gap-2" aria-orientation="vertical">
            {TABS.map((tab) => (
              <Tabs.Trigger
                key={tab.id}
                value={tab.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 outline-none
                  ${activeTab === tab.id 
                    ? 'bg-slate-100 text-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.1)] border border-slate-200' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                  }
                `}
              >
                <tab.icon className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-orange-500' : ''}`} />
                <AnimatePresence>
                  {isSidebarOpen && (
                    <motion.span 
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="whitespace-nowrap font-light text-sm"
                    >
                      {tab.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors w-full">
            <Settings className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="whitespace-nowrap font-light text-sm"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          <button 
            onClick={() => router.push('/login')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors w-full"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.span 
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="whitespace-nowrap font-light text-sm"
                >
                  Sign Out
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden m-4 ml-2 relative z-10">
        {/* Topbar */}
        <header className="glass-panel mb-4 h-16 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search documents, entries, reports..." 
                className="w-full bg-white border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm font-light focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/50 transition-all placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-slate-50 transition-colors">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.5)]"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-indigo-500 border border-slate-200"></div>
          </div>
        </header>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto glass-panel p-8 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="h-full"
            >
              <ActiveComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
