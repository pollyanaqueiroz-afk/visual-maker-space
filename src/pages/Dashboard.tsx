import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RequestStatus, STATUS_LABELS, STATUS_COLORS, IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Clock, FileImage, ExternalLink, Eye, Users, ImageIcon, CheckCircle, Loader2, Send, Download, PackageCheck, ThumbsUp, ThumbsDown, BarChart3, RefreshCw, AlertTriangle, CalendarIcon, AlertCircle, Link2, FolderOpen, FileText, Palette, UserCheck, FileSpreadsheet, Search, UserPen, X, LayoutGrid, XCircle, Smartphone, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import ImportBriefingDialog from '@/components/briefing/ImportBriefingDialog';
import GlobalAnalytics from '@/components/dashboard/GlobalAnalytics';
import AssignBriefingDialog from '@/components/briefing/AssignBriefingDialog';
import BrandAssetsDialog from '@/components/briefing/BrandAssetsDialog';
import BulkPhotoUploadDialog from '@/components/briefing/BulkPhotoUploadDialog';
import BulkAssignDialog from '@/components/briefing/BulkAssignDialog';
import { usePermissions } from '@/hooks/usePermissions';
import BriefingKanban from '@/components/briefing/BriefingKanban';
import EntregasTab from '@/components/briefing/EntregasTab';
function ChangeDesignerForm({ imageId, currentEmail, onChanged }: { imageId: string; currentEmail: string; onChanged: () => void }) {
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!email) { toast.error('Informe o email'); return; }
    setSaving(true);
    const { error } = await supabase.from('briefing_images').update({ assigned_email: email }).eq('id', imageId);
    setSaving(false);
    if (error) { toast.error('Erro ao atualizar designer'); return; }
    toast.success('Designer atualizado!');
    onChanged();
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium">Trocar designer responsável</Label>
      <Input type="email" placeholder="novo-designer@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-8 text-sm" />
      <Button onClick={handleSave} disabled={saving || email === currentEmail} size="sm" className="w-full">
        {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPen className="h-3 w-3 mr-1" />}
        Salvar
      </Button>
    </div>
  );
}

interface ImageWithRequest {
  id: string;
  image_type: string;
  product_name: string | null;
  image_text: string | null;
  font_suggestion: string | null;
  element_suggestion: string | null;
  professional_photo_url: string | null;
  orientation: string | null;
  observations: string | null;
  extra_info: string | null;
  status: RequestStatus;
  sort_order: number;
  created_at: string;
  request_id: string;
  assigned_email: string | null;
  deadline: string | null;
  revision_count: number;
  requester_name: string;
  requester_email: string;
  platform_url: string;
  received_at: string;
  submitted_by: string | null;
}

interface ReviewRecord {
  id: string;
  briefing_image_id: string;
  action: string;
  reviewer_comments: string | null;
  reviewed_by: string;
  created_at: string;
}

function imageLabel(img: { image_type: string; product_name?: string | null; observations?: string | null }): string {
  if (img.image_type === 'adjustment') return `Ajuste de Briefing${img.observations ? ` — ${img.observations}` : ''}`;
  const base = IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type;
  const suffix = img.observations ? ` — ${img.observations}` : img.product_name ? ` — ${img.product_name}` : '';
  return `${base}${suffix}`;
}

export default function Dashboard() {
  const { hasPermission, hasRole } = usePermissions();
  const { user } = useAuth();
  const isGerenteImpl = hasRole('gerente_implantacao');
  const canManage = hasRole('admin') || hasRole('gerente_implantacao') || hasRole('analista_implantacao');
  const canCreate = hasPermission('briefings.create') || isGerenteImpl || canManage;
  const canEdit = hasPermission('briefings.edit') || isGerenteImpl || canManage;
  const canAssign = hasPermission('briefings.assign') || isGerenteImpl || canManage;
  const canChangeAssignee = hasPermission('briefings.change_assignee') || isGerenteImpl || canManage;
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeKPI, setActiveKPI] = useState<string | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [artesPage, setArtesPage] = useState(1);
  const ARTES_PER_PAGE = 25;
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleKPI = (kpi: string) => {
    setActiveKPI(prev => {
      if (prev === kpi) {
        setFilterStatus('all');
        return null;
      }
      switch (kpi) {
        case 'total': setFilterStatus('all'); break;
        case 'pending': setFilterStatus('pending'); break;
        case 'in_progress': setFilterStatus('in_progress'); break;
        case 'review': setFilterStatus('review'); break;
        case 'revision': setFilterStatus('revision'); break;
        case 'completed': setFilterStatus('completed'); break;
        case 'cancelled': setFilterStatus('cancelled'); break;
        case 'clients': setFilterStatus('all'); break;
        case 'requests': setFilterStatus('all'); break;
      }
      return kpi;
    });
  };
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [mooniBlockDialogOpen, setMooniBlockDialogOpen] = useState(false);
  const [mooniBlockClientName, setMooniBlockClientName] = useState('');
  const [mockupSolicitationOpen, setMockupSolicitationOpen] = useState(false);
  const [mockupClientUrl, setMockupClientUrl] = useState('');
  const [mockupClientSuggestions, setMockupClientSuggestions] = useState<string[]>([]);
  const [mockupObservations, setMockupObservations] = useState('');
  const [mockupSubmitting, setMockupSubmitting] = useState(false);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);

  const { data: rawImages = [], isLoading: loadingImages } = useQuery({
    queryKey: ['briefing-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_images')
        .select('*, briefing_requests!inner(requester_name, requester_email, platform_url, received_at, submitted_by)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((img: any) => ({
        ...img,
        requester_name: img.briefing_requests?.requester_name || '',
        requester_email: img.briefing_requests?.requester_email || '',
        platform_url: img.briefing_requests?.platform_url || '',
        received_at: img.briefing_requests?.received_at || img.created_at,
        submitted_by: img.briefing_requests?.submitted_by || null,
      })) as ImageWithRequest[];
    },
    staleTime: 30_000,
  });

  // Fetch adjustment data so it merges into KPIs, Artes tab, and designer workload
  const { data: adjData = { adjustments: [], items: [] } } = useQuery({
    queryKey: ['briefing-adjustments-merged'],
    queryFn: async () => {
      const [adjRes, itemsRes] = await Promise.all([
        supabase.from('briefing_adjustments').select('*').order('created_at', { ascending: false }),
        supabase.from('briefing_adjustment_items').select('*'),
      ]);
      return { adjustments: adjRes.data || [], items: itemsRes.data || [] };
    },
    staleTime: 30_000,
  });

  // Convert adjustment items into ImageWithRequest-compatible objects
  const adjustmentImages: ImageWithRequest[] = useMemo(() => {
    return adjData.items.map((item: any) => {
      const parent = adjData.adjustments.find((a: any) => a.id === item.adjustment_id);
      if (!parent) return null;
      // Map adjustment status to request_status
      const statusMap: Record<string, RequestStatus> = {
        pending: 'pending',
        allocated: 'pending',
        in_progress: 'in_progress',
        review: 'review',
        revision: 'revision',
        completed: 'completed',
        cancelled: 'cancelled',
      };
      return {
        id: item.id,
        image_type: 'adjustment',
        product_name: null,
        image_text: item.observations || null,
        font_suggestion: null,
        element_suggestion: null,
        professional_photo_url: item.file_url || null,
        orientation: null,
        observations: item.observations || null,
        extra_info: null,
        status: (statusMap[parent.status] || 'pending') as RequestStatus,
        sort_order: 0,
        created_at: parent.created_at,
        request_id: parent.id,
        assigned_email: parent.assigned_email || null,
        deadline: parent.deadline || null,
        revision_count: 0,
        requester_name: parent.client_email || '',
        requester_email: parent.client_email || '',
        platform_url: parent.client_url || '',
        received_at: parent.created_at,
        submitted_by: 'CS — Ajuste',
        _isAdjustment: true,
      } as ImageWithRequest & { _isAdjustment?: boolean };
    }).filter(Boolean) as ImageWithRequest[];
  }, [adjData]);

  // Merge regular images + adjustment items into a single array
  const images: ImageWithRequest[] = useMemo(() => {
    return [...rawImages, ...adjustmentImages];
  }, [rawImages, adjustmentImages]);

  const { data: requests = [] } = useQuery({
    queryKey: ['briefing-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_requests')
        .select('id, platform_url, status, created_at, received_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['briefing-reviews'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ReviewRecord[];
    },
    staleTime: 30_000,
  });

  const loading = loadingImages;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
    queryClient.invalidateQueries({ queryKey: ['briefing-requests'] });
    queryClient.invalidateQueries({ queryKey: ['briefing-reviews'] });
    queryClient.invalidateQueries({ queryKey: ['briefing-adjustments-merged'] });
    queryClient.invalidateQueries({ queryKey: ['briefing-deliveries-all'] });
  };

  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { toast.error('Você precisa estar logado.'); setDownloadingReport(false); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'aqmbaycbwljiohdjputq';
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/monthly-designer-report?month=${month}&send=false`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await res.json();
      if (!data.designers || data.designers.length === 0) {
        toast.info('Nenhuma entrega encontrada neste mês.');
        setDownloadingReport(false);
        return;
      }

      // Build CSV
      const lines = ['Designer,Artes Entregues,Valor Total (R$)'];
      for (const d of data.designers) {
        lines.push(`"${d.email}",${d.count},${d.total.toFixed(2)}`);
      }
      lines.push(`"TOTAL",${data.grandCount},${data.grandTotal.toFixed(2)}`);

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-designers-${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Relatório baixado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório');
    }
    setDownloadingReport(false);
  };

  // Sync top scrollbar width with actual table scroll width
  useEffect(() => {
    const syncWidth = () => {
      if (tableScrollRef.current && topScrollInnerRef.current) {
        topScrollInnerRef.current.style.width = tableScrollRef.current.scrollWidth + 'px';
      }
    };
    syncWidth();
    window.addEventListener('resize', syncWidth);
    return () => window.removeEventListener('resize', syncWidth);
  }, [loading, images]);

  const updateImageStatus = async (id: string, status: RequestStatus, isAdjustment?: boolean) => {
    if (isAdjustment) {
      // Find parent adjustment for this item
      const parentAdj = adjData.adjustments.find((a: any) =>
        adjData.items.some((i: any) => i.id === id && i.adjustment_id === a.id)
      );
      if (!parentAdj) { toast.error('Ajuste não encontrado'); return; }
      // Map RequestStatus back to adjustment status
      const adjStatusMap: Record<string, string> = {
        pending: 'pending',
        in_progress: 'in_progress',
        review: 'review',
        revision: 'revision',
        completed: 'completed',
        cancelled: 'cancelled',
      };
      const { error } = await supabase.from('briefing_adjustments').update({ status: adjStatusMap[status] || status } as any).eq('id', parentAdj.id);
      if (error) { toast.error('Erro ao atualizar status'); return; }
      toast.success('Status do ajuste atualizado');
      refreshAll();
      return;
    }
    const { error } = await supabase.from('briefing_images').update({ status } as any).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      refreshAll();
    }
  };

  const deleteSingleBriefingImage = async (id: string) => {
    // Delete related records first (FK constraints)
    await supabase.from('briefing_reference_images').delete().eq('briefing_image_id', id);
    await supabase.from('briefing_deliveries').delete().eq('briefing_image_id', id);
    await supabase.from('briefing_reviews').delete().eq('briefing_image_id', id);
    await supabase.from('brand_assets').delete().eq('briefing_image_id', id);
    // Also unlink any adjustments referencing this image
    await supabase.from('briefing_adjustments').update({ source_briefing_image_id: null }).eq('source_briefing_image_id', id);
    const { error } = await supabase.from('briefing_images').delete().eq('id', id);
    return error;
  };

  const deleteImage = async (id: string, label: string, isAdjustment?: boolean) => {
    if (!canManage) return;
    if (!confirm(`Excluir arte "${label}"?`)) return;

    if (isAdjustment) {
      const parentAdj = adjData.adjustments.find((a: any) =>
        adjData.items.some((i: any) => i.id === id && i.adjustment_id === a.id)
      );
      if (parentAdj) {
        await supabase.from('briefing_adjustment_items').delete().eq('adjustment_id', parentAdj.id);
        const { error } = await supabase.from('briefing_adjustments').delete().eq('id', parentAdj.id);
        if (error) { toast.error('Erro ao excluir ajuste'); return; }
        toast.success('Ajuste de briefing excluído');
      } else {
        const { error } = await supabase.from('briefing_adjustment_items').delete().eq('id', id);
        if (error) { toast.error('Erro ao excluir'); return; }
        toast.success('Item de ajuste excluído');
      }
    } else {
      const error = await deleteSingleBriefingImage(id);
      if (error) { toast.error('Erro ao excluir'); return; }
      toast.success('Arte excluída');
    }
    refreshAll();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    if (!confirm(`Excluir ${ids.length} arte(s) selecionada(s)? Esta ação não pode ser desfeita.`)) return;

    let successCount = 0;
    let errorCount = 0;

    for (const id of ids) {
      // Check if it's an adjustment
      const img = images.find(i => i.id === id);
      if ((img as any)?._isAdjustment) {
        const parentAdj = adjData.adjustments.find((a: any) =>
          adjData.items.some((i: any) => i.id === id && i.adjustment_id === a.id)
        );
        if (parentAdj) {
          await supabase.from('briefing_adjustment_items').delete().eq('adjustment_id', parentAdj.id);
          const { error } = await supabase.from('briefing_adjustments').delete().eq('id', parentAdj.id);
          if (error) errorCount++; else successCount++;
        }
      } else {
        const error = await deleteSingleBriefingImage(id);
        if (error) errorCount++; else successCount++;
      }
    }

    if (successCount > 0) toast.success(`${successCount} arte(s) excluída(s)`);
    if (errorCount > 0) toast.error(`${errorCount} arte(s) não puderam ser excluídas`);
    setSelectedIds(new Set());
    refreshAll();
  };

  const handleBulkStatusChange = async (status: RequestStatus) => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from('briefing_images')
      .update({ status } as any)
      .in('id', ids);
    if (error) {
      toast.error('Erro ao atualizar status em lote');
    } else {
      toast.success(`${ids.length} arte(s) atualizada(s) para "${STATUS_LABELS[status]}"`);
      setSelectedIds(new Set());
      refreshAll();
    }
  };

  const revertApproval = async (id: string, targetStatus: RequestStatus) => {
    if (!canManage) return;
    const { error } = await supabase.from('briefing_images').update({ status: targetStatus } as any).eq('id', id);
    if (error) { toast.error('Erro ao reverter'); return; }
    await (supabase.from('briefing_reviews' as any).insert({ briefing_image_id: id, action: `reverted_to_${targetStatus}`, reviewed_by: user?.email || 'admin', reviewer_comments: `Status revertido para ${STATUS_LABELS[targetStatus]} por ${user?.email}` }) as any);
    toast.success(`Status revertido para ${STATUS_LABELS[targetStatus]}`);
    refreshAll();
  };

  const SLA_DAYS = 7; // Prazo padrão para artes sem deadline definido

  const isOverdue = (img: ImageWithRequest) => {
    if (img.status === 'completed' || img.status === 'cancelled') return false;
    const deadline = img.deadline;
    if (!deadline) {
      const baseDate = new Date((img as any).received_at || img.created_at);
      baseDate.setDate(baseDate.getDate() + SLA_DAYS);
      return baseDate < new Date();
    }
    return new Date(deadline) < new Date();
  };

  const isBriefingIncomplete = (img: ImageWithRequest) => {
    return !img.image_text || !img.image_type;
  };

  const filtered = useMemo(() => images.filter(i => {
    if (filterStatus === 'incomplete') {
      if (!isBriefingIncomplete(i)) return false;
    } else if (filterStatus === 'revision') {
      if (i.status !== 'revision' && !(i.revision_count > 0 && i.status !== 'completed' && i.status !== 'cancelled')) return false;
    } else if (filterStatus !== 'all') {
      if (i.status !== filterStatus) return false;
    }
    if (filterType !== 'all' && i.image_type !== filterType) return false;
    if (filterClient !== 'all' && i.platform_url !== filterClient) return false;
    if (filterOverdue && !isOverdue(i)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const clientName = extractClientName(i.platform_url).toLowerCase();
      const url = i.platform_url.toLowerCase();
      const requester = i.requester_name.toLowerCase();
      if (!clientName.includes(q) && !url.includes(q) && !requester.includes(q)) return false;
    }
    return true;
  }), [images, filterStatus, filterType, filterClient, filterOverdue, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: any = (a as any)[sortBy] || '';
      let valB: any = (b as any)[sortBy] || '';
      if (sortBy === 'created_at' || sortBy === 'deadline' || sortBy === 'received_at') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  const artesTotalPages = Math.ceil(sorted.length / ARTES_PER_PAGE);
  const paginatedImages = useMemo(() => {
    const start = (artesPage - 1) * ARTES_PER_PAGE;
    return sorted.slice(start, start + ARTES_PER_PAGE);
  }, [sorted, artesPage]);

  // Reset page when filters change
  useEffect(() => { setArtesPage(1); }, [filterStatus, filterType, filterClient, searchQuery, filterOverdue]);

  const handleSortToggle = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Cliente', 'URL', 'Tipo', 'Produto', 'Status', 'Designer', 'Prazo', 'Refações'];
    const rows = filtered.map(img => [
      format(new Date(img.created_at), 'dd/MM/yyyy'),
      img.requester_name,
      img.platform_url,
      IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type,
      img.product_name || '',
      STATUS_LABELS[img.status] || img.status,
      img.assigned_email || '',
      img.deadline ? format(new Date(img.deadline), 'dd/MM/yyyy') : '',
      String(img.revision_count || 0),
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artes-briefing-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const uniqueClients = Array.from(new Set(images.map(i => i.platform_url))).sort();

  const totalImages = images.length;
  const pendingImages = images.filter(i => i.status === 'pending').length;
  const inProgressImages = images.filter(i => i.status === 'in_progress').length;
  const completedImages = images.filter(i => i.status === 'completed').length;
  const reviewImages = images.filter(i => i.status === 'review').length;
  const revisionImages = images.filter(i => i.status === 'revision').length;
  const cancelledImages = images.filter(i => i.status === 'cancelled').length;
  const overdueImages = images.filter(i => isOverdue(i)).length;
  const incompleteImages = images.filter(i => isBriefingIncomplete(i)).length;
  const openClients = new Set(
    images.filter(i => i.status !== 'completed' && i.status !== 'cancelled').map(i => i.platform_url)
  ).size;

  const allClientUrls = useMemo(() => {
    const urls = new Set<string>();
    images.forEach(i => urls.add(i.platform_url));
    return Array.from(urls).sort();
  }, [images]);

  const designerWorkload = useMemo(() => {
    const map: Record<string, { email: string; pending: number; inProgress: number; review: number; completed: number; overdue: number; totalActive: number }> = {};
    images.filter(i => i.assigned_email).forEach(img => {
      const email = img.assigned_email!;
      if (!map[email]) map[email] = { email, pending: 0, inProgress: 0, review: 0, completed: 0, overdue: 0, totalActive: 0 };
      if (img.status === 'pending') { map[email].pending++; map[email].totalActive++; }
      if (img.status === 'in_progress') { map[email].inProgress++; map[email].totalActive++; }
      if (img.status === 'review') { map[email].review++; map[email].totalActive++; }
      if (img.status === 'completed') map[email].completed++;
      if (isOverdue(img)) map[email].overdue++;
    });
    return Object.values(map).sort((a, b) => b.totalActive - a.totalActive);
  }, [images]);

  const overloadedDesigners = designerWorkload.filter(d => d.totalActive > 5);

  const handleMockupSolicitation = async () => {
    if (!mockupClientUrl.trim()) {
      toast.error('Informe a URL da plataforma do cliente');
      return;
    }
    setMockupSubmitting(true);
    try {
      const { data: request, error: reqError } = await supabase.from('briefing_requests').insert({
        requester_name: user?.email || 'Equipe Interna',
        requester_email: user?.email || 'interno@curseduca.com',
        platform_url: mockupClientUrl.trim(),
        has_trail: false,
        has_challenge: false,
        has_community: false,
        received_at: new Date().toISOString(),
        submitted_by: user?.email || null,
      }).select('id').single();
      if (reqError) throw reqError;
      const { error: imgError } = await supabase.from('briefing_images').insert({
        request_id: request.id,
        image_type: 'app_mockup' as any,
        sort_order: 0,
        observations: mockupObservations.trim() || 'Mockup do aplicativo — solicitação interna',
        status: 'pending' as any,
      });
      if (imgError) throw imgError;
      toast.success('Mockup solicitado! Aparecerá no Kanban como pendente.');
      setMockupSolicitationOpen(false);
      setMockupClientUrl('');
      setMockupObservations('');
      queryClient.invalidateQueries({ queryKey: ['briefing-images'] });
      queryClient.invalidateQueries({ queryKey: ['briefing-requests'] });
    } catch (err: any) {
      console.error('Erro ao solicitar mockup:', err);
      toast.error('Erro ao criar solicitação: ' + err.message);
    } finally {
      setMockupSubmitting(false);
    }
  };

  const extractClientName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
    } catch {
      return url;
    }
  };

  // Revision stats
  const revisionRequests = reviews.filter(r => r.action === 'revision_requested');

  const filteredReviews = (() => {
    if (!reviewSearch.trim()) return reviews;
    const q = reviewSearch.toLowerCase();
    return reviews.filter(rev => {
      const img = images.find(i => i.id === rev.briefing_image_id);
      if (!img) return false;
      return (img.platform_url || '').toLowerCase().includes(q) ||
        (img.requester_name || '').toLowerCase().includes(q) ||
        (img.product_name || '').toLowerCase().includes(q) ||
        (img.assigned_email || '').toLowerCase().includes(q);
    });
  })();

  const filteredRevisionRequests = (() => {
    if (!reviewSearch.trim()) return revisionRequests;
    const q = reviewSearch.toLowerCase();
    return revisionRequests.filter(rev => {
      const img = images.find(i => i.id === rev.briefing_image_id);
      if (!img) return false;
      return (img.platform_url || '').toLowerCase().includes(q) ||
        (img.requester_name || '').toLowerCase().includes(q) ||
        (img.product_name || '').toLowerCase().includes(q) ||
        (img.assigned_email || '').toLowerCase().includes(q);
    });
  })();

  const revisionsByEmail = filteredRevisionRequests.reduce<Record<string, number>>((acc, r) => {
    const img = images.find(i => i.id === r.briefing_image_id);
    const email = img?.assigned_email || 'Desconhecido';
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});

  const revisionsByImage = filteredRevisionRequests.reduce<Record<string, { count: number; label: string; designer: string }>>((acc, r) => {
    const img = images.find(i => i.id === r.briefing_image_id);
    if (!acc[r.briefing_image_id]) {
      acc[r.briefing_image_id] = {
        count: 0,
        label: img ? imageLabel(img) : r.briefing_image_id,
        designer: img?.assigned_email || 'Desconhecido',
      };
    }
    acc[r.briefing_image_id].count += 1;
    return acc;
  }, {});

  const kpiDefs = [
    { key: 'total', label: 'Total Artes', value: totalImages, Icon: ImageIcon, color: 'text-muted-foreground', valueColor: '', help: 'Total de artes solicitadas, incluindo canceladas.', sub: 'Total solicitado (inclui canceladas)' },
    { key: 'requests', label: 'Solicitações', value: requests.length, Icon: FileText, color: 'text-muted-foreground', valueColor: '', help: 'Número de pedidos de briefing recebidos.' },
    { key: 'pending', label: 'Pendentes', value: pendingImages, Icon: Clock, color: 'text-warning', valueColor: 'text-warning', help: 'Artes aguardando início da produção pelo designer.' },
    { key: 'in_progress', label: 'Em Produção', value: inProgressImages, Icon: Loader2, color: 'text-info', valueColor: 'text-info', help: 'Artes sendo produzidas pelo designer.' },
    { key: 'review', label: 'Aguardando Validação', value: reviewImages, Icon: Eye, color: 'text-primary', valueColor: 'text-primary', help: 'Artes entregues pelo designer que aguardam avaliação do cliente.' },
    { key: 'revision', label: 'Em Refação', value: revisionImages, Icon: RefreshCw, color: 'text-warning', valueColor: 'text-warning', help: 'Artes em processo de refação após solicitação do cliente.' },
    { key: 'completed', label: 'Concluídas', value: completedImages, Icon: CheckCircle, color: 'text-primary', valueColor: 'text-primary', help: 'Artes aprovadas pelo cliente.' },
    { key: 'cancelled', label: 'Canceladas', value: cancelledImages, Icon: XCircle, color: 'text-destructive', valueColor: 'text-destructive', help: 'Artes que foram canceladas.' },
    { key: 'clients', label: 'Clientes Abertos', value: openClients, Icon: Users, color: 'text-muted-foreground', valueColor: '', help: 'Clientes com pelo menos uma arte em aberto (não concluída/cancelada).' },
  ];

  return (
      <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="h-4 w-4" /> Kanban</TabsTrigger>
            <TabsTrigger value="artes" className="gap-2"><FileImage className="h-4 w-4" /> Artes</TabsTrigger>
            <TabsTrigger value="entregas" className="gap-2"><PackageCheck className="h-4 w-4" /> Entregas</TabsTrigger>
            <TabsTrigger value="revisoes" className="gap-2"><RefreshCw className="h-4 w-4" /> Refações</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
          </TabsList>

          {/* ───── DASHBOARD TAB ───── */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex gap-6 items-start">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
                {kpiDefs.map(kpi => (
                  <Card key={kpi.key} className={`cursor-pointer transition-all hover:shadow-md ${activeKPI === kpi.key ? 'ring-2 ring-primary' : ''}`} onClick={() => toggleKPI(kpi.key)}>
                    <CardContent className="pt-3 pb-3 px-3">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <kpi.Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                          <p className="text-xs text-muted-foreground whitespace-nowrap">{kpi.label}</p>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="focus:outline-none"><HelpCircle className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground cursor-help" /></button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">{kpi.help}</TooltipContent>
                        </Tooltip>
                      </div>
                      <p className={`text-2xl font-bold ${kpi.valueColor}`}>{kpi.value}</p>
                      {kpi.sub && <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{kpi.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="shrink-0 w-52">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1.5">
                  <Button variant="destructive" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/briefing`); toast.success('Link do formulário copiado!'); }}>
                    <FileText className="h-3.5 w-3.5" /> Link Formulário
                  </Button>
                  <Button variant="secondary" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={() => setMockupSolicitationOpen(true)}>
                    <Smartphone className="h-3.5 w-3.5" /> Solicitar Mockup
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={async () => { toast.info('Enviando lembretes...'); const { data, error } = await supabase.functions.invoke('follow-up-review'); if (error) { toast.error('Erro: ' + error.message); return; } toast.success(`Lembretes enviados para ${data?.clients || 0} cliente(s) com ${data?.staleArts || 0} arte(s) pendentes`); }}>
                    <Send className="h-3.5 w-3.5" /> Enviar Lembretes
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={async () => { toast.info('Gerando relatório semanal...'); const { data, error } = await supabase.functions.invoke('weekly-team-report'); if (error) { toast.error('Erro: ' + error.message); return; } toast.success(`Relatório enviado! ${data?.completed || 0} concluídas, ${data?.overdue || 0} atrasadas, SLA ${data?.sla || 0}%`); }}>
                    <BarChart3 className="h-3.5 w-3.5" /> Relatório Semanal
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/designer`); toast.success('Link do painel do designer copiado!'); }}>
                    <Palette className="h-3.5 w-3.5" /> Link Designer
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/client-review`); toast.success('Link da validação do cliente copiado!'); }}>
                    <UserCheck className="h-3.5 w-3.5" /> Link Validação
                  </Button>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 justify-start text-xs h-8 w-full" onClick={handleDownloadReport} disabled={downloadingReport}>
                    {downloadingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />} Relatório
                  </Button>
                </CardContent>
              </Card>
            </div>

            {activeKPI && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-sm text-muted-foreground">
                  Filtro ativo: <span className="font-semibold text-foreground">
                    {activeKPI === 'total' ? 'Todas as artes' : activeKPI === 'requests' ? 'Solicitações' : activeKPI === 'pending' ? 'Pendentes' : activeKPI === 'in_progress' ? 'Em Produção' : activeKPI === 'review' ? 'Em Revisão' : activeKPI === 'completed' ? 'Concluídas' : activeKPI === 'cancelled' ? 'Canceladas' : 'Clientes Abertos'}
                  </span>
                </span>
                <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={() => { setActiveKPI(null); setFilterStatus('all'); }}>Limpar ✕</Button>
              </div>
            )}

            {activeKPI === 'requests' && (
              <Card className="animate-in fade-in slide-in-from-top-2 duration-300">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Solicitações ({requests.length})</h3>
                    <button onClick={() => setActiveKPI(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="text-[11px]">Cliente</TableHead>
                      <TableHead className="text-[11px]">URL</TableHead>
                      <TableHead className="text-[11px] text-center">Artes</TableHead>
                      <TableHead className="text-[11px]">Recebido em</TableHead>
                      <TableHead className="text-[11px]">Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {requests.map((req: any) => {
                        const reqImages = images.filter(img => img.request_id === req.id);
                        const reqCompleted = reqImages.filter(img => img.status === 'completed').length;
                        const reqTotal = reqImages.length;
                        return (
                          <TableRow key={req.id}>
                            <TableCell className="text-sm font-medium">{extractClientName(req.platform_url)}</TableCell>
                            <TableCell><a href={req.platform_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{req.platform_url}</a></TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-xs">{reqCompleted}/{reqTotal}</Badge></TableCell>
                            <TableCell className="text-xs">{req.received_at ? format(new Date(req.received_at), 'dd/MM/yyyy') : format(new Date(req.created_at), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              {reqCompleted === reqTotal && reqTotal > 0 ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">Concluída</Badge>
                              : reqImages.some(img => img.status === 'review') ? <Badge className="bg-primary/20 text-primary border-0 text-[10px]">Em revisão</Badge>
                              : reqImages.some(img => img.status === 'in_progress') ? <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px]">Em produção</Badge>
                              : <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px]">Pendente</Badge>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {activeKPI === 'clients' && (() => {
              const clientMap: Record<string, { url: string; name: string; total: number; pending: number; inProgress: number; review: number }> = {};
              images.filter(i => i.status !== 'completed' && i.status !== 'cancelled').forEach(img => {
                const url = img.platform_url;
                if (!clientMap[url]) clientMap[url] = { url, name: extractClientName(url), total: 0, pending: 0, inProgress: 0, review: 0 };
                clientMap[url].total += 1;
                if (img.status === 'pending') clientMap[url].pending += 1;
                if (img.status === 'in_progress') clientMap[url].inProgress += 1;
                if (img.status === 'review') clientMap[url].review += 1;
              });
              const clientList = Object.values(clientMap).sort((a, b) => b.total - a.total);
              return (
                <Card className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Clientes com artes em aberto ({clientList.length})</h3>
                      <button onClick={() => setActiveKPI(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                    </div>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="text-[11px]">Cliente</TableHead>
                        <TableHead className="text-[11px] text-center">Em aberto</TableHead>
                        <TableHead className="text-[11px] text-center">Pendentes</TableHead>
                        <TableHead className="text-[11px] text-center">Em Produção</TableHead>
                        <TableHead className="text-[11px] text-center">Em Revisão</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {clientList.map(c => (
                          <TableRow key={c.url}>
                            <TableCell><div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.url}</p></div></TableCell>
                            <TableCell className="text-center font-semibold">{c.total}</TableCell>
                            <TableCell className="text-center"><Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px]">{c.pending}</Badge></TableCell>
                            <TableCell className="text-center"><Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px]">{c.inProgress}</Badge></TableCell>
                            <TableCell className="text-center"><Badge className="bg-primary/20 text-primary border-0 text-[10px]">{c.review}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })()}

            {overloadedDesigners.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">{overloadedDesigners.length} designer(s) sobrecarregado(s) — mais de 5 artes simultâneas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{overloadedDesigners.map(d => `${d.email} (${d.totalActive} artes)`).join(' · ')}</p>
                </div>
              </div>
            )}
            <Card className="border-none shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Carga de Trabalho por Designer</CardTitle>
              </CardHeader>
              <CardContent>
                {designerWorkload.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum designer com artes atribuídas</p>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Designer</TableHead>
                      <TableHead className="text-center">Em aberto</TableHead>
                      <TableHead className="text-center">Pendentes</TableHead>
                      <TableHead className="text-center">Produzindo</TableHead>
                      <TableHead className="text-center">Em revisão</TableHead>
                      <TableHead className="text-center">Atrasadas</TableHead>
                      <TableHead className="text-center">Concluídas</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {designerWorkload.map(d => (
                        <TableRow key={d.email} className={d.totalActive > 5 ? 'bg-destructive/5' : ''}>
                          <TableCell className="font-medium text-sm">{d.email}{d.totalActive > 5 && <Badge variant="destructive" className="ml-2 text-[9px]">Sobrecarregado</Badge>}</TableCell>
                          <TableCell className="text-center font-bold">{d.totalActive}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 text-xs">{d.pending}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-0 text-xs">{d.inProgress}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-primary/20 text-primary border-0 text-xs">{d.review}</Badge></TableCell>
                          <TableCell className="text-center">{d.overdue > 0 ? <Badge variant="destructive" className="text-xs">{d.overdue}</Badge> : <span className="text-xs text-muted-foreground">0</span>}</TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">{d.completed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ───── KANBAN TAB ───── */}
          <TabsContent value="kanban" className="space-y-6">
            <BriefingKanban images={rawImages} loading={loadingImages} />
          </TabsContent>

          {/* ───── ARTES TAB ───── */}
          <TabsContent value="artes" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              {canCreate && <ImportBriefingDialog onImported={refreshAll} />}
              {canCreate && <BulkPhotoUploadDialog onUploaded={refreshAll} />}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por URL ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={(val) => { setFilterStatus(val); setActiveKPI(null); }}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                  <SelectItem value="revision">Em Refação</SelectItem>
                  <SelectItem value="incomplete">
                    Briefing Incompleto ({incompleteImages})
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Tipo de arte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(IMAGE_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                  <SelectItem value="adjustment">Ajuste de Briefing</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {uniqueClients.map(url => (
                    <SelectItem key={url} value={url}>{extractClientName(url)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="filter-overdue"
                  checked={filterOverdue}
                  onCheckedChange={(v) => setFilterOverdue(!!v)}
                />
                <label htmlFor="filter-overdue" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" />
                  Atrasadas ({overdueImages})
                </label>
              </div>
              <span className="text-sm text-muted-foreground">{filtered.length} arte(s)</span>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={handleExportCSV}>
                <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar CSV
              </Button>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 ml-auto bg-primary/10 rounded-lg px-4 py-2">
                  <span className="text-sm font-medium">{selectedIds.size} selecionada(s)</span>
                  {canEdit && (
                    <Select onValueChange={(status) => handleBulkStatusChange(status as RequestStatus)}>
                      <SelectTrigger className="w-44 h-8 text-sm">
                        <SelectValue placeholder="Alterar status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {canAssign && (
                    <Button size="sm" onClick={() => setBulkAssignOpen(true)}>
                      <Send className="h-4 w-4 mr-1" />
                      Enviar para Designer
                    </Button>
                  )}
                  {canManage && (
                    <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                      <XCircle className="h-4 w-4 mr-1" />
                      Excluir selecionadas
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                    Limpar seleção
                  </Button>
                </div>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando...</div>
            ) : (
              <Card className="overflow-hidden">
                <TopScrollableTable deps={[loading, images]}>

                <table className="w-full caption-bottom text-sm min-w-[2400px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds(new Set(filtered.map(i => i.id)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Pasta</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('image_type')}>
                        Tipo de Arte {sortBy === 'image_type' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('platform_url')}>
                        Cliente {sortBy === 'platform_url' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('assigned_email')}>
                        Responsável {sortBy === 'assigned_email' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('status')}>
                        Status {sortBy === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('revision_count')}>
                        Refações {sortBy === 'revision_count' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('received_at')}>
                        Recebido em {sortBy === 'received_at' && (sortDir === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Tempo em aberto</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                      <TableHead>Texto da Imagem</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Elemento</TableHead>
                      <TableHead>Foto Profissional</TableHead>
                      <TableHead>Orientação</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead>Outras Info</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedImages.map(img => {
                      return (
                         <TableRow key={img.id} className={selectedIds.has(img.id) ? 'bg-primary/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(img.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds);
                                if (checked) next.add(img.id); else next.delete(img.id);
                                setSelectedIds(next);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <a
                              href={`/assets/${encodeURIComponent(img.platform_url)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs flex items-center gap-1"
                            >
                              <FolderOpen className="h-3 w-3" />
                              Ver
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileImage className="h-4 w-4 text-primary" />
                              <div>
                                <span className="font-medium text-sm">
                                  {imageLabel(img)}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <a href={img.platform_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium text-sm">
                              {extractClientName(img.platform_url)}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{img.requester_name}</div>
                            <div className="text-xs text-muted-foreground">{img.requester_email}</div>
                            {img.submitted_by && img.submitted_by.toLowerCase() !== img.requester_email.toLowerCase() && (
                              <div className="text-xs text-muted-foreground/70 mt-0.5">
                                Enviado por: {img.submitted_by}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {img.assigned_email ? (
                              <div className="group flex items-center gap-1">
                                <div>
                                  <div className="text-sm">{img.assigned_email}</div>
                                  {img.deadline && (
                                    <div className="text-xs text-muted-foreground">
                                      Prazo: {new Date(img.deadline).toLocaleDateString('pt-BR')}
                                    </div>
                                  )}
                                </div>
                                {canChangeAssignee && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Trocar designer">
                                        <UserPen className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3" align="start">
                                      <ChangeDesignerForm
                                        imageId={img.id}
                                        currentEmail={img.assigned_email}
                                        onChanged={refreshAll}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            ) : (
                              <div className="group flex items-center gap-1">
                                <span className="text-sm text-muted-foreground">Não atribuído</span>
                                {canAssign && (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" title="Atribuir designer">
                                        <UserPen className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-72 p-3" align="start">
                                      <ChangeDesignerForm
                                        imageId={img.id}
                                        currentEmail=""
                                        onChanged={refreshAll}
                                      />
                                    </PopoverContent>
                                  </Popover>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {img.revision_count > 0 && img.status === 'in_progress' ? (
                                <Badge className="bg-destructive/20 text-destructive border-0">
                                  Refação {img.revision_count}
                                </Badge>
                              ) : (
                                <Badge className={STATUS_COLORS[img.status] || ''} variant="secondary">
                                  {STATUS_LABELS[img.status] || img.status}
                                </Badge>
                              )}
                              {img.status === 'completed' && (
                                <Badge className="bg-success/20 text-success border-0">
                                  <CheckCircle className="h-3 w-3 mr-1" /> Aprovada
                                </Badge>
                              )}
                              {isOverdue(img) && (
                                <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Atrasada
                                </Badge>
                              )}
                              {isBriefingIncomplete(img) && (
                                <Badge variant="outline" className="text-warning border-warning/30 text-xs">
                                  <AlertCircle className="h-3 w-3 mr-1" /> Briefing Incompleto
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {img.revision_count > 0 ? (
                              <Badge variant="outline" className="text-destructive border-destructive/30">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                {img.revision_count}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-sm font-normal gap-1">
                                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                  {format(new Date(img.received_at), 'dd/MM/yyyy')}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={new Date(img.received_at)}
                                  onSelect={async (d) => {
                                    if (!d) return;
                                    const { error } = await supabase
                                      .from('briefing_requests')
                                      .update({ received_at: d.toISOString() } as any)
                                      .eq('id', img.request_id);
                                    if (error) {
                                      toast.error('Erro ao atualizar data');
                                    } else {
                                      toast.success('Data de recebimento atualizada');
                                      refreshAll();
                                    }
                                  }}
                                  disabled={(date) => date > new Date()}
                                  initialFocus
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(img.received_at), { locale: ptBR, addSuffix: false })}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {img.status === 'review' && (
                                <ReviewActionDialog image={img} onReviewed={refreshAll} />
                              )}
                              <Select value={img.status} onValueChange={v => updateImageStatus(img.id, v as RequestStatus, (img as any)._isAdjustment)}>
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {img.image_type === 'app_mockup' && !img.extra_info ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8 border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                                      onClick={() => {
                                        setMooniBlockClientName(img.requester_name || img.platform_url);
                                        setMooniBlockDialogOpen(true);
                                      }}
                                    >
                                      <Send className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Mooni não preenchido — crie o Mooni antes de atribuir o designer</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <AssignBriefingDialog
                                  imageId={img.id}
                                  currentEmail={img.assigned_email}
                                  currentDeadline={img.deadline}
                                  imageLabel={imageLabel(img)}
                                  onAssigned={refreshAll}
                                />
                              )}
                              <BrandAssetsDialog platformUrl={img.platform_url} clientName={extractClientName(img.platform_url)} />
                              <ImageDetailDialog image={img} reviews={reviews.filter(r => r.briefing_image_id === img.id)} />
                              {canManage && img.status === 'completed' && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500" title="Reverter aprovação"
                                  onClick={() => revertApproval(img.id, 'review')}>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {canManage && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Excluir arte"
                                  onClick={() => deleteImage(img.id, imageLabel(img), (img as any)._isAdjustment)}>
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs max-w-[200px] block truncate" title={img.image_text || ''}>
                              {img.image_text || <span className="text-muted-foreground">—</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{img.font_suggestion || <span className="text-muted-foreground">—</span>}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs max-w-[200px] block truncate" title={img.element_suggestion || ''}>
                              {img.element_suggestion || <span className="text-muted-foreground">—</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            {img.professional_photo_url ? (
                              <a href={img.professional_photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline max-w-[150px] block truncate">
                                {img.professional_photo_url}
                              </a>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs">{img.orientation || <span className="text-muted-foreground">—</span>}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs max-w-[200px] block truncate" title={img.observations || ''}>
                              {img.observations || <span className="text-muted-foreground">—</span>}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs max-w-[200px] block truncate" title={(img as any).extra_info || ''}>
                              {(img as any).extra_info || <span className="text-muted-foreground">—</span>}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={18} className="text-center py-8 text-muted-foreground">
                          Nenhuma arte encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </table>
                </TopScrollableTable>
              {artesTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    Mostrando {((artesPage - 1) * ARTES_PER_PAGE) + 1}–{Math.min(artesPage * ARTES_PER_PAGE, sorted.length)} de {sorted.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={artesPage === 1} onClick={() => setArtesPage(p => p - 1)}>Anterior</Button>
                    <span className="text-xs text-muted-foreground px-2">{artesPage}/{artesTotalPages}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={artesPage === artesTotalPages} onClick={() => setArtesPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
              </Card>
            )}

            <BulkAssignDialog
              open={bulkAssignOpen}
              onOpenChange={setBulkAssignOpen}
              imageIds={Array.from(selectedIds)}
              onAssigned={() => { setSelectedIds(new Set()); refreshAll(); }}
            />
          </TabsContent>

          {/* ───── ENTREGAS TAB ───── */}
          <TabsContent value="entregas" className="space-y-6">
            <EntregasTab />
          </TabsContent>

          <TabsContent value="revisoes" className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por URL, nome do cliente ou email do designer..."
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {reviewSearch && (
                  <button
                    onClick={() => setReviewSearch('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {reviewSearch && (
                <span className="text-xs text-muted-foreground">
                  Filtrando por: &quot;{reviewSearch}&quot;
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Revisions by designer */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Refações por Designer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(revisionsByEmail).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma refação registrada</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Designer</TableHead>
                          <TableHead className="text-right">Refações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(revisionsByEmail)
                          .sort(([, a], [, b]) => b - a)
                          .map(([email, count]) => (
                            <TableRow key={email}>
                              <TableCell className="text-sm">{email}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-destructive border-destructive/30">
                                  {count}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Revisions by design */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileImage className="h-5 w-5 text-primary" />
                    Refações por Arte
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(revisionsByImage).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhuma refação registrada</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Arte</TableHead>
                          <TableHead>Designer</TableHead>
                          <TableHead className="text-right">Refações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(revisionsByImage)
                          .sort(([, a], [, b]) => b.count - a.count)
                          .map(([id, data]) => (
                            <TableRow key={id}>
                              <TableCell className="text-sm font-medium">{data.label}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{data.designer}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline" className="text-destructive border-destructive/30">
                                  {data.count}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  Histórico de Revisões
                  <Badge variant="outline" className="text-xs">{filteredReviews.length}</Badge>
                  {reviewSearch && filteredReviews.length !== reviews.length && (
                    <span className="text-xs text-muted-foreground font-normal">de {reviews.length}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {filteredReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {reviewSearch ? `Nenhuma revisão encontrada para "${reviewSearch}"` : 'Nenhuma revisão registrada'}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Arte</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Revisor</TableHead>
                        <TableHead>Comentários</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReviews.slice(0, 50).map(rev => {
                        const img = images.find(i => i.id === rev.briefing_image_id);
                        return (
                          <TableRow key={rev.id}>
                            <TableCell className="text-sm">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-sm">
                              {img ? (
                                <div>
                                  <p className="font-medium text-xs">{img.requester_name || '—'}</p>
                                  <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{img.platform_url || ''}</p>
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {img ? imageLabel(img) : rev.briefing_image_id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge className={rev.action === 'approved' ? 'bg-primary/20 text-primary border-0' : 'bg-destructive/20 text-destructive border-0'}>
                                {rev.action === 'approved' ? '✅ Aprovado' : '🔄 Refação'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{rev.reviewed_by}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{rev.reviewer_comments || '—'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <GlobalAnalytics />
          </TabsContent>
        </Tabs>

        {/* Mooni Block Dialog */}
        <Dialog open={mooniBlockDialogOpen} onOpenChange={setMooniBlockDialogOpen}>
          <DialogContent className="max-w-md">
            <div className="flex flex-col items-center text-center space-y-4 pt-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-lg">Não é possível alocar designer</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                A tarefa <span className="font-semibold text-foreground">Criar Mooni</span> ainda não foi concluída para o cliente <span className="font-semibold text-foreground">{mooniBlockClientName}</span>.
              </p>
              <p className="text-sm text-muted-foreground">
                O Mooni contém informações essenciais (paleta de cores, estilo visual, referências) que o designer precisa para produzir os assets do aplicativo.
              </p>
              <div className="w-full rounded-lg bg-muted/50 p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-foreground">O que fazer:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse <span className="font-medium text-foreground">Gestão de Aplicativos</span> → aba <span className="font-medium text-foreground">Pendências</span></li>
                  <li>Encontre o cliente e clique em <span className="font-medium text-foreground">Criar Mooni</span></li>
                  <li>Preencha as informações e salve</li>
                  <li>Volte aqui e aloque o designer normalmente</li>
                </ol>
              </div>
              <div className="flex gap-3 w-full pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMooniBlockDialogOpen(false)}>
                  Entendi
                </Button>
                <Button className="flex-1" asChild>
                  <a href="/hub/aplicativos">Ir para Aplicativos</a>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Mockup Solicitation Dialog */}
        <Dialog open={mockupSolicitationOpen} onOpenChange={setMockupSolicitationOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                Solicitar Mockup de Aplicativo
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Crie uma solicitação de mockup vinculada a um cliente. A arte seguirá o fluxo normal de produção e validação.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Label className="text-sm">URL da plataforma do cliente *</Label>
                <Input
                  placeholder="https://cliente.curseduca.pro"
                  value={mockupClientUrl}
                  onChange={(e) => {
                    setMockupClientUrl(e.target.value);
                    const q = e.target.value.toLowerCase();
                    if (q.length >= 2) {
                      setMockupClientSuggestions(allClientUrls.filter(u => u.toLowerCase().includes(q)).slice(0, 5));
                    } else {
                      setMockupClientSuggestions([]);
                    }
                  }}
                />
                {mockupClientSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 border rounded-md bg-popover shadow-md">
                    {mockupClientSuggestions.map(url => (
                      <button
                        key={url}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent truncate"
                        onClick={() => {
                          setMockupClientUrl(url);
                          setMockupClientSuggestions([]);
                        }}
                      >
                        {url}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  A solicitação ficará vinculada a esta URL.
                </p>
              </div>

              <div>
                <Label className="text-sm">Observações para o designer</Label>
                <Textarea
                  placeholder="Cores, estilo visual, referências..."
                  value={mockupObservations}
                  onChange={(e) => setMockupObservations(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-semibold text-foreground">O que acontece ao solicitar:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  <li>• Um briefing será criado com tipo "Mockup do Aplicativo"</li>
                  <li>• Aparecerá na tabela de artes e no Kanban como "Pendente"</li>
                  <li>• Pode ser alocado para um designer normalmente</li>
                  <li>• O cliente poderá validar a arte pelo fluxo padrão</li>
                </ul>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={() => { setMockupSolicitationOpen(false); setMockupClientUrl(''); setMockupObservations(''); }}>
                  Cancelar
                </Button>
                <Button
                  disabled={mockupSubmitting || !mockupClientUrl.trim()}
                  onClick={handleMockupSolicitation}
                  className="gap-2"
                >
                  {mockupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  Criar Solicitação
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
  );
}

// Dialog for approving or requesting revision
function ReviewActionDialog({ image, onReviewed }: { image: ImageWithRequest; onReviewed: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReview = async (action: 'approved' | 'revision_requested') => {
    setSubmitting(true);
    try {
      const newStatus = action === 'approved' ? 'completed' : 'in_progress';
      
      // Usar edge function para atualizar status (ela cuida de brand_assets e review server-side)
      const { error: statusErr } = await supabase.functions.invoke('delivery-data', {
        body: {
          action: 'update_status',
          image_id: image.id,
          status: newStatus,
          revision_count: action === 'revision_requested' ? (image.revision_count || 0) + 1 : undefined,
          reviewed_by: user?.email || 'admin',
          reviewer_comments: comments || null,
        },
      });
      if (statusErr) throw statusErr;

      // Notificar designer na refação
      if (action === 'revision_requested' && image.assigned_email) {
        supabase.functions.invoke('notify-revision', {
          body: {
            image_id: image.id,
            reviewer_comments: comments || null,
            reviewed_by: user?.email || 'admin',
            app_url: window.location.origin,
          },
        }).catch(err => console.error('Notify error:', err));
      }

      toast.success(action === 'approved' ? 'Arte aprovada!' : 'Refação solicitada — designer será notificado.');
      setOpen(false);
      setComments('');
      onReviewed();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
          <ThumbsUp className="h-3 w-3" /> Revisar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Revisar Entrega</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Arte:</span>{' '}
            <span className="font-medium">{imageLabel(image)}</span>
          </div>
          <div className="space-y-2">
            <Label>Comentários (opcional)</Label>
            <Textarea
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Feedback para o designer..."
              rows={3}
            />
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => handleReview('revision_requested')}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ThumbsDown className="h-4 w-4 mr-1" />}
              Solicitar Refação
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleReview('approved')}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
              Aprovar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImageDetailDialog({ image, reviews }: { image: ImageWithRequest; reviews: ReviewRecord[] }) {
  const [refs, setRefs] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const fetchRefs = async () => {
    const [refsRes, delRes] = await Promise.all([
      supabase.from('briefing_reference_images').select('*').eq('briefing_image_id', image.id),
      (supabase.from('briefing_deliveries' as any).select('*').eq('briefing_image_id', image.id).order('created_at', { ascending: false }) as any),
    ]);
    setRefs(refsRes.data || []);
    setDeliveries(delRes.data || []);
  };

  useEffect(() => {
    if (open) fetchRefs();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-primary" />
            {imageLabel(image)}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0">
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium truncate">
                <a href={image.platform_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                  {image.platform_url}
                </a>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Solicitante:</span>
              <p className="font-medium">{image.requester_name}</p>
              <p className="text-xs text-muted-foreground">{image.requester_email}</p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-3 text-sm">
            {image.image_text && <div><span className="text-muted-foreground">Texto:</span><p>{image.image_text}</p></div>}
            {image.font_suggestion && <div><span className="text-muted-foreground">Fonte:</span><p>{image.font_suggestion}</p></div>}
            {image.element_suggestion && <div className="col-span-2"><span className="text-muted-foreground">Elemento:</span><p>{image.element_suggestion}</p></div>}
            {image.professional_photo_url && <div className="col-span-2"><span className="text-muted-foreground">Foto profissional:</span><p><a href={image.professional_photo_url} target="_blank" className="text-primary hover:underline">{image.professional_photo_url}</a></p></div>}
            {image.orientation && <div><span className="text-muted-foreground">Orientação:</span><p>{image.orientation}</p></div>}
            {image.observations && <div className="col-span-2"><span className="text-muted-foreground">Observações:</span><p>{image.observations}</p></div>}
            {(image as any).extra_info && <div className="col-span-2 border-l-2 border-primary/30 pl-3"><span className="text-primary font-medium">Outras Informações:</span><p>{(image as any).extra_info}</p></div>}
          </div>
          {refs.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Referências</p>
                <div className="flex flex-wrap gap-2">
                  {refs.map((ref: any) => (
                    <a key={ref.id} href={ref.file_url} target="_blank" rel="noopener noreferrer" className="border rounded p-1 text-xs hover:bg-accent">
                      <img src={ref.file_url} alt="" className="w-16 h-16 object-cover rounded" />
                      <span className={ref.is_exact_use ? 'text-primary font-medium' : 'text-muted-foreground'}>
                        {ref.is_exact_use ? 'Usar exatamente' : 'Referência'}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
          {deliveries.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-primary" />
                  Entregas ({deliveries.length})
                </p>
                <div className="space-y-3">
                  {deliveries.map((d: any) => (
                    <div key={d.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{d.delivered_by_email}</span>
                        <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {d.comments && <p className="text-sm">{d.comments}</p>}
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <Download className="h-3 w-3" /> Baixar arquivo
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {reviews.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Histórico de Revisões ({reviews.length})
                </p>
                <div className="space-y-2">
                  {reviews.map(rev => (
                    <div key={rev.id} className="border rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge className={rev.action === 'approved' ? 'bg-primary/20 text-primary border-0' : 'bg-destructive/20 text-destructive border-0'} variant="outline">
                          {rev.action === 'approved' ? '✅ Aprovado' : '🔄 Refação'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">por {rev.reviewed_by}</p>
                      {rev.reviewer_comments && <p className="text-sm">{rev.reviewer_comments}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
