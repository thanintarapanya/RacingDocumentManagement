'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // If it's a chunk error, silently reload the page to get the new deployment files
    // Use a more robust check for chunk errors which often manifest as "Loading chunk ... failed"
    if (
      error.name === 'ChunkLoadError' || 
      error.message.toLowerCase().includes('loading chunk') ||
      error.message.toLowerCase().includes('failed to fetch dynamically imported module')
    ) {
      window.location.reload();
      return;
    }
    
    // Otherwise, log it so you can debug real bugs
    console.error("Application Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Something went wrong!</h2>
        <p className="text-slate-600 mb-8">An unexpected error occurred. We have been notified and are looking into it.</p>
        <button
          onClick={() => reset()}
          className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-orange-500/20 active:scale-95"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
