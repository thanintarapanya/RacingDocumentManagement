'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { Loader2, Bell, Mail, ShieldAlert } from 'lucide-react';

export default function NotificationSettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    inspectionUpdates: true,
    penaltyAlerts: true,
    announcements: true
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists() && userDoc.data().notificationSettings) {
          setSettings(userDoc.data().notificationSettings);
        }
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        notificationSettings: settings
      });
      setMessage({ type: 'success', text: 'Notification preferences updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update preferences.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-medium text-slate-900 mb-1">Notification Preferences</h2>
        <p className="text-sm text-slate-500 mb-6">Choose how you want to be notified about race updates and penalties.</p>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Email Notifications</p>
                <p className="text-xs text-slate-500">Receive summaries and important alerts via email.</p>
              </div>
            </div>
            <button 
              onClick={() => handleToggle('emailNotifications')}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.emailNotifications ? 'bg-orange-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.emailNotifications ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Push Notifications</p>
                <p className="text-xs text-slate-500">Real-time alerts in your browser or mobile device.</p>
              </div>
            </div>
            <button 
              onClick={() => handleToggle('pushNotifications')}
              className={`w-12 h-6 rounded-full transition-colors relative ${settings.pushNotifications ? 'bg-orange-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.pushNotifications ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="pt-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Content Updates</h3>
            <div className="space-y-3">
              {[
                { key: 'inspectionUpdates', label: 'Inspection Status', desc: 'When your car inspection is approved or needs attention.', icon: Bell },
                { key: 'penaltyAlerts', label: 'Penalties & Fines', desc: 'Alerts for any infringements or technical penalties.', icon: ShieldAlert },
                { key: 'announcements', label: 'Race Announcements', desc: 'Official updates from race control and organizers.', icon: Bell }
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <button 
                    onClick={() => handleToggle(item.key as keyof typeof settings)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${settings[item.key as keyof typeof settings] ? 'bg-orange-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings[item.key as keyof typeof settings] ? 'left-5.5' : 'left-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {message.text && (
          <div className={`mt-6 p-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {message.text}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
