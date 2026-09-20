<template>
  <view class="page">
    <text class="page-title">专项训练</text>
    <ml-card v-for="t in tasks" :key="t.id" @click="startTask(t)">
      <view class="train-row">
        <text class="train-title">{{ t.title }}</text>
        <text class="muted">{{ t.durationMin }} 分钟</text>
      </view>
    </ml-card>
  </view>
</template>

<script>
import mlCard from '../../components/ml-card.vue'

export default {
  components: { mlCard },
  data() {
    return {
      tasks: [
        { id: 't1', title: '并发基础 3 分钟快练', durationMin: 3 },
        { id: 't2', title: '系统设计 5 分钟快练', durationMin: 5 },
        { id: 't3', title: '项目经历表达 10 分钟', durationMin: 10 }
      ]
    }
  },
  methods: {
    startTask(t: { id: string; title: string; durationMin: number }) {
      uni.showToast({ title: '开始：' + t.title, icon: 'none' })
    }
  }
}
</script>

<style>
.page { padding: 16px; }
.page-title { color: var(--color-text-primary); font-size: 20px; font-weight: 700; display: block; margin-bottom: 12px; }
.train-row { display: flex; justify-content: space-between; align-items: center; }
.train-title { color: var(--color-text-primary); font-size: 15px; }
.muted { color: var(--color-text-secondary); font-size: 13px; }
</style>
