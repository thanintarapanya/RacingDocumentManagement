'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingLine, setIsLoadingLine] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingGoogle(true);
    setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setIsLoadingGoogle(false);
    }
  };

  const handleLineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingLine(true);
    setError(null);
    
    try {
      const provider = new OAuthProvider('oidc.line');
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('LINE login error:', err);
      setError(err.message || 'Failed to sign in with LINE');
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
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">RaceDoc</h1>
          <p className="text-slate-400 font-light text-sm tracking-wide">Sign in to your account</p>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl text-center">
              {error}
            </div>
          )}

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoadingGoogle || isLoadingLine}
            className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-black text-white rounded-full transition-all disabled:opacity-70 disabled:cursor-not-allowed font-light text-sm tracking-wide mt-4"
          >
            {isLoadingGoogle ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign in with Google <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button 
            onClick={handleLineLogin}
            disabled={isLoadingGoogle || isLoadingLine}
            className="w-full flex items-center justify-center gap-3 py-4 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-full transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide"
          >
            {isLoadingLine ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign in with LINE <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="mt-16 text-center space-y-4">
          <p className="text-xs text-slate-400 font-light tracking-wide">
            Don&apos;t have an account? <button onClick={() => router.push('/signup')} className="text-slate-900 hover:text-orange-500 transition-colors">Sign up</button>
          </p>
          <p className="text-xs text-slate-400 font-light tracking-wide">
            Need help? <a href="#" className="text-slate-900 hover:text-orange-500 transition-colors">Contact Support</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
