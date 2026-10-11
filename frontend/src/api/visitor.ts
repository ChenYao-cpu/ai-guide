/**
 * 游客端 API 模块
 * 用于景区导览游客交互页面
 */
import { request_handler as request } from './base'

// ============================================================
//                       类型定义
// ============================================================

export interface TourSessionInfo {
  session_id: number
  name: string
  visitor_preferences: string
  guide_info: {
    guide_id: number
    name: string
    character: string
    avatar: string
    base_mp4_path: string
    live2d_model_path: string
    voice_style: string
    voice_speed: number
  } | null
  route_info: {
    route_id: number
    name: string
    theme: string
    estimated_time: number
  } | null
  current_spot_info: {
    spot_id: number
    spot_name: string
    category: string
    description: string
    image_path: string
  } | null
  current_spot_index: number
  current_streamer_video: string
  live_status: number
  start_time: string
  final_spot: boolean
  conversation: MessageItem[]
}

export interface MessageItem {
  role: string
  userId: number
  userName: string
  avatar: string
  message: string
  send_time: string
  streamerVideo?: string
  aiMeta?: {
    answerMode: 'llm_rag' | 'llm_context' | 'local_knowledge'
    model?: string
    ragApplied?: boolean
    referenceCount?: number
    references?: string[]
    spotContext?: string
    fallbackReason?: string
  }
}

export interface RouteRecommendResult {
  name: string
  theme: string
  description: string
  estimated_time_minutes: number
  spot_ids: number[]
  spot_names: string[]
  spot_count: number
}

// ============================================================
//                       API 函数
// ============================================================

/** 游客获取景点列表（免登录公开接口） */
export function getVisitorSpotList() {
  return request({
    url: '/tour-session/spots',
    method: 'get',
  })
}

/** 游客获取路线列表（免登录公开接口） */
export function getVisitorRouteList() {
  return request({
    url: '/tour-session/routes',
    method: 'get',
  })
}

/** 游客获取导游列表（免登录公开接口） */
export function getVisitorGuideList() {
  return request({
    url: '/tour-session/guides',
    method: 'get',
  })
}

/** 创建导览会话 */
export function createTourSession(name: string, routeId: number, guideId: number, preferences: string) {
  return request({
    url: '/tour-session/create',
    method: 'post',
    params: {
      name,
      route_id: routeId,
      guide_id: guideId,
      visitor_preferences: preferences,
    },
  })
}

/** 开始导览 */
export function startTourSession(sessionId: number) {
  return request({
    url: `/tour-session/start/${sessionId}`,
    method: 'put',
  })
}

/** 结束导览 */
export function endTourSession(sessionId: number) {
  return request({
    url: `/tour-session/end/${sessionId}`,
    method: 'put',
  })
}

/** 获取导览实时信息 */
export function getTourLiveInfo(sessionId: number) {
  return request({
    url: `/tour-session/live-info/${sessionId}`,
    method: 'get',
  })
}

/** 发送聊天消息 */
export function sendTourChatMessage(sessionId: number, message: string, currentSpotId?: number, nextSpotId?: number, avatarMode = 'audio', options?: { signal?: AbortSignal; timeout?: number }) {
  return request({
    url: '/tour-session/chat',
    method: 'put',
    ...options,
    data: {
      sessionId,
      message,
      currentSpotId,
      nextSpotId,
      avatarMode,
    },
  })
}

/** 获取路线推荐 */
export interface RouteRecommendationResult {
  name: string
  theme: string
  description: string
  estimated_time_minutes: number
  spot_ids: number[]
  spot_names: string[]
  spot_count: number
  algorithm_version: string
  recommendation_explanation: string
  preferences?: string[]
  requested_time_minutes?: number
  visit_time_minutes?: number
  walking_time_minutes?: number
  rest_time_minutes?: number
  walking_distance_meters?: number
  candidate_count?: number
  catalog_count?: number
  stairs_excluded_count?: number
  pace?: 'standard' | 'relaxed'
  start_area?: 'auto' | 'east' | 'north' | 'south'
  start_label?: string
  data_basis?: string
  planning_note?: string
  source_urls?: string[]
  score_details: Array<{
    spot_id: number
    spot_name: string
    score: number
    diversity_penalty: number
    components: Record<string, number | string[]>
    reason?: string
    matched_preferences?: string[]
    walk_from_previous_minutes?: number
    walk_from_previous_meters?: number
  }>
}

export interface PlanningOptions {
  time_budget_minutes: number
  pace: 'standard' | 'relaxed'
  start_area: 'auto' | 'east' | 'north' | 'south'
}
export function getRouteRecommendation(preferences: string[], options?: PlanningOptions) {
  return request<{ code: number; success: boolean; data: RouteRecommendationResult; message: string }>({
    url: '/tour-routes/recommend',
    method: 'post',
    data: {
      preferences,
      ...options,
    },
  })
}

/** AI对话式景点推荐（LLM自然语言理解） */
export interface AiChatRecommendResult extends RouteRecommendationResult {
  ai_response: string
  preferences?: string[]
  spot_ids: number[]
  spot_names: string[]
  total_duration: number
  spot_count: number
  answer_mode: 'llm_with_budget_guardrail' | 'local_explainable_recommendation'
  model?: string
  requested_time_minutes?: number
  excluded_spot_count?: number
}

export function aiChatRecommend(message: string, options?: PlanningOptions) {
  return request<{ code: number; data: AiChatRecommendResult; message: string }>({
    url: '/tour-session/ai-chat-recommend',
    method: 'post',
    params: { message, ...options },
  })
}

/** 切换到下一个景点 */
export function nextSpot(sessionId: number) {
  return request({
    url: `/tour-session/next-spot/${sessionId}`,
    method: 'POST',
    data: {},
  })
}

/** 上传语音 (ASR) */
export function uploadAudioForAsr(audioBlob: Blob) {
  const formData = new FormData()
  formData.append('file', audioBlob)
  return request({
    url: '/upload/file',
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 语音识别 */
export function recognizeSpeech(sessionId: number, asrFileUrl: string) {
  return request({
    url: '/tour-session/asr',
    method: 'post',
    data: {
      sessionId,
      asrFileUrl,
    },
  })
}

// ============================================================
//              LBS 位置服务 API
// ============================================================

export interface SpotCoord {
  spot_id: number
  spot_name: string
  category: string
  latitude: number
  longitude: number
  trigger_radius: number
  description: string
}

/** 获取带GPS坐标的景点列表（用于客户端距离计算） */
export function getSpotsWithCoords() {
  return request({
    url: '/tour-session/spots-with-coords',
    method: 'GET',
  })
}

export interface NearbySpotResult {
  visitor_position: { latitude: number; longitude: number }
  nearby_spots: Array<{
    spot_id: number
    spot_name: string
    distance: number
    trigger_radius: number
    within_range: boolean
  }>
  closest_spot: {
    spot_id: number
    spot_name: string
    distance: number
    trigger_radius: number
    within_range: boolean
  } | null
  auto_switched: boolean
}

/** 检测附近景点（GPS坐标 → 最近景点） */
export function checkNearbySpot(latitude: number, longitude: number, sessionId: number = 0) {
  return request({
    url: '/tour-session/check-nearby',
    method: 'POST',
    params: { latitude, longitude, session_id: sessionId },
  })
}
