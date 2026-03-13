import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TopScrollableTable } from '@/components/ui/TopScrollableTable';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, Eye, Mail, PackageCheck, Loader2, ExternalLink, Search, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { IMAGE_TYPE_LABELS, ImageType } from '@/types/briefing';

interface DeliveryGroup {
  requestId: string;
  clientName: string;
  platformUrl: string;
  requesterEmail: string;
  requestDate: string;
  deliveryDate: string;
  artCount: number;
  approvedCount: number;
  deliveries: any[];
  images: any[];
}

function extractClientName(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace('.curseduca.pro', '').replace(/\./g, ' ');
  } catch {
    return url;
  }
}

export default function EntregasTab() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState<DeliveryGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [sending, setSending] = useState(false);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['briefing-deliveries-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('briefing_deliveries')
        .select('*, briefing_images!inner(id, image_type, product_name, status, request_id, assigned_email, created_at, briefing_requests!inner(requester_name, requester_email, platform_url, received_at))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const groups: DeliveryGroup[] = useMemo(() => {
    const map = new Map<string, DeliveryGroup>();
    for (const d of deliveries) {
      const img = d.briefing_images;
      const req = img?.briefing_requests;
      if (!img || !req) continue;
      const key = img.request_id;
      if (!map.has(key)) {
        map.set(key, {
          requestId: key,
          clientName: extractClientName(req.platform_url),
          platformUrl: req.platform_url,
          requesterEmail: req.requester_email,
          requestDate: req.received_at || img.created_at,
          deliveryDate: d.created_at,
          artCount: 0,
          approvedCount: 0,
          deliveries: [],
          images: [],
        });
      }
      const g = map.get(key)!;
      g.deliveries.push(d);
      if (!g.images.find((i: any) => i.id === img.id)) {
        g.images.push(img);
        g.artCount += 1;
        if (img.status === 'completed') g.approvedCount += 1;
      }
      if (new Date(d.created_at) > new Date(g.deliveryDate)) {
        g.deliveryDate = d.created_at;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());
  }, [deliveries]);

  const filtered = useMemo(() => {
    return groups.filter(g => {
      if (filterStatus === 'approved' && g.approvedCount !== g.artCount) return false;
      if (filterStatus === 'pending' && g.approvedCount === g.artCount) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!g.clientName.toLowerCase().includes(q) && !g.platformUrl.toLowerCase().includes(q) && !g.requesterEmail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [groups, filterStatus, searchQuery]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSendEmail = async () => {
    if (!selectedGroup) return;
    if (!isValidEmail(editEmail)) {
      toast.error('Não foi possível enviar o e-mail. O endereço informado parece inválido.');
      return;
    }
    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error('Sessão expirada'); setSending(false); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'aqmbaycbwljiohdjputq';
      const deliveryLinks = selectedGroup.deliveries.map((d: any) => d.file_url).filter(Boolean);
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/notify-delivery`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_email: editEmail,
          client_name: selectedGroup.clientName,
          platform_url: selectedGroup.platformUrl,
          delivery_links: deliveryLinks,
          request_id: selectedGroup.requestId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao enviar');
      toast.success('E-mail enviado com sucesso!');
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mail');
    }
    setSending(false);
  };

  const handleShareWhatsApp = (group: DeliveryGroup) => {
    const links = group.deliveries.map((d: any) => d.file_url).filter(Boolean).join('\n');
    const msg = encodeURIComponent(`Olá ${group.clientName}! 🎨\n\nSuas artes estão prontas para visualização:\n\n${links}\n\nQualquer dúvida, estamos à disposição!`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  const handleExportAll = (group: DeliveryGroup) => {
    for (const d of group.deliveries) {
      if (d.file_url) {
        const a = document.createElement('a');
        a.href = d.file_url;
        a.target = '_blank';
        a.download = '';
        a.click();
      }
    }
    toast.success(`Iniciando download de ${group.deliveries.length} arquivo(s)`);
  };

  const openEmailDialog = (group: DeliveryGroup) => {
    setSelectedGroup(group);
    setEditEmail(group.requesterEmail);
    setEmailDialogOpen(true);
  };

  const getStatusBadge = (group: DeliveryGroup) => {
    if (group.approvedCount === group.artCount) {
      return <Badge className="bg-primary/15 text-primary border border-primary/20"><CheckCircle className="h-3 w-3 mr-1" /> Aprovada</Badge>;
    }
    return <Badge className="bg-accent text-accent-foreground border border-border"><Clock className="h-3 w-3 mr-1" /> Aguardando aprovação</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <PackageCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{groups.length}</p>
              <p className="text-xs text-muted-foreground">Total de Entregas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{groups.filter(g => g.approvedCount === g.artCount).length}</p>
              <p className="text-xs text-muted-foreground">Totalmente Aprovadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{groups.filter(g => g.approvedCount < g.artCount).length}</p>
              <p className="text-xs text-muted-foreground">Aguardando Aprovação</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente, URL ou e-mail..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="pending">Aguardando aprovação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table with top scrollbar */}
      <TopScrollableTable className="rounded-lg border" deps={[isLoading, filtered]}>
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cliente</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">URL</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data Solicitação</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data Entrega</th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Artes</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando entregas...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma entrega encontrada</td></tr>
            ) : (
              filtered.map(g => (
                <tr key={g.requestId} className="border-b transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedGroup(g)}>
                  <td className="p-4 align-middle font-medium">{g.clientName}</td>
                  <td className="p-4 align-middle">
                    <a href={g.platformUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {g.platformUrl} <ExternalLink className="h-3 w-3" />
                    </a>
                  </td>
                  <td className="p-4 align-middle text-sm">{format(new Date(g.requestDate), 'dd/MM/yyyy', { locale: ptBR })}</td>
                  <td className="p-4 align-middle text-sm">{format(new Date(g.deliveryDate), 'dd/MM/yyyy', { locale: ptBR })}</td>
                  <td className="p-4 align-middle text-center"><Badge variant="outline">{g.approvedCount}/{g.artCount}</Badge></td>
                  <td className="p-4 align-middle">{getStatusBadge(g)}</td>
                  <td className="p-4 align-middle">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedGroup(g)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEmailDialog(g)}><Mail className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShareWhatsApp(g)}><MessageSquare className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExportAll(g)}><Download className="h-4 w-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TopScrollableTable>

      {/* Detail Modal */}
      <Dialog open={!!selectedGroup && !emailDialogOpen} onOpenChange={open => { if (!open) setSelectedGroup(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedGroup && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  Entrega — {selectedGroup.clientName}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cliente:</span>
                    <p className="font-medium">{selectedGroup.clientName}</p>
                    <a href={selectedGroup.platformUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">{selectedGroup.platformUrl}</a>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-mail:</span>
                    <p className="font-medium text-sm">{selectedGroup.requesterEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data do Pedido:</span>
                    <p className="font-medium">{format(new Date(selectedGroup.requestDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Data da Entrega:</span>
                    <p className="font-medium">{format(new Date(selectedGroup.deliveryDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium mb-3">Artes Entregues ({selectedGroup.artCount})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedGroup.deliveries.map((d: any) => {
                      const img = d.briefing_images;
                      const label = img ? (IMAGE_TYPE_LABELS[img.image_type as ImageType] || img.image_type) + (img.product_name ? ` — ${img.product_name}` : '') : 'Arte';
                      const isApproved = img?.status === 'completed';
                      return (
                        <div key={d.id} className="border rounded-lg overflow-hidden">
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                              <img src={d.file_url} alt={label} className="w-full h-32 object-cover hover:opacity-80 transition-opacity" />
                            </a>
                          )}
                          <div className="p-2 space-y-1">
                            <p className="text-xs font-medium truncate">{label}</p>
                            <div className="flex items-center justify-between">
                              <Badge className={isApproved ? 'bg-primary/15 text-primary border border-primary/20 text-[10px]' : 'bg-accent text-accent-foreground border border-border text-[10px]'}>
                                {isApproved ? 'Aprovada' : 'Aguardando'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{d.delivered_by_email}</span>
                            </div>
                            {d.comments && <p className="text-[11px] text-muted-foreground">{d.comments}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleExportAll(selectedGroup)}>
                    <Download className="h-4 w-4 mr-1" /> Exportar Imagens
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEmailDialog(selectedGroup)}>
                    <Mail className="h-4 w-4 mr-1" /> Enviar por E-mail
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleShareWhatsApp(selectedGroup)}>
                    <MessageSquare className="h-4 w-4 mr-1" /> WhatsApp
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Enviar Notificação por E-mail
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">E-mail do cliente</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="email@dominio.com" className="mt-1" />
              {editEmail && !isValidEmail(editEmail) && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" /> O endereço informado parece inválido.
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>O e-mail conterá:</p>
              <ul className="list-disc list-inside">
                <li>Nome do cliente</li>
                <li>Aviso de que as artes estão disponíveis</li>
                <li>Links de acesso às imagens entregues</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSendEmail} disabled={sending || !isValidEmail(editEmail)}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
