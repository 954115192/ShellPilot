<template>
  <div class="sessions-view">
    <SessionList />
  </div>
</template>

<script setup lang="ts">
import SessionList from '../components/sessions/SessionList.vue';
</script>

<style scoped>
.sessions-view {
  height: 100%;
}
</style>
