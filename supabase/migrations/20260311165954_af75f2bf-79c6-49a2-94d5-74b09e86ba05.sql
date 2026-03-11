-- Allow anon to read migration_projects by portal_token
CREATE POLICY "Anon read migration by token" ON public.migration_projects FOR SELECT TO anon USING (true);

-- Allow anon to read migration_form_submissions
CREATE POLICY "Anon read form_submissions" ON public.migration_form_submissions FOR SELECT TO anon USING (true);

-- Allow anon to insert form_submissions
CREATE POLICY "Anon insert form_submissions" ON public.migration_form_submissions FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to insert clubs
CREATE POLICY "Anon insert clubs" ON public.migration_clubs FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to read clubs
CREATE POLICY "Anon read clubs" ON public.migration_clubs FOR SELECT TO anon USING (true);

-- Allow anon to update migration_projects (status change on form submit)
CREATE POLICY "Anon update migration_projects" ON public.migration_projects FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Allow anon to insert migration_status_history
CREATE POLICY "Anon insert status_history" ON public.migration_status_history FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to read migration_validations
CREATE POLICY "Anon read validations" ON public.migration_validations FOR SELECT TO anon USING (true);