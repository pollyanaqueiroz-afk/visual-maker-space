-- Allow authenticated users to delete notifications
CREATE POLICY "Authenticated users can delete app_notificacoes"
ON public.app_notificacoes
FOR DELETE
TO authenticated
USING (true);