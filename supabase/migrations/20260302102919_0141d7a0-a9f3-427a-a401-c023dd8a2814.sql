
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  
  IF (NEW.raw_user_meta_data->>'is_client')::boolean = true THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  IF (NEW.raw_user_meta_data->>'is_designer')::boolean = true THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'designer')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;
