export type RequestStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type ImageType = 'login' | 'banner_vitrine' | 'product_cover' | 'trail_banner' | 'challenge_banner' | 'community_banner' | 'app_mockup';

export interface BriefingRequest {
  id: string;
  requester_name: string;
  requester_email: string;
  platform_url: string;
  has_trail: boolean;
  has_challenge: boolean;
  has_community: boolean;
  brand_file_url: string | null;
  brand_drive_link: string | null;
  status: RequestStatus;
  notes: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefingImage {
  id: string;
  request_id: string;
  image_type: ImageType;
  sort_order: number;
  product_name: string | null;
  image_text: string | null;
  font_suggestion: string | null;
  element_suggestion: string | null;
  professional_photo_url: string | null;
  orientation: string | null;
  copy_style_from: string | null;
  observations: string | null;
  created_at: string;
}

export interface BriefingReferenceImage {
  id: string;
  briefing_image_id: string;
  file_url: string;
  is_exact_use: boolean;
  created_at: string;
}

export const IMAGE_DIMENSIONS = [
  { value: '1920x400', label: '1920 × 400 px', hint: 'Banner principal / Vitrine' },
  { value: '1920x600', label: '1920 × 600 px', hint: 'Banner grande' },
  { value: '1920x1080', label: '1920 × 1080 px', hint: 'Full HD / Área de conteúdo' },
  { value: '1280x720', label: '1280 × 720 px', hint: 'HD / Thumbnail' },
  { value: '1080x1080', label: '1080 × 1080 px', hint: 'Quadrado / Redes sociais' },
  { value: '1080x1350', label: '1080 × 1350 px', hint: 'Vertical / Stories' },
  { value: '800x600', label: '800 × 600 px', hint: 'Capa de produto' },
  { value: '600x600', label: '600 × 600 px', hint: 'Capa quadrada' },
  { value: '400x400', label: '400 × 400 px', hint: 'Ícone / Avatar' },
  { value: 'custom', label: 'Personalizado', hint: 'Definir manualmente' },
] as const;

export interface ImageBriefingFormData {
  enabled: boolean;
  image_text: string;
  font_suggestion: string;
  element_suggestion: string;
  element_suggestion_url?: string;
  element_suggestion_images?: File[];
  professional_photo_url: string;
  observations: string;
  orientation?: string;
  product_name?: string;
  copy_previous?: boolean;
  dimension?: string;
  custom_dimension?: string;
  reference_images: { file: File; is_exact_use: boolean }[];
}

export interface BriefingFormData {
  requester_name: string;
  requester_email: string;
  platform_url: string;
  has_trail: boolean;
  has_challenge: boolean;
  has_community: boolean;
  brand_file: File | null;
  brand_drive_link: string;
  login_image: ImageBriefingFormData[];
  banner_vitrine: ImageBriefingFormData[];
  product_covers: ImageBriefingFormData[];
  trail_banner: ImageBriefingFormData;
  challenge_banner: ImageBriefingFormData;
  community_banner: ImageBriefingFormData;
}

export const defaultImageBriefing: ImageBriefingFormData = {
  enabled: false,
  image_text: '',
  font_suggestion: '',
  element_suggestion: '',
  professional_photo_url: '',
  observations: '',
  reference_images: [],
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Aguardando Alocação',
  in_progress: 'Em Execução',
  review: 'Aguardando Validação do Cliente',
  completed: 'Aprovada',
  cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
  in_progress: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  review: 'bg-violet-500/15 text-violet-400 border border-violet-500/20',
  completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/20',
};

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  login: 'Área de Login',
  banner_vitrine: 'Banner Vitrine Principal',
  product_cover: 'Capa de Produto',
  trail_banner: 'Banner de Trilha',
  challenge_banner: 'Banner de Desafio',
  community_banner: 'Banner de Comunidade',
  app_mockup: 'Mockup do Aplicativo',
};
