'use client';

import { useState } from 'react';
import { auth } from '@/firebase';
import { updatePassword, multiFactor, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier } from 'firebase/auth';
import { Lock, Smartphone, Loader2, ShieldCheck } from 'lucide-react';

export default function PrivacySettings() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [mfaMessage, setMfaMessage] = useState({ type: '', text: '' });

  const handleChangePassword = async () => {
    if (!auth.currentUser) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    try {
      await updatePassword(auth.currentUser, newPassword);
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setPasswordMessage({ type: 'error', text: 'Please sign out and sign in again to change your password.' });
      } else {
        setPasswordMessage({ type: 'error', text: error.message || 'Failed to update password.' });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
    }
  };

  const handleSendVerificationCode = async () => {
    if (!auth.currentUser) return;
    setIsEnabling2FA(true);
    setMfaMessage({ type: '', text: '' });
    try {
      setupRecaptcha();
      const appVerifier = window.recaptchaVerifier;
      const multiFactorSession = await multiFactor(auth.currentUser).getSession();
      const phoneInfoOptions = {
        phoneNumber,
        session: multiFactorSession
      };
      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const vid = await phoneAuthProvider.verifyPhoneNumber(phoneInfoOptions, appVerifier);
      setVerificationId(vid);
      setMfaMessage({ type: 'success', text: 'Verification code sent to your phone.' });
    } catch (error: any) {
      console.error(error);
      setMfaMessage({ type: 'error', text: error.message || 'Failed to send verification code. Ensure phone number is valid (e.g. +1234567890) and MFA is enabled in Firebase Console.' });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!auth.currentUser || !verificationId) return;
    setIsEnabling2FA(true);
    setMfaMessage({ type: '', text: '' });
    try {
      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(auth.currentUser).enroll(multiFactorAssertion, 'Personal Phone');
      setMfaMessage({ type: 'success', text: '2-Factor Authentication enabled successfully!' });
      setVerificationId('');
      setVerificationCode('');
      setPhoneNumber('');
    } catch (error: any) {
      setMfaMessage({ type: 'error', text: error.message || 'Failed to verify code.' });
    } finally {
      setIsEnabling2FA(false);
    }
  };

  const isMfaEnabled = auth.currentUser ? multiFactor(auth.currentUser).enrolledFactors.length > 0 : false;

  return (
    <div className="max-w-2xl space-y-12">
      {/* Change Password */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-medium text-slate-900">Change Password</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">Update your password to keep your account secure.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
            />
          </div>
        </div>

        {passwordMessage.text && (
          <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            {passwordMessage.text}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleChangePassword}
            disabled={isChangingPassword || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </div>
      </div>

      {/* 2-Factor Authentication */}
      <div className="pt-8 border-t border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-medium text-slate-900">Two-Factor Authentication (2FA)</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">Add an extra layer of security to your account using SMS OTP.</p>
        
        {isMfaEnabled ? (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-sm font-medium text-emerald-900">2FA is Enabled</h3>
              <p className="text-xs text-emerald-700">Your account is protected with multi-factor authentication.</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
            <div id="recaptcha-container"></div>
            
            {!verificationId ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleSendVerificationCode}
                      disabled={isEnabling2FA || !phoneNumber}
                      className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                    >
                      {isEnabling2FA && <Loader2 className="w-4 h-4 animate-spin" />}
                      Send Code
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Include country code (e.g., +1 for US, +66 for TH).</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification Code</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="123456"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all tracking-widest"
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={isEnabling2FA || !verificationCode}
                      className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isEnabling2FA && <Loader2 className="w-4 h-4 animate-spin" />}
                      Verify & Enable
                    </button>
                  </div>
                </div>
              </div>
            )}

            {mfaMessage.text && (
              <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${mfaMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {mfaMessage.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
