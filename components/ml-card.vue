<template>
  <view class="ml-card" @click="onClick">
    <slot></slot>
  </view>
</template>

<script>
export default {
  name: 'MlCard',
  emits: ['tap'],
  methods: {
    onClick() {
      this.$emit('tap')
    }
  }
}
</script>

<style>
.ml-card {
  background-color: var(--color-surface);
  border-radius: 16px;
  padding: 16px;
  border-width: 1px;
  border-color: var(--color-border);
}
</style>
