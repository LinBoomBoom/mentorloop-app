<template>
  <view class="page">
    <text class="page-title">简历优化</text>
    <ml-card>
      <text class="label">上传简历（PDF / Word / 图片）</text>
      <ml-button text="选择文件" type="secondary" @click="pick"></ml-button>
    </ml-card>

    <text class="section">改写建议（均为「建议稿」，确认后才保存）</text>
    <ml-card v-for="(s, i) in suggestions" :key="i">
      <text class="orig">原句：{{ s.original }}</text>
      <text class="suggest">建议稿：{{ s.suggested }}</text>
      <text class="reason">{{ s.reason }}</text>
      <ml-tag v-if="s.needsUserEvidence" label="需补充真实证据" bg="#FFF3E0" color="#E08A00"></ml-tag>
    </ml-card>
  </view>
</template>

<script>
import mlCard from '../../components/ml-card.vue'
import mlButton from '../../components/ml-button.vue'
import mlTag from '../../components/ml-tag.vue'
import { optimizeResume } from '../../api/resume.uts'
import { ResumeSuggestion } from '../../types/resume.uts'

export default {
  components: { mlCard, mlButton, mlTag },
  data() {
    return {
      suggestions: [] as ResumeSuggestion[]
    }
  },
  methods: {
    pick() {
      optimizeResume('负责系统开发', 'Java 后端').then((r) => {
        this.suggestions = r
      })
    }
  }
}
</script>

<style>
.page { padding: 16px; }
.page-title { color: var(--color-text-primary); font-size: 20px; font-weight: 700; display: block; margin-bottom: 12px; }
.label { color: var(--color-text-secondary); font-size: 13px; display: block; margin-bottom: 10px; }
.section { color: var(--color-text-primary); font-size: 15px; font-weight: 600; display: block; margin: 16px 0 10px; }
.orig { color: var(--color-text-secondary); font-size: 13px; display: block; }
.suggest { color: var(--color-text-primary); font-size: 14px; font-weight: 600; display: block; margin-top: 6px; }
.reason { color: var(--color-text-secondary); font-size: 12px; display: block; margin-top: 6px; }
</style>
