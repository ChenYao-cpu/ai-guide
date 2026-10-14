<script setup lang="ts">
import { locale } from '@/i18n'
withDefaults(defineProps<{ compact?: boolean; iconOnly?: boolean }>(), {
  compact: false,
  iconOnly: false,
})
</script>

<template>
  <span class="brand-logo" :class="{ compact, 'icon-only': iconOnly }" role="img" :aria-label='$t("智游灵境")'>
    <!-- Viewports keep the supplied artwork unchanged and exclude presentation captions. -->
    <svg class="brand-logo-icon" viewBox="173 133 398 510" aria-hidden="true" focusable="false">
      <image href="/brand/brand-sheet.png" width="1448" height="1086" />
    </svg>
    <svg v-if="!iconOnly && locale === 'zh'" class="brand-logo-wordmark" viewBox="604 280 702 214" aria-hidden="true" focusable="false">
      <image href="/brand/brand-sheet.png" width="1448" height="1086" />
    </svg>
    <strong v-if="!iconOnly && locale === 'en'" class="brand-logo-english">Zhiyou Lingjing</strong>
  </span>
</template>

<style scoped>
.brand-logo-english{font-size:21px;letter-spacing:-.4px;color:#222064;white-space:nowrap;font-weight:700}
.compact .brand-logo-english{font-size:17px}
.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  flex: none;
  vertical-align: middle;
  line-height: 1;
}
.brand-logo svg { display: block; flex: none; overflow: hidden; }
.brand-logo-icon { width: 34px; height: 44px; }
.brand-logo-wordmark { width: 128px; height: 40px; }
.brand-logo.compact { height: 34px; gap: 6px; }
.compact .brand-logo-icon { width: 26px; height: 34px; }
.compact .brand-logo-wordmark { width: 104px; height: 32px; }
@media (max-width: 600px) {
  .brand-logo { height: 34px; gap: 6px; }
  .brand-logo-icon { width: 26px; height: 34px; }
  .brand-logo-wordmark { width: 104px; height: 32px; }
}
</style>
