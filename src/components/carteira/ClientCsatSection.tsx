import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, MessageSquare, Star, Smile, Frown } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CsatRow {
  id: string;
  meeting_id: string;
  client_email: string;
  client_name: string | null;
  score: number | null;
  comment: string | null;
  responded_at: string | null;
  sent_at: string;
}

interface MeetingInfo {
  id: string;
  title: string;
  meeting_date: string;
}

const getScoreColor = (score: number) => {
  if (score >= 9) return 'hsl(var(--success))';
  if (score >= 7) return 'hsl(var(--info))';
  if (score >= 5) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
};

interface Props {
  clientUrl: string;
  clientEmail?: string | null;
  clientEmail2?: string | null;
}

export default function ClientCsatSection({ clientUrl, clientEmail, clientEmail2 }: Props) {
  const [csatData, setCsatData] = useState<CsatRow[]>([]);
  const [meetingsMap, setMeetingsMap] = useState<Record<string, MeetingInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Fetch all CSAT entries for this client's emails
      const emails = [clientEmail, clientEmail2].filter(Boolean) as string[];
      if (emails.length === 0) {
        setLoading(false);
        return;
      }

      const [csatRes, meetingsRes] = await Promise.all([
        supabase.from('meeting_csat').select('*').in('client_email', emails).order('sent_at', { ascending: false }),
        supabase.from('meetings').select('id, title, meeting_date').or(`client_url.eq.${clientUrl}${emails.map(e => `,client_email.eq.${e}`).join('')}`),
      ]);

      if (!csatRes.error) setCsatData((csatRes.data || []) as CsatRow[]);
      if (!meetingsRes.error) {
        const map: Record<string, MeetingInfo> = {};
        (meetingsRes.data || []).forEach((m: MeetingInfo) => { map[m.id] = m; });
        setMeetingsMap(map);
      }
      setLoading(false);
    })();
  }, [clientUrl, clientEmail, clientEmail2]);

  const responded = useMemo(() => csatData.filter(c => c.responded_at && c.score !== null), [csatData]);

  const avgScore = useMemo(() => {
    if (responded.length === 0) return null;
    return parseFloat((responded.reduce((s, c) => s + (c.score || 0), 0) / responded.length).toFixed(1));
  }, [responded]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (csatData.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma pesquisa CSAT enviada para este cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <MessageSquare className="h-4 w-4 mx-auto text-primary mb-1" />
            <p className="text-lg font-bold text-foreground">{csatData.length}</p>
            <p className="text-[10px] text-muted-foreground">Pesquisas Enviadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Smile className="h-4 w-4 mx-auto text-success mb-1" />
            <p className="text-lg font-bold text-foreground">{responded.length}</p>
            <p className="text-[10px] text-muted-foreground">Respostas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Star className="h-4 w-4 mx-auto text-warning mb-1" />
            <p className="text-lg font-bold text-foreground">{avgScore ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground">CSAT Médio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-foreground">
              {csatData.length > 0 ? Math.round((responded.length / csatData.length) * 100) : 0}%
            </p>
            <p className="text-[10px] text-muted-foreground">Taxa de Resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* CSAT History Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Histórico de CSAT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="text-[11px] uppercase tracking-wider">Reunião</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Data Envio</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Nota</TableHead>
                <TableHead className="text-center text-[11px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">Comentário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {csatData.map(c => {
                const meeting = meetingsMap[c.meeting_id];
                return (
                  <TableRow key={c.id} className="border-border/30">
                    <TableCell className="text-sm font-medium">
                      {meeting?.title || 'Reunião'}
                      {meeting?.meeting_date && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({format(parseISO(meeting.meeting_date), 'dd/MM/yy')})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(c.sent_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.score !== null ? (
                        <Badge
                          style={{
                            backgroundColor: `${getScoreColor(c.score)}20`,
                            color: getScoreColor(c.score),
                            borderColor: `${getScoreColor(c.score)}40`,
                          }}
                          className="border font-bold"
                        >
                          {c.score}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.responded_at ? (
                        <Badge className="bg-success/10 text-success border-success/20 border text-[10px]">Respondido</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {c.comment || '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comments */}
      {responded.filter(c => c.comment).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comentários do Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {responded.filter(c => c.comment).map(c => (
              <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${getScoreColor(c.score!)}20` }}
                >
                  <span className="text-xs font-bold" style={{ color: getScoreColor(c.score!) }}>{c.score}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(c.responded_at!), 'dd/MM/yyyy')}
                  </p>
                  <p className="text-sm text-foreground mt-0.5">{c.comment}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
