import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Lock, UserCircle, Sparkles, Users, Palette } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

const Index = () => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background image */}
      <img
        src="/images/bg-curseduca.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="relative z-10 text-center space-y-8 max-w-lg px-6"
      >
        {/* Badge */}

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl sm:text-5xl font-extrabold text-white drop-shadow-lg leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Hub{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Curseduca
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-white/60 text-lg max-w-md mx-auto"
        >
          Solicite artes, acompanhe entregas e gerencie seu aplicativo em um só lugar.
        </motion.p>

        {/* Buttons — primary vs secondary hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center pt-2"
        >
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25 border-0 px-8 h-12 text-base font-semibold"
          >
            <Link to="/cliente/login">
              <UserCircle className="h-5 w-5 mr-2" />
              Portal do Cliente
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-white/20 bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 hover:border-white/30 px-8 h-12 text-base"
          >
            <Link to="/hub">
              <Lock className="h-5 w-5 mr-2" />
              Área da Equipe
            </Link>
          </Button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex items-center justify-center gap-8 pt-4"
        >
          <SocialStat icon={<Users className="h-4 w-4 text-emerald-400" />} value={1690} suffix="+" label="clientes" />
          <SocialStat icon={<Palette className="h-4 w-4 text-emerald-400" />} value={312} suffix="+" label="artes entregues" />
        </motion.div>

        {/* Decorative sparkle */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-2 pt-2"
        >
          <Sparkles className="h-3 w-3 text-emerald-400/50" />
          <span className="text-white/30 text-xs tracking-widest uppercase">Design · Artes · Aplicativos</span>
          <Sparkles className="h-3 w-3 text-emerald-400/50" />
        </motion.div>
      </motion.div>
    </div>
  );
};

function SocialStat({ icon, value, suffix, label }: { icon: React.ReactNode; value: number; suffix: string; label: string }) {
  const display = useCountUp({ end: value, duration: 1200, separator: '.' });
  return (
    <div className="flex items-center gap-2 text-white/70">
      {icon}
      <span className="font-bold text-white">{display}{suffix}</span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export default Index;
