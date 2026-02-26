import { ReactNode } from 'react';
import { Palette } from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export default function CursEducaLayout({ title, subtitle, children, actions }: Props) {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero header matching BriefingForm style */}
      <div className="relative w-full overflow-hidden" style={{ minHeight: '180px' }}>
        <img
          src="/images/bg-curseduca.png"
          alt="Curseduca"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-background" />
        <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 py-10 min-h-[180px]">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-5 py-2 mb-4">
            <Palette className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm font-medium tracking-wide">Plataforma Curseduca</span>
          </div>
          <h1
            className="text-2xl sm:text-3xl font-extrabold text-white drop-shadow-lg"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="text-white/70 mt-2 text-sm max-w-xl">{subtitle}</p>
          )}
          {actions && (
            <div className="mt-4">{actions}</div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
