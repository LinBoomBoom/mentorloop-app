<template>
  <view class="prep">
    <ml-nav-bar title="面试准备"></ml-nav-bar>

    <ml-card>
      <text class="label">目标岗位</text>
      <text class="value">{{ position }}</text>
    </ml-card>

    <ml-card>
      <text class="label">面试时长</text>
      <view class="chips">
        <view class="chip" :class="{ active: mode === 'quick' }" @click="mode = 'quick'">
          <text class="chip-text" :class="{ 'active-text': mode === 'quick' }">快练 5′</text>
        </view>
        <view class="chip" :class="{ active: mode === 'standard' }" @click="mode = 'standard'">
          <text class="chip-text" :class="{ 'active-text': mode === 'standard' }">标准 20′</text>
        </view>
        <view class="chip" :class="{ active: mode === 'deep' }" @click="mode = 'deep'">
          <text class="chip-text" :class="{ 'active-text': mode === 'deep' }">深度 40′</text>
        </view>
      </view>
    </ml-card>

    <ml-card>
      <text class="label">设备检测</text>
      <view class="check-row" v-for="c in checks" :key="c.key">
        <text class="check-name">{{ c.name }}</text>
        <text class="check-state" :class="c.ok ? 'ok' : 'fail'">{{ c.ok ? '已通过' : '待检测' }}</text>
      </view>
      <ml-button :text="deviceOk ? '进入面试' : '开始检测'" :type="deviceOk ? 'primary' : 'secondary'" @click="onPrimary"></ml-button>
    </ml-card>
  </view>
</template>

<script>
import mlNavBar from '../../components/ml-nav-bar.vue'
import mlCard from '../../components/ml-card.vue'
import mlButton from '../../components/ml-button.vue'

export default {
  components: { mlNavBar, mlCard, mlButton },
  data() {
    return {
      position: 'Java 后端 · 1-3年',
      mode: 'standard',
      checks: [
        { key: 'mic', name: '麦克风', ok: false },
        { key: 'net', name: '网络', ok: false },
        { key: 'record', name: '录音授权', ok: false }
      ]
    }
  },
  computed: {
    deviceOk(): boolean {
      return this.checks.every((c) => c.ok)
    }
  },
  methods: {
    runCheck() {
      this.checks = this.checks.map((c) => ({ ...c, ok: true }))
    },
    start() {
      if (!this.deviceOk) return
      uni.navigateTo({ url: '/pages/interview/room' })
    },
    onPrimary() {
      if (this.deviceOk) this.start()
      else this.runCheck()
    }
  }
}
</script>

<style>
.prep { padding: 12px; }
.label { color: var(--color-text-secondary); font-size: 13px; }
.value { color: var(--color-text-primary); font-size: 16px; font-weight: 600; display: block; margin-top: 4px; }
.chips { display: flex; margin-top: 10px; }
.chip {
  flex: 1;
  margin-right: 8px;
  height: 40px;
  border-radius: 10px;
  background-color: var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}
.chip:last-child { margin-right: 0; }
.chip.active { background-color: var(--color-smart); }
.chip-text { color: var(--color-text-primary); font-size: 14px; }
.chip-text.active-text { color: #FFFFFF; }
.check-row { display: flex; justify-content: space-between; margin-top: 10px; }
.check-name { color: var(--color-text-primary); font-size: 14px; }
.check-state { font-size: 13px; }
.check-state.ok { color: var(--color-reliable); }
.check-state.fail { color: #E08A00; }
</style>
