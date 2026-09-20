<template>
  <view class="page">
    <text class="page-title">我的</text>
    <ml-card>
      <text class="label">账户</text>
      <text class="value">{{ nickname }} · {{ planLabel }}</text>
    </ml-card>
    <ml-card @click="privacy">
      <text class="label">数据删除入口（隐私透明）</text>
    </ml-card>
    <ml-card @click="about">
      <text class="label">关于 MentorLoop</text>
    </ml-card>
  </view>
</template>

<script>
import mlCard from '../../components/ml-card.vue'
import { userStore } from '../../store/user-profile.uts'

export default {
  components: { mlCard },
  data() {
    return {
      nickname: userStore.profile.nickname,
      plan: userStore.profile.plan
    }
  },
  computed: {
    planLabel(): string {
      return this.plan === 'member' ? '会员' : this.plan === 'single' ? '单次包' : '免费'
    }
  },
  methods: {
    privacy() {
      uni.showToast({ title: '前往数据删除', icon: 'none' })
    },
    about() {
      uni.showToast({ title: 'MentorLoop · 学面一体', icon: 'none' })
    }
  }
}
</script>

<style>
.page { padding: 16px; }
.page-title { color: var(--color-text-primary); font-size: 20px; font-weight: 700; display: block; margin-bottom: 12px; }
.label { color: var(--color-text-secondary); font-size: 13px; }
.value { color: var(--color-text-primary); font-size: 16px; font-weight: 600; display: block; margin-top: 4px; }
</style>
