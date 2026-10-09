/**
 * VRM 数字人模型配置
 *
 * 管理所有可用的 VRM 模型及其个性化参数。
 * 添加新模型时，只需在此文件中新增一条配置即可。
 *
 * ═══════════ 如何添加新模型 ═══════════
 * 1. 从 VRoid Hub 下载 .vrm 文件
 * 2. 将文件放入 frontend/public/models/vrm/ 目录
 * 3. 在本文件 MODELS 数组中添加配置项
 * 4. 如果默认姿态不合适，可设置 poseAdjust 微调参数
 */

export interface ModelConfig {
  /** 模型唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** 模型文件路径（相对于 public 目录） */
  path: string
  /** 描述 */
  description?: string
  /** 缩略图路径 */
  thumbnail?: string
  /**
   * 姿态微调参数（弧度）
   * 不同 VRoid 模型由于骨骼比例不同，可能需要微调
   * 不传则使用默认值
   */
  poseAdjust?: {
    /** 上臂放下角度调整（默认 ±1.38） */
    armDownAngle?: number
    /** 前臂自然弯曲角度（默认 ±0.15） */
    elbowBendAngle?: number
    /** 整体姿态柔度（0=僵硬, 1=默认, >1=更柔软） */
    softness?: number
  }
}

/**
 * ═══════════ 已注册模型列表 ═══════════
 */
export const MODELS: ModelConfig[] = [
  {
    id: 'suit-female',
    name: '小颐 · 西装女导游',
    path: '/models/西装女.vrm',
    description: '颐和园专属正装女导游',
    thumbnail: '/models/thumbnails/suit-female.png',
    poseAdjust: {
      armDownAngle: 1.38,
      elbowBendAngle: 0.15,
      softness: 1.0,
    },
  },
]

/**
 * 默认姿态参数
 */
export const DEFAULT_POSE_ADJUST = {
  armDownAngle: 1.38,
  elbowBendAngle: 0.15,
  softness: 1.0,
}

/**
 * 根据路径查找模型配置
 */
export function findModelByPath(path: string): ModelConfig | undefined {
  return MODELS.find((m) => m.path === path)
}

/**
 * 根据 ID 查找模型配置
 */
export function findModelById(id: string): ModelConfig | undefined {
  return MODELS.find((m) => m.id === id)
}
