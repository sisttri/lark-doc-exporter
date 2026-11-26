export const VERSION = '0.0.1';
export const warningMarker = 'feishu-local-exporter-warnings';
export function safeStem(name) {
  let value = Array.from(String(name).normalize('NFC')).slice(0,60).join('')
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/gu, '_')
    .replace(/^[.\s]+|[.\s]+$/gu, '');
  if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(value)) value = '_'+value;
  return value || '文档';
}
export const warnings = {
  missing_image:'缺少本地图片', invalid_image:'图片无法解码', remote_image:'外部图片已保留为文字说明',
  missing_attachment:'缺少附件', unsupported_link:'已移除无法安全打开的链接', unsupported_block:'内容块未完整转换',
  missing_block:'可能缺少文档块', missing_code:'缺少代码块内容', code_unreadable:'未能读取代码块',
  code_lines_missing:'缺少代码行', image_unreadable:'未能读取图片', image_download_failed:'未能保存图片',
  duplicate_image:'图片路径重复', code_tail_unconfirmed:'未能确认代码末行', capture_step_limit:'未能确认文末',
  table_cell_unconfirmed:'未能确认表格单元格内容', table_structure_unconfirmed:'未能确认表格结构',
  capture_content_changed:'采集期间内容发生变化，请重新保存核对',
  pdf_conversion_note:'PDF 转换提示'
};
export function warningLabel(code) { return warnings[code] || '内容已简化'; }
