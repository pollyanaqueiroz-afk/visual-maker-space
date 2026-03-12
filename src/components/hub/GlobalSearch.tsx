import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Smartphone, FileImage, Briefcase, ArrowRightLeft, Search, Loader2, X } from 'lucide-react';
import ClientQuickViewDialog from './ClientQuickViewDialog';

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  path: string;
  group: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [quickViewClientId, setQuickViewClientId] = useState<string | null>(null);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const q = `%${term}%`;
      const [clients, appClientes, briefings, migrations] = await Promise.all([
        supabase.from('clients').select('id, nome, cs_atual, plano').ilike('nome', q).limit(6),
        supabase.from('app_clientes').select('id, nome, empresa, fase_atual').or(`nome.ilike.${q},empresa.ilike.${q}`).limit(6),
        supabase.from('briefing_requests').select('id, requester_name, platform_url').or(`requester_name.ilike.${q},platform_url.ilike.${q}`).limit(6),
        supabase.from('migration_projects').select('id, client_name, client_url').or(`client_name.ilike.${q},client_url.ilike.${q}`).limit(6),
      ]);

      const items: SearchResult[] = [
        ...(clients.data || []).map(c => ({
          id: c.id, label: c.nome || 'Sem nome', sublabel: `${c.plano || ''} · CS: ${c.cs_atual || '—'}`,
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
      setSelectedIndex(-1);
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

  const flatResults = results;
  const showDropdown = focused && (query.length >= 2 || loading);

  const handleSelect = (item: SearchResult) => {
    navigate(item.path);
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && flatResults[selectedIndex]) {
      e.preventDefault();
      handleSelect(flatResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const grouped = flatResults.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.group]) acc[r.group] = [];
    acc[r.group].push(r);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative hidden md:block w-72 lg:w-96">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar clientes, briefings, apps..."
          className="pl-9 pr-16 h-9 bg-gray-50 border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-1 focus:ring-primary/30"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-600"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          {!query && (
            <kbd className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-400">⌘K</kbd>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {loading && flatResults.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">Buscando...</div>
          )}
          {!loading && query.length >= 2 && flatResults.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-400">Nenhum resultado encontrado</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50/80">
                {group}
              </div>
              {items.map(item => {
                const globalIdx = flatResults.indexOf(item);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                      globalIdx === selectedIndex ? 'bg-primary/5 text-primary' : 'hover:bg-gray-50 text-gray-900'
                    }`}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    onClick={() => handleSelect(item)}
                  >
                    <item.icon className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      <p className="text-xs text-gray-400 truncate">{item.sublabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
