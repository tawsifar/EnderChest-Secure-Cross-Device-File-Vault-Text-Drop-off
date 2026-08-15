const fs = require('fs');
let code = fs.readFileSync('src/components/RoomScreen.tsx', 'utf8');

// 1. Adjust outer container padding
code = code.replace(
  'className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 flex gap-8 relative z-10 fadeUp"',
  'className="w-full max-w-[1400px] mx-auto px-2 sm:px-6 py-4 sm:py-6 flex gap-8 relative z-10 fadeUp"'
);

// 2. Adjust glass padding
code = code.replace(
  'className="glass p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"',
  'className="glass p-3 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"'
);

code = code.replace(
  'className="glass p-5 sm:p-6 flex flex-col min-h-[500px]"',
  'className="glass p-4 sm:p-6 flex flex-col min-h-[500px]"'
);

code = code.replace(
  'className="glass p-5 sm:p-6 flex flex-col min-h-[500px] flex-1"',
  'className="glass p-4 sm:p-6 flex flex-col min-h-[500px] flex-1"'
);

// 3. Make Storage Status Banner responsive
code = code.replace(
  'className="p-4 bg-[#06090d]/80 border border-white/5 rounded-xl flex items-center justify-between"',
  'className="p-3 sm:p-4 bg-[#06090d]/80 border border-white/5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0"'
);

code = code.replace(
  'className="flex items-center gap-4"',
  'className="flex items-center gap-3 w-full min-w-0"'
);

// Ensure the folder name container has min-w-0
code = code.replace(
  /<div>\s*<div className="text-\[13px\] font-mono font-semibold text-slate-200 mb-0\.5">\s*Server Secure Storage\s*<\/div>\s*<div className="text-\[11px\] font-mono text-slate-500">/,
  '<div className="min-w-0 flex-1">\n                  <div className="text-[13px] font-mono font-semibold text-slate-200 mb-0.5 truncate">\n                    Server Secure Storage\n                  </div>\n                  <div className="text-[11px] font-mono text-slate-500 truncate">'
);

// 4. Shrink "Download" text on mobile
code = code.replace(
  '<Download className="w-4 h-4" />\n                        <span>Download</span>',
  '<Download className="w-4 h-4" />\n                        <span className="hidden sm:inline">Download</span>'
);

// 5. Shrink "Close Vault" text on mobile
code = code.replace(
  '<LogOut className="w-4 h-4" />\n            <span>Close Vault</span>',
  '<LogOut className="w-4 h-4" />\n            <span className="hidden sm:inline">Close Vault</span>'
);

fs.writeFileSync('src/components/RoomScreen.tsx', code);
