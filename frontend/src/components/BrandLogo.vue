<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean; iconOnly?: boolean }>(), {
  compact: false,
  iconOnly: false,
})
</script>

<template>
  <span class="brand-logo" :class="{ compact, 'icon-only': iconOnly }" role="img" aria-label="智游灵境">
    <!-- Viewports keep the supplied artwork unchanged and exclude presentation captions. -->
    <svg class="brand-logo-icon" viewBox="173 133 398 510" aria-hidden="true" focusable="false">
      <image href="/brand/brand-sheet.png" width="1448" height="1086" />
    </svg>
    <svg v-if="!iconOnly" class="brand-logo-wordmark" viewBox="604 280 702 214" aria-hidden="true" focusable="false">
      <image href="/brand/brand-sheet.png" width="1448" height="1086" />
    </svg>
  </span>
</template>

<style scoped>
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
