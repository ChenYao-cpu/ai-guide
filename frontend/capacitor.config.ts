/**
 * Capacitor 配置 — 将 PWA 打包为原生 Android/iOS APP
 *
 * 使用方式:
 *   1. npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/geolocation
 *   2. npx cap add android
 *   3. npm run build && npx cap sync
 *   4. npx cap open android  (在 Android Studio 中构建 APK)
 */

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tourguide.ai',
  appName: '景区智能导览',
  webDir: 'dist',
  server: {
    // 开发时使用本地服务器，生产时改为实际地址
    url: 'http://192.168.1.100:5173',
    cleartext: true,  // 开发时允许HTTP
  },
  plugins: {
    // GPS 高精度定位（使用原生GPS而非浏览器API，精度更高更省电）
    Geolocation: {
      permissions: ['location'],
    },
    // 语音权限（虽然Web Speech API可用，但原生权限管理更好）
    SpeechRecognition: {
      language: 'zh-CN',
    },
    // 后台位置追踪（APP退到后台也能检测位置）
    BackgroundRunner: {
      label: '景区导览位置追踪',
      src: 'background.js',
      event: 'locationUpdate',
      repeat: {
        interval: 15000,  // 每15秒检测一次
      },
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    // 位置权限声明
    permissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.RECORD_AUDIO',
      'android.permission.INTERNET',
    ],
  },
  ios: {
    contentInset: 'automatic',
    // iOS位置权限描述
    infoPlist: {
      NSLocationWhenInUseUsageDescription: '景区导览需要获取您的位置，以便在您接近景点时自动触发语音讲解',
      NSLocationAlwaysAndWhenInUseUsageDescription: '景区导览需要在后台获取位置，以便持续为您提供自动讲解服务',
      NSMicrophoneUsageDescription: '景区导览需要使用麦克风进行语音交互',
    },
  },
}

export default config
