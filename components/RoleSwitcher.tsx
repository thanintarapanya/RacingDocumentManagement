'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { auth, db } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const ROLES = [
  'admin',
  'president',
  'secretary',
  'head_scrutineer',
  'scrutineer_staff',
  'steward',
  'competitor'
];

export function RoleSwitcher({ isSidebarOpen }: { isSidebarOpen: boolean }) {
  const userRole = useAppStore(state => state.userRole);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    if (!auth.currentUser) return;
    
    setIsUpdating(true);
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, { role: newRole });
      // The FirebaseProvider will automatically pick up the change and update the store
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role. Check console for details.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-slate-200">
      <div className="flex items-center gap-3 text-slate-500 mb-2">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-orange-500" />
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.span 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="whitespace-nowrap font-medium text-xs uppercase tracking-wider text-slate-400"
            >
              Dev Role Switcher
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden"
          >
            <select
              value={userRole || ''}
              onChange={handleRoleChange}
              disabled={isUpdating}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 appearance-none cursor-pointer"
            >
              {ROLES.map(role => (
                <option key={role} value={role}>
                  {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
            {isUpdating && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
