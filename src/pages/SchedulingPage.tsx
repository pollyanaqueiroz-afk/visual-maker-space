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
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Video, Clock, User, Trash2, Edit2, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Loader2, CheckCircle, FileText, Star, RefreshCw, AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermissions } from '@/hooks/usePermissions';

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
  participants: string[];
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendada', color: 'bg-info/20 text-info' },
  completed: { label: 'Realizada', color: 'bg-success/20 text-success' },
  cancelled: { label: 'Cancelada', color: 'bg-destructive/20 text-destructive' },
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

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
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('agendamento.create');
  const canEdit = hasPermission('agendamento.edit');
  const canDelete = hasPermission('agendamento.delete');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [sendInvite, setSendInvite] = useState(true);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmingMeeting, setConfirmingMeeting] = useState<Meeting | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    minutes_url: '',
    recording_url: '',
    loyalty_index: '',
    loyalty_reason: '',
  });
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [csatMap, setCsatMap] = useState<Record<string, { score: number | null; responded: boolean }>>({});

  const fetchMeetings = async () => {
    const { data, error } = await (supabase
      .from('meetings' as any)
      .select('*')
      .order('meeting_date', { ascending: true })
      .order('meeting_time', { ascending: true }) as any);

    if (error) {
      console.error(error);
      toast.error('Erro ao carregar reuniões');
    } else {
      setMeetings((data || []) as Meeting[]);
    }
    setLoading(false);
  };

  const fetchCsatData = async () => {
    const { data } = await (supabase.from('meeting_csat' as any).select('meeting_id, score, responded_at') as any);
    if (data) {
      const map: Record<string, { score: number | null; responded: boolean }> = {};
      (data as any[]).forEach((c: any) => {
        map[c.meeting_id] = { score: c.score, responded: !!c.responded_at };
      });
      setCsatMap(map);
    }
  };

  useEffect(() => { fetchMeetings(); fetchCsatData(); }, []);

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
    setForm({
      ...emptyForm,
      meeting_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const handleEdit = (m: Meeting) => {
    setEditingId(m.id);
    setIsRescheduling(false);
    setForm({
      title: m.title,
      description: m.description || '',
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time.slice(0, 5),
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || '',
      client_name: m.client_name || '',
      client_email: m.client_email || '',
      client_url: (m as any).client_url || '',
      participants: (m.participants || []).join(', '),
      notes: m.notes || '',
      meeting_reason: (m as any).meeting_reason || '',
      reschedule_reason: '',
    });
    setDialogOpen(true);
  };

  const handleReschedule = (m: Meeting) => {
    setEditingId(m.id);
    setIsRescheduling(true);
    setForm({
      title: m.title,
      description: m.description || '',
      meeting_date: format(new Date(), 'yyyy-MM-dd'),
      meeting_time: m.meeting_time.slice(0, 5),
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || '',
      client_name: m.client_name || '',
      client_email: m.client_email || '',
      client_url: (m as any).client_url || '',
      participants: (m.participants || []).join(', '),
      notes: m.notes || '',
      meeting_reason: (m as any).meeting_reason || '',
      reschedule_reason: '',
    });
    setDialogOpen(true);
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

      if (editingId) {
        const { error } = await (supabase.from('meetings' as any).update(payload).eq('id', editingId) as any);
        if (error) throw error;
        toast.success('Reunião atualizada!');
      } else {
        const { error } = await (supabase.from('meetings' as any).insert(payload) as any);
        if (error) throw error;

        // Send invite email if checkbox is checked and client email exists
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
              toast.success('Reunião agendada! ⚠️ Convite não enviado (domínio não verificado).');
            } else {
              toast.success('Reunião agendada e convite enviado!');
            }
          } catch {
            toast.success('Reunião agendada! ⚠️ Erro ao enviar convite.');
          }
        } else {
          toast.success('Reunião agendada!');
        }
      }
      setDialogOpen(false);
      fetchMeetings();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta reunião?')) return;
    const { error } = await (supabase.from('meetings' as any).delete().eq('id', id) as any);
    if (error) toast.error('Erro ao remover');
    else { toast.success('Reunião removida'); fetchMeetings(); }
  };

  const handleOpenConfirm = (m: Meeting) => {
    setConfirmingMeeting(m);
    setConfirmForm({
      minutes_url: (m as any).minutes_url || '',
      recording_url: (m as any).recording_url || '',
      loyalty_index: (m as any).loyalty_index ? String((m as any).loyalty_index) : '',
      loyalty_reason: (m as any).loyalty_reason || '',
    });
    setConfirmDialogOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmingMeeting) return;
    if (!confirmForm.loyalty_index) {
      toast.error('Selecione o índice de fidelidade');
      return;
    }
    if (!confirmForm.loyalty_reason.trim()) {
      toast.error('Preencha o motivo do índice de fidelidade');
      return;
    }
    setConfirmSubmitting(true);
    try {
      const { error } = await (supabase.from('meetings' as any).update({
        status: 'completed',
        minutes_url: confirmForm.minutes_url || null,
        recording_url: confirmForm.recording_url || null,
        loyalty_index: Number(confirmForm.loyalty_index),
        loyalty_reason: confirmForm.loyalty_reason,
      }).eq('id', confirmingMeeting.id) as any);
      if (error) throw error;
      toast.success('Reunião confirmada!');

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
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setConfirmSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await (supabase.from('meetings' as any).update({ status }).eq('id', id) as any);
    if (error) toast.error('Erro ao atualizar status');
    else fetchMeetings();
  };

  // Count meetings by reason
  const reasonCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of meetings) {
      const r = (m as any).meeting_reason;
      if (r) counts[r] = (counts[r] || 0) + 1;
    }
    return counts;
  }, [meetings]);

  // Calendar helpers
  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    meetings.forEach(m => {
      if (!map[m.meeting_date]) map[m.meeting_date] = [];
      map[m.meeting_date].push(m);
    });
    return map;
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    let list = meetings;
    if (filterStatus !== 'all') list = list.filter(m => m.status === filterStatus);
    if (filterReason !== 'all') list = list.filter(m => (m as any).meeting_reason === filterReason);
    if (selectedDate) list = list.filter(m => isSameDay(parseISO(m.meeting_date), selectedDate));
    return list;
  }, [meetings, filterStatus, filterReason, selectedDate]);

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
    meetings.filter(m => m.status === 'completed' && !(m as any).loyalty_index),
    [meetings]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending loyalty - interactive list */}
      {pendingLoyalty.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <AlertCircle className="h-4 w-4 text-warning" />
              {pendingLoyalty.length} {pendingLoyalty.length === 1 ? 'reunião pendente' : 'reuniões pendentes'} de índice de fidelidade
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {pendingLoyalty.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-background border border-border/50 hover:border-warning/40 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleOpenConfirm(m)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10">
                    <Star className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(m.meeting_date), "dd/MM/yyyy")} · {m.client_name || 'Sem cliente'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0 border-warning/30 text-warning hover:bg-warning/10 group-hover:border-warning/60"
                >
                  Preencher
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamento</h1>
          <p className="text-sm text-muted-foreground">Gerencie reuniões e calls com clientes</p>
        </div>
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
                <Label>Link da reunião (Zoom, Meet, etc.)</Label>
                <Input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder="https://meet.google.com/..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nome do cliente</Label>
                  <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="João Silva" />
                </div>
                <div className="space-y-2">
                  <Label>Email do cliente</Label>
                  <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} placeholder="joao@email.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>URL do cliente (plataforma)</Label>
                <Input value={form.client_url} onChange={e => setForm(f => ({ ...f, client_url: e.target.value }))} placeholder="https://cliente.curseduca.com" />
              </div>
              <div className="space-y-2">
                <Label>Participantes (separados por vírgula)</Label>
                <Input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} placeholder="ana@email.com, pedro@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Pauta da reunião..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas internas..." rows={2} />
              </div>
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

      {/* Calendar + List layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Calendário
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={ptBR}
              className="p-0 pointer-events-auto"
              modifiers={{
                hasMeeting: daysWithMeetings,
              }}
              modifiersClassNames={{
                hasMeeting: 'bg-primary/15 font-bold text-primary',
              }}
            />
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded bg-primary/15" />
              <span>Dias com reuniões</span>
            </div>

            {/* Available time slots */}
            {selectedDate && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-foreground mb-2">
                  Horários disponíveis — {format(selectedDate, "dd/MM")}
                </p>
                {availableSlots.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum horário disponível</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {availableSlots.map(slot => (
                      <Button
                        key={slot}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        onClick={() => handleSlotClick(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Meeting list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {selectedDate
                ? isToday(selectedDate)
                  ? 'Reuniões de Hoje'
                  : `Reuniões — ${format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}`
                : 'Todas as reuniões'}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="Motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os motivos ({meetings.length})</SelectItem>
                  {MEETING_REASONS.map(r => (
                    <SelectItem key={r} value={r}>{r} {reasonCounts[r] ? `(${reasonCounts[r]})` : '(0)'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => handleOpenNew(selectedDate)}>
                <Plus className="h-3 w-3 mr-1" /> Agendar
              </Button>
            </div>
          </div>

          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma reunião para esta data</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => handleOpenNew(selectedDate)}>
                  <Plus className="h-3 w-3 mr-1" /> Agendar reunião
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map(m => {
                const config = STATUS_CONFIG[m.status] || STATUS_CONFIG.scheduled;
                const isPast = isBefore(parseISO(m.meeting_date), new Date()) && m.status === 'scheduled';
                const hasLoyalty = !!(m as any).loyalty_index;
                const hasMinutes = !!(m as any).minutes_url;
                const hasRecording = !!(m as any).recording_url;
                return (
                  <Card key={m.id} className={cn('transition-all hover:shadow-md', m.status === 'cancelled' && 'opacity-60')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
                            <Badge className={cn('text-[10px] px-2 py-0', config.color)}>{config.label}</Badge>
                            {isPast && <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Atrasada</Badge>}
                            {(m as any).meeting_reason && <Badge variant="outline" className="text-[10px]">{(m as any).meeting_reason}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {format(parseISO(m.meeting_date), "dd/MM/yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {m.meeting_time.slice(0, 5)} · {m.duration_minutes}min
                            </span>
                            {m.client_name && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {m.client_name}
                              </span>
                            )}
                          </div>
                          {/* Email meeting stats */}
                          {m.client_email && emailStats[m.client_email.toLowerCase()] && (
                            <div className="flex items-center gap-3 text-[10px] mt-1">
                              <span className="text-muted-foreground">
                                Reuniões com este cliente:
                              </span>
                              <span className="font-medium text-foreground">{emailStats[m.client_email.toLowerCase()].total} total</span>
                              <span className="text-success">{emailStats[m.client_email.toLowerCase()].completed} realizadas</span>
                              <span className="text-info">{emailStats[m.client_email.toLowerCase()].scheduled} agendadas</span>
                              <span className="text-destructive">{emailStats[m.client_email.toLowerCase()].cancelled} canceladas</span>
                            </div>
                          )}
                          {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}

                          {/* Completed meeting details section */}
                          {m.status === 'completed' && (
                            <div className="mt-2 pt-2 border-t border-border space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                {hasMinutes && (
                                  <a href={(m as any).minutes_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                                    <FileText className="h-3.5 w-3.5" /> Ata da reunião
                                  </a>
                                )}
                                {hasRecording && (
                                  <a href={(m as any).recording_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                                    <Video className="h-3.5 w-3.5" /> Gravação
                                  </a>
                                )}
                                {!hasMinutes && !hasRecording && (
                                  <span className="text-xs text-muted-foreground/60 italic">Sem ata ou gravação</span>
                                )}
                              </div>
                              {hasLoyalty ? (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10">
                                    <Star className="h-3.5 w-3.5 text-warning" />
                                    <span className="text-xs font-bold text-foreground">Fidelidade: {(m as any).loyalty_index}/4</span>
                                  </div>
                                  {(m as any).loyalty_reason && (
                                    <span className="text-xs text-muted-foreground line-clamp-1">— {(m as any).loyalty_reason}</span>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-2"
                                    onClick={() => handleOpenConfirm(m)}
                                  >
                                    <Edit2 className="h-3 w-3 mr-1" /> Editar
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5 text-xs border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                                  onClick={() => handleOpenConfirm(m)}
                                >
                                  <Star className="h-3.5 w-3.5" />
                                  Preencher índice de fidelidade
                                </Button>
                              )}
                              {/* CSAT indicator */}
                              {csatMap[m.id] && (
                                <div className="flex items-center gap-2">
                                  {csatMap[m.id].responded ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10">
                                      <MessageSquare className="h-3.5 w-3.5 text-success" />
                                      <span className="text-xs font-bold text-success">CSAT: {csatMap[m.id].score}/10</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">CSAT enviado · Aguardando resposta</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Scheduled meeting: prominent confirm CTA */}
                          {m.status === 'scheduled' && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs bg-success/90 hover:bg-success text-white"
                                onClick={() => handleOpenConfirm(m)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Concluir reunião
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {m.meeting_url && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                              <a href={m.meeting_url} target="_blank" rel="noopener noreferrer">
                                <Video className="h-4 w-4 text-primary" />
                              </a>
                            </Button>
                          )}
                          {m.status === 'scheduled' && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Adicionar ao Google Calendar">
                              <a href={buildGoogleCalendarUrl(m)} target="_blank" rel="noopener noreferrer">
                                <CalendarDays className="h-4 w-4 text-success" />
                              </a>
                            </Button>
                          )}
                          {m.status === 'scheduled' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">Cancelar</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancelar reunião?</AlertDialogTitle>
                                  <AlertDialogDescription>Tem certeza que deseja cancelar <strong>{m.title}</strong>? Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleStatusChange(m.id, 'cancelled')}>Confirmar cancelamento</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {(m.status === 'cancelled' || m.status === 'completed') && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => handleReschedule(m)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Reagendar
                            </Button>
                          )}
                          {canEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
                <Select value={confirmForm.loyalty_index} onValueChange={v => setConfirmForm(f => ({ ...f, loyalty_index: v }))}>
                  <SelectTrigger className={!confirmForm.loyalty_index ? 'text-muted-foreground' : ''}>
                    <SelectValue placeholder="Selecione de 1 a 4" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 — Muito baixo</SelectItem>
                    <SelectItem value="2">2 — Baixo</SelectItem>
                    <SelectItem value="3">3 — Alto</SelectItem>
                    <SelectItem value="4">4 — Muito alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo do Índice *</Label>
                <Textarea
                  value={confirmForm.loyalty_reason}
                  onChange={e => setConfirmForm(f => ({ ...f, loyalty_reason: e.target.value }))}
                  placeholder="Explique o motivo pelo qual você atribuiu esse índice..."
                  rows={3}
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
    </div>
  );
}
