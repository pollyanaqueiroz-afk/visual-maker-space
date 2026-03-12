import { useLanguage, Language } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const BR_FLAG = (
  <svg viewBox="0 0 640 480" className="h-4 w-6 rounded-sm shrink-0">
    <rect width="640" height="480" fill="#009b3a" />
    <polygon points="320,39 600,240 320,441 40,240" fill="#fedf00" />
    <circle cx="320" cy="240" r="95" fill="#002776" />
    <path d="M195,240 Q320,170 445,240" stroke="#fff" strokeWidth="12" fill="none" />
  </svg>
);

const US_FLAG = (
  <svg viewBox="0 0 640 480" className="h-4 w-6 rounded-sm shrink-0">
    <rect width="640" height="480" fill="#fff" />
    {[0,2,4,6,8,10,12].map(i => (
      <rect key={i} y={i * 36.92} width="640" height="36.92" fill="#b22234" />
    ))}
    <rect width="256" height="259.4" fill="#3c3b6e" />
    {Array.from({ length: 50 }, (_, i) => {
      const row = Math.floor(i / (i % 2 === 0 ? 6 : 5));
      return null;
    })}
    <g fill="#fff">
      {[0,1,2,3,4,5,6,7,8].map(row => {
        const cols = row % 2 === 0 ? 6 : 5;
        const offsetX = row % 2 === 0 ? 21 : 42;
        return Array.from({ length: cols }, (_, col) => (
          <circle key={`${row}-${col}`} cx={offsetX + col * 42} cy={16 + row * 28.8} r="8" />
        ));
      })}
    </g>
  </svg>
);

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  const options: { lang: Language; label: string; flag: React.ReactNode }[] = [
    { lang: 'pt', label: 'PT', flag: BR_FLAG },
    { lang: 'en', label: 'EN', flag: US_FLAG },
  ];

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/5 p-0.5">
      {options.map(({ lang, label, flag }) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
            language === lang
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
          title={lang === 'pt' ? 'Português (Brasil)' : 'English (US)'}
        >
          {flag}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
