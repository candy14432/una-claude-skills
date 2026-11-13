# video-highlight-distill 技能说明

[English](README.md) | [简体中文](README.zh-CN.md)

`video-highlight-distill` 是一个给 Codex、Claude 或其他智能代理使用的技能仓库，作用是把一段较长的视频整理成更短、更聚焦的精彩片段。它会先把视频内容转成文字，再由模型根据你指定的主题挑出重点片段，校验这些片段的时间范围，最后把它们合成为一个新视频。

当前这个技能暂时只支持 macOS，因为转写流程依赖 `mlx-whisper`。后续版本可以通过接入兼容 Windows 的 Whisper 后端，或改用转写 API 的方式，扩展到 Windows。

仓库地址：[github.com/Troyanovsky/video-highlight-distill](https://github.com/Troyanovsky/video-highlight-distill)

## 这个技能适合做什么

这个仓库里主要提供一个技能：`video-highlight-distill`。

如果你也有过这种情况: 拍完一大段一两个小时的原始视频，一直拖着没整理成 vlog、视频播客，或者适合发小红书、Bilibili 的精华版内容，那这个技能就是为你准备的。

如果你希望代理帮你完成下面这些事情，这个技能会比较合适：

- 把很长的视频整理成更短的精华版
- 围绕某个重点主题、核心观点或主要结论来剪辑
- 先生成可检查的文字材料，方便你确认内容是否选对
- 把选中的片段裁出来，再拼接成最终成片

仓库里还附带了这个技能会用到的辅助脚本和参考资料：

- `scripts/setup.sh`
- `scripts/transcribe_video.py`
- `scripts/validate_highlights.py`
- `scripts/auto_select_highlights.py`
- `scripts/render_highlight_video.py`
- `scripts/download_model.py`
- `references/selection-schema.md`

## 安装方法

下载并安装这个技能时，可以运行：

```bash
npx skills add Troyanovsky/video-highlight-distill
```

根据你的技能管理方式不同，它可能会被安装到下面这些位置之一：

- `.agents/skills/video-highlight-distill`
- `.claude/skills/video-highlight-distill`
- `~/.agents/skills/video-highlight-distill`
- `~/.claude/skills/video-highlight-distill`

## 它是怎么工作的

整个流程可以理解成下面这几步：

1. 一开始先确认剪辑目标。
   在执行初始化或转写之前，代理应先询问：
   - 最终成片希望控制在多长时间
   - 你想重点突出哪些主题、观点或结论
   - 内容模式
   - 输出风格
   - 如果还没提供原视频路径，也要一并确认
2. 先检查环境。
   代理会先确认机器上有没有 `python3`、`ffmpeg` 和 `ffprobe`，也会看看仓库里是否已经准备好 `.venv` 和 `models/whisper-large-v3-turbo-q4`。
3. 做初始化准备。
   `scripts/setup.sh` 会创建 `.venv`、安装需要的 Python 依赖，并在需要时把 Whisper 模型下载到项目里的 `models/` 目录。
4. 把视频内容转成文字。
   `scripts/transcribe_video.py` 会先提取音频，再生成几份中间结果：
   - `transcript.json`
   - `transcript.txt`
   - `selection_input.json`
5. 由模型挑选重点片段。
   模型应把 `transcript.txt` 作为主要阅读材料，在需要更精确的结构化时间戳时再参考 `selection_input.json`。通常应挑出多个重点片段，后续再把它们拼接成最终视频，而不是默认只找一个很长的大段。然后按照 `references/selection-schema.md` 里的格式写出一版 `highlights.draft.json`。
6. 先暂停并向用户确认。
   在真正裁剪视频之前，代理应先把选中的片段告诉用户，包括每段的时间范围、简短内容概述，以及所有片段合计的大致时长，然后等待用户确认或要求修改。
7. 校验并微调。
   `scripts/validate_highlights.py` 会在渲染前检查 JSON 结构、时间顺序、是否重叠、时间戳是否超出转写范围。`scripts/auto_select_highlights.py` 仍然保留，作为快速首版或兜底方案。
8. 输出最终视频。
   `scripts/render_highlight_video.py` 会把选中的时间段从原视频里裁出来，再拼接成一个完整的精彩片段视频。

这个技能既支持安装在 `.agents/`，也支持安装在 `.claude/`；既可以放在当前仓库里，也可以安装到用户主目录下。文档中的命令会先找到技能所在目录，再从那里调用对应脚本。

## 你需要提前提供什么

在代理真正开始生成精彩片段视频之前，你需要准备好下面这些信息：

- 最终成片希望控制在多长时间
- 你希望突出呈现的主题或主线
- 内容模式
- 输出风格
- 原始视频文件路径

在对话一开始，如果缺少目标时长、重点主题、内容模式或输出风格，代理就应该先向你确认，再开始后续流程。如果没有提供目标时长，也不能直接开始挑选片段，因为挑选过程会按时长预算来取舍内容。

推荐的内容模式：

- `vlog`
- `podcast/interview`
- `meeting/demo`
- `lecture/tutorial`
- `talking-head/social clip`

推荐的输出风格：

- `trailer`
- `recap`
- `educational summary`
- `best moments`
- `decision log`

## 在项目里运行这个技能

建议在你希望保存结果的项目目录或工作目录中运行整个流程，因为这些文件都会生成在这里：

- `.venv`
- `models/whisper-large-v3-turbo-q4`
- 转写结果文件
- 自动生成的精彩片段 JSON
- 最终输出的视频文件

更完整的命令顺序可以参考 [SKILL.md](/Users/guodongzhao/Documents/GitHub/video-distill/SKILL.md)。其中也包含了 `SKILL_DIR` 的定位方式，能够兼容本地安装和全局安装，以及 `.agents` / `.claude` 两种目录结构。

## Change Log

- 旧版本: 默认由 `scripts/auto_select_highlights.py` 基于转写分段和启发式规则生成一版 `highlights.json`。
- 新版本: 默认改为由模型以 `transcript.txt` 作为主要阅读材料来挑选通常由多个片段组成的精彩内容，再由 `scripts/validate_highlights.py` 校验时间范围；启发式自动选择保留为兜底方案。
- 边界处理: 选段逻辑现在会利用词级时间戳，减少片段结尾把词切断的问题。
