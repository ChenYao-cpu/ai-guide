import { request_handler } from './base'

export interface VisualContext {
  spot_id?: number
  spot_name: string
  images: Array<{ url: string; label: string; source: string }>
  timeline: Array<{ year: number | string; text: string; source?: string }>
  note: string
}
export interface WalkingLeg {
  from_id: number; to_id: number; from_name: string; to_name: string
  meters: number | null; minutes: number | null; basis: string
  available?: boolean; geometry?: number[][]; has_steps?: boolean | null; steps_meters?: number | null
  sections?: Array<{way_id:number;road_name:string;meters:number;steps:boolean;bridge:boolean;highway:string}>
  is_exit?: boolean
  is_entry?: boolean
}
export interface RouteOverviewData {
  stops: Array<{
    spot_id: number
    spot_name: string
    order: number
    latitude: number | null
    longitude: number | null
    visit_minutes: number
    access_latitude?: number | null
    access_longitude?: number | null
    access_label?: string
    access_offset_meters?: number | null
  }>
  legs: WalkingLeg[]
  exit_leg?: WalkingLeg | null
  exit_anchor?: {latitude:number;longitude:number;label:string} | null
  entry_leg?: WalkingLeg | null
  entry_anchor?: {latitude:number;longitude:number;label:string} | null
  exit_minutes?: number | null
  reserve_minutes?: number
  network_version?: string
  avoid_steps?: boolean
  geometry?: string
  pace: string
  complete: boolean
  walking_meters: number | null
  walking_minutes: number | null
  visit_minutes: number
  rest_minutes: number
  total_minutes: number | null
  distance_version: string
  note: string
}
export function getRouteOverview(spotIds: number[], pace = 'standard', signal?: AbortSignal, options?: {start_area?:string;end_area?:string;avoid_steps?:boolean;reserve?:number}) {
  return request_handler<{ success: boolean; data: RouteOverviewData }>({
    url: '/tour-experience/route-preview',
    method: 'post',
    data: { spot_ids: spotIds, pace, ...options },
    signal,
    timeout: 15000
  })
}
export async function getContentPreview(data: Record<string, unknown>, signal?: AbortSignal) {
  const { header_authorization } = await import('./user')
  return request_handler({
    url: '/tour-experience/content-preview',
    method: 'post',
    data,
    signal,
    timeout: 20000,
    headers: { Authorization: header_authorization.value }
  })
}
