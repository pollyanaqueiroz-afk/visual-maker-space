import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IMAGE_TYPE_LABELS } from '@/types/briefing';
import {
  CheckCircle, Clock, DollarSign, TrendingUp, AlertTriangle, BarChart3,
  CalendarDays, Loader2, RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
}

interface DeliveryRecord {
  briefing_image_id: string;
  created_at: string;
}

interface Props {
  designerEmail: string;
}

export default function DesignerAnalytics({ designerEmail }: Props) {
  const [images, setImages] = useState<AnalyticsImage[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [designerEmail]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [imgResult, delResult] = await Promise.all([
        supabase
          .from('briefing_images')
          .select('id, status, deadline, created_at, revision_count, price_per_art, image_type')
          .eq('assigned_email', designerEmail)
          .order('created_at', { ascending: true }),
        supabase
          .from('briefing_deliveries')
          .select('briefing_image_id, created_at')
          .eq('delivered_by_email', designerEmail)
          .order('created_at', { ascending: true }),
      ]);

      setImages((imgResult.data || []) as AnalyticsImage[]);
      setDeliveries((delResult.data || []) as DeliveryRecord[]);
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

  // --- Compute metrics ---
  const now = new Date();

  // Status counts
  const completedImages = images.filter(i => i.status === 'completed');
  const pendingImages = images.filter(i => ['pending', 'in_progress'].includes(i.status));
  const reviewImages = images.filter(i => i.status === 'review');

  // Deliveries with deadline info
  const deliveryMap = new Map<string, string>(); // image_id -> delivery date
  deliveries.forEach(d => {
    // Keep the first delivery per image (original delivery)
    if (!deliveryMap.has(d.briefing_image_id)) {
      deliveryMap.set(d.briefing_image_id, d.created_at);
    }
  });

  // Late deliveries: delivered after deadline
  const lateDeliveries = images.filter(img => {
    if (!img.deadline) return false;
    const deliveryDate = deliveryMap.get(img.id);
    if (!deliveryDate) return false;
    return new Date(deliveryDate) > new Date(img.deadline);
  });

  // Average revision count
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

  // Monthly chart data (last 6 months)
  const monthlyData: { month: string; entregas: number; valor: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const mStart = startOfMonth(monthDate);
    const mEnd = i > 0 ? startOfMonth(subMonths(now, i - 1)) : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthDeliveries = deliveries.filter(d => {
      const dd = new Date(d.created_at);
      return dd >= mStart && dd < mEnd;
    });

    // Find completed images for this month's deliveries to sum price
    const deliveredImageIds = new Set(monthDeliveries.map(d => d.briefing_image_id));
    const monthValue = images
      .filter(i => deliveredImageIds.has(i.id) && i.price_per_art)
      .reduce((sum, i) => sum + (i.price_per_art || 0), 0);

    monthlyData.push({
      month: format(monthDate, 'MMM', { locale: ptBR }),
      entregas: monthDeliveries.length,
      valor: monthValue,
    });
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-4">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-primary" />}
          iconBg="bg-primary/10"
          value={completedImages.length}
          label="Entregues"
          delay={0}
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          iconBg="bg-amber-500/10"
          value={pendingImages.length}
          label="Pendentes"
          delay={0.05}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-destructive" />}
          iconBg="bg-destructive/10"
          value={lateDeliveries.length}
          label="Com atraso"
          delay={0.1}
        />
        <StatCard
          icon={<RefreshCw className="h-5 w-5 text-muted-foreground" />}
          iconBg="bg-muted"
          value={avgRevision}
          label="Média refação"
          delay={0.15}
        />
      </div>

      {/* Period counts */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-foreground" />}
          iconBg="bg-muted"
          value={deliveredToday}
          label="Hoje"
          delay={0.2}
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-foreground" />}
          iconBg="bg-muted"
          value={deliveredThisWeek}
          label="Esta semana"
          delay={0.25}
        />
        <StatCard
          icon={<CalendarDays className="h-5 w-5 text-foreground" />}
          iconBg="bg-muted"
          value={deliveredThisMonth}
          label="Este mês"
          delay={0.3}
        />
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
                  <p className="text-2xl font-extrabold text-foreground leading-none">
                    {formatCurrency(totalEarnings)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total recebido (artes aprovadas)</p>
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
                  <p className="text-2xl font-extrabold text-foreground leading-none">
                    {formatCurrency(pendingEarnings)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">A receber (em andamento)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Chart */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Entregas por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, name: string) => [
                      name === 'valor' ? formatCurrency(value) : value,
                      name === 'valor' ? 'Valor' : 'Entregas',
                    ]}
                  />
                  <Bar dataKey="entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly financial summary below chart */}
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
              {monthlyData.filter(m => m.valor > 0).map(m => (
                <Badge key={m.month} variant="outline" className="gap-1 text-xs">
                  <DollarSign className="h-3 w-3" />
                  {m.month}: {formatCurrency(m.valor)}
                </Badge>
              ))}
              {monthlyData.every(m => m.valor === 0) && (
                <p className="text-xs text-muted-foreground">Nenhum valor financeiro registrado nos últimos 6 meses</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// Reusable stat card
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
