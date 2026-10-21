export interface RouteCopy {
  summary: string
  audience: string
  highlights: string[]
  tips: string
}
export interface RecommendedRoute {
  route_id: number
  name: string
  theme?: string
  hero_spot_name?: string
  description?: string
  cover_image?: string
  cover_generated?: boolean
  estimated_time_minutes?: number | null
  walking_time_minutes?: number | null
  walking_distance_meters?: number | null
  visit_time_minutes?: number
  rest_time_minutes?: number
  spot_count?: number
  spot_ids?: number[]
  spot_names?: string[]
  editorial?: { zh?: RouteCopy; en?: RouteCopy }
  itinerary_stops?: Array<{ spot_id: number; spot_name: string; order: number; visit_minutes: number; focus: { zh: string; en: string } }>
  walking_legs?: Array<{ from_id: number; to_id: number; meters: number | null; minutes: number | null; available: boolean; has_steps: boolean | null }>
  complete?: boolean
  has_steps?: boolean
  distance_version?: string
}
