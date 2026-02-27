import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IMAGE_TYPE_LABELS, STATUS_LABELS, STATUS_COLORS } from '@/types/briefing';
import { Search, Loader2, Clock, ExternalLink, FileImage, Filter, MessageSquare, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import CursEducaLayout from '@/components/CursEducaLayout';
import DesignerFeedback from '@/components/designer/DesignerFeedback';
import DesignerAnalytics from '@/components/designer/DesignerAnalytics';

interface DesignerImage {
  id: string;
  image_type: string;
  product_name: string | null;
  deadline: string | null;
  status: string;
  revision_count: number;
  delivery_token: string | null;
  briefing_requests: {
    requester_name: string;
    platform_url: string;
  };
}

export default function DesignerPanel() {
  const [email, setEmail] = useState(() => localStorage.getItem('designer_email') || '');
  const [images, setImages] = useState<DesignerImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Auto-search on mount if email is saved
  useEffect(() => {
    if (email.trim()) {
      handleSearch();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setSearched(true);
    localStorage.setItem('designer_email', email.trim().toLowerCase());

    const { data: result, error } = await supabase.functions.invoke('designer-data', {
      body: { email: email.trim().toLowerCase() },
    });

    if (error) {
      console.error(error);
      setImages([]);
    } else {
      setImages((result?.images || []) as DesignerImage[]);
    }
    setLoading(false);
  };

  const getStatusBadge = (img: DesignerImage) => {
    if (img.revision_count > 0 && img.status === 'in_progress') {
      return <Badge className="bg-destructive/20 text-destructive border-0">Refação {img.revision_count}</Badge>;
    }
    const label = STATUS_LABELS[img.status as keyof typeof STATUS_LABELS] || img.status;
    const color = STATUS_COLORS[img.status as keyof typeof STATUS_COLORS] || 'bg-muted text-muted-foreground';
    return <Badge className={`${color} border-0`}>{label}</Badge>;
  };

  const isOverdue = (deadline: string | null) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  };

  return (
    <CursEducaLayout title="Minhas Artes" subtitle="Painel do Designer">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="designer-email">Seu email</Label>
                <Input
                  id="designer-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="designer@email.com"
                />
              </div>
              <Button onClick={handleSearch} disabled={loading || !email.trim()}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Ver minhas artes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs: Artes + Feedbacks */}
        {searched && !loading && (
          <Tabs defaultValue="artes" className="w-full">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="artes" className="gap-2">
                <FileImage className="h-4 w-4" />
                Minhas Artes
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="feedbacks" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Feedbacks
              </TabsTrigger>
            </TabsList>

            <TabsContent value="artes" className="mt-4">
              {(() => {
                const filtered = images.filter(img => {
                  if (filterStatus === 'all') return true;
                  if (filterStatus === 'revision') return img.revision_count > 0 && img.status === 'in_progress';
                  return img.status === filterStatus;
                });
                return images.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center">
                      <FileImage className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma arte encontrada para este email.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-lg">{filtered.length} de {images.length} arte{images.length !== 1 ? 's' : ''}</CardTitle>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <Filter className="h-3 w-3 mr-1" />
                            <SelectValue placeholder="Filtrar status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                            <SelectItem value="revision">Em Refação</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Desktop table */}
                      <div className="hidden md:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tipo de Arte</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Prazo</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtered.map(img => (
                              <TableRow key={img.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium">{IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type}</p>
                                    {img.product_name && <p className="text-xs text-muted-foreground">{img.product_name}</p>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <a href={img.briefing_requests.platform_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                    {img.briefing_requests.requester_name}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </TableCell>
                                <TableCell>
                                  {img.deadline ? (
                                    <span className={`flex items-center gap-1 text-sm ${isOverdue(img.deadline) && img.status !== 'completed' ? 'text-destructive font-medium' : ''}`}>
                                      <Clock className="h-3 w-3" />
                                      {new Date(img.deadline).toLocaleDateString('pt-BR')}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">—</span>
                                  )}
                                </TableCell>
                                <TableCell>{getStatusBadge(img)}</TableCell>
                                <TableCell className="text-right">
                                  {img.delivery_token ? (
                                    <Button size="sm" variant="outline" asChild>
                                      <Link to={`/delivery/${img.delivery_token}`}>Entregar</Link>
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Sem link</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Mobile cards */}
                      <div className="md:hidden space-y-3 p-4">
                        {filtered.map(img => (
                          <Card key={img.id} className="border">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{IMAGE_TYPE_LABELS[img.image_type as keyof typeof IMAGE_TYPE_LABELS] || img.image_type}</p>
                                  {img.product_name && <p className="text-xs text-muted-foreground">{img.product_name}</p>}
                                </div>
                                {getStatusBadge(img)}
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{img.briefing_requests.requester_name}</span>
                                {img.deadline && (
                                  <span className={`flex items-center gap-1 ${isOverdue(img.deadline) && img.status !== 'completed' ? 'text-destructive font-medium' : ''}`}>
                                    <Clock className="h-3 w-3" />
                                    {new Date(img.deadline).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                              {img.delivery_token && (
                                <Button size="sm" className="w-full" variant="outline" asChild>
                                  <Link to={`/delivery/${img.delivery_token}`}>Entregar Arte</Link>
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <DesignerAnalytics designerEmail={email.trim().toLowerCase()} />
            </TabsContent>

            <TabsContent value="feedbacks" className="mt-4">
              <DesignerFeedback designerEmail={email.trim().toLowerCase()} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </CursEducaLayout>
  );
}
