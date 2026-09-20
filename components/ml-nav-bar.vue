<template>
  <view class="ml-nav">
    <text class="ml-nav-title">{{ title }}</text>
    <slot name="right"></slot>
  </view>
</template>

<script>
export default {
  name: 'MlNavBar',
  props: {
    title: { type: String, default: '' }
  }
}
</script>

<style>
.ml-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
}
.ml-nav-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
</style>
