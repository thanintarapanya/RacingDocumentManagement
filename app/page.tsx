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
  LogOut,
  Scale
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { NotificationDropdown } from '@/components/NotificationDropdown';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';

const LoadingFallback = () => (
  <div className="w-full h-full flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
  </div>
);

const DashboardTab = dynamic(() => import('@/components/tabs/DashboardTab'), { loading: LoadingFallback });
const EntryFormTab = dynamic(() => import('@/components/tabs/EntryFormTab'), { loading: LoadingFallback });
const ChecklistTab = dynamic(() => import('@/components/tabs/ChecklistTab'), { loading: LoadingFallback });
const InspectionTab = dynamic(() => import('@/components/tabs/InspectionTab'), { loading: LoadingFallback });
const WeighInTab = dynamic(() => import('@/components/tabs/WeighInTab'), { loading: LoadingFallback });
const ReportTab = dynamic(() => import('@/components/tabs/ReportTab'), { loading: LoadingFallback });
const RequestTab = dynamic(() => import('@/components/tabs/RequestTab'), { loading: LoadingFallback });
const DeletedTab = dynamic(() => import('@/components/tabs/DeletedTab'), { loading: LoadingFallback });

const SettingsTab = dynamic(() => import('@/components/tabs/SettingsTab'), { loading: LoadingFallback });

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: DashboardTab },
  { id: 'entry-form', label: 'Entry Form', icon: FileText, component: EntryFormTab },
  { id: 'checklist', label: 'Candidate Checklist', icon: CheckSquare, component: ChecklistTab },
  { id: 'weigh-in', label: 'Weigh-in Station', icon: Scale, component: WeighInTab },
  { id: 'inspection', label: 'Inspection Form', icon: ClipboardList, component: InspectionTab },
  { id: 'report', label: 'Scrutineering Report', icon: FileCheck, component: ReportTab },
  { id: 'request', label: 'Competitor Request', icon: MessageSquare, component: RequestTab },
  { id: 'deleted', label: 'Recently Deleted', icon: Trash2, component: DeletedTab },
  { id: 'settings', label: 'Settings', icon: Settings, component: SettingsTab },
];

export default function Home() {
  const router = useRouter();
  const userRole = useAppStore(state => state.userRole);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const availableTabs = useMemo(() => {
    switch (userRole) {
      case 'admin':
      case 'president':
      case 'secretary':
        return TABS;
      case 'head_scrutineer':
      case 'scrutineer_staff':
      case 'offsite_scrutineer':
      case 'steward':
        return TABS.filter(t => ['dashboard', 'entry-form', 'checklist', 'inspection', 'report', 'request', 'settings', 'weigh-in'].includes(t.id));
      case 'competitor':
      case 'user':
        return TABS.filter(t => ['dashboard', 'entry-form', 'inspection', 'request', 'settings'].includes(t.id));
      default:
        return TABS.filter(t => ['dashboard', 'settings'].includes(t.id));
    }
  }, [userRole]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  const ActiveComponent = useMemo(() => {
    return availableTabs.find(t => t.id === activeTab)?.component || DashboardTab;
  }, [activeTab, availableTabs]);

  if (!isMounted) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50 print:h-auto print:overflow-visible print:bg-white">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 240 : 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="glass-panel m-4 mr-2 flex flex-col overflow-hidden border-r border-slate-200 relative z-10 print:hidden"
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
            {availableTabs.filter(t => t.id !== 'settings').map((tab) => (
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
          <RoleSwitcher isSidebarOpen={isSidebarOpen} />
          <button 
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors w-full ${activeTab === 'settings' ? 'bg-slate-100 text-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.1)] border border-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
          >
            <Settings className={`w-5 h-5 flex-shrink-0 ${activeTab === 'settings' ? 'text-orange-500' : ''}`} />
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
            onClick={async () => {
              try {
                await signOut(auth);
                router.push('/login');
              } catch (error) {
                console.error('Error signing out:', error);
              }
            }}
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
        
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <p className={`text-[10px] font-medium text-slate-400 tracking-widest uppercase transition-opacity duration-300 ${!isSidebarOpen ? 'opacity-0 h-0 hidden' : 'opacity-100'}`}>
            Racedoc powered by Embedded Linux Group Co.,Ltd.
          </p>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden m-4 ml-2 relative z-10 print:m-0 print:overflow-visible">
        {/* Topbar */}
        <header className="glass-panel mb-4 h-16 flex items-center justify-between px-6 flex-shrink-0 print:hidden relative z-30">
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
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-indigo-500 border border-slate-200 flex items-center justify-center text-white text-xs font-bold uppercase" title={userRole || 'Guest'}>
              {userRole ? userRole.charAt(0) : 'G'}
            </div>
          </div>
        </header>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto glass-panel p-8 relative print:overflow-visible print:p-0 print:border-none print:shadow-none print:bg-white">
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
