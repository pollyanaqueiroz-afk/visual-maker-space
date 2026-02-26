import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { RequestStatus, STATUS_LABELS, STATUS_COLORS, IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { LogOut, Clock, FileImage, ExternalLink, Eye, Users, ImageIcon, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ImportBriefingDialog from '@/components/briefing/ImportBriefingDialog';

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
  // Joined from briefing_requests
  requester_name: string;
  requester_email: string;
  platform_url: string;
}

export default function Dashboard() {
  const { signOut } = useAuth();
  const [images, setImages] = useState<ImageWithRequest[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchData = async () => {
    // Fetch all images with their parent request info
    const { data: imgData, error: imgErr } = await supabase
      .from('briefing_images')
      .select('*, briefing_requests!inner(requester_name, requester_email, platform_url)')
      .order('created_at', { ascending: false });

    if (imgErr) {
      console.error(imgErr);
      toast.error('Erro ao carregar dados');
    } else {
      const mapped = (imgData || []).map((img: any) => ({
        ...img,
        requester_name: img.briefing_requests?.requester_name || '',
        requester_email: img.briefing_requests?.requester_email || '',
        platform_url: img.briefing_requests?.platform_url || '',
      }));
      setImages(mapped);
    }

    // Fetch requests for client count
    const { data: reqData } = await supabase
      .from('briefing_requests')
      .select('id, platform_url, status, created_at')
      .order('created_at', { ascending: false });
    setRequests(reqData || []);

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateImageStatus = async (id: string, status: RequestStatus) => {
    const { error } = await supabase.from('briefing_images').update({ status } as any).eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success('Status atualizado');
      fetchData();
    }
  };

  const filtered = filterStatus === 'all' ? images : images.filter(i => i.status === filterStatus);

  // Stats
  const totalImages = images.length;
  const pendingImages = images.filter(i => i.status === 'pending').length;
  const inProgressImages = images.filter(i => i.status === 'in_progress').length;
  const completedImages = images.filter(i => i.status === 'completed').length;
  const openClients = new Set(
    requests.filter(r => r.status !== 'completed' && r.status !== 'cancelled').map(r => r.platform_url)
  ).size;

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Artes</p>
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
                <p className="text-sm text-muted-foreground">Em Produção</p>
              </div>
              <p className="text-3xl font-bold text-info">{inProgressImages}</p>
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
                <p className="text-sm text-muted-foreground">Clientes Abertos</p>
              </div>
              <p className="text-3xl font-bold">{openClients}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <ImportBriefingDialog onImported={fetchData} />
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
          <span className="text-sm text-muted-foreground">{filtered.length} arte(s)</span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo de Arte</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo em aberto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(img => (
                  <TableRow key={img.id}>
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
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[img.status] || ''} variant="secondary">
                        {STATUS_LABELS[img.status] || img.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(img.created_at), { locale: ptBR, addSuffix: false })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-2 justify-end">
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
                        <ImageDetailDialog image={img} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma arte encontrada
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

function ImageDetailDialog({ image }: { image: ImageWithRequest }) {
  const [refs, setRefs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const fetchRefs = async () => {
    const { data } = await supabase
      .from('briefing_reference_images')
      .select('*')
      .eq('briefing_image_id', image.id);
    setRefs(data || []);
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
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{image.platform_url}</p>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
