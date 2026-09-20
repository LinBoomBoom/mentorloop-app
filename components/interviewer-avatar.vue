<template>
  <view class="avatar-wrap" :style="{ backgroundColor: bg }">
    <view class="avatar-figure">
      <view class="avatar-head" :class="'s-' + state">
        <view class="avatar-mouth" :class="'s-' + state"></view>
      </view>
      <view class="avatar-body"></view>
    </view>
    <text class="avatar-label">{{ label }}</text>
  </view>
</template>

<script>
// 2.5D 数字人占位（状态驱动），真实 UTS 渲染（utssdk/interviewer-avatar）后续替换
// 状态：idle / asking / listening / followup / summary（文档 02 §4 / 文档 04）
const LABELS: Record<string, string> = {
  idle: '待机',
  asking: '提问中',
  listening: '倾听中',
  followup: '追问中',
  summary: '总结中'
}

export default {
  name: 'InterviewerAvatar',
  props: {
    state: { type: String, default: 'idle' }
  },
  computed: {
    label(): string {
      return LABELS[this.state] || '待机'
    },
    bg(): string {
      return this.state === 'idle' ? '#0F2C4C' : '#13294A'
    }
  }
}
</script>

<style>
.avatar-wrap { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.avatar-figure { display: flex; flex-direction: column; align-items: center; }
.avatar-head { width: 72px; height: 72px; border-radius: 36px; background-color: #C9D4E5; display: flex; align-items: center; justify-content: center; }
.avatar-mouth { width: 26px; height: 6px; border-radius: 3px; background-color: #5B6CFF; margin-top: 20px; }
.avatar-body { width: 110px; height: 46px; border-radius: 55px 55px 0 0; background-color: #8C9BB5; margin-top: 8px; }
.avatar-label { color: #AEB9CC; font-size: 12px; margin-top: 12px; }
/* 状态微变化（真实动效交由 UTS 渲染层，尊重系统减少动态效果） */
.s-listening .avatar-mouth { width: 16px; background-color: #1FB6A6; }
.s-followup .avatar-mouth { width: 30px; background-color: #5B6CFF; }
.s-summary .avatar-mouth { width: 22px; background-color: #1FB6A6; }
</style>
