
-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Briefing requests
CREATE TYPE public.request_status AS ENUM ('pending', 'in_progress', 'review', 'completed', 'cancelled');

CREATE TABLE public.briefing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_name TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  platform_url TEXT NOT NULL,
  has_trail BOOLEAN NOT NULL DEFAULT false,
  has_challenge BOOLEAN NOT NULL DEFAULT false,
  has_community BOOLEAN NOT NULL DEFAULT false,
  brand_file_url TEXT,
  brand_drive_link TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.briefing_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can create a briefing request (public form)
CREATE POLICY "Anyone can create briefing requests" ON public.briefing_requests FOR INSERT WITH CHECK (true);
-- Authenticated team can view all
CREATE POLICY "Authenticated users can view requests" ON public.briefing_requests FOR SELECT TO authenticated USING (true);
-- Authenticated team can update
CREATE POLICY "Authenticated users can update requests" ON public.briefing_requests FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_briefing_requests_updated_at BEFORE UPDATE ON public.briefing_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Briefing images (each art piece within a request)
CREATE TYPE public.image_type AS ENUM ('login', 'banner_vitrine', 'product_cover', 'trail_banner', 'challenge_banner', 'community_banner');

CREATE TABLE public.briefing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.briefing_requests(id) ON DELETE CASCADE,
  image_type image_type NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  product_name TEXT,
  image_text TEXT,
  font_suggestion TEXT,
  element_suggestion TEXT,
  professional_photo_url TEXT,
  orientation TEXT CHECK (orientation IN ('horizontal', 'vertical')),
  copy_style_from UUID REFERENCES public.briefing_images(id),
  observations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.briefing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create briefing images" ON public.briefing_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view briefing images" ON public.briefing_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update briefing images" ON public.briefing_images FOR UPDATE TO authenticated USING (true);

-- Reference images attached to briefing images
CREATE TABLE public.briefing_reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_image_id UUID NOT NULL REFERENCES public.briefing_images(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  is_exact_use BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.briefing_reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reference images" ON public.briefing_reference_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can view reference images" ON public.briefing_reference_images FOR SELECT TO authenticated USING (true);

-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('briefing-uploads', 'briefing-uploads', true);

CREATE POLICY "Anyone can upload briefing files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'briefing-uploads');
CREATE POLICY "Anyone can view briefing files" ON storage.objects FOR SELECT USING (bucket_id = 'briefing-uploads');
