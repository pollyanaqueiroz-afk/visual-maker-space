import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FieldDefinition {
  id: string;
  db_key: string;
  label: string;
  field_type: string;
  enum_options: string[];
  is_required: boolean;
  is_hidden: boolean;
  sort_order: number;
}

const QUERY_KEY = ['client-field-definitions'];

export function useFieldDefinitions() {
  const queryClient = useQueryClient();

  const { data: fields = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('client_field_definitions' as any)
        .select('*')
        .order('sort_order') as any);
      if (error) throw error;
      return (data || []) as FieldDefinition[];
    },
    staleTime: 60_000,
  });

  const visibleFields = fields.filter(f => !f.is_hidden);

  const createField = useMutation({
    mutationFn: async (field: Omit<FieldDefinition, 'id'>) => {
      // 1. Create physical column in clients table
      const { error: colError } = await supabase.functions.invoke('manage-client-columns', {
        body: { action: 'create', columns: [{ name: field.db_key, type: 'text' }] },
      });
      // Ignore "already exists" errors
      
      // 2. Create field definition
      const { error } = await (supabase
        .from('client_field_definitions' as any)
        .insert({
          db_key: field.db_key,
          label: field.label,
          field_type: field.field_type,
          enum_options: field.enum_options || [],
          is_required: field.is_required || false,
          is_hidden: false,
          sort_order: field.sort_order,
        }) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FieldDefinition> & { id: string }) => {
      const { error } = await (supabase
        .from('client_field_definitions' as any)
        .update(updates)
        .eq('id', id) as any);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const reorderFields = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, i) => 
        (supabase.from('client_field_definitions' as any).update({ sort_order: i }).eq('id', id) as any)
      );
      await Promise.all(updates);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    fields,
    visibleFields,
    isLoading,
    createField,
    updateField,
    reorderFields,
  };
}
