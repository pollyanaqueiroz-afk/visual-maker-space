import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import {
  CheckCircle, Clock, DollarSign, TrendingUp, AlertTriangle, BarChart3,
  CalendarDays, Loader2, RefreshCw, Users, FileImage
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, startOfWeek, startOfDay, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AnalyticsImage {
  id: string;
  status: string;
  deadline: string | null;
  created_at: string;
  revision_count: number;
  price_per_art: number | null;
  image_type: string;
  assigned_email: string | null;
  platform_url?: string;
  requester_name?: string;
}

interface DeliveryRecord {
  briefing_image_id: string;
  created_at: string;
  delivered_by_email: string;
}

interface ReviewRecord {
  briefing_image_id: string;
  action: string;
  created_at: string;
}

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(200 70% 50%)',
  'hsl(45 90% 50%)',
];

export default function GlobalAnalytics() {
  const [images, setImages] = useState<AnalyticsImage[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [imgResult, delResult, revResult] = await Promise.all([
        supabase
          .from('briefing_images')
          .select('id, status, deadline, created_at, revision_count, price_per_art, image_type, assigned_email')
          .order('created_at', { ascending: true }),
        supabase
          .from('briefing_deliveries')
          .select('briefing_image_id, created_at, delivered_by_email')
          .order('created_at', { ascending: true }),
        supabase
          .from('briefing_reviews')
          .select('briefing_image_id, action, created_at')
          .order('created_at', { ascending: true }),
      ]);

      setImages((imgResult.data || []) as AnalyticsImage[]);
      setDeliveries((delResult.data || []) as DeliveryRecord[]);
      setReviews((revResult.data || []) as ReviewRecord[]);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando analytics...</p>
        </CardContent>
      </Card>
    );
  }

  if (images.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum dado disponível ainda.</p>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();

  // Status counts
  const completedImages = images.filter(i => i.status === 'completed');
  const pendingImages = images.filter(i => ['pending', 'in_progress'].includes(i.status));
  const reviewImgs = images.filter(i => i.status === 'review');

  // Delivery map
  const deliveryMap = new Map<string, string>();
  deliveries.forEach(d => {
    if (!deliveryMap.has(d.briefing_image_id)) {
      deliveryMap.set(d.briefing_image_id, d.created_at);
    }
  });

  // Late deliveries
  const lateDeliveries = images.filter(img => {
    if (!img.deadline) return false;
    const deliveryDate = deliveryMap.get(img.id);
    if (!deliveryDate) return false;
    return new Date(deliveryDate) > new Date(img.deadline);
  });

  // Average revision
  const totalRevisions = images.reduce((sum, i) => sum + i.revision_count, 0);
  const avgRevision = images.length > 0 ? (totalRevisions / images.length).toFixed(1) : '0';

  // Financial
  const totalEarnings = images
    .filter(i => i.status === 'completed' && i.price_per_art)
    .reduce((sum, i) => sum + (i.price_per_art || 0), 0);
  const pendingEarnings = images
    .filter(i => ['pending', 'in_progress', 'review'].includes(i.status) && i.price_per_art)
    .reduce((sum, i) => sum + (i.price_per_art || 0), 0);

  // Period counts
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const deliveredToday = deliveries.filter(d => isAfter(new Date(d.created_at), todayStart)).length;
  const deliveredThisWeek = deliveries.filter(d => isAfter(new Date(d.created_at), weekStart)).length;
  const deliveredThisMonth = deliveries.filter(d => isAfter(new Date(d.created_at), monthStart)).length;

  // Monthly chart (last 6 months)
  const monthlyData: { month: string; entregas: number; valor: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = i > 0 ? startOfMonth(subMonths(now, i - 1)) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthDels = deliveries.filter(d => {
      const dd = new Date(d.created_at);
      return dd >= mStart && dd < mEnd;
    });
    const deliveredIds = new Set(monthDels.map(d => d.briefing_image_id));
    const monthValue = images
      .filter(i => deliveredIds.has(i.id) && i.price_per_art)
      .reduce((sum, i) => sum + (i.price_per_art || 0), 0);
    monthlyData.push({
      month: format(monthDate, 'MMM', { locale: ptBR }),
      entregas: monthDels.length,
      valor: monthValue,
    });
  }

  // Approval rate per month
  const approvalData: { month: string; taxa: number; aprovadas: number; refacoes: number; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = i > 0 ? startOfMonth(subMonths(now, i - 1)) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthRevs = reviews.filter(r => {
      const rd = new Date(r.created_at);
      return rd >= mStart && rd < mEnd;
    });
    const approved = monthRevs.filter(r => r.action === 'approved').length;
    const revisions = monthRevs.filter(r => r.action === 'revision_requested').length;
    const total = approved + revisions;
    approvalData.push({
      month: format(monthDate, "MMM/yy", { locale: ptBR }),
      taxa: total > 0 ? Math.round((approved / total) * 100) : 0,
      aprovadas: approved,
      refacoes: revisions,
      total,
    });
  }

  const totalApproved = approvalData.reduce((s, d) => s + d.aprovadas, 0);
  const totalRevs = approvalData.reduce((s, d) => s + d.refacoes, 0);
  const totalAll = totalApproved + totalRevs;
  const overallRate = totalAll > 0 ? Math.round((totalApproved / totalAll) * 100) : 0;

  // By type distribution
  const byType: Record<string, number> = {};
  images.forEach(i => {
    const label = IMAGE_TYPE_LABELS[i.image_type as ImageType] || i.image_type;
    byType[label] = (byType[label] || 0) + 1;
  });
  const typeData = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }));

  // Top designers
  const designerStats: Record<string, { total: number; completed: number; revisions: number }> = {};
  images.forEach(img => {
    const email = img.assigned_email || 'Não atribuído';
    if (!designerStats[email]) designerStats[email] = { total: 0, completed: 0, revisions: 0 };
    designerStats[email].total += 1;
    if (img.status === 'completed') designerStats[email].completed += 1;
    designerStats[email].revisions += img.revision_count;
  });
  const topDesigners = Object.entries(designerStats)
    .sort(([, a], [, b]) => b.completed - a.completed)
    .slice(0, 8);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle className="h-5 w-5 text-primary" />} iconBg="bg-primary/10" value={completedImages.length} label="Aprovadas" delay={0} />
        <StatCard icon={<Clock className="h-5 w-5 text-amber-500" />} iconBg="bg-amber-500/10" value={pendingImages.length} label="Pendentes" delay={0.05} />
        <StatCard icon={<AlertTriangle className="h-5 w-5 text-destructive" />} iconBg="bg-destructive/10" value={lateDeliveries.length} label="Com atraso" delay={0.1} />
        <StatCard icon={<RefreshCw className="h-5 w-5 text-muted-foreground" />} iconBg="bg-muted" value={avgRevision} label="Média refação" delay={0.15} />
      </div>

      {/* Period counts */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<CalendarDays className="h-5 w-5 text-foreground" />} iconBg="bg-muted" value={deliveredToday} label="Entregas hoje" delay={0.2} />
        <StatCard icon={<CalendarDays className="h-5 w-5 text-foreground" />} iconBg="bg-muted" value={deliveredThisWeek} label="Esta semana" delay={0.25} />
        <StatCard icon={<CalendarDays className="h-5 w-5 text-foreground" />} iconBg="bg-muted" value={deliveredThisMonth} label="Este mês" delay={0.3} />
      </div>

      {/* Financial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">{formatCurrency(totalEarnings)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total investido (artes aprovadas)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-foreground leading-none">{formatCurrency(pendingEarnings)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Em andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly deliveries bar chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Entregas por Mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : 'Entregas']}
                    />
                    <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                {monthlyData.filter(m => m.valor > 0).map(m => (
                  <Badge key={m.month} variant="outline" className="gap-1 text-xs">
                    <DollarSign className="h-3 w-3" /> {m.month}: {formatCurrency(m.valor)}
                  </Badge>
                ))}
                {monthlyData.every(m => m.valor === 0) && (
                  <p className="text-xs text-muted-foreground">Nenhum valor financeiro nos últimos 6 meses</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Type distribution pie */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileImage className="h-4 w-4" /> Distribuição por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {typeData.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {typeData.map((t, idx) => (
                  <Badge key={t.name} variant="outline" className="text-xs gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                    {t.name}: {t.value}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Approval rate */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Taxa de Aprovação Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalAll === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação registrada</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`text-3xl font-extrabold ${overallRate >= 80 ? 'text-primary' : overallRate >= 50 ? 'text-amber-500' : 'text-destructive'}`}>
                    {overallRate}%
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Taxa geral de aprovação</p>
                    <p className="text-xs text-muted-foreground">{totalApproved} aprovadas · {totalRevs} refações</p>
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={approvalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="globalApprovalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => {
                          if (name === 'taxa') return [`${value}%`, 'Taxa de Aprovação'];
                          return [value, name];
                        }}
                      />
                      <Area type="monotone" dataKey="taxa" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#globalApprovalGradient)" dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo por mês</p>
                  <div className="grid gap-2">
                    {approvalData.filter(d => d.total > 0).map(d => (
                      <div key={d.month} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40">
                        <span className="text-sm font-medium text-foreground capitalize">{d.month}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">✅ {d.aprovadas} · 🔄 {d.refacoes}</span>
                          <Badge variant="outline" className={`text-xs ${d.taxa >= 80 ? 'border-primary/40 text-primary' : d.taxa >= 50 ? 'border-amber-500/40 text-amber-500' : 'border-destructive/40 text-destructive'}`}>
                            {d.taxa}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top designers */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Desempenho por Designer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDesigners.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum designer atribuído</p>
            ) : (
              <div className="space-y-3">
                {topDesigners.map(([email, stats]) => {
                  const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
                  return (
                    <div key={email} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{email}</p>
                        <p className="text-xs text-muted-foreground">{stats.total} artes · {stats.revisions} refações</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{stats.completed} aprovadas</Badge>
                        <Badge variant="outline" className={`text-xs ${rate >= 80 ? 'border-primary/40 text-primary' : rate >= 50 ? 'border-amber-500/40 text-amber-500' : 'border-destructive/40 text-destructive'}`}>
                          {rate}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, iconBg, value, label, delay }: {
  icon: React.ReactNode;
  iconBg: string;
  value: string | number;
  label: string;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div>
            <p className="text-xl font-extrabold text-foreground leading-none">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
