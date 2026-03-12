import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore, addDays, startOfWeek, endOfWeek, addMonths, subMonths, subWeeks, addWeeks, getDay, getYear, setYear, setMonth, getMonth, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Video, Clock, User, Users, Trash2, Edit2, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Loader2, CheckCircle, FileText, Star, RefreshCw, AlertCircle, MessageSquare, Eye, TrendingUp, Calendar as CalendarIcon, Bell, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';

// Brazilian holidays (fixed + Easter-based)
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getBrazilianHolidays(year: number): Record<string, string> {
  const easter = getEasterDate(year);
  const addD = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  
  return {
    [`${year}-01-01`]: 'Ano Novo',
    [fmt(addD(easter, -47))]: 'Carnaval',
    [fmt(addD(easter, -46))]: 'Carnaval',
    [fmt(addD(easter, -2))]: 'Sexta-feira Santa',
    [fmt(easter)]: 'Páscoa',
    [`${year}-04-21`]: 'Tiradentes',
    [`${year}-05-01`]: 'Dia do Trabalho',
    [fmt(addD(easter, 60))]: 'Corpus Christi',
    [`${year}-09-07`]: 'Independência',
    [`${year}-10-12`]: 'N. S. Aparecida',
    [`${year}-11-02`]: 'Finados',
    [`${year}-11-15`]: 'Proclamação da República',
    [`${year}-11-20`]: 'Consciência Negra',
    [`${year}-12-25`]: 'Natal',
  };
}
import { motion, AnimatePresence } from 'framer-motion';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useReunioes } from '@/hooks/useReunioes';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
}

type CalendarView = 'month' | 'week';


interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  meeting_time: string;
  duration_minutes: number;
  meeting_url: string | null;
  client_name: string | null;
  client_email: string | null;
  client_url: string | null;
  participants: string[];
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  meeting_reason: string | null;
  reschedule_reason: string | null;
  loyalty_index: number | null;
  loyalty_reason: string | null;
  minutes_url: string | null;
  recording_url: string | null;
  funil_status: string | null;
  funil_notas: string | null;
  gcal_event_id: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-info/20 text-info' },
  completed: { label: 'Realizada', color: 'bg-success/20 text-success' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/20 text-destructive' },
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'annually' | 'weekdays' | 'custom';
type RecurrenceFrequency = 'day' | 'week' | 'month' | 'year';
type RecurrenceEndType = 'never' | 'on_date' | 'after_occurrences';

interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number;
  frequency: RecurrenceFrequency;
  weekDays: number[]; // 0=Sun .. 6=Sat
  endType: RecurrenceEndType;
  endDate: string;
  occurrences: number;
}

const DEFAULT_RECURRENCE: RecurrenceConfig = {
  type: 'none',
  interval: 1,
  frequency: 'week',
  weekDays: [],
  endType: 'never',
  endDate: '',
  occurrences: 13,
};

const MEETING_REASONS = [
  'Passagem de bastão Closer <> Onboarding',
  'Passagem de bastão Onboarding <> CS',
  'Apresentação do CS para o cliente',
  'Reunião interna de definição do escopo implantação',
  'Negociação',
  'Inadimplência',
  'Upsell',
  'Reversão de Churn',
  'Renovação',
  'Definição de implantação',
  'Follow Up de implantação',
  'Resolução de problemas proativos',
  'Encantamento proativo',
  'Resolução reativa',
];

const emptyForm = {
  title: '',
  description: '',
  meeting_date: '',
  meeting_time: '10:00',
  duration_minutes: 30,
  meeting_url: '',
  client_name: '',
  client_email: '',
  client_url: '',
  participants: '',
  notes: '',
  meeting_reason: '',
  reschedule_reason: '',
};

  const buildGoogleCalendarUrl = (meeting: { title: string; description?: string | null; meeting_date: string; meeting_time: string; duration_minutes: number; meeting_url?: string | null; client_name?: string | null; client_email?: string | null }) => {
    const startDt = new Date(`${meeting.meeting_date}T${meeting.meeting_time}:00`);
    const endDt = new Date(startDt.getTime() + meeting.duration_minutes * 60000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatDt = (dt: Date) =>
      `${dt.getFullYear()}${pad(dt.getMonth()+1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
    const dates = `${formatDt(startDt)}/${formatDt(endDt)}`;
    const details = [meeting.description, meeting.meeting_url ? `Link: ${meeting.meeting_url}` : ''].filter(Boolean).join('\n');

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: meeting.title,
      dates,
      details,
    });

    if (meeting.client_email) {
      params.set('add', meeting.client_email);
    }

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

export default function SchedulingPage() {
  const { hasPermission, hasRole } = usePermissions();
  const { user } = useAuth();
  const isManager = hasRole('admin') || hasRole('gerente_cs');

  const canCreate = hasPermission('agendamento.create');
  const canEdit = hasPermission('agendamento.edit');
  const canDelete = hasPermission('agendamento.delete');
  const { sync: syncCalendar, syncing: calendarSyncing, createEvent: createCalendarEvent, updateEvent: updateCalendarEvent, deleteEvent: deleteCalendarEvent } = useReunioes();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [meetingType, setMeetingType] = useState<'client' | 'internal'>('client');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { locale: ptBR }));
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [sendInvite, setSendInvite] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceConfig>({ ...DEFAULT_RECURRENCE });
  const [customRecurrenceOpen, setCustomRecurrenceOpen] = useState(false);
  const [tempRecurrence, setTempRecurrence] = useState<RecurrenceConfig>({ ...DEFAULT_RECURRENCE });
  const [reschedulingOldData, setReschedulingOldData] = useState<{ date: string; time: string } | null>(null);
  const [rescheduleHistory, setRescheduleHistory] = useState<Record<string, { previous_date: string; previous_time: string; new_date: string; new_time: string; reason: string; created_at: string }[]>>({});
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmingMeeting, setConfirmingMeeting] = useState<Meeting | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    minutes_url: '',
    recording_url: '',
    loyalty_stars: 0,
    observations: '',
  });
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [csatMap, setCsatMap] = useState<Record<string, { score: number | null; responded: boolean }>>({});
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [filterCs, setFilterCs] = useState<string>('all');
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailNotes, setDetailNotes] = useState('');
  const [detailFunilStatus, setDetailFunilStatus] = useState('');
  const [detailFunilNotas, setDetailFunilNotas] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);

  // Onboarding Coletivo state
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingForm, setOnboardingForm] = useState({ title: '', date: '', time: '10:00', duration: 60, participantsText: '' });
  const [onboardingMediators, setOnboardingMediators] = useState<string[]>([]);
  const [onboardingMediatorSearch, setOnboardingMediatorSearch] = useState('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState(false);
  const [showMediatorDropdown, setShowMediatorDropdown] = useState(false);
  const [minutesMeetingIds, setMinutesMeetingIds] = useState<Set<string>>(new Set());
  const [pendingPage, setPendingPage] = useState(1);
  const PENDING_PER_PAGE = 5;

  const filteredMediators = useMemo(() => {
    if (!onboardingMediatorSearch.trim()) return teamMembers;
    const q = onboardingMediatorSearch.toLowerCase();
    return teamMembers.filter(
      t => t.display_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q)
    );
  }, [teamMembers, onboardingMediatorSearch]);

  const handleAddMediator = (email: string) => {
    if (!onboardingMediators.includes(email)) {
      setOnboardingMediators(prev => [...prev, email]);
    }
    setOnboardingMediatorSearch('');
    setShowMediatorDropdown(false);
  };

  const handleRemoveMediator = (email: string) => {
    setOnboardingMediators(prev => prev.filter(e => e !== email));
  };

  const handleOnboardingSubmit = async () => {
    if (!onboardingForm.title || !onboardingForm.date || !onboardingForm.time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (onboardingMediators.length === 0) {
      toast.error('Adicione ao menos um mediador');
      return;
    }
    setOnboardingSubmitting(true);
    const payload = {
      title: `[Onboarding Coletivo] ${onboardingForm.title}`,
      meeting_date: onboardingForm.date,
      meeting_time: onboardingForm.time,
      duration_minutes: onboardingForm.duration,
      participants: [
        ...onboardingMediators,
        ...onboardingForm.participantsText.split(';').map(s => s.trim()).filter(Boolean),
      ],
      status: 'scheduled',
      meeting_reason: 'Passagem de bastão Closer <> Onboarding',
      created_by: user?.id,
    };

    const { error } = await supabase.from('meetings').insert(payload as any);
    setOnboardingSubmitting(false);
    if (error) {
      toast.error('Erro ao criar onboarding coletivo');
      console.error(error);
      return;
    }
    toast.success('Onboarding coletivo criado!');
    setOnboardingOpen(false);
    setOnboardingForm({ title: '', date: '', time: '10:00', duration: 60, participantsText: '' });
    setOnboardingMediators([]);
    fetchMeetings();
  };

  const fetchMeetings = async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true });

    if (error) {
      console.error(error);
      toast.error('Erro ao carregar reuniões');
    } else {
      setMeetings((data || []) as Meeting[]);
    }
    setLoading(false);
  };

  const fetchCsatData = async () => {
    const { data } = await supabase.from('meeting_csat').select('meeting_id, score, responded_at');
    if (data) {
      const map: Record<string, { score: number | null; responded: boolean }> = {};
      (data as any[]).forEach((c: any) => {
        map[c.meeting_id] = { score: c.score, responded: !!c.responded_at };
      });
      setCsatMap(map);
    }
  };

  const fetchRescheduleHistory = async () => {
    const { data } = await supabase
      .from('meeting_reschedules')
      .select('meeting_id, previous_date, previous_time, new_date, new_time, reason, created_at')
      .order('created_at', { ascending: false });
    if (data) {
      const map: Record<string, typeof data> = {};
      for (const r of data as any[]) {
        if (!map[r.meeting_id]) map[r.meeting_id] = [];
        map[r.meeting_id].push(r);
      }
      setRescheduleHistory(map);
    }
  };

  const fetchMinutesIds = async () => {
    const { data } = await supabase.from('meeting_minutes').select('meeting_id');
    if (data) {
      setMinutesMeetingIds(new Set(data.map((d: any) => d.meeting_id)));
    }
  };

  useEffect(() => { fetchMeetings(); fetchCsatData(); fetchRescheduleHistory(); fetchMinutesIds(); }, []);

  // Fetch team members for managers
  useEffect(() => {
    if (!isManager) return;
    const fetchTeam = async () => {
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (!session) return;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users?action=list`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
          }
        );
        if (response.ok) {
          const result = await response.json();
          const users = result.users || result;
          if (Array.isArray(users)) {
            setTeamMembers(
              users
                .filter((u: any) => u.email?.endsWith('@curseduca.com'))
                .map((u: any) => ({
                  id: u.id,
                  email: u.email || '',
                  display_name: u.display_name || u.email || u.id,
                }))
            );
          }
        }
      } catch (e) {
        console.error('Error fetching team members', e);
      }
    };
    fetchTeam();
  }, [isManager]);

  // Compute per-email meeting stats
  const emailStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; scheduled: number; cancelled: number }> = {};
    for (const m of meetings) {
      const email = m.client_email?.toLowerCase();
      if (!email) continue;
      if (!stats[email]) stats[email] = { total: 0, completed: 0, scheduled: 0, cancelled: 0 };
      stats[email].total++;
      if (m.status === 'completed') stats[email].completed++;
      else if (m.status === 'scheduled') stats[email].scheduled++;
      else if (m.status === 'cancelled') stats[email].cancelled++;
    }
    return stats;
  }, [meetings]);

  const handleOpenNew = (date?: Date) => {
    setEditingId(null);
    setIsRescheduling(false);
    setRecurrence({ ...DEFAULT_RECURRENCE });
    setMeetingType('client');
    setForm({
      ...emptyForm,
      meeting_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const handleEdit = (m: Meeting) => {
    setEditingId(m.id);
    setIsRescheduling(false);
    setMeetingType(m.client_email || m.client_url ? 'client' : 'internal');
    setForm({
      title: m.title,
      description: m.description || '',
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time.slice(0, 5),
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || '',
      client_name: m.client_name || '',
      client_email: m.client_email || '',
      client_url: m.client_url || '',
      participants: (m.participants || []).join(', '),
      notes: m.notes || '',
      meeting_reason: m.meeting_reason || '',
      reschedule_reason: '',
    });
    setDialogOpen(true);
  };

  const handleReschedule = (m: Meeting) => {
    setEditingId(m.id);
    setIsRescheduling(true);
    setReschedulingOldData({ date: m.meeting_date, time: m.meeting_time });
    setForm({
      title: m.title,
      description: m.description || '',
      meeting_date: format(new Date(), 'yyyy-MM-dd'),
      meeting_time: m.meeting_time.slice(0, 5),
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || '',
      client_name: m.client_name || '',
      client_email: m.client_email || '',
      client_url: m.client_url || '',
      participants: (m.participants || []).join(', '),
      notes: m.notes || '',
      meeting_reason: m.meeting_reason || '',
      reschedule_reason: '',
    });
    setDialogOpen(true);
  };

  // Generate recurrence dates based on config
  const generateRecurrenceDates = (baseDate: string, config: RecurrenceConfig): string[] => {
    if (config.type === 'none') return [baseDate];
    const dates: string[] = [baseDate];
    const base = parseISO(baseDate);
    const maxDates = 365; // safety limit

    let current = base;
    for (let i = 1; i < maxDates; i++) {
      let next: Date;

      if (config.type === 'daily') {
        next = addDays(current, 1);
      } else if (config.type === 'weekdays') {
        next = addDays(current, 1);
        while (getDay(next) === 0 || getDay(next) === 6) {
          next = addDays(next, 1);
        }
      } else if (config.type === 'custom') {
        if (config.frequency === 'day') {
          next = addDays(current, config.interval);
        } else if (config.frequency === 'week') {
          if (config.weekDays.length === 0) {
            next = addDays(current, config.interval * 7);
          } else {
            // Find next matching weekday
            let candidate = addDays(current, 1);
            let found = false;
            for (let j = 0; j < config.interval * 7 + 7; j++) {
              if (config.weekDays.includes(getDay(candidate))) {
                found = true;
                next = candidate;
                break;
              }
              candidate = addDays(candidate, 1);
            }
            if (!found) next = addDays(current, config.interval * 7);
          }
        } else if (config.frequency === 'month') {
          next = new Date(current.getFullYear(), current.getMonth() + config.interval, current.getDate());
        } else {
          next = new Date(current.getFullYear() + config.interval, current.getMonth(), current.getDate());
        }
      } else if (config.type === 'weekly') {
        next = addDays(current, 7);
      } else if (config.type === 'monthly') {
        next = new Date(current.getFullYear(), current.getMonth() + 1, current.getDate());
      } else if (config.type === 'annually') {
        next = new Date(current.getFullYear() + 1, current.getMonth(), current.getDate());
      } else {
        break;
      }

      // Check end conditions
      if (config.endType === 'on_date' && config.endDate) {
        if (next > parseISO(config.endDate)) break;
      }
      if (config.endType === 'after_occurrences') {
        if (dates.length >= config.occurrences) break;
      }
      // Default safety: max 52 occurrences for 'never'
      if (config.endType === 'never' && dates.length >= 52) break;

      dates.push(format(next, 'yyyy-MM-dd'));
      current = next;
    }
    return dates;
  };

  const getRecurrenceLabel = (): string => {
    if (recurrence.type === 'none') return 'Não se repete';
    if (recurrence.type === 'daily') return 'Todos os dias';
    if (recurrence.type === 'weekdays') return 'Todos os dias da semana (segunda a sexta-feira)';
    if (recurrence.type === 'weekly') {
      const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
      const baseDay = form.meeting_date ? getDay(parseISO(form.meeting_date)) : getDay(new Date());
      return `Semanal: cada ${dayNames[baseDay]}`;
    }
    if (recurrence.type === 'monthly') {
      if (form.meeting_date) {
        const d = parseISO(form.meeting_date);
        const dayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
        const weekNum = Math.ceil(d.getDate() / 7);
        const ordinals = ['', 'primeiro(a)', 'segundo(a)', 'terceiro(a)', 'quarto(a)', 'quinto(a)'];
        return `Mensal no(a) ${ordinals[weekNum]} ${dayNames[getDay(d)]}`;
      }
      return 'Mensal';
    }
    if (recurrence.type === 'annually') {
      if (form.meeting_date) {
        const d = parseISO(form.meeting_date);
        const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        return `Anual em ${monthNames[d.getMonth()]} ${d.getDate()}`;
      }
      return 'Anual';
    }
    if (recurrence.type === 'custom') {
      const freqNames: Record<string, string> = { day: 'dia(s)', week: 'semana(s)', month: 'mês(es)', year: 'ano(s)' };
      return `Personalizado: a cada ${recurrence.interval} ${freqNames[recurrence.frequency]}`;
    }
    return 'Não se repete';
  };

  const handleSubmit = async () => {
    if (!form.title || !form.meeting_date || !form.meeting_time || !form.meeting_reason) {
      toast.error('Preencha título, motivo, data e horário');
      return;
    }
    if (isRescheduling && !form.reschedule_reason.trim()) {
      toast.error('Preencha o motivo do reagendamento');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time,
        duration_minutes: form.duration_minutes,
        meeting_url: form.meeting_url || null,
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        client_url: form.client_url || null,
        participants: form.participants ? form.participants.split(',').map(p => p.trim()).filter(Boolean) : [],
        notes: form.notes || null,
        meeting_reason: form.meeting_reason,
        ...(isRescheduling ? { reschedule_reason: form.reschedule_reason, status: 'scheduled' } : {}),
      };

      // Build ISO start/end for Google Calendar API
      const startISO = `${form.meeting_date}T${form.meeting_time}:00`;
      const startDate = new Date(startISO);
      const endDate = new Date(startDate.getTime() + form.duration_minutes * 60000);
      const endISO = `${form.meeting_date}T${String(endDate.getHours()).padStart(2,'0')}:${String(endDate.getMinutes()).padStart(2,'0')}:00`;
      const attendeesArr = payload.participants.length > 0
        ? payload.participants
        : (form.client_email ? [form.client_email] : []);

      if (editingId) {
        const { error } = await supabase.from('meetings').update(payload).eq('id', editingId);
        if (error) throw error;

        // Save reschedule history
        if (isRescheduling && reschedulingOldData) {
          await supabase.from('meeting_reschedules').insert({
            meeting_id: editingId,
            previous_date: reschedulingOldData.date,
            previous_time: reschedulingOldData.time,
            new_date: form.meeting_date,
            new_time: form.meeting_time,
            reason: form.reschedule_reason,
          });
        }

        // Update in Google Calendar (best-effort, uses meeting id as event_id if stored)
        try {
          const editingMeeting = meetings.find(m => m.id === editingId);
          if (editingMeeting?.gcal_event_id) {
            await updateCalendarEvent({
              event_id: editingMeeting.gcal_event_id,
              summary: form.title,
              start: startISO,
              end: endISO,
              description: form.description || '',
              attendees: attendeesArr,
            });
          }
        } catch { /* best-effort */ }

        toast.success(isRescheduling ? 'Reunião reagendada!' : 'Reunião atualizada!');
      } else {
        // Generate recurrence dates
        const recurrenceDates = generateRecurrenceDates(form.meeting_date, recurrence);

        for (const date of recurrenceDates) {
          const dateStartISO = `${date}T${form.meeting_time}:00`;
          const dateStartDt = new Date(dateStartISO);
          const dateEndDt = new Date(dateStartDt.getTime() + form.duration_minutes * 60000);
          const dateEndISO = `${date}T${String(dateEndDt.getHours()).padStart(2,'0')}:${String(dateEndDt.getMinutes()).padStart(2,'0')}:00`;

          // Create in Google Calendar first
          let gcalEventId: string | undefined;
          try {
            const calResult = await createCalendarEvent({
              summary: form.title,
              start: dateStartISO,
              end: dateEndISO,
              description: form.description || '',
              attendees: attendeesArr,
            });
            gcalEventId = calResult?.event_id;
          } catch {
            // If Google Calendar fails, still save locally
          }

          const datePayload = { ...payload, meeting_date: date };
          const insertPayload = gcalEventId ? { ...datePayload, gcal_event_id: gcalEventId } : datePayload;
          const { error } = await supabase.from('meetings').insert(insertPayload as any);
          if (error) throw error;
        }

        // Send invite email for the first occurrence
        if (sendInvite && form.client_email) {
          try {
            const gcalUrl = buildGoogleCalendarUrl({
              title: form.title,
              description: form.description || null,
              meeting_date: form.meeting_date,
              meeting_time: form.meeting_time,
              duration_minutes: form.duration_minutes,
              meeting_url: form.meeting_url || null,
              client_name: form.client_name || null,
              client_email: form.client_email || null,
            });

            const { data: inviteData } = await supabase.functions.invoke('notify-meeting', {
              body: {
                client_email: form.client_email,
                client_name: form.client_name || null,
                title: form.title,
                meeting_date: form.meeting_date,
                meeting_time: form.meeting_time,
                duration_minutes: form.duration_minutes,
                meeting_url: form.meeting_url || null,
                description: form.description || null,
                google_calendar_url: gcalUrl,
              },
            });

            if (inviteData?.email_warning) {
              toast.success(`${recurrenceDates.length} reunião(ões) agendada(s)! ⚠️ Convite não enviado (domínio não verificado).`);
            } else {
              toast.success(`${recurrenceDates.length} reunião(ões) agendada(s) e convite enviado!`);
            }
          } catch {
            toast.success(`${recurrenceDates.length} reunião(ões) agendada(s)! ⚠️ Erro ao enviar convite.`);
          }
        } else {
          toast.success(`${recurrenceDates.length} reunião(ões) agendada(s)!`);
        }
      }
      setDialogOpen(false);
      setReschedulingOldData(null);
      fetchMeetings();
      fetchRescheduleHistory();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta reunião?')) return;
    // Try delete from Google Calendar (best-effort)
    const meeting = meetings.find(m => m.id === id);
    if (meeting?.gcal_event_id) {
      try { await deleteCalendarEvent(meeting.gcal_event_id); } catch { /* best-effort */ }
    }
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) toast.error('Erro ao remover');
    else { toast.success('Reunião removida'); fetchMeetings(); }
  };

  const handleOpenConfirm = async (m: Meeting) => {
    setConfirmingMeeting(m);
    // Try to load existing minutes
    const { data: existingMinutes } = await supabase
      .from('meeting_minutes')
      .select('*')
      .eq('meeting_id', m.id)
      .maybeSingle();

    setConfirmForm({
      minutes_url: m.minutes_url || '',
      recording_url: m.recording_url || '',
      loyalty_stars: (existingMinutes as any)?.loyalty_stars || 0,
      observations: (existingMinutes as any)?.observations || '',
    });
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmingMeeting) return;
    if (confirmForm.loyalty_stars === 0) {
      toast.error('Selecione o índice de fidelidade (1 a 5 estrelas)');
      return;
    }
    if (confirmForm.loyalty_stars <= 2 && !confirmForm.observations.trim()) {
      toast.error('Observação é obrigatória para índice 1 ou 2 estrelas');
      return;
    }
    setConfirmSubmitting(true);
    try {
      // Update meeting status
      const { error } = await supabase.from('meetings').update({
        status: 'completed',
        minutes_url: confirmForm.minutes_url || null,
        recording_url: confirmForm.recording_url || null,
        loyalty_index: confirmForm.loyalty_stars,
        loyalty_reason: confirmForm.observations || null,
      }).eq('id', confirmingMeeting.id);
      if (error) throw error;

      // Upsert meeting_minutes
      const { error: minutesError } = await supabase
        .from('meeting_minutes')
        .upsert({
          meeting_id: confirmingMeeting.id,
          loyalty_stars: confirmForm.loyalty_stars,
          observations: confirmForm.observations || null,
        } as any, { onConflict: 'meeting_id' });
      if (minutesError) console.error('Minutes save error:', minutesError);

      toast.success('Reunião confirmada e ata salva!');

      // Send CSAT email if client has email
      if (confirmingMeeting.client_email) {
        try {
          await supabase.functions.invoke('send-csat-email', {
            body: {
              meeting_id: confirmingMeeting.id,
              client_email: confirmingMeeting.client_email,
              client_name: confirmingMeeting.client_name,
              meeting_title: confirmingMeeting.title,
              meeting_date: confirmingMeeting.meeting_date,
            },
          });
          toast.success('Pesquisa CSAT enviada ao cliente!');
        } catch {
          toast.warning('Reunião confirmada, mas erro ao enviar pesquisa CSAT.');
        }
      }

      setConfirmDialogOpen(false);
      setConfirmingMeeting(null);
      fetchMeetings();
      fetchMinutesIds();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('meetings').update({ status }).eq('id', id);
    if (error) toast.error('Erro ao atualizar status');
    else fetchMeetings();
  };

  // Sync Google Calendar events into DB (upsert, no deletes)
  const handleSyncCalendar = async () => {
    try {
      const events = await syncCalendar(100);
      if (!events || events.length === 0) {
        toast.info('Nenhum evento encontrado no Google Calendar');
        return;
      }

      // Get existing gcal_event_ids from DB
      const { data: existingMeetings } = await supabase
        .from('meetings')
        .select('gcal_event_id')
        .not('gcal_event_id', 'is', null);

      const existingIds = new Set(
        (existingMeetings || []).map((m: any) => m.gcal_event_id).filter(Boolean)
      );

      const newEvents = events.filter(e => !existingIds.has(e.event_id));

      if (newEvents.length === 0) {
        toast.success('Tudo sincronizado! Nenhum evento novo.');
        return;
      }

      // Insert only new events
      const currentUserId = user?.id || null;
      const inserts = newEvents.map(e => {
        const startDate = new Date(e.start);
        const endDate = new Date(e.end);
        const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
        return {
          title: e.summary || 'Sem título',
          description: e.description || null,
          meeting_date: format(startDate, 'yyyy-MM-dd'),
          meeting_time: format(startDate, 'HH:mm'),
          duration_minutes: durationMin > 0 ? durationMin : 30,
          meeting_url: e.hangout_link || null,
          gcal_event_id: e.event_id,
          status: 'scheduled' as const,
          participants: e.attendees?.map(a => a.email) || [],
          client_email: e.attendees?.[0]?.email || null,
          client_name: e.attendees?.[0]?.email?.split('@')[0] || null,
          created_by: currentUserId,
        };
      });

      const { error } = await supabase.from('meetings').insert(inserts as any);
      if (error) {
        toast.error('Erro ao importar: ' + error.message);
      } else {
        toast.success(`${newEvents.length} nova(s) reunião(ões) importada(s)!`);
        fetchMeetings();
      }
    } catch (err: any) {
      toast.error('Erro na sincronização: ' + err.message);
    }
  };

  // Detail dialog handlers
  const handleOpenDetail = (m: Meeting) => {
    setDetailMeeting(m);
    setDetailNotes(m.notes || '');
    setDetailFunilStatus(m.funil_status || '');
    setDetailFunilNotas(m.funil_notas || '');
    setDetailDialogOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!detailMeeting) return;
    setDetailSaving(true);
    try {
      const { error } = await supabase.from('meetings').update({
        notes: detailNotes || null,
        funil_status: detailFunilStatus || null,
        funil_notas: detailFunilNotas || null,
      }).eq('id', detailMeeting.id);
      if (error) throw error;
      toast.success('Detalhes salvos!');
      setDetailDialogOpen(false);
      fetchMeetings();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setDetailSaving(false);
    }
  };

  // Count meetings by reason
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of meetings) {
      const r = m.meeting_reason;
      if (r) counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [meetings]);

  // Calendar helpers
  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    let filtered = meetings;
    if (filterCs !== 'all') {
      filtered = filtered.filter(m => m.created_by === filterCs);
    }
    filtered.forEach(m => {
      if (!map[m.meeting_date]) map[m.meeting_date] = [];
      map[m.meeting_date].push(m);
    });
    console.log('[Agendamento] meetingsByDate keys:', Object.keys(map), 'total meetings:', meetings.length, 'filtered:', filtered.length, 'filterCs:', filterCs);
    return map;
  }, [meetings, filterCs]);

  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (filterCs !== 'all') list = list.filter(m => m.created_by === filterCs);
    if (filterStatus !== 'all') list = list.filter(m => m.status === filterStatus);
    if (filterReason !== 'all') list = list.filter(m => m.meeting_reason === filterReason);
    if (selectedDate) list = list.filter(m => isSameDay(parseISO(m.meeting_date), selectedDate));
    console.log('[Agendamento] filteredMeetings:', list.length, 'selectedDate:', selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'none');
    return list;
  }, [meetings, filterStatus, filterReason, selectedDate, filterCs]);

  const daysWithMeetings = useMemo(() => {
    return meetings
      .filter(m => m.status !== 'cancelled')
      .map(m => parseISO(m.meeting_date));
  }, [meetings]);

  // Available time slots for selected date
  const ALL_SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];

  const availableSlots = useMemo(() => {
    if (!selectedDate) return ALL_SLOTS;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dayMeetings = meetingsByDate[dateStr] || [];
    const busySlots = new Set<string>();
    dayMeetings.forEach(m => {
      if (m.status === 'cancelled') return;
      const [h, min] = m.meeting_time.split(':').map(Number);
      const startMin = h * 60 + min;
      const endMin = startMin + m.duration_minutes;
      ALL_SLOTS.forEach(slot => {
        const [sh, sm] = slot.split(':').map(Number);
        const slotStart = sh * 60 + sm;
        const slotEnd = slotStart + 30;
        if (slotStart < endMin && slotEnd > startMin) {
          busySlots.add(slot);
        }
      });
    });
    return ALL_SLOTS.filter(s => !busySlots.has(s));
  }, [selectedDate, meetingsByDate]);

  const handleSlotClick = (time: string) => {
    setEditingId(null);
    setIsRescheduling(false);
    setForm({
      ...emptyForm,
      meeting_date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      meeting_time: time,
    });
    setDialogOpen(true);
  };

  const pendingLoyalty = useMemo(() =>
    meetings.filter(m => m.status === 'completed' && m.loyalty_index == null),
    [meetings]
  );

  // Past meetings without meeting_minutes (ata not filled)
  const pendingAnnotations = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return meetings
      .filter(m => {
        if (m.status === 'cancelled') return false;
        const d = parseISO(m.meeting_date);
        if (d > today) return false; // future meeting
        return !minutesMeetingIds.has(m.id);
      })
      .sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));
  }, [meetings, minutesMeetingIds]);

  const pendingAnnotationsPage = useMemo(() => {
    const start = (pendingPage - 1) * PENDING_PER_PAGE;
    return pendingAnnotations.slice(start, start + PENDING_PER_PAGE);
  }, [pendingAnnotations, pendingPage]);

  const pendingTotalPages = Math.max(1, Math.ceil(pendingAnnotations.length / PENDING_PER_PAGE));

  // Meetings past their date still "scheduled" — split by days overdue
  const { pendingConclusion, pendingReschedule } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = meetings.filter(m => m.status === 'scheduled' && isBefore(parseISO(m.meeting_date), today));
    const conclude: Meeting[] = [];
    const reschedule: Meeting[] = [];
    const RESCHEDULE_THRESHOLD_DAYS = 7;
    for (const m of overdue) {
      const diffMs = today.getTime() - parseISO(m.meeting_date).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > RESCHEDULE_THRESHOLD_DAYS) {
        reschedule.push(m);
      } else {
        conclude.push(m);
      }
    }
    return { pendingConclusion: conclude, pendingReschedule: reschedule };
  }, [meetings]);

  // Month grid helpers
  const holidays = useMemo(() => getBrazilianHolidays(getYear(calendarMonth)), [calendarMonth]);
  
  const monthGridDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const monthDays = eachDayOfInterval({ start, end });
    const firstDayOfWeek = getDay(start);
    const prefixDays: (Date | null)[] = Array(firstDayOfWeek).fill(null);
    const totalCells = prefixDays.length + monthDays.length;
    const suffixCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const suffixDays: (Date | null)[] = Array(suffixCount).fill(null);
    return [...prefixDays, ...monthDays, ...suffixDays];
  }, [calendarMonth]);

  // Week view helpers
  const weekDays = useMemo(() => {
    return eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  }, [weekStart]);

  const WEEK_HOURS = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];

  const getMeetingsForDayAndHour = (day: Date, hour: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayMeetings = meetingsByDate[dateStr] || [];
    const [hh] = hour.split(':').map(Number);
    return dayMeetings.filter(m => {
      if (m.status === 'cancelled') return false;
      const [mh] = m.meeting_time.split(':').map(Number);
      return mh === hh;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending annotations - past meetings without ata */}
      {pendingAnnotations.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-warning" />
              {pendingAnnotations.length} {pendingAnnotations.length === 1 ? 'reunião pendente' : 'reuniões pendentes'} de conclusão
            </CardTitle>
            {pendingTotalPages > 1 && (
              <p className="text-[10px] text-muted-foreground">
                Página {pendingPage} de {pendingTotalPages}
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {pendingAnnotationsPage.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background border border-border/50 hover:border-warning/40 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleOpenConfirm(m)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
                    <FileText className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(m.meeting_date), "dd/MM/yyyy")} · {m.meeting_time?.slice(0, 5)} · {m.client_name || 'Sem cliente'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.status === 'completed' && m.loyalty_index == null && (
                    <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">Sem fidelidade</Badge>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs shrink-0 border-warning/30 text-warning hover:bg-warning/10 group-hover:border-warning/60"
                  >
                    Preencher
                  </Button>
                </div>
              </div>
            ))}
            {pendingTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={pendingPage <= 1}
                  onClick={() => setPendingPage(p => p - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {pendingPage} / {pendingTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={pendingPage >= pendingTotalPages}
                  onClick={() => setPendingPage(p => p + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamento</h1>
          <p className="text-sm text-muted-foreground">Gerencie reuniões e calls com clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSyncCalendar} disabled={calendarSyncing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", calendarSyncing && "animate-spin")} />
            {calendarSyncing ? 'Sincronizando...' : 'Sincronizar'}
          </Button>
          {canCreate && (
            <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => { setOnboardingOpen(true); setOnboardingForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), time: '10:00', duration: 60, participantsText: '' }); setOnboardingMediators([]); }}>
                  <Users className="h-4 w-4 mr-2" /> Onboarding Coletivo
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Onboarding Coletivo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Nome da Reunião *</Label>
                    <Input value={onboardingForm.title} onChange={e => setOnboardingForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Onboarding turma março" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input type="date" value={onboardingForm.date} onChange={e => setOnboardingForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário *</Label>
                      <Input type="time" value={onboardingForm.time} onChange={e => setOnboardingForm(f => ({ ...f, time: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Select value={String(onboardingForm.duration)} onValueChange={v => setOnboardingForm(f => ({ ...f, duration: Number(v) }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[30, 45, 60, 90, 120].map(d => (
                          <SelectItem key={d} value={String(d)}>{d} minutos</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mediadores (CS) *</Label>
                    <div className="relative">
                      <Input
                        value={onboardingMediatorSearch}
                        onChange={e => { setOnboardingMediatorSearch(e.target.value); setShowMediatorDropdown(true); }}
                        onFocus={() => setShowMediatorDropdown(true)}
                        placeholder="Buscar CS por nome ou email..."
                      />
                      {showMediatorDropdown && filteredMediators.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {filteredMediators.map(t => (
                            <button
                              key={t.email}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between",
                                onboardingMediators.includes(t.email) && "opacity-50"
                              )}
                              onClick={() => handleAddMediator(t.email)}
                              disabled={onboardingMediators.includes(t.email)}
                            >
                              <div>
                                <p className="font-medium text-foreground">{t.display_name}</p>
                                <p className="text-xs text-muted-foreground">{t.email}</p>
                              </div>
                              {onboardingMediators.includes(t.email) && (
                                <CheckCircle className="h-4 w-4 text-success" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {onboardingMediators.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {onboardingMediators.map(email => {
                          const member = teamMembers.find(t => t.email === email);
                          return (
                            <Badge key={email} variant="secondary" className="gap-1 pr-1">
                              {member?.display_name || email}
                              <button
                                onClick={() => handleRemoveMediator(email)}
                                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <Button onClick={handleOnboardingSubmit} disabled={onboardingSubmitting} className="w-full">
                    {onboardingSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                    Criar Onboarding Coletivo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {canCreate && (
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenNew()}>
                <Plus className="h-4 w-4 mr-2" /> Nova Reunião
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Reunião' : 'Nova Reunião'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Alinhamento de briefing" />
              </div>
              <div className="space-y-2">
                <Label>Motivo da Reunião *</Label>
                <Select value={form.meeting_reason} onValueChange={v => setForm(f => ({ ...f, meeting_reason: v }))}>
                  <SelectTrigger className={!form.meeting_reason ? 'text-muted-foreground' : ''}>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_REASONS.map(reason => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={form.meeting_date} onChange={e => setForm(f => ({ ...f, meeting_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <Input type="time" value={form.meeting_time} onChange={e => setForm(f => ({ ...f, meeting_time: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duração</Label>
                <Select value={String(form.duration_minutes)} onValueChange={v => setForm(f => ({ ...f, duration_minutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de Reunião *</Label>
                <Select value={meetingType} onValueChange={v => setMeetingType(v as 'client' | 'internal')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Com cliente</SelectItem>
                    <SelectItem value="internal">Interna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Link da reunião (Zoom, Meet, etc.)</Label>
                <Input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
              {meetingType === 'client' && (
                <>
                  <div className="space-y-2">
                    <Label>Email do cliente</Label>
                    <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="joao@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>URL da plataforma do cliente</Label>
                    <Input value={form.client_url} onChange={e => setForm(f => ({ ...f, client_url: e.target.value }))} placeholder="https://cliente.curseduca.pro" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Participantes (separados por vírgula)</Label>
                <Input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} placeholder="ana@email.com, pedro@email.com" />
              </div>

              {/* Recurrence selector */}
              {!editingId && (
                <div className="space-y-2">
                  <Label>Recorrência</Label>
                  <Select
                    value={recurrence.type}
                    onValueChange={v => {
                      if (v === 'custom') {
                        setTempRecurrence({ ...recurrence, type: 'custom', frequency: 'week', weekDays: form.meeting_date ? [getDay(parseISO(form.meeting_date))] : [getDay(new Date())] });
                        setCustomRecurrenceOpen(true);
                      } else {
                        setRecurrence({ ...DEFAULT_RECURRENCE, type: v as RecurrenceType });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>{getRecurrenceLabel()}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não se repete</SelectItem>
                      <SelectItem value="daily">Todos os dias</SelectItem>
                      <SelectItem value="weekly">
                        {form.meeting_date
                          ? `Semanal: cada ${['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'][getDay(parseISO(form.meeting_date))]}`
                          : 'Semanal'}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {form.meeting_date
                          ? (() => {
                              const d = parseISO(form.meeting_date);
                              const dayNames = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
                              const weekNum = Math.ceil(d.getDate() / 7);
                              const ordinals = ['','primeiro(a)','segundo(a)','terceiro(a)','quarto(a)','quinto(a)'];
                              return `Mensal no(a) ${ordinals[weekNum]} ${dayNames[getDay(d)]}`;
                            })()
                          : 'Mensal'}
                      </SelectItem>
                      <SelectItem value="annually">
                        {form.meeting_date
                          ? (() => {
                              const d = parseISO(form.meeting_date);
                              const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
                              return `Anual em ${monthNames[d.getMonth()]} ${d.getDate()}`;
                            })()
                          : 'Anual'}
                      </SelectItem>
                      <SelectItem value="weekdays">Todos os dias da semana (segunda a sexta-feira)</SelectItem>
                      <SelectItem value="custom">Personalizar...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Custom recurrence dialog */}
              <Dialog open={customRecurrenceOpen} onOpenChange={setCustomRecurrenceOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Recorrência personalizada</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 pt-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-foreground whitespace-nowrap">Repetir a cada:</span>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className="w-16"
                        value={tempRecurrence.interval}
                        onChange={e => setTempRecurrence(r => ({ ...r, interval: Math.max(1, parseInt(e.target.value) || 1) }))}
                      />
                      <Select value={tempRecurrence.frequency} onValueChange={v => setTempRecurrence(r => ({ ...r, frequency: v as RecurrenceFrequency }))}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">dia</SelectItem>
                          <SelectItem value="week">semana</SelectItem>
                          <SelectItem value="month">mês</SelectItem>
                          <SelectItem value="year">ano</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {tempRecurrence.frequency === 'week' && (
                      <div className="space-y-2">
                        <span className="text-sm text-foreground">Repetir:</span>
                        <div className="flex gap-1.5">
                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setTempRecurrence(r => ({
                                  ...r,
                                  weekDays: r.weekDays.includes(idx)
                                    ? r.weekDays.filter(d => d !== idx)
                                    : [...r.weekDays, idx].sort(),
                                }));
                              }}
                              className={cn(
                                "h-9 w-9 rounded-full text-sm font-medium transition-colors border",
                                tempRecurrence.weekDays.includes(idx)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background text-foreground border-border hover:bg-muted"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <span className="text-sm text-foreground">Termina em</span>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="recurrence-end"
                            checked={tempRecurrence.endType === 'never'}
                            onChange={() => setTempRecurrence(r => ({ ...r, endType: 'never' }))}
                            className="accent-primary"
                          />
                          <span className="text-sm text-foreground">Nunca</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="recurrence-end"
                            checked={tempRecurrence.endType === 'on_date'}
                            onChange={() => setTempRecurrence(r => ({ ...r, endType: 'on_date' }))}
                            className="accent-primary"
                          />
                          <span className="text-sm text-foreground">Em</span>
                          <Input
                            type="date"
                            className="w-40"
                            value={tempRecurrence.endDate}
                            onChange={e => setTempRecurrence(r => ({ ...r, endDate: e.target.value, endType: 'on_date' }))}
                            disabled={tempRecurrence.endType !== 'on_date'}
                          />
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="radio"
                            name="recurrence-end"
                            checked={tempRecurrence.endType === 'after_occurrences'}
                            onChange={() => setTempRecurrence(r => ({ ...r, endType: 'after_occurrences' }))}
                            className="accent-primary"
                          />
                          <span className="text-sm text-foreground">Após</span>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            className="w-16"
                            value={tempRecurrence.occurrences}
                            onChange={e => setTempRecurrence(r => ({ ...r, occurrences: Math.max(1, parseInt(e.target.value) || 1), endType: 'after_occurrences' }))}
                            disabled={tempRecurrence.endType !== 'after_occurrences'}
                          />
                          <span className="text-sm text-muted-foreground">ocorrências</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="ghost" onClick={() => setCustomRecurrenceOpen(false)}>Cancelar</Button>
                      <Button onClick={() => {
                        setRecurrence({ ...tempRecurrence, type: 'custom' });
                        setCustomRecurrenceOpen(false);
                      }}>Concluir</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {isRescheduling && (
                <div className="space-y-2">
                  <Label className="text-destructive">Motivo do reagendamento *</Label>
                  <Textarea
                    value={form.reschedule_reason}
                    onChange={e => setForm(f => ({ ...f, reschedule_reason: e.target.value }))}
                    placeholder="Informe o motivo do reagendamento..."
                    rows={2}
                    className="border-destructive/50 focus-visible:ring-destructive/30"
                  />
                </div>
              )}
              {!editingId && form.client_email && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="send-invite"
                    checked={sendInvite}
                    onCheckedChange={(v) => setSendInvite(!!v)}
                  />
                  <label htmlFor="send-invite" className="text-sm text-muted-foreground cursor-pointer">
                    Enviar convite por email ao cliente
                  </label>
                </div>
              )}
              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? 'Salvar Alterações' : 'Agendar Reunião'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Hoje', value: meetings.filter(m => isSameDay(parseISO(m.meeting_date), new Date()) && m.status === 'scheduled').length, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Próximas 30min', value: meetings.filter(m => { if (m.status !== 'scheduled' || !isSameDay(parseISO(m.meeting_date), new Date())) return false; const [hh, mm] = m.meeting_time.split(':').map(Number); const mt = new Date(); mt.setHours(hh, mm, 0, 0); const now = new Date(); return mt > now && mt.getTime() - now.getTime() <= 30 * 60 * 1000; }).length, color: 'text-amber-500', bg: 'bg-amber-500/10', icon: '🔔' },
          { label: 'Esta semana', value: meetings.filter(m => { const d = parseISO(m.meeting_date); return d >= startOfWeek(new Date(), { locale: ptBR }) && d <= endOfWeek(new Date(), { locale: ptBR }) && m.status === 'scheduled'; }).length, color: 'text-info', bg: 'bg-info/10' },
          { label: 'Realizadas', value: meetings.filter(m => m.status === 'completed').length, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Pendentes', value: meetings.filter(m => m.status === 'scheduled').length, color: 'text-warning', bg: 'bg-warning/10', sub: pendingConclusion.length > 0 || pendingReschedule.length > 0 ? `${pendingConclusion.length} concluir · ${pendingReschedule.length} reagendar` : undefined },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-lg font-bold", stat.bg, stat.color)}>
                  {stat.value}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  {(stat as any).sub && (
                    <span className="text-[10px] text-muted-foreground/70">{(stat as any).sub}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Calendar + List layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Panel */}
        <div className="space-y-4 lg:col-span-12">
          {/* Pending alerts above calendar */}
          {(pendingConclusion.length > 0 || pendingReschedule.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Pending Conclusion (≤7 days overdue) */}
              {pendingConclusion.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                    <CheckCircle className="h-4 w-4" />
                    {pendingConclusion.length} {pendingConclusion.length === 1 ? 'reunião' : 'reuniões'} pendente{pendingConclusion.length !== 1 ? 's' : ''} de conclusão
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">Até 7 dias de atraso</p>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1.5">
                  {pendingConclusion.slice(0, 5).map(m => {
                    const diffDays = Math.floor((new Date().setHours(0,0,0,0) - parseISO(m.meeting_date).getTime()) / 86400000);
                    return (
                    <div
                      key={`conclude-${m.id}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/50 hover:border-destructive/40 transition-all cursor-pointer group"
                      onClick={() => handleOpenConfirm(m)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(m.meeting_date), "dd/MM")} · {m.client_name || 'Sem cliente'}
                          <span className="ml-1 text-destructive font-medium">({diffDays}d atraso)</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        Concluir
                      </Button>
                    </div>
                    );
                  })}
                  {pendingConclusion.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+{pendingConclusion.length - 5} mais</p>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Pending Rescheduling (>7 days overdue) */}
              {pendingReschedule.length > 0 && (
              <Card className="border-destructive/40 bg-destructive/5">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
                    <RefreshCw className="h-4 w-4" />
                    {pendingReschedule.length} {pendingReschedule.length === 1 ? 'reunião' : 'reuniões'} pendente{pendingReschedule.length !== 1 ? 's' : ''} de reagendamento
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">Mais de 7 dias de atraso</p>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-1.5">
                  {pendingReschedule.slice(0, 5).map(m => {
                    const diffDays = Math.floor((new Date().setHours(0,0,0,0) - parseISO(m.meeting_date).getTime()) / 86400000);
                    return (
                    <div
                      key={`reschedule-${m.id}`}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/50 hover:border-destructive/40 transition-all cursor-pointer group"
                      onClick={() => handleReschedule(m)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(m.meeting_date), "dd/MM")} · {m.client_name || 'Sem cliente'}
                          <span className="ml-1 text-destructive font-medium">({diffDays}d atraso)</span>
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        Reagendar
                      </Button>
                    </div>
                    );
                  })}
                  {pendingReschedule.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">+{pendingReschedule.length - 5} mais</p>
                  )}
                </CardContent>
              </Card>
              )}
            </div>
          )}

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  Calendário
                  <Badge variant="secondary" className="text-[10px] ml-1">{meetings.length} reuniões</Badge>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-muted rounded-lg p-0.5">
                    <Button variant={calendarView === 'month' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3 rounded-md" onClick={() => setCalendarView('month')}>Mês</Button>
                    <Button variant={calendarView === 'week' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs px-3 rounded-md" onClick={() => { setCalendarView('week'); setWeekStart(startOfWeek(selectedDate || new Date(), { locale: ptBR })); }}>Semana</Button>
                  </div>
                  {calendarView === 'month' ? (
                    <div className="flex items-center gap-1">
                      <Select value={String(getYear(calendarMonth))} onValueChange={v => setCalendarMonth(setYear(calendarMonth, Number(v)))}>
                        <SelectTrigger className="h-7 w-[80px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 5 }, (_, i) => getYear(new Date()) - 1 + i).map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={String(getMonth(calendarMonth))} onValueChange={v => setCalendarMonth(setMonth(calendarMonth, Number(v)))}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i} value={String(i)}>{format(new Date(2024, i, 1), 'MMMM', { locale: ptBR })}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isManager && teamMembers.length > 0 && (
                        <Select value={filterCs} onValueChange={setFilterCs}>
                          <SelectTrigger className="h-7 w-[180px] text-xs">
                            <User className="h-3 w-3 mr-1 shrink-0" />
                            <SelectValue placeholder="Todos os CSs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os CSs</SelectItem>
                            {teamMembers.map(tm => (
                              <SelectItem key={tm.id} value={tm.id}>
                                {tm.display_name || tm.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-2 font-medium" onClick={() => { setCalendarMonth(new Date()); setSelectedDate(new Date()); }}>Hoje</Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {isManager && teamMembers.length > 0 && (
                        <Select value={filterCs} onValueChange={setFilterCs}>
                          <SelectTrigger className="h-7 w-[180px] text-xs">
                            <User className="h-3 w-3 mr-1 shrink-0" />
                            <SelectValue placeholder="Todos os CSs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os CSs</SelectItem>
                            {teamMembers.map(tm => (
                              <SelectItem key={tm.id} value={tm.id}>
                                {tm.display_name || tm.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-2 font-medium" onClick={() => { setWeekStart(startOfWeek(new Date(), { locale: ptBR })); setSelectedDate(new Date()); }}>Hoje</Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              {calendarView === 'month' ? (
              <>
              {/* Full Month Grid */}
              <div className="mt-2">
                <div className="text-sm font-semibold text-center text-foreground mb-3 capitalize">
                  {format(calendarMonth, "MMMM yyyy", { locale: ptBR })}
                </div>
                <div className="grid grid-cols-7 gap-px rounded-t-lg overflow-hidden">
                  {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                    <div key={d} className="bg-muted/50 p-2 text-[10px] text-muted-foreground font-semibold text-center uppercase tracking-wider">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-px">
                  {monthGridDays.map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="bg-muted/10 min-h-[90px] border-t border-border/10" />;
                    }
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayMeetings = (meetingsByDate[dateStr] || []).filter(m => m.status !== 'cancelled');
                    const holiday = holidays[dateStr];
                    const dayIsToday = isToday(day);
                    const dayIsSelected = selectedDate && isSameDay(day, selectedDate);
                    const isSunday = getDay(day) === 0;
                    
                    return (
                      <TooltipProvider key={dateStr} delayDuration={200}>
                        <div
                          className={cn(
                            "bg-background min-h-[90px] p-1.5 border-t border-border/20 transition-all cursor-pointer hover:bg-accent/20 relative group",
                            dayIsToday && "bg-primary/[0.04] ring-1 ring-inset ring-primary/20",
                            dayIsSelected && "bg-primary/10 ring-1 ring-inset ring-primary/40",
                            (isSunday || holiday) && "bg-destructive/[0.02]"
                          )}
                          onClick={() => setSelectedDate(day)}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <span className={cn(
                              "text-sm font-medium leading-none",
                              dayIsToday && "bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold",
                              !dayIsToday && isSunday && "text-destructive/60",
                              !dayIsToday && !isSunday && "text-foreground"
                            )}>
                              {day.getDate()}
                            </span>
                            {dayMeetings.length > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">{dayMeetings.length}</Badge>
                            )}
                          </div>
                          
                          {holiday && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5 mb-0.5">
                                  <PartyPopper className="h-2.5 w-2.5 text-destructive/60 shrink-0" />
                                  <span className="text-[9px] text-destructive/70 font-medium truncate leading-tight">{holiday}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-semibold">Feriado: {holiday}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          
                          <div className="space-y-0.5">
                            {dayMeetings.slice(0, 3).map(m => (
                              <Tooltip key={m.id}>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "rounded px-1 py-0.5 text-[9px] leading-tight truncate border-l-2",
                                    m.status === 'completed' ? 'bg-success/10 border-success text-foreground' : 'bg-primary/10 border-primary text-foreground'
                                  )}>
                                    <span className="font-medium">{m.meeting_time.slice(0, 5)}</span>{' '}
                                    <span className="text-muted-foreground">{m.title}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" className="text-xs max-w-[200px]">
                                  <p className="font-semibold">{m.title}</p>
                                  {m.client_name && <p className="text-muted-foreground">{m.client_name}</p>}
                                  <p className="text-muted-foreground">{m.meeting_time.slice(0, 5)} — {m.duration_minutes}min</p>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                            {dayMeetings.length > 3 && (
                              <span className="text-[9px] text-muted-foreground font-medium px-1">+{dayMeetings.length - 3} mais</span>
                            )}
                          </div>
                          
                          {dayMeetings.length === 0 && !holiday && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-3.5 w-3.5 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      </TooltipProvider>
                    );
                  })}
                </div>
                <div className="mt-3 px-2 flex items-center gap-4 text-[10px] text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Agendada</div>
                  <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Realizada</div>
                  <div className="flex items-center gap-1"><PartyPopper className="h-3 w-3 text-destructive/60" /> Feriado</div>
                  <span className="ml-auto text-muted-foreground/60">Clique em um dia para ver detalhes</span>
                </div>
              </div>
              </>
              ) : (
                /* Weekly Grid View */
                <div className="mt-2">
                  <div className="text-sm font-medium text-center text-muted-foreground mb-3">
                    {format(weekDays[0], "dd MMM", { locale: ptBR })} — {format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}
                    {filterCs !== 'all' && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        <User className="h-2.5 w-2.5 mr-1" />
                        {teamMembers.find(t => t.id === filterCs)?.display_name || 'CS'}
                      </Badge>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <div className="min-w-[700px]">
                      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px rounded-t-lg overflow-hidden">
                        <div className="bg-muted/50 p-2 text-[10px] text-muted-foreground font-medium text-center">Horário</div>
                        {weekDays.map(day => {
                          const dayIsToday = isToday(day);
                          const dayIsSelected = selectedDate && isSameDay(day, selectedDate);
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const dayCount = (meetingsByDate[dateStr] || []).filter(m => m.status !== 'cancelled').length;
                          return (
                            <div key={dateStr} className={cn("bg-muted/30 p-2 text-center cursor-pointer transition-colors hover:bg-accent/40", dayIsToday && "bg-primary/5", dayIsSelected && "bg-primary/10")} onClick={() => { setSelectedDate(day); setCalendarView('month'); }}>
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{format(day, 'EEE', { locale: ptBR })}</div>
                              <div className={cn("text-lg font-bold leading-tight", dayIsToday ? "text-primary" : "text-foreground")}>{format(day, 'd')}</div>
                              {dayCount > 0 && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 mt-0.5">{dayCount}</Badge>}
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-px">
                        {WEEK_HOURS.map(hour => (
                          <TooltipProvider key={hour} delayDuration={200}>
                            <div className="bg-muted/20 py-2 px-1 text-[10px] text-muted-foreground text-right tabular-nums font-medium border-t border-border/30">{hour}</div>
                            {weekDays.map(day => {
                              const dayMeetingsInHour = getMeetingsForDayAndHour(day, hour);
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const dayIsToday = isToday(day);
                              return (
                                <div key={`${dateStr}-${hour}`} className={cn("bg-background min-h-[52px] p-0.5 border-t border-border/20 transition-colors hover:bg-accent/20 cursor-pointer relative", dayIsToday && "bg-primary/[0.02]")} onClick={() => { if (dayMeetingsInHour.length === 0) { setForm({ ...emptyForm, meeting_date: dateStr, meeting_time: hour }); setEditingId(null); setIsRescheduling(false); setDialogOpen(true); } }}>
                                  {dayMeetingsInHour.map(m => (
                                    <Tooltip key={m.id}>
                                      <TooltipTrigger asChild>
                                        <div className={cn("rounded-md px-1.5 py-1 mb-0.5 text-[10px] leading-tight truncate cursor-pointer transition-all hover:shadow-sm", m.status === 'completed' ? 'bg-success/15 border-l-2 border-success hover:bg-success/25' : 'bg-primary/15 border-l-2 border-primary hover:bg-primary/25')} onClick={(e) => { e.stopPropagation(); setSelectedDate(day); setCalendarView('month'); }}>
                                          <div className="font-semibold truncate text-foreground">{m.title}</div>
                                          <div className="text-muted-foreground truncate">{m.meeting_time.slice(0, 5)} · {m.duration_minutes}min</div>
                                          {m.client_name && <div className="text-muted-foreground truncate">{m.client_name}</div>}
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="right" className="text-xs max-w-[200px]">
                                        <p className="font-semibold">{m.title}</p>
                                        {m.client_name && <p className="text-muted-foreground">{m.client_name}</p>}
                                        <p className="text-muted-foreground">{m.meeting_time.slice(0, 5)} — {m.duration_minutes}min</p>
                                        {m.meeting_reason && <p className="text-muted-foreground mt-1">{m.meeting_reason}</p>}
                                        <p className="text-primary mt-1 text-[10px]">Clique para ver detalhes</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                  {dayMeetingsInHour.length === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                      <Plus className="h-3 w-3 text-muted-foreground/40" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </TooltipProvider>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 px-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Agendada</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Realizada</div>
                    <span className="ml-auto text-muted-foreground/60">Clique em um horário vazio para agendar</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>



          {calendarView === 'month' && (
          <AnimatePresence mode="wait">
            {selectedDate && (
              <motion.div
                key={format(selectedDate, 'yyyy-MM-dd')}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-border/60">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            const prev = addDays(selectedDate!, -1);
                            setSelectedDate(prev);
                            if (!isSameMonth(prev, calendarMonth)) setCalendarMonth(startOfMonth(prev));
                          }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span
                          className="cursor-pointer hover:text-primary transition-colors"
                          onClick={() => { setSelectedDate(new Date()); setCalendarMonth(startOfMonth(new Date())); }}
                          title="Voltar para hoje"
                        >
                          {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            const next = addDays(selectedDate!, 1);
                            setSelectedDate(next);
                            if (!isSameMonth(next, calendarMonth)) setCalendarMonth(startOfMonth(next));
                          }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {availableSlots.length}/{ALL_SLOTS.length} livres
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 pb-3">
                    <div className="space-y-0.5">
                      <TooltipProvider delayDuration={200}>
                        {ALL_SLOTS.map(slot => {
                          const dateStr = format(selectedDate, 'yyyy-MM-dd');
                          const dayMeetings = meetingsByDate[dateStr] || [];
                          const meetingsInSlot = dayMeetings.filter(m => {
                            if (m.status === 'cancelled') return false;
                            const [h, min] = m.meeting_time.split(':').map(Number);
                            const startMin = h * 60 + min;
                            const endMin = startMin + m.duration_minutes;
                            const [sh, sm] = slot.split(':').map(Number);
                            const slotStart = sh * 60 + sm;
                            return slotStart >= startMin && slotStart < endMin;
                          });
                          const isBusy = meetingsInSlot.length > 0;
                          const exactStartMeetings = meetingsInSlot.filter(m => m.meeting_time.slice(0, 5) === slot);
                          const hasExactStart = exactStartMeetings.length > 0;

                          if (isBusy && !hasExactStart) {
                            return (
                              <div key={slot} className="flex items-center h-6 px-2 text-[10px] text-muted-foreground/40">
                                <span className="w-10 text-right mr-2 tabular-nums">{slot}</span>
                                <div className="flex-1 h-px bg-border/30" />
                              </div>
                            );
                          }

                          if (hasExactStart) {
                            return (
                              <div key={slot} className="space-y-0.5">
                                {exactStartMeetings.map(meetingInSlot => {
                                  const meetingDate = parseISO(meetingInSlot.meeting_date);
                                  const now = new Date();
                                  const isPast = meetingDate <= now;
                                  const isPendingAnnotation = isPast && meetingInSlot.status !== 'cancelled' && !minutesMeetingIds.has(meetingInSlot.id);
                                  
                                  let bgClass = 'bg-primary/8 hover:bg-primary/15 border border-primary/20';
                                  let barClass = 'bg-primary';
                                  if (isPendingAnnotation) {
                                    bgClass = 'bg-destructive/8 hover:bg-destructive/15 border border-destructive/20';
                                    barClass = 'bg-destructive';
                                  } else if (meetingInSlot.status === 'completed') {
                                    bgClass = 'bg-success/8 hover:bg-success/15 border border-success/20';
                                    barClass = 'bg-success';
                                  }
                                  
                                  return (
                                  <div
                                    key={meetingInSlot.id}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-all",
                                      bgClass
                                    )}
                                    onClick={() => handleOpenDetail(meetingInSlot)}
                                  >
                                    <span className="w-10 text-right text-[10px] tabular-nums font-medium text-foreground/70 mr-1">{slot}</span>
                                    <div className={cn("w-1 h-4 rounded-full shrink-0", barClass)} />
                                    <span className="text-xs font-medium text-foreground truncate flex-1">{meetingInSlot.title}</span>
                                    <span className="text-[10px] text-muted-foreground shrink-0">{meetingInSlot.duration_minutes}min</span>
                                  </div>
                                  );
                                })}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={slot}
                              className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/40 cursor-pointer transition-all group"
                              onClick={() => handleSlotClick(slot)}
                            >
                              <span className="w-10 text-right text-[10px] tabular-nums text-muted-foreground mr-1">{slot}</span>
                              <div className="flex-1 h-px bg-border/40 group-hover:bg-primary/30 transition-colors" />
                              <Plus className="h-3 w-3 text-transparent group-hover:text-primary transition-all" />
                            </div>
                          );
                        })}
                      </TooltipProvider>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>

        {/* Meeting list */}
        <div className="space-y-4 lg:col-span-12">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const prev = addDays(selectedDate || new Date(), -1);
                  setSelectedDate(prev);
                  if (!isSameMonth(prev, calendarMonth)) setCalendarMonth(startOfMonth(prev));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2
                className="text-lg font-semibold text-foreground cursor-pointer hover:text-primary transition-colors"
                onClick={() => { setSelectedDate(new Date()); setCalendarMonth(startOfMonth(new Date())); }}
                title="Voltar para hoje"
              >
                {selectedDate
                  ? isToday(selectedDate)
                    ? 'Reuniões de Hoje'
                    : `Reuniões — ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                  : 'Todas as reuniões'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const next = addDays(selectedDate || new Date(), 1);
                  setSelectedDate(next);
                  if (!isSameMonth(next, calendarMonth)) setCalendarMonth(startOfMonth(next));
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {selectedDate && !isToday(selectedDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[11px] ml-1"
                  onClick={() => { setSelectedDate(new Date()); setCalendarMonth(startOfMonth(new Date())); }}
                >
                  Hoje
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue placeholder="Motivo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motivos ({meetings.length})</SelectItem>
                  {MEETING_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r} {reasonCounts[r] ? `(${reasonCounts[r]})` : '(0)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canCreate && (
                <Button size="sm" onClick={() => handleOpenNew(selectedDate)} className="h-8 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Agendar
                </Button>
              )}
            </div>
          </div>

          {filteredMeetings.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="border-dashed border-2 border-border/50">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <CalendarDays className="h-7 w-7 text-muted-foreground/60" />
                  </div>
                  <p className="text-muted-foreground font-medium">Nenhuma reunião para esta data</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Clique em um horário livre no calendário ou use o botão abaixo</p>
                  {canCreate && (
                    <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => handleOpenNew(selectedDate)}>
                      <Plus className="h-3.5 w-3.5" /> Agendar reunião
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((m, i) => {
                const config = STATUS_CONFIG[m.status] || STATUS_CONFIG.scheduled;
                const isPast = isBefore(parseISO(m.meeting_date), new Date()) && m.status === 'scheduled';
                const hasLoyalty = m.loyalty_index != null;
                const isInternalMeeting = m.loyalty_index === 0;
                const hasMinutes = !!m.minutes_url;
                const hasRecording = !!m.recording_url;
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className={cn(
                      'transition-all hover:shadow-md border-l-[3px]',
                      m.status === 'cancelled' && 'opacity-50 border-l-destructive/40',
                      m.status === 'completed' && 'border-l-success',
                      m.status === 'scheduled' && (isPast ? 'border-l-warning' : 'border-l-primary'),
                    )}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
                              <Badge className={cn('text-[10px] px-2 py-0', config.color)}>{config.label}</Badge>
                              {isPast && <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Atrasada</Badge>}
                              {m.status === 'scheduled' && !isPast && (() => {
                                const [hh, mm] = m.meeting_time.split(':').map(Number);
                                const mt = new Date(); mt.setHours(hh, mm, 0, 0);
                                const now = new Date();
                                const diff = mt.getTime() - now.getTime();
                                return isSameDay(parseISO(m.meeting_date), now) && diff > 0 && diff <= 30 * 60 * 1000;
                              })() && (
                                <Badge className="text-[10px] px-2 py-0 bg-amber-500/20 text-amber-500 animate-pulse gap-1">
                                  <Bell className="h-3 w-3" /> Em breve
                                </Badge>
                              )}
                              {m.meeting_reason && <Badge variant="outline" className="text-[10px]">{m.meeting_reason}</Badge>}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(parseISO(m.meeting_date), "dd/MM/yyyy")}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{m.meeting_time.slice(0, 5)} · {m.duration_minutes}min</span>
                              {m.client_name && <span className="flex items-center gap-1"><User className="h-3 w-3" />{m.client_name}</span>}
                            </div>
                            {m.client_email && emailStats[m.client_email.toLowerCase()] && (
                              <div className="flex items-center gap-3 text-[10px] mt-1">
                                <span className="text-muted-foreground">Reuniões com este cliente:</span>
                                <span className="font-medium text-foreground">{emailStats[m.client_email.toLowerCase()].total} total</span>
                                <span className="text-success">{emailStats[m.client_email.toLowerCase()].completed} realizadas</span>
                                <span className="text-info">{emailStats[m.client_email.toLowerCase()].scheduled} agendadas</span>
                                <span className="text-destructive">{emailStats[m.client_email.toLowerCase()].cancelled} canceladas</span>
                              </div>
                            )}
                            {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
                            {(rescheduleHistory[m.id]?.length > 0 || m.reschedule_reason) && (
                              <div className="mt-1 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Histórico de reagendamentos ({rescheduleHistory[m.id]?.length || 1})</span>
                                </div>
                                {rescheduleHistory[m.id]?.length > 0 ? (
                                  <div className="ml-4 space-y-1 border-l-2 border-muted pl-3">
                                    {rescheduleHistory[m.id].slice(0, 3).map((r, idx) => (
                                      <div key={idx} className="text-[10px] text-muted-foreground">
                                        <span className="font-medium text-foreground/70">
                                          {format(parseISO(r.previous_date), 'dd/MM')} {r.previous_time?.slice(0,5)} → {format(parseISO(r.new_date), 'dd/MM')} {r.new_time?.slice(0,5)}
                                        </span>
                                        <span className="ml-1.5">— {r.reason}</span>
                                        <span className="ml-1.5 text-muted-foreground/50">({format(parseISO(r.created_at), 'dd/MM/yy')})</span>
                                      </div>
                                    ))}
                                    {rescheduleHistory[m.id].length > 3 && (
                                      <p className="text-[10px] text-muted-foreground/50">+{rescheduleHistory[m.id].length - 3} mais</p>
                                    )}
                                  </div>
                                ) : m.reschedule_reason ? (
                                  <div className="ml-4 text-[10px] text-muted-foreground border-l-2 border-muted pl-3">
                                    {m.reschedule_reason}
                                  </div>
                                ) : null}
                              </div>
                            )}
                            {m.status === 'completed' && (
                              <div className="mt-2 pt-2 border-t border-border space-y-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                  {hasMinutes && <a href={m.minutes_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><FileText className="h-3.5 w-3.5" /> Ata</a>}
                                  {hasRecording && <a href={m.recording_url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"><Video className="h-3.5 w-3.5" /> Gravação</a>}
                                  {!hasMinutes && !hasRecording && <span className="text-xs text-muted-foreground/60 italic">Sem ata ou gravação</span>}
                                </div>
                                {hasLoyalty ? (
                                  <div className="flex items-center gap-3">
                                    {isInternalMeeting ? (
                                      <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">Interna</Badge>
                                    ) : (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10">
                                        <Star className="h-3.5 w-3.5 text-warning" />
                                        <span className="text-xs font-bold text-foreground">Fidelidade: {m.loyalty_index}/5</span>
                                      </div>
                                    )}
                                    {m.loyalty_reason && !isInternalMeeting && <span className="text-xs text-muted-foreground line-clamp-1">— {m.loyalty_reason}</span>}
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2" onClick={() => handleOpenConfirm(m)}><Edit2 className="h-3 w-3 mr-1" /> Editar</Button>
                                  </div>
                                ) : (
                                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs border-warning/40 text-warning hover:bg-warning/10 hover:text-warning" onClick={() => handleOpenConfirm(m)}><Star className="h-3.5 w-3.5" /> Preencher índice de fidelidade</Button>
                                )}
                                {csatMap[m.id] && (
                                  <div className="flex items-center gap-2">
                                    {csatMap[m.id].responded ? (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10"><MessageSquare className="h-3.5 w-3.5 text-success" /><span className="text-xs font-bold text-success">CSAT: {csatMap[m.id].score}/10</span></div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground">CSAT enviado · Aguardando resposta</span></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            {m.status === 'scheduled' && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <Button size="sm" className="h-8 gap-1.5 text-xs bg-success/90 hover:bg-success text-white" onClick={() => handleOpenConfirm(m)}><CheckCircle className="h-3.5 w-3.5" /> Concluir reunião</Button>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {m.meeting_url && <Button variant="ghost" size="icon" className="h-8 w-8" asChild><a href={m.meeting_url} target="_blank" rel="noopener noreferrer"><Video className="h-4 w-4 text-primary" /></a></Button>}
                            {m.status === 'scheduled' && <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Adicionar ao Google Calendar"><a href={buildGoogleCalendarUrl(m)} target="_blank" rel="noopener noreferrer"><CalendarDays className="h-4 w-4 text-success" /></a></Button>}
                            {m.status === 'scheduled' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">Cancelar</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Cancelar reunião?</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja cancelar <strong>{m.title}</strong>?</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => handleStatusChange(m.id, 'cancelled')}>Confirmar cancelamento</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {(m.status === 'cancelled' || m.status === 'completed') && <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => handleReschedule(m)}><RefreshCw className="h-3.5 w-3.5" /> Reagendar</Button>}
                            {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}><Edit2 className="h-3.5 w-3.5" /></Button>}
                            {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Confirm Meeting Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Confirmar Reunião
            </DialogTitle>
          </DialogHeader>
          {confirmingMeeting && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm font-semibold text-foreground">{confirmingMeeting.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(confirmingMeeting.meeting_date), "dd/MM/yyyy")} às {confirmingMeeting.meeting_time.slice(0, 5)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Link da Ata da Reunião</Label>
                <Input
                  value={confirmForm.minutes_url}
                  onChange={e => setConfirmForm(f => ({ ...f, minutes_url: e.target.value }))}
                  placeholder="https://docs.google.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Link da Gravação</Label>
                <Input
                  value={confirmForm.recording_url}
                  onChange={e => setConfirmForm(f => ({ ...f, recording_url: e.target.value }))}
                  placeholder="https://meet.google.com/recording/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Índice de Fidelidade *</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setConfirmForm(f => ({ ...f, loyalty_stars: star }))}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Star
                        className={cn(
                          "h-7 w-7 transition-colors",
                          star <= confirmForm.loyalty_stars
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        )}
                      />
                    </button>
                  ))}
                  {confirmForm.loyalty_stars > 0 && (
                    <span className="text-sm text-muted-foreground ml-2">
                      {confirmForm.loyalty_stars}/5
                    </span>
                  )}
                </div>
                {confirmForm.loyalty_stars > 0 && confirmForm.loyalty_stars <= 2 && (
                  <p className="text-xs text-destructive">⚠️ Índice baixo — observação obrigatória</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  Observações {confirmForm.loyalty_stars > 0 && confirmForm.loyalty_stars <= 2 ? '*' : ''}
                </Label>
                <Textarea
                  value={confirmForm.observations}
                  onChange={e => setConfirmForm(f => ({ ...f, observations: e.target.value }))}
                  placeholder={confirmForm.loyalty_stars <= 2 && confirmForm.loyalty_stars > 0 ? 'Explique o motivo do índice baixo...' : 'Observações sobre a reunião (opcional)...'}
                  rows={3}
                  className={cn(confirmForm.loyalty_stars > 0 && confirmForm.loyalty_stars <= 2 && "border-destructive/50 focus-visible:ring-destructive/30")}
                />
              </div>
              <Button className="w-full" onClick={handleConfirmSubmit} disabled={confirmSubmitting}>
                {confirmSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Confirmar Reunião
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Detalhes da Reunião
            </DialogTitle>
          </DialogHeader>
          {detailMeeting && (
            <div className="space-y-4 pt-2">
              {/* Meeting info */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{detailMeeting.title}</h3>
                  <Badge className={cn('text-[10px] px-2 py-0', (STATUS_CONFIG[detailMeeting.status] || STATUS_CONFIG.scheduled).color)}>
                    {(STATUS_CONFIG[detailMeeting.status] || STATUS_CONFIG.scheduled).label}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    {format(parseISO(detailMeeting.meeting_date), "dd/MM/yyyy")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {detailMeeting.meeting_time.slice(0, 5)} · {detailMeeting.duration_minutes}min
                  </div>
                  {detailMeeting.client_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {detailMeeting.client_name}
                    </div>
                  )}
                  {detailMeeting.client_email && (
                    <div className="flex items-center gap-1.5 text-primary">
                      {detailMeeting.client_email}
                    </div>
                  )}
                  {detailMeeting.meeting_reason && (
                    <div className="col-span-2">
                      <Badge variant="outline" className="text-[10px]">{detailMeeting.meeting_reason}</Badge>
                    </div>
                  )}
                </div>
                {detailMeeting.description && (
                  <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">{detailMeeting.description}</p>
                )}
                {detailMeeting.meeting_url && (
                  <a href={detailMeeting.meeting_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <Video className="h-3 w-3" /> Link da reunião
                  </a>
                )}
              </div>

              {/* Loyalty info */}
              {detailMeeting.loyalty_index != null && (
                <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 space-y-1">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-warning" />
                    <span className="text-sm font-semibold">Fidelidade: {detailMeeting.loyalty_index === 0 ? 'Interna' : `${detailMeeting.loyalty_index}/5`}</span>
                  </div>
                  {detailMeeting.loyalty_reason && detailMeeting.loyalty_index !== 0 && (
                    <p className="text-xs text-muted-foreground">{detailMeeting.loyalty_reason}</p>
                  )}
                </div>
              )}

              {/* CSAT */}
              {csatMap[detailMeeting.id] && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border">
                  {csatMap[detailMeeting.id].responded ? (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-success" />
                      <span className="text-sm font-bold text-success">CSAT: {csatMap[detailMeeting.id].score}/10</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">CSAT enviado · Aguardando resposta</span>
                    </div>
                  )}
                </div>
              )}

              {/* Editable: Notes */}
              <div className="space-y-2">
                <Label>Anotações da Reunião</Label>
                <Textarea
                  value={detailNotes}
                  onChange={e => setDetailNotes(e.target.value)}
                  placeholder="O que foi conversado, decisões tomadas..."
                  rows={3}
                />
              </div>


              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                <Button className="flex-1" onClick={handleSaveDetail} disabled={detailSaving}>
                  {detailSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
                {canEdit && (
                  <Button variant="outline" onClick={() => { setDetailDialogOpen(false); handleEdit(detailMeeting); }}>
                    <Edit2 className="h-4 w-4 mr-2" /> Editar Reunião
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
