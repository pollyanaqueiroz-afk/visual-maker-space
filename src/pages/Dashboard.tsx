import { useEffect, useState, useRef, useCallback } from 'react';
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
import { toast } from 'sonner';
import { Clock, FileImage, ExternalLink, Eye, Users, ImageIcon, CheckCircle, Loader2, Send, Download, PackageCheck, ThumbsUp, ThumbsDown, BarChart3, RefreshCw, AlertTriangle, CalendarIcon, AlertCircle, Link2, FolderOpen, FileText, Palette, UserCheck, FileSpreadsheet, Search } from 'lucide-react';
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

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('briefings.create');
  const canEdit = hasPermission('briefings.edit');
  const canAssign = hasPermission('briefings.assign');
  const [images, setImages] = useState<ImageWithRequest[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const topScrollInnerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    const [imgRes, reqRes, revRes] = await Promise.all([
      supabase
        .from('briefing_images')
        .select('*, briefing_requests!inner(requester_name, requester_email, platform_url, received_at, submitted_by)')
        .order('created_at', { ascending: false }),
      supabase
        .from('briefing_requests')
        .select('id, platform_url, status, created_at, received_at')
        .order('created_at', { ascending: false }),
      (supabase.from('briefing_reviews' as any).select('*').order('created_at', { ascending: false }) as any),
    ]);

    if (imgRes.error) {
      console.error(imgRes.error);
      toast.error('Erro ao carregar dados');
    } else {
      const mapped = (imgRes.data || []).map((img: any) => ({
        ...img,
        requester_name: img.briefing_requests?.requester_name || '',
        requester_email: img.briefing_requests?.requester_email || '',
        platform_url: img.briefing_requests?.platform_url || '',
        received_at: img.briefing_requests?.received_at || img.created_at,
        submitted_by: img.briefing_requests?.submitted_by || null,
      }));
      setImages(mapped);
    }

    setRequests(reqRes.data || []);
    setReviews((revRes.data || []) as ReviewRecord[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!key) { toast.error('Chave de API não configurada.'); setDownloadingReport(false); return; }
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'aqmbaycbwljiohdjputq';
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/monthly-designer-report?month=${month}&send=false`,
        {
          headers: {
            'Authorization': `Bearer ${key}`,
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

  const updateImageStatus = async (id: string, status: RequestStatus) => {
    const { error } = await supabase.from('briefing_images').update({ status } as any).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      fetchData();
    }
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
      fetchData();
    }
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

  const filtered = images.filter(i => {
    if (filterStatus === 'incomplete') {
      if (!isBriefingIncomplete(i)) return false;
    } else if (filterStatus !== 'all' && filterStatus !== 'revision') {
      if (i.status !== filterStatus) return false;
    }
    if (filterStatus === 'revision' && i.revision_count === 0) return false;
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
  });

  const uniqueClients = Array.from(new Set(images.map(i => i.platform_url))).sort();

  const totalImages = images.length;
  const pendingImages = images.filter(i => i.status === 'pending').length;
  const inProgressImages = images.filter(i => i.status === 'in_progress').length;
  const completedImages = images.filter(i => i.status === 'completed').length;
  const reviewImages = images.filter(i => i.status === 'review').length;
  const overdueImages = images.filter(i => isOverdue(i)).length;
  const incompleteImages = images.filter(i => isBriefingIncomplete(i)).length;
  const openClients = new Set(
    images.filter(i => i.status !== 'completed' && i.status !== 'cancelled').map(i => i.platform_url)
  ).size;

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

  const revisionsByEmail = revisionRequests.reduce<Record<string, number>>((acc, r) => {
    // Find the image to get assigned_email
    const img = images.find(i => i.id === r.briefing_image_id);
    const email = img?.assigned_email || 'Desconhecido';
    acc[email] = (acc[email] || 0) + 1;
    return acc;
  }, {});

  const revisionsByImage = revisionRequests.reduce<Record<string, { count: number; label: string; designer: string }>>((acc, r) => {
    const img = images.find(i => i.id === r.briefing_image_id);
    if (!acc[r.briefing_image_id]) {
      acc[r.briefing_image_id] = {
        count: 0,
        label: img ? `${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${img.product_name ? ` — ${img.product_name}` : ''}` : r.briefing_image_id,
        designer: img?.assigned_email || 'Desconhecido',
      };
    }
    acc[r.briefing_image_id].count += 1;
    return acc;
  }, {});

  return (
      <div className="p-6 space-y-8 max-w-[1800px] mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Total Artes</p>
              </div>
              <p className="text-3xl font-bold">{totalImages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-warning" />
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
              <p className="text-3xl font-bold text-warning">{pendingImages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="h-4 w-4 text-info" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Em Produção</p>
              </div>
              <p className="text-3xl font-bold text-info">{inProgressImages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Em Revisão</p>
              </div>
              <p className="text-3xl font-bold text-primary">{reviewImages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">Concluídas</p>
              </div>
              <p className="text-3xl font-bold text-primary">{completedImages}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground whitespace-nowrap">Clientes Abertos</p>
              </div>
              <p className="text-3xl font-bold">{openClients}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="artes" className="space-y-6">
          <div className="flex flex-col gap-4">
            <TabsList>
              <TabsTrigger value="artes">Artes</TabsTrigger>
              <TabsTrigger value="revisoes" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> Refações
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Analytics
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Button
                variant="destructive"
                size="sm"
                className="flex items-center gap-2 justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/briefing`);
                  toast.success('Link do formulário copiado!');
                }}
              >
                <FileText className="h-4 w-4" />
                Link Formulário
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/designer`);
                  toast.success('Link do painel do designer copiado!');
                }}
              >
                <Palette className="h-4 w-4" />
                Link Painel Designer
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 justify-start"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/client-review`);
                  toast.success('Link da validação do cliente copiado!');
                }}
              >
                <UserCheck className="h-4 w-4" />
                Link Validação Cliente
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 justify-start"
                onClick={handleDownloadReport}
                disabled={downloadingReport}
              >
                {downloadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Relatório Externo
              </Button>
            </div>
          </div>

          <TabsContent value="artes" className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
              {canCreate && <ImportBriefingDialog onImported={fetchData} />}
              {canCreate && <BulkPhotoUploadDialog onUploaded={fetchData} />}
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por URL ou cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
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
                {/* Top scrollbar */}
                <div
                  ref={topScrollRef}
                  className="overflow-x-auto"
                  style={{ overflowY: 'hidden' }}
                  onScroll={() => {
                    if (tableScrollRef.current && topScrollRef.current) {
                      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
                    }
                  }}
                >
                  <div ref={topScrollInnerRef} style={{ height: 1 }} />
                </div>
                <div
                  ref={tableScrollRef}
                  className="overflow-x-auto"
                  onScroll={() => {
                    if (topScrollRef.current && tableScrollRef.current) {
                      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
                    }
                  }}
                >
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
                      <TableHead>Tipo de Arte</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Refações</TableHead>
                      <TableHead>Recebido em</TableHead>
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
                    {filtered.map(img => {
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
                                  {IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}
                                </span>
                                {img.product_name && (
                                  <p className="text-xs text-muted-foreground">{img.product_name}</p>
                                )}
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
                              <div>
                                <div className="text-sm">{img.assigned_email}</div>
                                {img.deadline && (
                                  <div className="text-xs text-muted-foreground">
                                    Prazo: {new Date(img.deadline).toLocaleDateString('pt-BR')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Não atribuído</span>
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
                                      fetchData();
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
                                <ReviewActionDialog image={img} onReviewed={fetchData} />
                              )}
                              <Select value={img.status} onValueChange={v => updateImageStatus(img.id, v as RequestStatus)}>
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AssignBriefingDialog
                                imageId={img.id}
                                currentEmail={img.assigned_email}
                                currentDeadline={img.deadline}
                                imageLabel={`${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${img.product_name ? ` — ${img.product_name}` : ''}`}
                                onAssigned={fetchData}
                              />
                              <BrandAssetsDialog platformUrl={img.platform_url} clientName={extractClientName(img.platform_url)} />
                              <ImageDetailDialog image={img} reviews={reviews.filter(r => r.briefing_image_id === img.id)} />
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
                </div>
              </Card>
            )}

            <BulkAssignDialog
              open={bulkAssignOpen}
              onOpenChange={setBulkAssignOpen}
              imageIds={Array.from(selectedIds)}
              onAssigned={() => { setSelectedIds(new Set()); fetchData(); }}
            />
          </TabsContent>

          <TabsContent value="revisoes" className="space-y-6">
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

            {/* Full review history */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Revisões</CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma revisão registrada</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Arte</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Revisor</TableHead>
                        <TableHead>Comentários</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviews.slice(0, 50).map(rev => {
                        const img = images.find(i => i.id === rev.briefing_image_id);
                        return (
                          <TableRow key={rev.id}>
                            <TableCell className="text-sm">{new Date(rev.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-sm">
                              {img ? `${IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type}${img.product_name ? ` — ${img.product_name}` : ''}` : rev.briefing_image_id.slice(0, 8)}
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
      // Insert review record
      const { error: revErr } = await (supabase.from('briefing_reviews' as any).insert({
        briefing_image_id: image.id,
        action,
        reviewer_comments: comments || null,
        reviewed_by: user?.email || 'admin',
      }) as any);

      if (revErr) throw revErr;

      // Update image status and revision count
      const newStatus = action === 'approved' ? 'completed' : 'in_progress';
      const updatePayload: any = { status: newStatus };
      if (action === 'revision_requested') {
        updatePayload.revision_count = (image.revision_count || 0) + 1;
      }
      const { error: updErr } = await supabase
        .from('briefing_images')
        .update(updatePayload)
        .eq('id', image.id);

      if (updErr) throw updErr;

      // On approval, save deliveries to brand assets
      if (action === 'approved') {
        const { data: deliveries } = await (supabase
          .from('briefing_deliveries' as any)
          .select('file_url, delivered_by_email')
          .eq('briefing_image_id', image.id) as any);

        if (deliveries && deliveries.length > 0) {
          for (const d of deliveries) {
            await (supabase.from('brand_assets' as any).insert({
              platform_url: image.platform_url,
              file_url: d.file_url,
              file_name: `Entrega — ${IMAGE_TYPE_LABELS[image.image_type as ImageType] || image.image_type}`,
              uploaded_by: d.delivered_by_email,
              source: 'delivery',
              briefing_image_id: image.id,
            }) as any);
          }
        }
      }

      // Send revision notification email to designer
      if (action === 'revision_requested' && image.assigned_email) {
        supabase.functions.invoke('notify-revision', {
          body: {
            image_id: image.id,
            reviewer_comments: comments || null,
            reviewed_by: user?.email || 'admin',
            app_url: window.location.origin,
          },
        }).then(({ error }) => {
          if (error) console.error('Failed to send revision email:', error);
        });
      }

      toast.success(action === 'approved' ? 'Arte aprovada!' : 'Refação solicitada — designer será notificado.');
      setOpen(false);
      setComments('');
      onReviewed();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar revisão');
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
            <span className="font-medium">{IMAGE_TYPE_LABELS[image.image_type as ImageType] || image.image_type}</span>
            {image.product_name && <span className="text-muted-foreground"> — {image.product_name}</span>}
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
            {IMAGE_TYPE_LABELS[image.image_type as ImageType] || image.image_type}
            {image.product_name && <span className="text-muted-foreground font-normal">— {image.product_name}</span>}
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
