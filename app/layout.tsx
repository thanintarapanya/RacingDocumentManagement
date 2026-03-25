import type {Metadata} from 'next';
import { Inter } from 'next/font/google';
import './globals.css'; // Global styles
import { FirebaseProvider } from '@/components/FirebaseProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['100', '200', '300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'RaceDoc Manager',
  description: 'Minimalist glassmorphism web application for racing administration teams.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="antialiased font-sans font-light text-slate-900 bg-[#FAFAFA]" suppressHydrationWarning>
        {/* Print Watermarks */}
        <div className="hidden print:block fixed top-0 left-0 w-full h-full z-[-1] pointer-events-none">
          <img 
            src="/portrait-bg.jpg" 
            alt="Portrait Background" 
            className="w-full h-full object-fill print-portrait-only" 
          />
          <img 
            src="/landscape-bg.jpg" 
            alt="Landscape Background" 
            className="w-full h-full object-fill print-landscape-only" 
          />
        </div>
        <FirebaseProvider>
          {children}
        </FirebaseProvider>
      </body>
    </html>
  );
}
