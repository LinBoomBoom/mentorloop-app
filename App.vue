<script>
export default {
  onLaunch() {
    // 应用初始化：检查登录态、加载主题
    console.log('[MentorLoop] app launch')
  },
  onShow() {},
  onHide() {}
}
</script>

<style>
/* 设计系统 Token：以 CSS 变量注入全局，uvue 页面用 var() 引用
   来源文档 03：深海军蓝 / 紫蓝 / 青绿 + 浅色学习页背景 */
page {
  --color-navy: #0F2C4C;
  --color-smart: #5B6CFF;
  --color-reliable: #1FB6A6;
  --color-bg-light: #F7F9FC;
  --color-text-primary: #1A2433;
  --color-text-secondary: #5B6472;
  --color-border: #E3E8F0;
  --color-surface: #FFFFFF;

  background-color: var(--color-bg-light);
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--color-text-primary);
}
</style>
