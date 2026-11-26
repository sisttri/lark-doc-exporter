# PDF 字体

现有 Noto Sans CJK SC 常规、粗体继续完整保留。PDF 字形回退使用下列未修改的官方轮廓字体；它们不含彩色位图表，不在 Markdown、HTML 或素材包导出时解析。

| 本地文件 | 固定官方来源 | SHA-256 |
| --- | --- | --- |
| NotoEmoji-Regular.ttf | [google/fonts b979dba](https://github.com/google/fonts/blob/b979dba422e445492b0eb9951ac52ee0b4d648c3/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf) | `de6c18832938afc99caf132b39d6a30a19bac7f2e812e28db2535b4608d27551` |
| NotoSansSymbols2-Regular.ttf | [google/fonts 7b6724a](https://github.com/google/fonts/blob/7b6724ac7ececc713e9ba93af309f7520c9a80a3/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf) | `7d5fb73b7ca67a6798101741f5d280a3d016a56a197afcd4199dbb57b4b82a21` |

内部版本分别为 Noto Emoji 3.002、Noto Sans Symbols 2 2.008。各自 SIL OFL 1.1 原文保留在 `licenses/Noto-Emoji-OFL.txt`、`licenses/Noto-Symbols-OFL.txt`；它们不由项目 MIT 许可替代。

原文件分别为 1,982,596 B、1,233,128 B。沿用 gzip + Z85 字体缓存后，两者合计增加约 2.21 MB 的字体资源文本，不增加运行时依赖或逐字联网请求。实际发布资源摘要以资源清单为准。

`tools/build-userscript.mjs --assets-only` 校验原字节摘要，从两个 TTF 的 Unicode format-12 cmap 自动提取非 `.notdef` 覆盖区间，将区间元数据随字体归档缓存。PDF 阶段按 grapheme 选择字体，保留 ZWJ、变体选择符、旗帜和键帽序列的原字符；复选框使用符号字体。未知字形保留原文并提示覆盖不足，不将固定字体版本描述为覆盖任意未来 Unicode 或任意组合。

已验证普通 emoji、星光、心形、肤色修饰、常见职业/家庭 ZWJ、国旗、键帽及复选框的字体选择与实际 PDF；新字体需要与发布资源一起提交，再由主脚本引用固定 commit URL 和摘要。
