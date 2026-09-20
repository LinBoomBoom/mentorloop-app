<template>
  <view class="room">
    <!-- 顶部状态条 -->
    <view class="topbar">
      <text class="exit" @click="confirmExit">退出</text>
      <text class="net">网络良好</text>
      <text class="time">{{ remain }}″</text>
    </view>

    <!-- 数字人舞台 -->
    <view class="stage">
      <interviewer-avatar :state="avatarState"></interviewer-avatar>
    </view>

    <!-- 字幕 / 实时转写（仅显示稳定文本，避免频闪） -->
    <view class="caption">
      <text class="caption-q">{{ currentQuestion.content || '准备开始…' }}</text>
      <text class="caption-sub">{{ caption }}</text>
    </view>

    <!-- 控制条 -->
    <view class="controls">
      <view class="ctrl" @click="toggleRecord">
        <view class="mic" :class="{ recording: recording }"></view>
        <text class="ctrl-label">{{ recording ? '停止' : '录音' }}</text>
      </view>
      <view class="ctrl" @click="replay"><text class="ctrl-label">再说一遍</text></view>
      <view class="ctrl" @click="pause"><text class="ctrl-label">暂停</text></view>
      <view class="ctrl" @click="textMode"><text class="ctrl-label">文字辅助</text></view>
    </view>
  </view>
</template>

<script>
import interviewerAvatar from '../../components/interviewer-avatar.vue'
import { interviewSession } from '../../store/interview-session.uts'
import { createSession, nextQuestion, submitAnswer } from '../../api/interview.uts'
import { QuestionItem } from '../../types/interview.uts'

export default {
  components: { interviewerAvatar },
  data() {
    return {
      recording: false,
      remain: 1200,
      avatarState: 'idle',
      caption: '',
      currentQuestion: {
        id: '',
        abilityDomain: '',
        subAbility: '',
        content: '',
        purpose: '',
        difficulty: 'junior',
        expectedEvidence: ''
      } as QuestionItem,
      sessionId: '',
      timer: 0 as unknown as ReturnType<typeof setInterval>
    }
  },
  onLoad() {
    this.init()
    this.timer = setInterval(() => {
      if (this.remain > 0) this.remain -= 1
    }, 1000)
  },
  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },
  methods: {
    async init() {
      const s = await createSession('Java 后端')
      this.sessionId = s.sessionId
      interviewSession.reset(s.sessionId)
      interviewSession.transition('DEVICE_CHECK')
      interviewSession.transition('READY')
      this.ask()
    },
    async ask() {
      interviewSession.transition('ASKING')
      this.avatarState = 'asking'
      this.caption = ''
      const blueprint = {
        position: 'Java 后端',
        experienceRange: '1-3年',
        companyType: '互联网',
        language: '中文',
        target: '求职'
      }
      const q = await nextQuestion(this.sessionId, 'standard', blueprint)
      this.currentQuestion = q
      interviewSession.pushQuestion(q)
      // 数字人播报后进入倾听（真实播报由 realtime 插件驱动）
      setTimeout(() => {
        interviewSession.transition('LISTENING')
        this.avatarState = 'listening'
      }, 1500)
    },
    toggleRecord() {
      this.recording = !this.recording
      if (this.recording) {
        this.avatarState = 'listening'
        this.caption = '正在聆听…'
      } else {
        this.caption = '已记录你的回答'
        interviewSession.appendTranscript({
          questionId: this.currentQuestion.id,
          speaker: 'user',
          text: '（录音转写占位）',
          timestamp: Date.now()
        })
        interviewSession.transition('TRANSCRIBING')
        interviewSession.transition('FOLLOW_UP_DECISION')
        // 演示：进入下一题或收束
        setTimeout(() => {
          const ev = interviewSession.transition('NEXT_QUESTION')
          if (ev) this.ask()
        }, 800)
      }
    },
    replay() {
      this.avatarState = 'asking'
    },
    pause() {
      this.recording = false
    },
    textMode() {
      // 降级文字输入（正式评分需标记输入方式）
      uni.showToast({ title: '文字辅助模式', icon: 'none' })
    },
    confirmExit() {
      // 结束必须二次确认；异常退出自动保存会话（文档 03）
      uni.showModal({
        title: '结束面试',
        content: '进度将自动保存，确认退出？',
        success: (r: any) => {
          if (r.confirm) uni.navigateBack()
        }
      })
    }
  }
}
</script>

<style>
.room { display: flex; flex-direction: column; height: 100vh; background-color: var(--color-navy); }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 16px;
  margin-top: 20px;
}
.exit { color: #AEB9CC; font-size: 14px; }
.net { color: var(--color-reliable); font-size: 13px; }
.time { color: #FFFFFF; font-size: 14px; }
.stage { flex: 1; }
.caption {
  padding: 16px;
  background-color: rgba(255, 255, 255, 0.06);
  margin: 0 12px;
  border-radius: 14px;
}
.caption-q { color: #FFFFFF; font-size: 16px; font-weight: 600; display: block; }
.caption-sub { color: #AEB9CC; font-size: 13px; display: block; margin-top: 6px; }
.controls {
  display: flex;
  justify-content: space-around;
  padding: 16px 12px;
  background-color: #0B2138;
}
.ctrl { display: flex; flex-direction: column; align-items: center; }
.mic { width: 40px; height: 40px; border-radius: 20px; background-color: var(--color-border); }
.mic.recording { background-color: var(--color-smart); }
.ctrl-label { color: #AEB9CC; font-size: 12px; margin-top: 6px; }
</style>
