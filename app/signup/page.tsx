'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { auth, db } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get('invite');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [invitedRole, setInvitedRole] = useState<string | null>(null);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // FirebaseProvider will handle the rest (invite verification, role assignment, and redirect)
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to sign up');
      setIsLoading(false);
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

        <form onSubmit={handleSignup} className="space-y-6">
          {!inviteId && error && (
            <div className="p-3 text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading || (inviteId !== null && inviteValid === false)}
            className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-black text-white rounded-full transition-all disabled:opacity-70 disabled:cursor-not-allowed font-light text-sm tracking-wide"
          >
            {isLoading ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign up with Google <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

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
