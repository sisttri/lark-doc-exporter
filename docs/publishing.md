# 发布与更新

## 0.0.1 公开版本

- [Greasy Fork 社区页面](https://greasyfork.org/zh-CN/scripts/607471-飞书文档导出工具)
- [Greasy Fork 安装入口](https://update.greasyfork.org/scripts/607471/飞书文档导出工具.user.js)
- [GitHub v0.0.1](https://github.com/sisttri/lark-doc-exporter/releases/tag/v0.0.1)

0.0.1 源提交为 `b30f49ae5a25c732e2d486eaf59688360170eed4`。发布前完整测试 499 项通过、0 失败、0 跳过，[对应 CI](https://github.com/sisttri/lark-doc-exporter/actions/runs/45820415088)已成功；测试范围和边界见 [验收记录](release-checks.md)。

社区版主脚本和更新由 Greasy Fork 分发；两项 PDF 静态资源继续从固定 GitHub commit 下载并缓存，保留 SRI 和运行时摘要校验。

### 社区安装验证（2026-11-26）

Greasy Fork 已按公开用户脚本、简体中文和 MIT 发布。社区分发脚本为 702,985 B，仅安装与更新元信息由站点调整，代码主体与源提交的 702,919 B 脚本逐字节一致。社区安装与更新链接均可访问。

已从社区页面实际点击安装，在 Tampermonkey 5.5.1 完成重新安装。编辑器中的完整源码与社区分发文件一致，按用户脚本配置检查为零诊断。

实际导出 HTML 和 PDF 总包，面板清单与包内两项一致。HTML 离线打开的五张图片正常解码、两张表格保留，没有 HTTP(S) 子资源；PDF 为 A4 六页、897,513 B，文本提取成功，首尾页已渲染目视检查。样本的内嵌多维表格和两幅 GIF 静态排版保留准确提示，未宣称超出现有能力边界。

导出结束恢复原阅读位置，格式偏好恢复。本轮导出物、截图、临时副本及一条测试下载记录清理；公开发布页面保留。发布附件继续对应上面的源提交，后续文档维护不移动已发布的版本标签。

## 后续版本

1. 同步提升 `src/shared.js` 的 `VERSION`、`package.json` 和 `package-lock.json` 中的项目版本，例如 `0.0.2`。保留现有脚本名称及 namespace。
2. 安装锁定依赖，构建并验证：

   ```sh
   npm ci
   npm run build
   npm test
   npm run lint
   node --check lark-doc-exporter.user.js
   git diff --check
   ```

3. 在 EgoLite 安装生成的脚本，核对实际导出文件及对应改动；清理测试临时文件和下载记录。
4. 提交源码和生成的用户脚本，推送后等待 CI 成功。创建新版本 Git tag 和 GitHub Release，附上用户脚本、安装包、源码包及验收记录，再正式发布。
5. 在上面的同一 Greasy Fork 脚本中发布新版本，提交完整的 `lark-doc-exporter.user.js` 和变更说明。保留资源摘要及许可注释；发布后核对社区版本号和安装入口。

不要为更新另建社区脚本。只发布 GitHub 版本不会更新从 Greasy Fork 安装的脚本。
