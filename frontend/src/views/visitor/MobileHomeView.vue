<template>
  <VisitorHomeView tour-path-prefix="/m/tour/" />
</template>

<script setup lang="ts">
// Share the responsive planner so mobile preferences use the same constraints,
// explanations and independent drafts as the desktop entry.
import VisitorHomeView from './VisitorHomeView.vue'
</script>
