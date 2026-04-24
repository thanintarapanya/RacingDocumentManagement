'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowRight, Mail, Lock, Globe } from 'lucide-react';
import { auth } from '@/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, sendPasswordResetEmail, signInWithPopup, OAuthProvider } from 'firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [isLoadingLine, setIsLoadingLine] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lang, setLang] = useState<'EN' | 'TH'>('EN');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const t = {
    EN: {
      title: 'RaceDoc',
      subtitle: 'Sign in to your account',
      resetSubtitle: 'Reset your password',
      emailPlaceholder: 'Email address',
      passwordPlaceholder: 'Password',
      forgotPassword: 'Forgot Password?',
      signInEmail: 'Sign in with Email',
      sendReset: 'Send Reset Link',
      backToSignIn: 'Back to sign in',
      orContinue: 'Or continue with',
      signInGoogle: 'Google',
      signInLine: 'Sign in with LINE',
      noAccount: "Don't have an account?",
      signUp: 'Sign up',
      needHelp: 'Need help?',
      contactSupport: 'Contact Support',
      emailRequired: 'Please enter your email address first',
      resetSent: 'Password reset email sent. Please check your inbox.',
      errorGoogle: 'Failed to sign in with Google',
      errorEmail: 'Failed to sign in with email',
      errorLine: 'Failed to sign in with LINE',
      errorReset: 'Failed to send password reset email'
    },
    TH: {
      title: 'RaceDoc',
      subtitle: 'เข้าสู่ระบบบัญชีของคุณ',
      resetSubtitle: 'รีเซ็ตรหัสผ่านของคุณ',
      emailPlaceholder: 'อีเมล',
      passwordPlaceholder: 'รหัสผ่าน',
      forgotPassword: 'ลืมรหัสผ่าน?',
      signInEmail: 'เข้าสู่ระบบด้วยอีเมล',
      sendReset: 'ส่งลิงก์รีเซ็ตรหัสผ่าน',
      backToSignIn: 'กลับไปหน้าเข้าสู่ระบบ',
      orContinue: 'หรือเข้าสู่ระบบด้วย',
      signInGoogle: 'Google',
      signInLine: 'เข้าสู่ระบบด้วย LINE',
      noAccount: "ยังไม่มีบัญชี?",
      signUp: 'สมัครสมาชิก',
      needHelp: 'ต้องการความช่วยเหลือ?',
      contactSupport: 'ติดต่อฝ่ายสนับสนุน',
      emailRequired: 'กรุณากรอกอีเมลของคุณก่อน',
      resetSent: 'ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ',
      errorGoogle: 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ',
      errorEmail: 'เข้าสู่ระบบด้วยอีเมลไม่สำเร็จ',
      errorLine: 'เข้าสู่ระบบด้วย LINE ไม่สำเร็จ',
      errorReset: 'ส่งอีเมลรีเซ็ตรหัสผ่านไม่สำเร็จ'
    }
  };

  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingGoogle(true);
    setError(null);
    setMessage(null);
    
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('Google login error:', err);
      setError(err.message || t[lang].errorGoogle);
      setIsLoadingGoogle(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingEmail(true);
    setError(null);
    setMessage(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      console.error('Email login error:', err);
      setError(err.message || t[lang].errorEmail);
      setIsLoadingEmail(false);
    }
  };

  const handleLineLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoadingLine(true);
    setError(null);
    setMessage(null);
    
    try {
      const provider = new OAuthProvider('oidc.line');
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (err: any) {
      console.error('LINE login error:', err);
      setError(err.message || t[lang].errorLine);
      setIsLoadingLine(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError(t[lang].emailRequired);
      return;
    }
    
    setIsResetting(true);
    setError(null);
    setMessage(null);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage(t[lang].resetSent);
      setIsForgotPassword(false);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || t[lang].errorReset);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFAFA] p-6 relative">
      <div className="absolute top-6 right-6">
        <button 
          onClick={() => setLang(lang === 'EN' ? 'TH' : 'EN')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors shadow-sm"
        >
          <Globe className="w-3.5 h-3.5" />
          {lang === 'EN' ? 'TH' : 'EN'}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center mb-12">
          <h1 className="text-4xl font-light tracking-tight text-slate-900 mb-3">{t[lang].title}</h1>
          <p className="text-slate-400 font-light text-sm tracking-wide">
            {isForgotPassword ? t[lang].resetSubtitle : t[lang].subtitle}
          </p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-rose-500 bg-rose-50 border border-rose-100 rounded-xl text-center">
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-3 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
              {message}
            </div>
          )}

          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder={t[lang].emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={isResetting}
                className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide"
              >
                {isResetting ? (
                  <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>{t[lang].sendReset} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError(null);
                  setMessage(null);
                }}
                className="w-full py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
              >
                {t[lang].backToSignIn}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      required
                      placeholder={t[lang].emailPlaceholder}
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
                      placeholder={t[lang].passwordPlaceholder}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                      setMessage(null);
                    }}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                  >
                    {t[lang].forgotPassword}
                  </button>
                </div>

                <button 
                  type="submit"
                  disabled={isLoadingEmail || isLoadingGoogle || isLoadingLine}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-slate-900 hover:bg-black text-white rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide"
                >
                  {isLoadingEmail ? (
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>{t[lang].signInEmail} <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-[#FAFAFA] text-slate-500 font-light">{t[lang].orContinue}</span>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoadingGoogle || isLoadingEmail || isLoadingLine}
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
                    {t[lang].signInGoogle}
                  </>
                )}
              </button>

              {/* LINE login hidden as requested */}
              {false && (
                <button 
                  type="button"
                  onClick={handleLineLogin}
                  disabled={isLoadingGoogle || isLoadingEmail || isLoadingLine}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed font-medium text-sm tracking-wide mt-3"
                >
                  {isLoadingLine ? (
                    <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {t[lang].signInLine} <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        <div className="mt-12 text-center space-y-4">
          <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
            Racedoc powered by Embedded Linux Group Co.,Ltd.
          </p>
          <p className="text-xs text-slate-400 font-light tracking-wide">
            {t[lang].noAccount} <button onClick={() => router.push('/signup')} className="text-slate-900 hover:text-orange-500 transition-colors">{t[lang].signUp}</button>
          </p>
          <p className="text-xs text-slate-400 font-light tracking-wide">
            {t[lang].needHelp} <a href="#" className="text-slate-900 hover:text-orange-500 transition-colors">{t[lang].contactSupport}</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
