// assets/charts.js — 多端 UI 设计学习手册
(function () {
  var style = getComputedStyle(document.documentElement);
  var accent = style.getPropertyValue('--accent').trim() || '#4f46e5';
  var accent2 = style.getPropertyValue('--accent2').trim() || '#0ea5e9';
  var ink = style.getPropertyValue('--ink').trim() || '#1a1d29';
  var muted = style.getPropertyValue('--muted').trim() || '#5c6273';
  var rule = style.getPropertyValue('--rule').trim() || 'rgba(26,29,41,0.10)';
  var bg2 = style.getPropertyValue('--bg2').trim() || '#ffffff';

  /* ---------- Mermaid init ---------- */
  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: true, theme: 'neutral', securityLevel: 'loose', flowchart: { htmlLabels: true } });
  }

  /* ---------- Chart 1: 定位象限散点 ---------- */
  var elQ = document.getElementById('chart-quadrant');
  if (elQ && window.echarts) {
    var chartQ = echarts.init(elQ, null, { renderer: 'svg' });

    var libs = [
      { name: 'shadcn/ui', x: 8.0, y: 6.5, tag: '两者兼得' },
      { name: 'Radix UI', x: 9.5, y: 2.0, tag: '自建体系' },
      { name: 'Headless UI', x: 9.0, y: 2.5, tag: '自建体系' },
      { name: 'daisyUI', x: 6.0, y: 7.5, tag: '均衡' },
      { name: 'Chakra UI', x: 5.5, y: 6.5, tag: '均衡' },
      { name: 'HeroUI', x: 5.0, y: 7.0, tag: '快速出活' },
      { name: 'React Bits', x: 4.5, y: 7.5, tag: '快速出活' },
      { name: 'Mantine', x: 5.5, y: 8.0, tag: '均衡' },
      { name: 'MUI', x: 5.0, y: 8.5, tag: '快速出活' },
      { name: 'Ant Design', x: 4.5, y: 9.0, tag: '快速出活' },
      { name: 'Fluent UI', x: 4.0, y: 8.5, tag: '快速出活' },
      { name: 'React Bootstrap', x: 3.5, y: 7.5, tag: '快速出活' }
    ];

    var option = {
      animation: false,
      grid: { left: 56, right: 40, top: 40, bottom: 48 },
      tooltip: {
        appendToBody: true,
        formatter: function (p) {
          return '<b>' + p.data.name + '</b><br>样式可控性：' + p.data.value[0] + ' / 10<br>开箱即用：' + p.data.value[1] + ' / 10';
        }
      },
      xAxis: {
        name: '样式可控性 →',
        nameLocation: 'middle', nameGap: 30,
        nameTextStyle: { color: muted, fontSize: 12, fontWeight: 600 },
        min: 0, max: 10,
        splitLine: { lineStyle: { color: rule } },
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted }
      },
      yAxis: {
        name: '开箱即用 →',
        nameLocation: 'middle', nameGap: 40,
        nameTextStyle: { color: muted, fontSize: 12, fontWeight: 600 },
        min: 0, max: 10,
        splitLine: { lineStyle: { color: rule } },
        axisLine: { lineStyle: { color: rule } },
        axisLabel: { color: muted }
      },
      series: [
        {
          type: 'scatter',
          symbolSize: 20,
          data: libs.map(function (d) {
            return { name: d.name, value: [d.x, d.y], tag: d.tag,
              itemStyle: {
                color: d.tag === '自建体系' ? accent : (d.tag === '快速出活' ? accent2 : ink),
                opacity: 0.85
              },
              label: { show: true, position: 'top', distance: 6, color: ink, fontSize: 11, fontWeight: 600, formatter: d.name }
            };
          }),
          markLine: {
            silent: true, symbol: 'none',
            lineStyle: { color: muted, type: 'dashed', opacity: 0.5 },
            label: { show: false },
            data: [ { xAxis: 5.5 }, { yAxis: 5.5 } ]
          },
          markArea: {
            silent: true,
            itemStyle: { color: 'rgba(79,70,229,0.04)' },
            data: [ [ { xAxis: 5.5, yAxis: 5.5 }, { xAxis: 10, yAxis: 10 } ] ]
          }
        }
      ],
      graphic: [
        { type: 'text', left: 70, top: 52, style: { text: '快速出活区', fill: muted, fontSize: 12, fontWeight: 700 } },
        { type: 'text', right: 52, top: 52, style: { text: '两者兼得区', fill: accent, fontSize: 12, fontWeight: 700 } },
        { type: 'text', left: 70, bottom: 58, style: { text: '按需补齐区', fill: muted, fontSize: 12, fontWeight: 700 } },
        { type: 'text', right: 52, bottom: 58, style: { text: '自建体系区', fill: accent2, fontSize: 12, fontWeight: 700 } }
      ]
    };
    chartQ.setOption(option);
    window.addEventListener('resize', function () { chartQ.resize(); });
  }

  /* ---------- Chart 2: 三类方案雷达 ---------- */
  var elR = document.getElementById('chart-radar');
  if (elR && window.echarts) {
    var chartR = echarts.init(elR, null, { renderer: 'svg' });
    chartR.setOption({
      animation: false,
      tooltip: { appendToBody: true },
      legend: { bottom: 0, textStyle: { color: muted }, itemGap: 24 },
      radar: {
        indicator: [
          { name: '开箱即用', max: 5 },
          { name: '样式可控性', max: 5 },
          { name: '企业级能力', max: 5 },
          { name: '视觉表现', max: 5 },
          { name: '生态与文档', max: 5 }
        ],
        radius: '62%',
        center: ['50%', '48%'],
        axisName: { color: ink, fontSize: 12, fontWeight: 600 },
        splitLine: { lineStyle: { color: rule } },
        splitArea: { areaStyle: { color: ['rgba(79,70,229,0.03)', 'transparent'] } },
        axisLine: { lineStyle: { color: rule } }
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              name: '掌控型 · shadcn/ui',
              value: [3.0, 5.0, 2.5, 3.5, 4.5],
              lineStyle: { color: accent, width: 2 },
              itemStyle: { color: accent },
              areaStyle: { color: accent, opacity: 0.12 }
            },
            {
              name: '企业型 · Ant Design',
              value: [5.0, 2.5, 5.0, 3.0, 5.0],
              lineStyle: { color: accent2, width: 2 },
              itemStyle: { color: accent2 },
              areaStyle: { color: accent2, opacity: 0.12 }
            },
            {
              name: '视觉型 · React Bits',
              value: [4.0, 3.5, 1.5, 5.0, 3.0],
              lineStyle: { color: muted, width: 2, type: 'dashed' },
              itemStyle: { color: muted },
              areaStyle: { color: muted, opacity: 0.08 }
            }
          ]
        }
      ]
    });
    window.addEventListener('resize', function () { chartR.resize(); });
  }
})();
