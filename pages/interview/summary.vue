<template>
  <view class="summary">
    <ml-nav-bar title="面试总结"></ml-nav-bar>
    <ml-card>
      <text class="big-label">本次覆盖</text>
      <text class="big-num">{{ count }} 道题</text>
      <text class="muted">覆盖能力域：并发与JVM、系统设计、项目经历、表达能力</text>
    </ml-card>
    <ml-button text="生成报告" type="primary" @click="genReport"></ml-button>
  </view>
</template>

<script>
import mlNavBar from '../../components/ml-nav-bar.vue'
import mlCard from '../../components/ml-card.vue'
import mlButton from '../../components/ml-button.vue'
import { interviewSession } from '../../store/interview-session.uts'

export default {
  components: { mlNavBar, mlCard, mlButton },
  data() {
    return { count: 0 }
  },
  onLoad() {
    this.count = interviewSession.getQuestions().length
  },
  methods: {
    genReport() {
      // 收束并进入报告（状态机按当前态安全迁移；非法迁移仅告警不中断）
      interviewSession.transition('WRAP_UP')
      interviewSession.transition('REPORT_GENERATING')
      uni.navigateTo({ url: '/pages/report/report' })
    }
  }
}
</script>

<style>
.summary { padding: 12px; }
.big-label { color: var(--color-text-secondary); font-size: 13px; }
.big-num { color: var(--color-text-primary); font-size: 24px; font-weight: 700; display: block; margin: 6px 0; }
.muted { color: var(--color-text-secondary); font-size: 13px; }
</style>
