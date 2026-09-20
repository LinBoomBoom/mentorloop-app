<template>
  <view class="ml-tag" :style="{ backgroundColor: bg }">
    <text class="ml-tag-text" :style="{ color: color }">{{ label }}</text>
  </view>
</template>

<script>
export default {
  name: 'MlTag',
  props: {
    label: { type: String, default: '' },
    bg: { type: String, default: '#EEF1FF' },
    color: { type: String, default: '#5B6CFF' }
  }
}
</script>

<style>
.ml-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
}
.ml-tag-text { font-size: 12px; }
</style>
