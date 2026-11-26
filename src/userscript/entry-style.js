export const css = `
#feishu-local-export-panel{position:fixed;inset:0;z-index:2147483646;pointer-events:none;color:var(--fle-text,#263b35);font:13px/1.55 system-ui,-apple-system,'PingFang SC',sans-serif;text-align:left;letter-spacing:normal}
#feishu-local-export-panel [hidden]{display:none!important}
#feishu-local-export-panel *{box-sizing:border-box}
#feishu-local-export-panel button{appearance:none;cursor:pointer;font:inherit;color:inherit;border:1px solid var(--fle-border,#dce4df);background:var(--fle-surface,#fff);border-radius:8px;padding:8px 12px;touch-action:manipulation;transition:transform 100ms ease-out,background-color 120ms ease-out,color 120ms ease-out}
#feishu-local-export-panel button:active:not(:disabled){transform:scale(.98)}
#feishu-local-export-panel button:disabled{opacity:.45;cursor:default}
#feishu-local-export-panel :focus-visible{outline:2px solid var(--fle-accent,#246a58);outline-offset:3px}
#feishu-local-export-panel svg{display:block;width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
#feishu-local-export-panel #feishu-local-export-launcher{position:absolute;right:20px;top:60%;width:40px;height:40px;display:grid;place-items:center;padding:0;border:0;background:transparent;pointer-events:auto;touch-action:none;user-select:none;color:var(--fle-muted,#687a6f)}
#feishu-local-export-launcher .glyph{display:grid;place-items:center;width:30px;height:30px;background:var(--fle-surface,#fff);border:1px solid var(--fle-border,#dce4df);border-radius:50%;box-shadow:0 2px 7px #00000014}
#feishu-local-export-panel #feishu-local-export-launcher:hover,#feishu-local-export-panel #feishu-local-export-launcher:focus-visible{color:var(--fle-accent,#246a58)}
#feishu-local-export-launcher .tooltip{position:absolute;right:47px;top:50%;transform:translateY(-50%);white-space:nowrap;padding:5px 9px;background:var(--fle-surface,#fff);color:var(--fle-text,#263b35);border:1px solid var(--fle-border,#dce4df);border-radius:6px;font-size:12px;visibility:hidden;pointer-events:none}
#feishu-local-export-launcher:hover .tooltip,#feishu-local-export-launcher:focus-visible .tooltip{visibility:visible}
#feishu-local-export-launcher[data-state=busy] .glyph{color:var(--fle-accent,#246a58)}
#feishu-local-export-launcher[data-state=busy] svg{animation:fle-spin 1.4s linear infinite}
#feishu-local-export-launcher[data-state=notice]::after{content:'!';position:absolute;right:1px;top:0;display:grid;place-items:center;width:14px;height:14px;border-radius:50%;background:var(--fle-warning,#86611c);color:var(--fle-surface,#fff);font-size:10px;font-weight:600}
#feishu-local-export-popover{position:absolute;width:min(320px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;padding:18px;background:var(--fle-surface,#fff);border:1px solid var(--fle-border,#dce4df);border-radius:14px;box-shadow:var(--fle-shadow,0 8px 32px #162e2524);pointer-events:auto;transform-origin:right bottom}
#feishu-local-export-panel header{display:flex;align-items:center;justify-content:space-between;gap:10px}
#feishu-local-export-panel header strong{font-size:15px;font-weight:600}
#feishu-local-export-popover>header{align-items:flex-start;margin-bottom:14px}
#feishu-local-export-panel .quiet{background:transparent;border-color:transparent;color:var(--fle-muted,#687a6f);padding:5px 0}
#feishu-local-export-panel .quiet:hover{color:var(--fle-accent,#246a58)}
#feishu-local-export-panel #feishu-local-export-close{width:32px;height:32px;display:grid;place-items:center;margin:-5px -5px -5px 0;padding:0}
#feishu-local-export-title{flex:1;min-width:0;font-size:12px;color:var(--fle-muted,#687a6f);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#feishu-local-export-formats{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#feishu-local-export-formats label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;border:1px solid transparent;border-radius:8px;padding:8px 5px;min-width:0}
#feishu-local-export-formats label:has(input:checked){border-color:var(--fle-border,#dce4df);background:var(--fle-soft,#f1f7f3)}
#feishu-local-export-formats input{accent-color:var(--fle-accent,#23634f);margin:3px 0 0;width:15px;height:15px;flex:none}
#feishu-local-export-formats .format-copy{min-width:0}
#feishu-local-export-formats small{display:block;font-size:11px;color:var(--fle-muted,#687a6f);margin-top:2px}
#feishu-local-export-plan{font-size:12px;color:var(--fle-muted,#687a6f);margin:12px 0 14px;overflow-wrap:anywhere}
#feishu-local-export-panel #feishu-local-export-button{width:100%;background:var(--fle-button,#205e4c);color:var(--fle-button-text,#fff);border-color:var(--fle-button,#205e4c);font-weight:600;min-height:40px}
#feishu-local-export-availability,#feishu-local-export-snapshot-note{font-size:12px;color:var(--fle-warning,#775f2b);margin:10px 0;overflow-wrap:anywhere}
#feishu-local-export-capture-note{font-size:11px;color:var(--fle-muted,#687a6f);margin-top:10px}
#feishu-local-export-notice{font-size:12px;color:var(--fle-warning,#775f2b);border-top:1px solid var(--fle-border,#dce4df);margin-top:12px;padding-top:8px}
#feishu-local-export-panel #feishu-local-export-notice-details{color:inherit;padding:3px 0;display:block}
#feishu-local-export-card header strong{font-size:13px}
#feishu-local-export-card progress{display:block;width:100%;height:4px;accent-color:var(--fle-accent,#23634f);margin:14px 0}
#feishu-local-export-status{display:block;font-size:13px;overflow-wrap:anywhere;margin:8px 0}
#feishu-local-export-job-heading{color:var(--fle-accent,#23634f)}
#feishu-local-export-history{border-top:1px solid var(--fle-border,#dce4df);margin-top:14px;padding-top:10px;font-size:12px;overflow-wrap:anywhere}
#feishu-local-export-history>summary{color:var(--fle-muted,#687a6f)}
#feishu-local-export-results{font-size:12px;margin-top:10px;overflow-wrap:anywhere}
#feishu-local-export-results strong{font-weight:500}
#feishu-local-export-warnings{font-size:12px;color:var(--fle-warning,#7c6028);margin-top:12px;overflow-wrap:anywhere}
#feishu-local-export-panel summary{cursor:pointer;padding:4px 0}
#feishu-local-export-panel ul{padding-left:18px;max-height:150px;overflow:auto;margin:6px 0}
#feishu-local-export-panel details button{font-size:12px}
#feishu-local-export-actions,#feishu-local-export-file-actions{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:10px}
#feishu-local-export-panel #feishu-local-export-supplement,#feishu-local-export-panel #feishu-local-export-redownload,#feishu-local-export-panel #feishu-local-export-fresh{color:var(--fle-accent,#23634f)}
@keyframes fle-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#feishu-local-export-launcher[data-state=busy] svg{animation:none}}
#feishu-local-export-panel[data-input=keyboard] button{transition:none}
#feishu-local-export-panel[data-input=keyboard] button:active{transform:none}
#feishu-local-export-popover,#feishu-local-export-formats label{transition:background-color 160ms ease-out,border-color 160ms ease-out,color 160ms ease-out}
@media(prefers-reduced-motion:reduce){#feishu-local-export-panel button{transition:none}}
@media(prefers-reduced-motion:reduce){#feishu-local-export-popover,#feishu-local-export-formats label{transition:none}}
@media(pointer:coarse){#feishu-local-export-panel button,#feishu-local-export-panel label,#feishu-local-export-panel summary{min-height:44px}#feishu-local-export-panel #feishu-local-export-launcher{width:44px;height:44px}#feishu-local-export-panel #feishu-local-export-close{width:44px;height:44px}}
@media(forced-colors:active){#feishu-local-export-panel button,#feishu-local-export-popover,#feishu-local-export-launcher .glyph{border:1px solid ButtonText}#feishu-local-export-launcher[data-state=notice]::after{background:Mark;color:MarkText}}
`;
