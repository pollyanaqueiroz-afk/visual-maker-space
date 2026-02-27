import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Video, Clock, User, Trash2, Edit2, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const emptyForm = {
  title: '',
  description: '',
  meeting_date: '',
  meeting_time: '10:00',
  duration_minutes: 30,
  meeting_url: '',
  client_name: '',
  client_email: '',
  participants: '',
  notes: '',
};

  const buildGoogleCalendarUrl = (meeting: { title: string; description?: string | null; meeting_date: string; meeting_time: string; duration_minutes: number; meeting_url?: string | null; client_name?: string | null; client_email?: string | null }) => {
    const startDate = meeting.meeting_date.replace(/-/g, '');
    const [h, m] = meeting.meeting_time.split(':').map(Number);
    const startTime = `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
    const endMinutes = h * 60 + m + meeting.duration_minutes;
    const endH = Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;

    const dates = `${startDate}T${startTime}/${startDate}T${endTime}`;
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
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  useEffect(() => { fetchMeetings(); }, []);

  const handleOpenNew = (date?: Date) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      meeting_date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const handleEdit = (m: Meeting) => {
    setEditingId(m.id);
    setForm({
      title: m.title,
      description: m.description || '',
      meeting_date: m.meeting_date,
      meeting_time: m.meeting_time.slice(0, 5),
      duration_minutes: m.duration_minutes,
      meeting_url: m.meeting_url || '',
      client_name: m.client_name || '',
      client_email: m.client_email || '',
      participants: (m.participants || []).join(', '),
      notes: m.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.meeting_date || !form.meeting_time) {
      toast.error('Preencha título, data e horário');
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
        participants: form.participants ? form.participants.split(',').map(p => p.trim()).filter(Boolean) : [],
        notes: form.notes || null,
      };

      if (editingId) {
        const { error } = await (supabase.from('meetings' as any).update(payload).eq('id', editingId) as any);
        if (error) throw error;
        toast.success('Reunião atualizada!');
      } else {
        const { error } = await (supabase.from('meetings' as any).insert(payload) as any);
        if (error) throw error;
        toast.success('Reunião agendada!');
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

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await (supabase.from('meetings' as any).update({ status }).eq('id', id) as any);
    if (error) toast.error('Erro ao atualizar status');
    else fetchMeetings();
  };

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
    if (selectedDate) list = list.filter(m => isSameDay(parseISO(m.meeting_date), selectedDate));
    return list;
  }, [meetings, filterStatus, selectedDate]);

  const daysWithMeetings = useMemo(() => {
    return meetings
      .filter(m => m.status !== 'cancelled')
      .map(m => parseISO(m.meeting_date));
  }, [meetings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agendamento</h1>
          <p className="text-sm text-muted-foreground">Gerencie reuniões e calls com clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenNew()}>
              <Plus className="h-4 w-4 mr-2" /> Nova Reunião
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Reunião' : 'Nova Reunião'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Alinhamento de briefing" />
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
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="scheduled">Agendadas</SelectItem>
                  <SelectItem value="completed">Realizadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
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
                return (
                  <Card key={m.id} className={cn('transition-all hover:shadow-md', m.status === 'cancelled' && 'opacity-60')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground truncate">{m.title}</h3>
                            <Badge className={cn('text-[10px] px-2 py-0', config.color)}>{config.label}</Badge>
                            {isPast && <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Atrasada</Badge>}
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
                          {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
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
                            <Select value={m.status} onValueChange={v => handleStatusChange(m.id, v)}>
                              <SelectTrigger className="h-8 w-8 p-0 border-0 [&>svg]:hidden">
                                <span className="sr-only">Status</span>
                                <div className="w-2 h-2 rounded-full bg-info mx-auto" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="completed">Marcar como realizada</SelectItem>
                                <SelectItem value="cancelled">Cancelar</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(m)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
    </div>
  );
}
