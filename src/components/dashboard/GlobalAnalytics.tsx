import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import {
  CheckCircle, Clock, DollarSign, TrendingUp, AlertTriangle, BarChart3,
  CalendarDays, Loader2, RefreshCw, Users, FileImage, Zap, Target, Timer, Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, startOfWeek, startOfDay, subMonths, subDays, isAfter, differenceInDays, differenceInHours } from 'date-fns';
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

const TYPE_SHORT_LABELS: Record<string, string> = {
  login: 'Login', banner_vitrine: 'Banner', product_cover: 'Capa',
  trail_banner: 'Trilha', challenge_banner: 'Desafio',
  community_banner: 'Comunidade', app_mockup: 'Mockup',
};

export default function GlobalAnalytics() {
  const [images, setImages] = useState<AnalyticsImage[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [imgResult, delResult, revResult] = await Promise.all([
        supabase.from('briefing_images')
          .select('id, status, deadline, created_at, revision_count, price_per_art, image_type, assigned_email, briefing_requests!inner(platform_url, requester_name)')
          .order('created_at', { ascending: true }),
        supabase.from('briefing_deliveries')
          .select('briefing_image_id, created_at, delivered_by_email')
          .order('created_at', { ascending: true }),
        supabase.from('briefing_reviews')
          .select('briefing_image_id, action, created_at')
          .order('created_at', { ascending: true }),
      ]);
      setImages((imgResult.data || []).map((img: any) => ({
        ...img,
        platform_url: img.briefing_requests?.platform_url || '',
        requester_name: img.briefing_requests?.requester_name || '',
      })) as AnalyticsImage[]);
      setDeliveries((delResult.data || []) as DeliveryRecord[]);
      setReviews((revResult.data || []) as ReviewRecord[]);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Computed metrics ───
  const metrics = useMemo(() => {
    if (images.length === 0) return null;
    const now = new Date();

    // Basic counts
    const completedImages = images.filter(i => i.status === 'completed');
    const pendingImages = images.filter(i => ['pending', 'in_progress'].includes(i.status));

    // Delivery map (first delivery per image)
    const deliveryMap = new Map<string, string>();
    deliveries.forEach(d => {
      if (!deliveryMap.has(d.briefing_image_id)) deliveryMap.set(d.briefing_image_id, d.created_at);
    });

    // First delivery per image (for time calculations)
    const firstDeliveryMap = new Map<string, string>();
    deliveries.forEach(d => {
      const existing = firstDeliveryMap.get(d.briefing_image_id);
      if (!existing || new Date(d.created_at) < new Date(existing)) {
        firstDeliveryMap.set(d.briefing_image_id, d.created_at);
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
    const totalEarnings = images.filter(i => i.status === 'completed' && i.price_per_art).reduce((sum, i) => sum + (i.price_per_art || 0), 0);
    const pendingEarnings = images.filter(i => ['pending', 'in_progress', 'review'].includes(i.status) && i.price_per_art).reduce((sum, i) => sum + (i.price_per_art || 0), 0);

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
      const monthDels = deliveries.filter(d => { const dd = new Date(d.created_at); return dd >= mStart && dd < mEnd; });
      const deliveredIds = new Set(monthDels.map(d => d.briefing_image_id));
      const monthValue = images.filter(i => deliveredIds.has(i.id) && i.price_per_art).reduce((sum, i) => sum + (i.price_per_art || 0), 0);
      monthlyData.push({ month: format(monthDate, 'MMM', { locale: ptBR }), entregas: monthDels.length, valor: monthValue });
    }

    // Approval rate per month
    const approvalData: { month: string; taxa: number; aprovadas: number; refacoes: number; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = startOfMonth(monthDate);
      const mEnd = i > 0 ? startOfMonth(subMonths(now, i - 1)) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthRevs = reviews.filter(r => { const rd = new Date(r.created_at); return rd >= mStart && rd < mEnd; });
      const approved = monthRevs.filter(r => r.action === 'approved').length;
      const revisions = monthRevs.filter(r => r.action === 'revision_requested').length;
      const total = approved + revisions;
      approvalData.push({ month: format(monthDate, "MMM/yy", { locale: ptBR }), taxa: total > 0 ? Math.round((approved / total) * 100) : 0, aprovadas: approved, refacoes: revisions, total });
    }
    const totalApproved = approvalData.reduce((s, d) => s + d.aprovadas, 0);
    const totalRevs = approvalData.reduce((s, d) => s + d.refacoes, 0);
    const totalAll = totalApproved + totalRevs;
    const overallRate = totalAll > 0 ? Math.round((totalApproved / totalAll) * 100) : 0;

    // By type distribution
    const byType: Record<string, number> = {};
    images.forEach(i => { const label = IMAGE_TYPE_LABELS[i.image_type as ImageType] || i.image_type; byType[label] = (byType[label] || 0) + 1; });
    const typeData = Object.entries(byType).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value }));

    // Designer stats
    const designerStats: Record<string, { total: number; completed: number; revisions: number; delivered: number }> = {};
    images.forEach(img => {
      const email = img.assigned_email || 'Não atribuído';
      if (!designerStats[email]) designerStats[email] = { total: 0, completed: 0, revisions: 0, delivered: 0 };
      designerStats[email].total += 1;
      if (img.status === 'completed') designerStats[email].completed += 1;
      designerStats[email].revisions += img.revision_count;
    });
    deliveries.forEach(d => {
      const email = d.delivered_by_email;
      if (!designerStats[email]) designerStats[email] = { total: 0, completed: 0, revisions: 0, delivered: 0 };
      designerStats[email].delivered += 1;
    });
    const topDesigners = Object.entries(designerStats).sort(([, a], [, b]) => b.completed - a.completed).slice(0, 10);

    // ─── NEW: Avg time by type ───
    const avgTimeByType = (() => {
      const map: Record<string, { totalDays: number; count: number }> = {};
      completedImages.forEach(img => {
        const type = img.image_type;
        if (!map[type]) map[type] = { totalDays: 0, count: 0 };
        const created = new Date(img.created_at).getTime();
        const approvalReview = reviews.find(r => r.briefing_image_id === img.id && r.action === 'approved');
        const completedDate = approvalReview ? new Date(approvalReview.created_at).getTime() : created;
        const days = Math.max(1, Math.round((completedDate - created) / (1000 * 60 * 60 * 24)));
        map[type].totalDays += days;
        map[type].count += 1;
      });
      return Object.entries(map).map(([type, data]) => ({
        type: TYPE_SHORT_LABELS[type] || type, fullType: type, avgDays: Math.round(data.totalDays / data.count), count: data.count,
      })).sort((a, b) => b.avgDays - a.avgDays);
    })();

    // ─── NEW: Top refaction clients ───
    const topRefactionClients = (() => {
      const map: Record<string, { url: string; name: string; totalRefactions: number; artCount: number; completedCount: number }> = {};
      images.forEach(img => {
        const url = img.platform_url || '';
        const name = img.requester_name || url;
        if (!map[url]) map[url] = { url, name, totalRefactions: 0, artCount: 0, completedCount: 0 };
        map[url].artCount += 1;
        map[url].totalRefactions += img.revision_count || 0;
        if (img.status === 'completed') map[url].completedCount += 1;
      });
      return Object.values(map).filter(c => c.totalRefactions > 0)
        .map(c => ({ ...c, avgRefactions: c.artCount > 0 ? (c.totalRefactions / c.artCount).toFixed(1) : '0', refactionRate: c.artCount > 0 ? Math.round((c.totalRefactions / c.artCount) * 100) : 0 }))
        .sort((a, b) => b.totalRefactions - a.totalRefactions).slice(0, 10);
    })();

    // ─── NEW: No-adjustment approval rate ───
    const artsWithNoRevisions = completedImages.filter(i => i.revision_count === 0).length;
    const noAdjustmentRate = completedImages.length > 0 ? Math.round((artsWithNoRevisions / completedImages.length) * 100) : 0;

    // ─── NEW: Refaction rate by client ───
    const refactionByClient = (() => {
      const map: Record<string, { name: string; total: number; withRefaction: number }> = {};
      images.forEach(img => {
        const url = img.platform_url || '';
        if (!map[url]) map[url] = { name: img.requester_name || url, total: 0, withRefaction: 0 };
        map[url].total += 1;
        if (img.revision_count > 0) map[url].withRefaction += 1;
      });
      return Object.entries(map)
        .map(([url, d]) => ({ url, name: d.name, rate: d.total > 0 ? Math.round((d.withRefaction / d.total) * 100) : 0, total: d.total, withRefaction: d.withRefaction }))
        .filter(c => c.withRefaction > 0)
        .sort((a, b) => b.rate - a.rate).slice(0, 10);
    })();

    // ─── NEW: Arts with >3 refactions ───
    const artsOver3Refactions = images.filter(i => i.revision_count > 3);

    // ─── NEW: SLA metrics ───
    // Avg time from request to first delivery
    const avgTimeToFirstDelivery = (() => {
      const times: number[] = [];
      images.forEach(img => {
        const fd = firstDeliveryMap.get(img.id);
        if (fd) {
          const hours = differenceInHours(new Date(fd), new Date(img.created_at));
          if (hours > 0) times.push(hours);
        }
      });
      return times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    })();

    // Avg client approval time (from delivery to approval)
    const avgClientApprovalTime = (() => {
      const times: number[] = [];
      completedImages.forEach(img => {
        const fd = firstDeliveryMap.get(img.id);
        const approval = reviews.find(r => r.briefing_image_id === img.id && r.action === 'approved');
        if (fd && approval) {
          const hours = differenceInHours(new Date(approval.created_at), new Date(fd));
          if (hours > 0) times.push(hours);
        }
      });
      return times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    })();

    // Overdue by status
    const overdueByStatus = (() => {
      const map: Record<string, number> = {};
      images.forEach(img => {
        if (img.status === 'completed' || img.status === 'cancelled') return;
        if (img.deadline && new Date(img.deadline) < now) {
          map[img.status] = (map[img.status] || 0) + 1;
        }
      });
      return map;
    })();

    // ─── NEW: Daily production (last 30 days) ───
    const dailyProduction = (() => {
      const data: { day: string; entregas: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const day = subDays(now, i);
        const dayStart = startOfDay(day);
        const dayEnd = startOfDay(subDays(now, i - 1));
        const count = deliveries.filter(d => { const dd = new Date(d.created_at); return dd >= dayStart && dd < dayEnd; }).length;
        data.push({ day: format(day, 'dd/MM'), entregas: count });
      }
      return data;
    })();

    // ─── NEW: Production per designer (bar chart data) ───
    const designerProductionChart = topDesigners
      .filter(([email]) => email !== 'Não atribuído')
      .map(([email, stats]) => ({
        designer: email.split('@')[0],
        entregues: stats.delivered,
        concluidas: stats.completed,
        refacoes: stats.revisions,
      })).slice(0, 8);

    // ─── NEW: Weekly evolution (last 12 weeks) ───
    const weeklyEvolution = (() => {
      const data: { semana: string; criadas: number; entregues: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const wEnd = subDays(now, i * 7);
        const wStart = subDays(wEnd, 7);
        const created = images.filter(img => { const d = new Date(img.created_at); return d >= wStart && d < wEnd; }).length;
        const delivered = deliveries.filter(d => { const dd = new Date(d.created_at); return dd >= wStart && dd < wEnd; }).length;
        data.push({ semana: format(wEnd, 'dd/MM'), criadas: created, entregues: delivered });
      }
      return data;
    })();

    // ─── NEW: Volume by client (top 10) ───
    const volumeByClient = (() => {
      const map: Record<string, { name: string; count: number }> = {};
      images.forEach(img => {
        const url = img.platform_url || '';
        const name = img.requester_name || url;
        if (!map[url]) map[url] = { name, count: 0 };
        map[url].count += 1;
      });
      return Object.entries(map).map(([url, d]) => ({ url, name: d.name, count: d.count })).sort((a, b) => b.count - a.count).slice(0, 10);
    })();

    return {
      completedImages, pendingImages, lateDeliveries, avgRevision,
      totalEarnings, pendingEarnings, deliveredToday, deliveredThisWeek, deliveredThisMonth,
      monthlyData, approvalData, totalApproved, totalRevs, totalAll, overallRate,
      typeData, topDesigners, avgTimeByType, topRefactionClients,
      noAdjustmentRate, artsWithNoRevisions, refactionByClient, artsOver3Refactions,
      avgTimeToFirstDelivery, avgClientApprovalTime, overdueByStatus,
      dailyProduction, designerProductionChart, weeklyEvolution, volumeByClient,
    };
  }, [images, deliveries, reviews]);

  if (loading) {
    return (
      <Card><CardContent className="py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Carregando analytics...</p>
      </CardContent></Card>
    );
  }

  if (!metrics) {
    return (
      <Card><CardContent className="py-12 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">Nenhum dado disponível ainda.</p>
      </CardContent></Card>
    );
  }

  const {
    completedImages, pendingImages, lateDeliveries, avgRevision,
    totalEarnings, pendingEarnings, deliveredToday, deliveredThisWeek, deliveredThisMonth,
    monthlyData, approvalData, totalApproved, totalRevs, totalAll, overallRate,
    typeData, topDesigners, avgTimeByType, topRefactionClients,
    noAdjustmentRate, artsWithNoRevisions, refactionByClient, artsOver3Refactions,
    avgTimeToFirstDelivery, avgClientApprovalTime, overdueByStatus,
    dailyProduction, designerProductionChart, weeklyEvolution, volumeByClient,
  } = metrics;

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatHours = (hours: number) => hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;

  return (
    <div className="space-y-6">
      {/* ═══ KPIs Row 1 ═══ */}
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

      {/* ═══ SLA Operacional ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Timer className="h-4 w-4 text-primary" /> SLA Operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-extrabold text-foreground">{formatHours(avgTimeToFirstDelivery)}</p>
                <p className="text-[11px] text-muted-foreground">Tempo médio até 1ª entrega</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-extrabold text-foreground">{formatHours(avgClientApprovalTime)}</p>
                <p className="text-[11px] text-muted-foreground">Tempo médio aprovação cliente</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className={`text-2xl font-extrabold ${noAdjustmentRate >= 70 ? 'text-primary' : noAdjustmentRate >= 50 ? 'text-amber-500' : 'text-destructive'}`}>{noAdjustmentRate}%</p>
                <p className="text-[11px] text-muted-foreground">Aprovação sem ajustes</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-extrabold text-destructive">{artsOver3Refactions.length}</p>
                <p className="text-[11px] text-muted-foreground">Artes com +3 refações</p>
              </div>
            </div>
            {Object.keys(overdueByStatus).length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Artes atrasadas por status</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(overdueByStatus).map(([status, count]) => (
                    <Badge key={status} variant="outline" className="text-xs text-destructive border-destructive/30">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Eficiência do Processo ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.34 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Eficiência do Processo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className={`text-2xl font-extrabold ${noAdjustmentRate >= 70 ? 'text-primary' : 'text-amber-500'}`}>{noAdjustmentRate}%</p>
                <p className="text-[11px] text-muted-foreground">Taxa aprovação sem ajustes</p>
                <p className="text-[9px] text-muted-foreground">{artsWithNoRevisions} de {completedImages.length} aprovadas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-extrabold text-foreground">{avgRevision}</p>
                <p className="text-[11px] text-muted-foreground">Média ajustes por arte</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-2xl font-extrabold text-destructive">{artsOver3Refactions.length}</p>
                <p className="text-[11px] text-muted-foreground">Artes com +3 refações</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <p className={`text-2xl font-extrabold ${overallRate >= 80 ? 'text-primary' : overallRate >= 50 ? 'text-amber-500' : 'text-destructive'}`}>{overallRate}%</p>
                <p className="text-[11px] text-muted-foreground">Taxa geral de aprovação</p>
              </div>
            </div>
            {/* Refaction rate by client */}
            {refactionByClient.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Taxa de refação por cliente (top 10)</p>
                <div className="space-y-1.5">
                  {refactionByClient.slice(0, 5).map(c => (
                    <div key={c.url} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/20">
                      <span className="text-sm truncate max-w-[200px]">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{c.withRefaction}/{c.total}</span>
                        <Badge variant="outline" className={`text-xs ${c.rate > 50 ? 'text-destructive border-destructive/30' : 'text-amber-500 border-amber-500/30'}`}>{c.rate}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

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

      {/* ═══ Produção por Dia (30 dias) ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Produção por Dia (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyProduction} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} className="fill-muted-foreground" interval={2} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Charts row: Monthly + Type ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Entregas por Mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(value: number, name: string) => [name === 'valor' ? formatCurrency(value) : value, name === 'valor' ? 'Valor' : 'Entregas']} />
                    <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                {monthlyData.filter(m => m.valor > 0).map(m => (
                  <Badge key={m.month} variant="outline" className="gap-1 text-xs"><DollarSign className="h-3 w-3" /> {m.month}: {formatCurrency(m.valor)}</Badge>
                ))}
                {monthlyData.every(m => m.valor === 0) && <p className="text-xs text-muted-foreground">Nenhum valor financeiro nos últimos 6 meses</p>}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><FileImage className="h-4 w-4" /> Distribuição por Tipo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {typeData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
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

      {/* ═══ Produção por Designer ═══ */}
      {designerProductionChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Produção por Designer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={designerProductionChart} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="designer" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="entregues" name="Entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="concluidas" name="Concluídas" fill="hsl(160 60% 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="refacoes" name="Refações" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ Evolução Semanal ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.53 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Evolução Semanal (últimas 12 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyEvolution} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="semana" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="criadas" name="Artes criadas" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="entregues" name="Entregas" stroke="hsl(160 60% 45%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Approval rate */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Aprovação vs Refação Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {totalAll === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma avaliação registrada</p>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`text-3xl font-extrabold ${overallRate >= 80 ? 'text-primary' : overallRate >= 50 ? 'text-amber-500' : 'text-destructive'}`}>{overallRate}%</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Taxa geral de aprovação</p>
                    <p className="text-xs text-muted-foreground">{totalApproved} aprovadas · {totalRevs} refações</p>
                  </div>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={approvalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="aprovadas" name="Aprovadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="refacoes" name="Refações" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
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
                          <Badge variant="outline" className={`text-xs ${d.taxa >= 80 ? 'border-primary/40 text-primary' : d.taxa >= 50 ? 'border-amber-500/40 text-amber-500' : 'border-destructive/40 text-destructive'}`}>{d.taxa}%</Badge>
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

      {/* ═══ Volume de Demanda ═══ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.57 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Volume de Demanda por Cliente (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {volumeByClient.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
            ) : (
              <div className="space-y-2">
                {volumeByClient.map((c, i) => (
                  <div key={c.url} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">{c.count} artes</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top designers */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Desempenho por Designer</CardTitle>
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
                        <p className="text-xs text-muted-foreground">{stats.total} artes · {stats.revisions} refações · {stats.delivered} entregas</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">{stats.completed} aprovadas</Badge>
                        <Badge variant="outline" className={`text-xs ${rate >= 80 ? 'border-primary/40 text-primary' : rate >= 50 ? 'border-amber-500/40 text-amber-500' : 'border-destructive/40 text-destructive'}`}>{rate}%</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tempo médio por tipo */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Tempo Médio de Conclusão por Tipo de Arte (dias)</CardTitle>
            <p className="text-xs text-muted-foreground">Quanto tempo cada tipo de arte leva do pedido até a aprovação</p>
          </CardHeader>
          <CardContent>
            {avgTimeByType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma arte concluída ainda</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(180, avgTimeByType.length * 45)}>
                  <BarChart data={avgTimeByType} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="type" width={90} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(value: number) => [`${value} dias`, 'Tempo médio']} />
                    <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
                      {avgTimeByType.map((entry, i) => (
                        <Cell key={i} fill={entry.avgDays > 10 ? 'hsl(var(--destructive))' : entry.avgDays > 5 ? 'hsl(30 90% 50%)' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  {avgTimeByType.map(t => (
                    <div key={t.fullType} className="text-center p-2 rounded-lg bg-muted/30">
                      <p className={`text-lg font-bold ${t.avgDays > 10 ? 'text-destructive' : t.avgDays > 5 ? 'text-amber-500' : 'text-primary'}`}>{t.avgDays}d</p>
                      <p className="text-[10px] text-muted-foreground">{t.type} ({t.count})</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top clientes com mais refações */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><RefreshCw className="h-4 w-4 text-amber-500" /> Top Clientes com Mais Refações</CardTitle>
            <p className="text-xs text-muted-foreground">Clientes que mais solicitam ajustes nas artes</p>
          </CardHeader>
          <CardContent>
            {topRefactionClients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma refação registrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Artes</TableHead>
                    <TableHead className="text-center">Refações</TableHead>
                    <TableHead className="text-center">Média/arte</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead>Taxa de refação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topRefactionClients.map(c => (
                    <TableRow key={c.url}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.url}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">{c.artCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-xs ${c.totalRefactions > 5 ? 'border-destructive/30 text-destructive' : 'border-amber-500/30 text-amber-500'}`}>{c.totalRefactions}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm">{c.avgRefactions}</TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground">{c.completedCount}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[100px]">
                            <div className={`h-full rounded-full ${c.refactionRate > 100 ? 'bg-destructive' : c.refactionRate > 50 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${Math.min(c.refactionRate, 100)}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{c.refactionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function StatCard({ icon, iconBg, value, label, delay }: { icon: React.ReactNode; iconBg: string; value: string | number; label: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card>
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
          <div>
            <p className="text-xl font-extrabold text-foreground leading-none">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
