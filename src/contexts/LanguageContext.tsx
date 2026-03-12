import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type Language = 'pt' | 'en';

const translations = {
  // Layout
  'portal.title': { pt: 'Portal do Cliente', en: 'Client Portal' },
  'portal.logout': { pt: 'Sair', en: 'Log out' },
  'portal.notifications': { pt: 'Notificações', en: 'Notifications' },
  'portal.no_notifications': { pt: 'Nenhuma notificação', en: 'No notifications' },
  'portal.view_all_arts': { pt: 'Ver todas as artes', en: 'View all arts' },
  'portal.art_ready': { pt: 'Arte pronta para aprovação', en: 'Art ready for approval' },
  
  // Nav items
  'nav.home': { pt: 'Home', en: 'Home' },
  'nav.arts': { pt: 'Artes', en: 'Designs' },
  'nav.app': { pt: 'Aplicativo', en: 'App' },
  'nav.migration': { pt: 'Migração', en: 'Migration' },
  'nav.scorm': { pt: 'SCORM', en: 'SCORM' },

  // Greetings
  'greeting.morning': { pt: 'Bom dia', en: 'Good morning' },
  'greeting.afternoon': { pt: 'Boa tarde', en: 'Good afternoon' },
  'greeting.evening': { pt: 'Boa noite', en: 'Good evening' },

  // Home page
  'home.pendencies_singular': { pt: 'Você tem 1 pendência para resolver', en: 'You have 1 pending item to resolve' },
  'home.pendencies_plural': { pt: 'Você tem {count} pendências para resolver', en: 'You have {count} pending items to resolve' },
  'home.all_clear': { pt: 'Você está em dia! Nenhuma pendência no momento 🎉', en: "You're all caught up! No pending items 🎉" },
  'home.request_design': { pt: 'Solicitar Design', en: 'Request Design' },
  'home.request_design_sub': { pt: 'Peça artes', en: 'Order designs' },
  'home.request_app': { pt: 'Solicitar App', en: 'Request App' },
  'home.request_app_sub': { pt: 'Crie seu app', en: 'Create your app' },
  'home.app_requested': { pt: 'App solicitado', en: 'App requested' },
  'home.in_progress': { pt: 'Em andamento', en: 'In progress' },
  'home.creating': { pt: 'Criando...', en: 'Creating...' },
  'home.request_migration': { pt: 'Solicitar Migração', en: 'Request Migration' },
  'home.request_migration_sub': { pt: 'Migre dados', en: 'Migrate data' },
  'home.track_title': { pt: '📊 Acompanhe suas artes, aplicativos e migrações', en: '📊 Track your designs, apps and migrations' },

  // App status
  'app.title': { pt: 'Aplicativo', en: 'App' },
  'app.published': { pt: '🎉 Publicado!', en: '🎉 Published!' },
  'app.completed_pct': { pt: '{pct}% concluído', en: '{pct}% completed' },
  'app.no_project': { pt: 'Nenhum projeto de app vinculado', en: 'No app project linked' },
  'app.cancelled': { pt: 'Solicitação cancelada', en: 'Request cancelled' },
  'app.cancelled_desc': { pt: 'Seu fluxo de aplicativo foi cancelado', en: 'Your app flow was cancelled' },
  'app.request_again': { pt: 'Solicitar novamente', en: 'Request again' },
  'app.pendency': { pt: 'pendência', en: 'pending' },
  'app.pendencies': { pt: 'pendências', en: 'pending' },

  // Art status
  'art.title': { pt: 'Validação de Artes', en: 'Design Validation' },
  'art.approved_of': { pt: '{done} de {total} aprovadas', en: '{done} of {total} approved' },
  'art.to_validate': { pt: '{count} para validar', en: '{count} to validate' },
  'art.to_approve': { pt: '{count} para aprovar', en: '{count} to approve' },
  'art.no_arts': { pt: 'Nenhuma arte no momento', en: 'No designs at the moment' },

  // Pending actions
  'pending.title': { pt: '🔔 Ações Pendentes ({count})', en: '🔔 Pending Actions ({count})' },
  'pending.app_badge': { pt: 'Aplicativo', en: 'App' },
  'pending.art_badge': { pt: 'Arte', en: 'Design' },
  'pending.awaiting_approval': { pt: 'Aguardando sua aprovação', en: 'Awaiting your approval' },

  // All clear state
  'clear.title': { pt: 'Tudo em dia! 🎉', en: 'All caught up! 🎉' },
  'clear.subtitle': { pt: 'Nenhuma pendência no momento. Que tal solicitar algo novo?', en: 'No pending items. How about requesting something new?' },
  'clear.request_arts': { pt: 'Solicitar Artes', en: 'Request Designs' },
  'clear.request_arts_sub': { pt: 'Banners, capas, login', en: 'Banners, covers, login' },
  'clear.request_app': { pt: 'Solicitar App', en: 'Request App' },
  'clear.request_app_sub': { pt: 'Aplicativo mobile', en: 'Mobile app' },
  'clear.request_migration': { pt: 'Solicitar Migração', en: 'Request Migration' },
  'clear.request_migration_sub': { pt: 'Migrar dados', en: 'Migrate data' },

  // Migration
  'migration.title': { pt: 'Migração', en: 'Migration' },
  'migration.adjustments_needed': { pt: 'Ajustes necessários', en: 'Adjustments needed' },
  'migration.waiting_form': { pt: 'Aguardando formulário', en: 'Waiting for form' },
  'migration.analysis': { pt: 'Em análise', en: 'Under analysis' },
  'migration.rejected': { pt: 'Ajustes solicitados', en: 'Adjustments requested' },
  'migration.extraction': { pt: 'Extração de dados', en: 'Data extraction' },
  'migration.in_progress': { pt: 'Migração em andamento', en: 'Migration in progress' },
  'migration.completed': { pt: 'Concluído', en: 'Completed' },

  // Phases
  'phase.0': { pt: 'Pré-Requisitos', en: 'Prerequisites' },
  'phase.1': { pt: 'Primeiros Passos', en: 'First Steps' },
  'phase.2': { pt: 'Validação pela Loja', en: 'Store Validation' },
  'phase.3': { pt: 'Criação e Submissão', en: 'Creation & Submission' },
  'phase.4': { pt: 'Aprovação das Lojas', en: 'Store Approval' },
  'phase.5': { pt: 'Publicado', en: 'Published' },

  // Loading
  'loading': { pt: 'Carregando...', en: 'Loading...' },
  'not_found': { pt: 'Portal não encontrado', en: 'Portal not found' },
  'client_not_found': { pt: 'Cliente não encontrado.', en: 'Client not found.' },

  // Preview
  'preview.title': { pt: 'Portal do Cliente (Preview)', en: 'Client Portal (Preview)' },
  'preview.cs_mode': { pt: 'Modo CS — Visualizando portal de', en: 'CS Mode — Viewing portal of' },
  'preview.back_hub': { pt: 'Voltar ao Hub', en: 'Back to Hub' },

  // Image types
  'img.login': { pt: 'Área de Login', en: 'Login Area' },
  'img.banner_vitrine': { pt: 'Banner Vitrine', en: 'Showcase Banner' },
  'img.product_cover': { pt: 'Capa de Produto', en: 'Product Cover' },
  'img.trail_banner': { pt: 'Banner de Trilha', en: 'Trail Banner' },
  'img.challenge_banner': { pt: 'Banner de Desafio', en: 'Challenge Banner' },
  'img.community_banner': { pt: 'Banner de Comunidade', en: 'Community Banner' },
  'img.app_mockup': { pt: 'Mockup do Aplicativo', en: 'App Mockup' },
} as const;

export type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('portal-language');
    return (saved === 'en' ? 'en' : 'pt') as Language;
  });

  const changeLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('portal-language', lang);
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    const entry = translations[key];
    if (!entry) return key;
    let text = entry[language] || entry.pt;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
