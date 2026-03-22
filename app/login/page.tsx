'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
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
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">RaceDoc</h1>
          <p className="text-slate-400 font-light text-sm tracking-wide">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-10">
          {error && (
            <div className="p-3 text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl text-center">
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-slate-900 hover:bg-black text-white rounded-full transition-all disabled:opacity-70 disabled:cursor-not-allowed font-light text-sm tracking-wide mt-4"
          >
            {isLoading ? (
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Sign in with Google <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-16 text-center">
          <p className="text-xs text-slate-400 font-light tracking-wide">
            Don&apos;t have an account? <a href="#" className="text-slate-900 hover:text-orange-500 transition-colors">Contact Support</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
