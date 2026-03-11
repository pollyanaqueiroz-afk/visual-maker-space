import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { Smartphone, FileImage, Briefcase, ArrowRightLeft, User } from 'lucide-react';

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  path: string;
  group: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const q = `%${term}%`;
      const [clients, appClientes, briefings, migrations] = await Promise.all([
        supabase.from('clients').select('id, cliente, cs_atual, plano').ilike('cliente', q).limit(8),
        supabase.from('app_clientes').select('id, nome, empresa, fase_atual').or(`nome.ilike.${q},empresa.ilike.${q}`).limit(8),
        supabase.from('briefing_requests').select('id, requester_name, platform_url').or(`requester_name.ilike.${q},platform_url.ilike.${q}`).limit(8),
        supabase.from('migration_projects').select('id, client_name, client_url').or(`client_name.ilike.${q},client_url.ilike.${q}`).limit(8),
      ]);

      const items: SearchResult[] = [
        ...(clients.data || []).map(c => ({
          id: c.id, label: c.cliente || 'Sem nome', sublabel: `${c.plano || ''} · CS: ${c.cs_atual || '—'}`,
          icon: Briefcase, path: `/hub/carteira/${c.id}`, group: 'Carteira',
        })),
        ...(appClientes.data || []).map(c => ({
          id: c.id, label: c.nome, sublabel: `${c.empresa} · Fase ${c.fase_atual}`,
          icon: Smartphone, path: `/hub/aplicativos/${c.id}`, group: 'Aplicativos',
        })),
        ...(briefings.data || []).map(b => ({
          id: b.id, label: b.requester_name, sublabel: b.platform_url,
          icon: FileImage, path: `/hub/briefings`, group: 'Briefings',
        })),
        ...(migrations.data || []).map(m => ({
          id: m.id, label: m.client_name, sublabel: m.client_url,
          icon: ArrowRightLeft, path: `/hub/migracao`, group: 'Migração',
        })),
      ];
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.group]) acc[r.group] = [];
    acc[r.group].push(r);
    return acc;
  }, {});

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 text-sm cursor-pointer hover:bg-gray-200/70 transition-colors"
      >
        <User className="h-3.5 w-3.5" />
        <span>Buscar...</span>
        <kbd className="ml-4 text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar clientes, briefings, apps, migrações..." value={query} onValueChange={setQuery} />
        <CommandList>
          {loading && <div className="py-4 text-center text-sm text-muted-foreground">Buscando...</div>}
          {!loading && query.length >= 2 && results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Digite ao menos 2 caracteres para buscar
            </div>
          )}
          {Object.entries(grouped).map(([group, items], i) => (
            <CommandGroup key={group} heading={group}>
              {items.map(item => (
                <CommandItem
                  key={item.id}
                  value={`${item.label} ${item.sublabel}`}
                  onSelect={() => { navigate(item.path); setOpen(false); setQuery(''); }}
                  className="cursor-pointer"
                >
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
