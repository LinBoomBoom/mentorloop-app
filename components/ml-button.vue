<template>
  <view class="ml-btn" :class="[type, { disabled: disabled }]" @click="onClick">
    <text class="ml-btn-text">{{ text }}</text>
  </view>
</template>

<script>
export default {
  name: 'MlButton',
  props: {
    text: { type: String, default: '' },
    type: { type: String, default: 'primary' }, // primary | secondary | ghost
    disabled: { type: Boolean, default: false }
  },
  emits: ['tap'],
  methods: {
    onClick() {
      if (this.disabled) return
      this.$emit('tap')
    }
  }
}
</script>

<style>
.ml-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  border-radius: 12px;
  padding: 0 20px;
}
.ml-btn.primary { background-color: var(--color-smart); }
.ml-btn.primary .ml-btn-text { color: #FFFFFF; font-size: 16px; font-weight: 600; }
.ml-btn.secondary { background-color: var(--color-border); }
.ml-btn.secondary .ml-btn-text { color: var(--color-text-primary); font-size: 16px; }
.ml-btn.ghost { background-color: transparent; border-width: 1px; border-color: var(--color-smart); }
.ml-btn.ghost .ml-btn-text { color: var(--color-smart); font-size: 16px; }
.ml-btn.disabled { opacity: 0.5; }
</style>
