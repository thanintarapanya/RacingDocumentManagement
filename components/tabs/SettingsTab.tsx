'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { db, auth } from '@/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { 
  Users, 
  Shield, 
  Search, 
  Filter, 
  Mail, 
  Copy, 
  CheckCircle2, 
  Trash2,
  Plus,
  UserCircle,
  Lock,
  Scale
} from 'lucide-react';
import AccountSettings from './settings/AccountSettings';
import PrivacySettings from './settings/PrivacySettings';
import RulesSettings from './settings/RulesSettings';
import NotificationSettings from './settings/NotificationSettings';

const ROLES = [
  'admin',
  'president',
  'secretary',
  'head_scrutineer',
  'scrutineer_staff',
  'offsite_scrutineer',
  'steward',
  'competitor'
];

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  displayName?: string;
}

interface Invitation {
  id: string;
  role: string;
  createdBy: string;
  createdAt: string;
  used: boolean;
}

export default function SettingsTab() {
  const userRole = useAppStore(state => state.userRole);
  const [activeSubTab, setActiveSubTab] = useState('account');
  
  // Users State
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Invite State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('competitor');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const canManageUsers = ['admin', 'president', 'secretary'].includes(userRole || '');

  useEffect(() => {
    if (!canManageUsers || !auth.currentUser) return;

    const qUsers = query(collection(db, 'users'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() } as User);
      });
      setUsers(usersData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const qInvites = query(collection(db, 'invitations'));
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      const invitesData: Invitation[] = [];
      snapshot.forEach((doc) => {
        invitesData.push({ id: doc.id, ...doc.data() } as Invitation);
      });
      setInvitations(invitesData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'invitations'));

    return () => {
      unsubUsers();
      unsubInvites();
    };
  }, [canManageUsers]);

  const handleGenerateInvite = async () => {
    if (!auth.currentUser) return;
    
    const inviteId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newInvite: Invitation = {
      id: inviteId,
      role: inviteRole,
      createdBy: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
      used: false
    };

    try {
      await setDoc(doc(db, 'invitations', inviteId), newInvite);
      const link = `${window.location.origin}/signup?invite=${inviteId}`;
      setGeneratedLink(link);

      if (inviteEmail) {
        const subject = encodeURIComponent("You're invited to join RaceDoc");
        const body = encodeURIComponent(`Hello,\n\nYou have been invited to join RaceDoc as a ${inviteRole.replace('_', ' ')}.\n\nPlease click the link below to sign up:\n${link}\n\nBest regards,\nRaceDoc Team`);
        window.location.href = `mailto:${inviteEmail}?subject=${subject}&body=${body}`;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'invitations');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteInvite = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invitations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'invitations');
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = searchQuery === '' || 
                          (user.email && user.email.toLowerCase().includes(searchLower)) || 
                          (user.displayName && user.displayName.toLowerCase().includes(searchLower));
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="h-full flex flex-col max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">Settings</h1>
        <p className="text-slate-500 font-light text-sm">Manage application settings and users.</p>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        {/* Settings Sidebar */}
        <div className="w-64 flex-shrink-0 border-r border-slate-200 pr-6">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSubTab('account')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeSubTab === 'account' 
                  ? 'bg-orange-50 text-orange-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <UserCircle className="w-5 h-5" />
              Account
            </button>
            <button
              onClick={() => setActiveSubTab('privacy')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeSubTab === 'privacy' 
                  ? 'bg-orange-50 text-orange-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Lock className="w-5 h-5" />
              Privacy
            </button>
            <button
              onClick={() => setActiveSubTab('notifications')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeSubTab === 'notifications' 
                  ? 'bg-orange-50 text-orange-600' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Mail className="w-5 h-5" />
              Notifications
            </button>
            {canManageUsers && (
              <>
                <button
                  onClick={() => setActiveSubTab('users')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeSubTab === 'users' 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  User & Role
                </button>
                <button
                  onClick={() => setActiveSubTab('rules')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeSubTab === 'rules' 
                      ? 'bg-orange-50 text-orange-600' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Scale className="w-5 h-5" />
                  Rules
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto pb-12 pr-4 scrollbar-hide">
          {activeSubTab === 'account' && <AccountSettings />}
          {activeSubTab === 'privacy' && <PrivacySettings />}
          {activeSubTab === 'notifications' && <NotificationSettings />}
          {activeSubTab === 'rules' && canManageUsers && <RulesSettings />}
          {activeSubTab === 'users' && canManageUsers && (
            <div className="space-y-8">
              {/* Header Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search users..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="bg-white border border-slate-200 rounded-full py-2 pl-10 pr-8 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all appearance-none"
                    >
                      <option value="all">All Roles</option>
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-full text-sm font-medium transition-all shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Invite User
                </button>
              </div>

              {/* Users Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined Date</th>
                        <th className="px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-orange-700 font-medium text-sm">
                                {(user.email || user.displayName || 'U').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="text-sm font-medium text-slate-900">{user.displayName || 'Unknown'}</div>
                                <div className="text-xs text-slate-500">{user.email || 'No email provided'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                              {user.role.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-500 text-sm">
                            No users found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Invitations */}
              {invitations.filter(i => !i.used).length > 0 && (
                <div className="mt-12">
                  <h3 className="text-lg font-medium text-slate-900 mb-4">Active Invitations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {invitations.filter(i => !i.used).map(invite => (
                      <div key={invite.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 capitalize">
                            Role: {invite.role.replace('_', ' ')}
                          </span>
                          <button 
                            onClick={() => handleDeleteInvite(invite.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Revoke Invitation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">
                          Created: {new Date(invite.createdAt).toLocaleDateString()}
                        </div>
                        <div className="mt-auto pt-2 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-mono text-slate-400 truncate pr-2">
                            ...{invite.id.slice(-8)}
                          </span>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${invite.id}`);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="text-xs font-medium text-orange-600 hover:text-orange-700 flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy Link
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
            >
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Generate Invite Link</h2>
              <p className="text-sm text-slate-500 mb-6">Create a unique link to invite a new user and automatically assign them a role.</p>
              
              {!generatedLink ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address (Optional)</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                    >
                      {ROLES.map(role => (
                        <option key={role} value={role}>
                          {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => setIsInviteModalOpen(false)}
                      className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleGenerateInvite}
                      className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      {inviteEmail ? 'Generate & Send' : 'Generate Link'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-emerald-900">Link Generated Successfully</h3>
                      <p className="text-xs text-emerald-700 mt-1">Send this link to the user. It can only be used once.</p>
                    </div>
                  </div>
                  
                  <div className="relative">
                    <input 
                      type="text" 
                      readOnly 
                      value={generatedLink}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 text-sm font-mono text-slate-600 focus:outline-none"
                    />
                    <button 
                      onClick={copyToClipboard}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-orange-500 transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsInviteModalOpen(false);
                      setGeneratedLink('');
                    }}
                    className="w-full px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors mt-4"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
