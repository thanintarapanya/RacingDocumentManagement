'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase';
import { doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { updateProfile, deleteUser } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '@/lib/firebase-utils';
import { AlertTriangle, Save, Loader2 } from 'lucide-react';

export default function AccountSettings() {
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const { userRole } = useAppStore();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      setIsLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setDisplayName(data.displayName || auth.currentUser.displayName || '');
          setPhoneNumber(data.phoneNumber || '');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      // Update Auth Profile
      await updateProfile(auth.currentUser, { displayName });
      
      // Update Firestore Document
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName,
        phoneNumber
      });
      
      setMessage({ type: 'success', text: 'Account details updated successfully.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update account details.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    const confirmed = window.confirm('Are you sure you want to delete your account? This action cannot be undone.');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const uid = auth.currentUser.uid;
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', uid));
      // Delete from Auth
      await deleteUser(auth.currentUser);
      // User will be redirected by the auth state listener in FirebaseProvider
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        alert('Please sign out and sign in again to delete your account.');
      } else {
        alert(error.message || 'Failed to delete account.');
      }
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  }

  const getAccountId = (uid: string) => {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
      hash = Math.imul(31, hash) + uid.charCodeAt(i) | 0;
    }
    return Math.abs(hash).toString().slice(0, 5).padStart(5, '0');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Account Details</h2>
        <p className="text-sm text-slate-500 mb-6">Update your personal information and contact details.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 234 567 8900"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Account ID (For Support)</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-500 select-all">
              {auth.currentUser?.uid ? getAccountId(auth.currentUser.uid) : '-'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Role</label>
            <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 capitalize">
              {userRole?.replace('_', ' ') || 'Unknown'}
            </div>
          </div>
        </div>

        {message.text && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {message.text}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      <div className="pt-8 border-t border-slate-200">
        <h2 className="text-lg font-medium text-rose-600 mb-1">Danger Zone</h2>
        <p className="text-sm text-slate-500 mb-6">Permanently delete your account and all associated data.</p>
        
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-rose-900 mb-1">Delete Account</h3>
            <p className="text-sm text-rose-700 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete My Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
