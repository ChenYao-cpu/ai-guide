<script setup lang="ts">
defineProps<{src:string;alt?:string}>()
</script>
<template>
  <div class="scenic-photo">
    <img :src="src" :alt="alt || '景点照片'" loading="lazy" class="photo-clear" />
    <img :src="src" alt="" aria-hidden="true" loading="lazy" class="photo-blur" />
  </div>
</template>
<style scoped>
.scenic-photo{position:relative;height:230px;overflow:hidden;background:#fff;border-radius:14px 14px 0 0}
.scenic-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.photo-clear{mask-image:linear-gradient(to bottom,#000 0%,#000 38%,rgba(0,0,0,.85) 55%,transparent 98%)}
.photo-blur{filter:blur(10px);transform:scale(1.04);mask-image:linear-gradient(to bottom,transparent 28%,rgba(0,0,0,.65) 64%,transparent 100%)}
@media(prefers-reduced-motion:reduce){.scenic-photo{transition:none}}
</style>
