<template>
  <view class="page">
    <text class="page-title">我的成长</text>
    <ml-card>
      <text class="muted">完成多场模拟后，这里对比你的能力变化（避免只比较总分，应比较具体能力与证据覆盖率）。</text>
    </ml-card>
  </view>
</template>

<script>
import mlCard from '../../components/ml-card.vue'
export default {
  components: { mlCard }
}
</script>

<style>
.page { padding: 16px; }
.page-title { color: var(--color-text-primary); font-size: 20px; font-weight: 700; display: block; margin-bottom: 12px; }
.muted { color: var(--color-text-secondary); font-size: 14px; }
</style>
