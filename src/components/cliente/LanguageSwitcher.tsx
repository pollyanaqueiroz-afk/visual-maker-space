import { useLanguage, Language } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

const flags: { lang: Language; label: string; flag: string }[] = [
  { lang: 'pt', label: 'BR', flag: '🇧🇷' },
  { lang: 'en', label: 'US', flag: '🇺🇸' },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5">
      {flags.map(({ lang, label, flag }) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
            language === lang
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
          title={lang === 'pt' ? 'Português' : 'English'}
        >
          <span className="text-sm leading-none">{flag}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
