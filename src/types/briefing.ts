export type RequestStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'cancelled';
export type ImageType = 'login' | 'banner_vitrine' | 'product_cover' | 'trail_banner' | 'challenge_banner' | 'community_banner';

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
  login_image: ImageBriefingFormData;
  banner_vitrine: ImageBriefingFormData;
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
  pending: 'Pendente',
  in_progress: 'Em Produção',
  review: 'Em Revisão',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  pending: 'bg-warning/20 text-warning',
  in_progress: 'bg-info/20 text-info',
  review: 'bg-primary/20 text-primary',
  completed: 'bg-success/20 text-success',
  cancelled: 'bg-destructive/20 text-destructive',
};

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  login: 'Área de Login',
  banner_vitrine: 'Banner Vitrine Principal',
  product_cover: 'Capa de Produto',
  trail_banner: 'Banner de Trilha',
  challenge_banner: 'Banner de Desafio',
  community_banner: 'Banner de Comunidade',
};
