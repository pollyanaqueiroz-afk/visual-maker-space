import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BriefingRequest, RequestStatus, STATUS_LABELS, STATUS_COLORS, IMAGE_TYPE_LABELS } from '@/types/briefing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { LogOut, Clock, FileImage, ExternalLink, Eye } from 'lucide-react';
import ImportBriefingDialog from '@/components/briefing/ImportBriefingDialog';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Dashboard() {
  const { signOut } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('briefing_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error(error);
      toast.error('Erro ao carregar pedidos');
    } else {
      setRequests(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, []);

  const updateStatus = async (id: string, status: RequestStatus) => {
    const { error } = await supabase.from('briefing_requests').update({ status } as any).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      fetchRequests();
    }
  };

  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  const extractClientName = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
    } catch {
      return url;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestão de Briefings</h1>
            <p className="text-sm text-muted-foreground">Curseduca Design</p>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-3xl font-bold text-warning">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Em Produção</p>
              <p className="text-3xl font-bold text-info">{stats.in_progress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Concluídos</p>
              <p className="text-3xl font-bold text-primary">{stats.completed}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <ImportBriefingDialog onImported={fetchRequests} />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filtered.length} resultado(s)</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo em aberto</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <a href={req.platform_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium">
                        {extractClientName(req.platform_url)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell>
                      <div>{req.requester_name}</div>
                      <div className="text-xs text-muted-foreground">{req.requester_email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[req.status as RequestStatus] || ''} variant="secondary">
                        {STATUS_LABELS[req.status as RequestStatus] || req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(req.created_at), { locale: ptBR, addSuffix: false })}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Select value={req.status} onValueChange={v => updateStatus(req.id, v as RequestStatus)}>
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <RequestDetailDialog requestId={req.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>
    </div>
  );
}

function RequestDetailDialog({ requestId }: { requestId: string }) {
  const [images, setImages] = useState<any[]>([]);
  const [refs, setRefs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const fetchDetails = async () => {
    const { data: imgs } = await supabase
      .from('briefing_images')
      .select('*')
      .eq('request_id', requestId)
      .order('sort_order');
    setImages(imgs || []);

    if (imgs && imgs.length > 0) {
      const ids = imgs.map((i: any) => i.id);
      const { data: refData } = await supabase
        .from('briefing_reference_images')
        .select('*')
        .in('briefing_image_id', ids);
      setRefs(refData || []);
    }
  };

  useEffect(() => {
    if (open) fetchDetails();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Eye className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Briefing</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {images.map((img: any) => {
            const imgRefs = refs.filter((r: any) => r.briefing_image_id === img.id);
            return (
              <div key={img.id} className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileImage className="h-4 w-4 text-primary" />
                  {IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type}
                  {img.product_name && <span className="text-muted-foreground font-normal">— {img.product_name}</span>}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {img.image_text && <div><span className="text-muted-foreground">Texto:</span> {img.image_text}</div>}
                  {img.font_suggestion && <div><span className="text-muted-foreground">Fonte:</span> {img.font_suggestion}</div>}
                  {img.element_suggestion && <div className="col-span-2"><span className="text-muted-foreground">Elemento:</span> {img.element_suggestion}</div>}
                  {img.orientation && <div><span className="text-muted-foreground">Orientação:</span> {img.orientation}</div>}
                  {img.observations && <div className="col-span-2"><span className="text-muted-foreground">Obs:</span> {img.observations}</div>}
                </div>
                {imgRefs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {imgRefs.map((ref: any) => (
                      <a key={ref.id} href={ref.file_url} target="_blank" rel="noopener noreferrer" className="border rounded p-1 text-xs hover:bg-accent">
                        <img src={ref.file_url} alt="" className="w-16 h-16 object-cover rounded" />
                        <span className={ref.is_exact_use ? 'text-primary font-medium' : 'text-muted-foreground'}>
                          {ref.is_exact_use ? 'Usar exatamente' : 'Referência'}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
                <Separator />
              </div>
            );
          })}
          {images.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhuma arte solicitada</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
