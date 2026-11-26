# PDF 预缓存资源

这些固定资源由油猴在安装或更新脚本时下载并缓存，不含任何文档正文。导出时从 `GM_getResourceText` 读取，不在运行时请求远程脚本或字体。

- `pdf-engine-0.3.15.js`：按顺序拼接 pdfmake 0.3.15 的原始 `pdfmake.min.js` 与 `standard-fonts/Courier.js`。上游：[pdfmake](https://github.com/bpampuch/pdfmake)，MIT 及其随包第三方许可见 [JavaScript-notices.txt](../licenses/JavaScript-notices.txt)。本文件不包含项目自有采集或排版代码。
- `pdf-fonts-v1.json`：Noto Sans CJK SC Regular、Bold 完整 WOFF2 的 gzip/Z85 数据及字节数和 SHA-256。字体以 [SIL OFL 1.1](../licenses/Noto-OFL.txt) 分发，不受项目 MIT 许可替代。构建前的 WOFF2 位于 `fonts/`，两个固定摘要由构建器校验。
- `manifest.json`：资源文件的 SHA-256 和字节数。主脚本通过固定 Git commit URL、油猴 SRI 及运行时摘要校验锁定这些资源。

使用 `npm run build:assets` 从锁定的依赖与字库复现。改变资源时先提交并推送资源，再将根目录 `pdf-resource-manifest.json` 指向新的不可变 commit。历史资源需要继续保留，供已安装脚本使用。
