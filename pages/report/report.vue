<template>
  <scroll-view class="report" scroll-y="true">
    <view class="first-screen" v-if="report.dimensions.length">
      <text class="fs-label">总体判断</text>
      <text class="fs-value">{{ report.overall }}</text>
      <view class="fs-row">
        <view class="fs-card">
          <text class="fs-card-label">最强项</text>
          <text class="fs-card-val">{{ report.strongest }}</text>
        </view>
        <view class="fs-card">
          <text class="fs-card-label">最高优先级</text>
          <text class="fs-card-val">{{ report.topPriority }}</text>
        </view>
      </view>
    </view>

    <text class="section">能力维度</text>
    <ml-card v-for="d in report.dimensions" :key="d.dimension">
      <view class="dim-head">
        <text class="dim-name">{{ dimLabel(d.dimension) }}</text>
        <ml-tag :label="d.level" :bg="levelBg(d.level)" :color="levelColor(d.level)"></ml-tag>
      </view>
      <text class="dim-evidence">证据：{{ d.evidence }}</text>
    </ml-card>

    <text class="section">训练计划</text>
    <ml-card v-for="t in report.trainingPlan" :key="t.id">
      <text class="train-title">{{ t.title }}</text>
      <text class="muted">{{ t.durationMin }} 分钟 · 优先级 {{ t.priority }}</text>
    </ml-card>

    <ml-button text="再次模拟" type="ghost" @click="again"></ml-button>
  </scroll-view>
</template>

<script>
import mlCard from '../../components/ml-card.vue'
import mlTag from '../../components/ml-tag.vue'
import mlButton from '../../components/ml-button.vue'
import { getReport } from '../../api/report.uts'
import { InterviewReport } from '../../types/scoring.uts'

const DIM_LABELS: Record<string, string> = {
  knowledge: '岗位知识与正确性',
  engineering: '项目与工程实践',
  analysis: '问题分析与权衡',
  communication: '表达与沟通',
  learning: '学习与复盘',
  motivation: '职业动机与匹配'
}

export default {
  components: { mlCard, mlTag, mlButton },
  data() {
    return {
      report: {
        overall: '',
        strongest: '',
        topPriority: '',
        dimensions: [],
        riskQuestions: [],
        trainingPlan: []
      } as InterviewReport
    }
  },
  onLoad() {
    getReport('mock').then((r) => {
      this.report = r
    })
  },
  methods: {
    dimLabel(k: string): string {
      return DIM_LABELS[k] || k
    },
    levelBg(l: string): string {
      return l === 'A' ? '#E6F7F4' : l === 'B' ? '#EEF1FF' : '#FFF3E0'
    },
    levelColor(l: string): string {
      return l === 'A' ? '#1FB6A6' : l === 'B' ? '#5B6CFF' : '#E08A00'
    },
    again() {
      uni.reLaunch({ url: '/pages/index/index' })
    }
  }
}
</script>

<style>
.report { height: 100vh; padding: 16px; }
.first-screen { background-color: var(--color-navy); border-radius: 16px; padding: 20px; }
.fs-label { color: #AEB9CC; font-size: 13px; }
.fs-value { color: #FFFFFF; font-size: 18px; font-weight: 600; display: block; margin: 6px 0 14px; }
.fs-row { display: flex; }
.fs-card { flex: 1; background-color: rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin-right: 10px; }
.fs-card:last-child { margin-right: 0; }
.fs-card-label { color: #AEB9CC; font-size: 12px; display: block; }
.fs-card-val { color: #FFFFFF; font-size: 14px; display: block; margin-top: 4px; }
.section { color: var(--color-text-primary); font-size: 16px; font-weight: 600; margin: 20px 0 10px; display: block; }
.dim-head { display: flex; justify-content: space-between; align-items: center; }
.dim-name { color: var(--color-text-primary); font-size: 15px; font-weight: 600; }
.dim-evidence { color: var(--color-text-secondary); font-size: 13px; display: block; margin-top: 8px; }
.train-title { color: var(--color-text-primary); font-size: 15px; display: block; }
.muted { color: var(--color-text-secondary); font-size: 13px; }
</style>
