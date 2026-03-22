const fs = require('fs');

const files = [
  'app/page.tsx',
  'components/tabs/DashboardTab.tsx',
  'components/tabs/EntryFormTab.tsx',
  'components/tabs/ChecklistTab.tsx',
  'components/tabs/InspectionTab.tsx',
  'components/tabs/ReportTab.tsx',
  'components/tabs/RequestTab.tsx',
  'components/tabs/DeletedTab.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Text Colors
  content = content.replace(/text-white/g, 'text-slate-900');
  content = content.replace(/text-slate-200/g, 'text-slate-800');
  content = content.replace(/text-slate-300/g, 'text-slate-700');
  content = content.replace(/text-slate-400/g, 'text-slate-500');
  
  // Background Colors
  content = content.replace(/bg-black\/20/g, 'bg-white');
  content = content.replace(/bg-black\/40/g, 'bg-slate-100');
  content = content.replace(/bg-white\/10/g, 'bg-slate-100');
  content = content.replace(/bg-white\/5/g, 'bg-slate-50');
  content = content.replace(/bg-transparent/g, 'bg-slate-50/50');
  
  // Border Colors
  content = content.replace(/border-white\/10/g, 'border-slate-200');
  content = content.replace(/border-white\/20/g, 'border-slate-200');
  content = content.replace(/border-white\/5/g, 'border-slate-100');
  content = content.replace(/border-white\/30/g, 'border-slate-300');
  
  // Accent Colors (Sky -> Orange)
  content = content.replace(/sky-500/g, 'orange-500');
  content = content.replace(/sky-400/g, 'orange-500');
  
  // Status Colors (Make slightly darker for light mode)
  content = content.replace(/emerald-400/g, 'emerald-500');
  content = content.replace(/rose-400/g, 'rose-500');
  content = content.replace(/amber-400/g, 'amber-500');
  content = content.replace(/indigo-400/g, 'indigo-500');
  
  // Shadows
  content = content.replace(/rgba\(0,170,255,0\.15\)/g, 'rgba(249,115,22,0.1)');
  content = content.replace(/rgba\(0,170,255,0\.3\)/g, 'rgba(249,115,22,0.2)');
  content = content.replace(/rgba\(0,170,255,0\.8\)/g, 'rgba(249,115,22,0.5)');
  content = content.replace(/rgba\(56,189,248,0\.8\)/g, 'rgba(249,115,22,0.5)');
  content = content.replace(/rgba\(56,189,248,0\.5\)/g, 'rgba(249,115,22,0.4)');
  
  // Recharts
  content = content.replace(/stroke="#0ea5e9"/g, 'stroke="#f97316"');
  content = content.replace(/stopColor="#0ea5e9"/g, 'stopColor="#f97316"');
  content = content.replace(/stroke="#475569"/g, 'stroke="#94a3b8"');
  content = content.replace(/stroke="#1e293b"/g, 'stroke="#e2e8f0"');
  content = content.replace(/backgroundColor: 'rgba\\(15, 23, 42, 0\\.8\\)'/g, "backgroundColor: 'rgba(255, 255, 255, 0.9)'");
  content = content.replace(/color: '#e2e8f0'/g, "color: '#0f172a'");
  
  fs.writeFileSync(file, content);
});
