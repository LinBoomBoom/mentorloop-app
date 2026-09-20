<template>
  <view class="home">
    <view class="hero">
      <text class="hero-title">开始一次面试</text>
      <text class="hero-sub">当前岗位：{{ currentPosition }}</text>
      <ml-button text="开始面试" type="primary" @click="startInterview"></ml-button>
    </view>

    <text class="section-title">快速入口</text>
    <view class="entry" @click="goTab('/pages/training/training')">
      <ml-card><text class="entry-text">专项训练</text></ml-card>
    </view>
    <view class="entry" @click="goTab('/pages/resume/resume')">
      <ml-card><text class="entry-text">简历优化</text></ml-card>
    </view>
    <view class="entry" @click="goTab('/pages/growth/growth')">
      <ml-card><text class="entry-text">我的成长</text></ml-card>
    </view>

    <text class="section-title">最近报告</text>
    <ml-card><text class="muted">完成首次面试后，这里会显示你的最新报告</text></ml-card>
  </view>
</template>

<script>
import mlButton from '../../components/ml-button.vue'
import mlCard from '../../components/ml-card.vue'
import { userStore } from '../../store/user-profile.uts'

export default {
  components: { mlButton, mlCard },
  data() {
    return {
      currentPosition: userStore.profile.currentPosition
    }
  },
  methods: {
    startInterview() {
      uni.navigateTo({ url: '/pages/interview/prep' })
    },
    goTab(url: string) {
      uni.switchTab({ url })
    }
  }
}
</script>

<style>
.home { padding: 16px; }
.hero {
  background-color: var(--color-navy);
  border-radius: 20px;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.hero-title { color: #FFFFFF; font-size: 22px; font-weight: 700; }
.hero-sub { color: #AEB9CC; font-size: 13px; margin-top: 6px; margin-bottom: 16px; }
.section-title { color: var(--color-text-primary); font-size: 16px; font-weight: 600; margin: 20px 0 10px; }
.entry { margin-bottom: 10px; }
.entry-text { color: var(--color-text-primary); font-size: 15px; }
.muted { color: var(--color-text-secondary); font-size: 14px; }
</style>
