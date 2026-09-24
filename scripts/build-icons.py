# 构建 Lucide 图标子集与 @font-face CSS
# 用法: python scripts/build-icons.py
# 产物:
#   static/fonts/lucide-subset.ttf  —— 仅包含 USED_UNICODES 的字形（App/H5 本地引用）
#   styles/icons.css                —— App/H5 走本地 TTF；MP-WEIXIN 走 base64 内联
# 新增图标：把 unicode 加入 USED_UNICODES 后重新运行本脚本
import base64
import os

from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_TTF = os.path.join(ROOT, 'static', 'fonts', 'lucide.ttf')
OUT_TTF = os.path.join(ROOT, 'static', 'fonts', 'lucide-subset.ttf')
OUT_CSS = os.path.join(ROOT, 'styles', 'icons.css')

# 当前页面/组件实际使用的码位（来源：static/fonts/lucide.css）
USED_UNICODES = [
    0xE038,  # activity
    0xE04D,  # arrow-up-right
    0xE048,  # arrow-left
    0xE049,  # arrow-right
    0xE04F,  # award
    0xE059,  # bell
    0xE062,  # briefcase
    0xE063,  # calendar
    0xE06C,  # check
    0xE06D,  # chevron-down
    0xE06F,  # chevron-right
    0xE070,  # chevron-up
    0xE076,  # circle
    0xE077,  # circle-alert
    0xE07C,  # check-circle
    0xE080,  # circle-play
    0xE082,  # circle-help
    0xE087,  # clock
    0xE091,  # cloud-upload
    0xE09B,  # compass
    0xE0AC,  # crosshair
    0xE0C1,  # file-check
    0xE0CC,  # file-text
    0xE0D1,  # flag
    0xE0D2,  # flame
    0xE0D7,  # folder
    0xE0F5,  # home
    0xE0F9,  # info
    0xE0FF,  # layout-grid
    0xE106,  # list
    0xE10B,  # lock
    0xE10E,  # log-out
    0xE116,  # message-circle
    0xE117,  # message-square
    0xE118,  # mic
    0xE11C,  # minus
    0xE11E,  # moon
    0xE130,  # pen-line
    0xE138,  # phone-off
    0xE13C,  # play
    0xE145,  # refresh-cw
    0xE146,  # repeat
    0xE148,  # rotate-ccw
    0xE151,  # search
    0xE153,  # server
    0xE154,  # settings
    0xE155,  # share
    0xE158,  # shield
    0xE163,  # smartphone
    0xE167,  # square
    0xE172,  # square-pen
    0xE176,  # star
    0xE180,  # target
    0xE18E,  # trash-2
    0xE190,  # trending-down
    0xE191,  # trending-up
    0xE193,  # triangle-alert
    0xE19E,  # upload
    0xE19F,  # user
    0xE1AB,  # volume-2
    0xE1AE,  # wifi
    0xE1B2,  # x
    0xE1B4,  # zap
    0xE1BB,  # bot
    0xE1BF,  # gauge
    0xE1C2,  # lightbulb
    0xE1D0,  # list-checks
    0xE1D6,  # crown
    0xE1DD,  # palette
    0xE1E0,  # timer
    0xE1F5,  # history
    0xE1F9,  # pencil
    0xE1FF,  # shield-check
    0xE226,  # circle-check
    0xE234,  # graduation-cap
    0xE239,  # quote
    0xE241,  # badge-check
    0xE242,  # gem
    0xE284,  # keyboard
    0xE286,  # rocket
    0xE29A,  # sliders-horizontal
    0xE2A3,  # chart-column
    0xE32A,  # file-up
    0xE349,  # mic-vocal
    0xE357,  # wand-2
    0xE36E,  # heart-pulse
    0xE36F,  # medal
    0xE373,  # trophy
    0xE38E,  # check-check
    0xE3C6,  # brain
    0xE3F1,  # book-marked
    0xE412,  # sparkles
    0xE47E,  # sparkle
    0xE529,  # layers
    0xE538,  # scan-text
    0xE55A,  # audio-lines
    0xE596,  # notebook-pen
    0xE3A1,  # dumbbell
]


def build():
    options = subset.Options()
    options.with_zopfli = False
    font = subset.load_font(SRC_TTF, options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(set(USED_UNICODES)))
    subsetter.subset(font)
    subset.save_font(font, OUT_TTF, options)

    with open(OUT_TTF, 'rb') as f:
        b64 = base64.b64encode(f.read()).decode('ascii')

    css = f"""/* 由 scripts/build-icons.py 生成，请勿手改 */
/* App / H5：引用本地子集 TTF */
/* #ifndef MP-WEIXIN */
@font-face {{
  font-family: 'lucide';
  src: url('../static/fonts/lucide-subset.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}}
/* #endif */

/* MP-WEIXIN：wxss 不支持包内字体路径，使用 base64 内联 */
/* #ifdef MP-WEIXIN */
@font-face {{
  font-family: 'lucide';
  src: url('data:font/ttf;base64,{b64}') format('truetype');
  font-weight: normal;
  font-style: normal;
}}
/* #endif */
"""
    with open(OUT_CSS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(css)

    print('subset ttf:', os.path.getsize(OUT_TTF), 'bytes')
    print('icons.css :', os.path.getsize(OUT_CSS), 'bytes')


if __name__ == '__main__':
    build()
