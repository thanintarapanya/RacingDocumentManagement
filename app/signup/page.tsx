'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, AlertCircle, Mail, Lock } from 'lucide-react';
import { auth, db } from '@/firebase';
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup, OAuthProvider } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('invite');
  
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingLine, setIsLoadingLine] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [invitedRole, setInvitedRole] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const checkInvite = async () => {
      if (!inviteId) {
        setInviteValid(false);
        return;
      }
      try {
        const inviteDoc = await getDoc(doc(db, 'invitations', inviteId));
        if (inviteDoc.exists() && !inviteDoc.data().used) {
          setInviteValid(true);
          setInvitedRole(inviteDoc.data().role);
          sessionStorage.setItem('pendingInvite', inviteId);
        } else {
          setInviteValid(false);
          setError('This invitation link is invalid or has already been used.');
        }
      } catch (err) {
        console.error('Error checking invite:', err);
        setInviteValid(false);
        setError('Failed to verify invitation.');
      }
    };
    checkInvite();
  }, [inviteId]);

  const handleGoogleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingGoogle(true);
    setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // FirebaseProvider will handle the rest
    } catch (err: any) {
      console.error('Google signup error:', err);
      setError(err.message || 'Failed to sign up with Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    
    setIsLoadingEmail(true);
    setError(null);
    
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // FirebaseProvider will handle the rest
    } catch (err: any) {
      console.error('Email signup error:', err);
      setError(err.message || 'Failed to sign up with email');
      setIsLoadingEmail(false);
    }
  };

  const handleLineSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingLine(true);
    setError(null);
    
    try {
      const provider = new OAuthProvider('oidc.line');
      await signInWithPopup(auth, provider);
      // FirebaseProvider will handle the rest
    } catch (err: any) {
      console.error('LINE signup error:', err);
      setError(err.message || 'Failed to sign up with LINE');
      setIsLoadingLine(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-6">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">RaceDoc</h1>
          <p className="text-slate-400 font-light text-sm tracking-wide">
            {inviteValid ? 'Accept your invitation' : 'Sign up as a Competitor'}
          </p>
        </div>

        {inviteId && inviteValid === true && (
          <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-emerald-900">Valid Invitation</h3>
              <p className="text-xs text-emerald-700 mt-1">
                You have been invited to join as a <span className="font-semibold capitalize">{invitedRole?.replace('_', ' ')}</span>.
              </p>
            </div>
          </div>
        )}

        {inviteId && inviteValid === false && error && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-rose-900">Invalid Link</h3>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {!inviteId && error && (
            <div className="p-3 text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                />
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoadingEmail || isLoadingGoogle || isLoadingLine || (inviteId !== null && inviteValid === false)}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide"
            >
              {isLoadingEmail ? (
                <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign up with Email <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#FAFAFA] text-slate-500 font-light">Or continue with</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignup}
            disabled={isLoadingGoogle || isLoadingEmail || isLoadingLine || (inviteId !== null && inviteValid === false)}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide"
          >
            {isLoadingGoogle ? (
              <div className="w-4 h-4 border border-slate-300 border-t-slate-700 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </>
            )}
          </button>

          <button 
            type="button"
            onClick={handleLineSignup}
            disabled={isLoadingGoogle || isLoadingEmail || isLoadingLine || (inviteId !== null && inviteValid === false)}
            className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide mt-3"
          >
            {isLoadingLine ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign up with LINE <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-slate-400 font-light tracking-wide">
            Already have an account? <button onClick={() => router.push('/login')} className="text-slate-900 hover:text-orange-500 transition-colors">Sign in</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]"><div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
