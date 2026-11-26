// ==UserScript==
// @name         飞书文档导出工具
// @namespace    urn:feishu-local-exporter
// @version      0.0.1
// @description  将飞书文档保存为 Markdown、HTML、PDF 和已采集素材；PDF 依赖在安装时预缓存，导出时在本机生成。
// @author       sisttri
// @license      MIT
// @homepageURL  https://github.com/sisttri/lark-doc-exporter
// @supportURL   https://github.com/sisttri/lark-doc-exporter/issues
// @match        https://*.feishu.cn/docx/*
// @match        https://*.feishu.cn/docs/*
// @match        https://*.feishu.cn/wiki/*
// @run-at       document-idle
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getResourceText
// @grant        unsafeWindow
// @updateURL    https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js
// @downloadURL  https://raw.githubusercontent.com/sisttri/lark-doc-exporter/main/lark-doc-exporter.user.js
// @resource     pdfEngine https://raw.githubusercontent.com/sisttri/lark-doc-exporter/26c22708c7b5a952611c185fa2c151d60bde83ce/release-assets/pdf-engine-0.3.15.js#sha256=34561e07851000e186ab22e1cb8e38b84e54f2de618946de4053f692c8d2003b
// @resource     pdfFonts https://raw.githubusercontent.com/sisttri/lark-doc-exporter/26c22708c7b5a952611c185fa2c151d60bde83ce/release-assets/pdf-fonts-v1.json#sha256=76df3504ffe8e93e530e75807ef7cc48ecf844c584e3d7224f19b6c2e35d1a3c
// ==/UserScript==
/* global globalThis:readonly */
// Readable bundled libraries for local HTML parsing, ZIP output and isolated Worker decompression:
// fflate 0.8.2 (MIT): https://github.com/101arrowz/fflate/tree/v0.8.2
// parse5 7.3.0 (MIT): https://github.com/inikulin/parse5/tree/v7.3.0
// entities 6.0.1 (BSD-2-Clause): https://github.com/fb55/entities/tree/v6.0.1
/*
LICENSE

MIT License

Copyright (c) 2026 sisttri

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
/*
licenses/JavaScript-notices.txt

Third-party software notices


node_modules/@noble/ciphers 2.4.0 · MIT

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)
Copyright (c) 2016 Thomas Pornin <pornin@bolet.org>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

node_modules/@noble/hashes 2.4.0 · MIT

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

node_modules/@pdfmake/svg-to-pdfkit 0.2.0 · MIT

The MIT License (MIT)

Copyright (c) 2019-2022 alafr
Copyright (c) 2026 liborm85

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


node_modules/base64-js 1.5.1 · MIT

The MIT License (MIT)

Copyright (c) 2014 Jameson Little

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


node_modules/brotli 2.1.0 · MIT

## License

MIT


node_modules/dfa 2.0.0 · MIT

## License

MIT


node_modules/entities 6.0.1 · BSD-2-Clause

Copyright (c) Felix Böhm
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS,
EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


node_modules/fflate 0.8.2 · MIT

MIT License

Copyright (c) 2023 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

node_modules/fontkit 3.0.0 · MIT

MIT License

Copyright (c) 2014-present Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


node_modules/fontkit/node_modules/fflate 0.8.3 · MIT

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

node_modules/linebreak 2.0.0 · MIT

MIT License

Copyright (c) 2014-present Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


node_modules/parse5 7.3.0 · MIT

Copyright (c) 2013-2019 Ivan Nikulin (ifaaan@gmail.com, https://github.com/inikulin)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.


node_modules/pdfkit 0.21.0 · MIT

MIT LICENSE
Copyright (c) 2014 Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

node_modules/pdfkit/node_modules/fflate 0.8.3 · MIT

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

node_modules/pdfmake 0.3.15 · MIT

The MIT License (MIT)

Copyright (c) 2014-2015 bpampuch
              2016-2026 liborm85

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


node_modules/png-js 3.0.0 · MIT

MIT License

Copyright (c) 2017 Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


node_modules/png-js/node_modules/fflate 0.8.3 · MIT

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

node_modules/restructure 3.0.2 · MIT

MIT License

Copyright (c) 2015-present Devon Govett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.


node_modules/sax 1.6.1 · BlueOak-1.0.0

# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***


node_modules/unicode-properties 2.0.2 · MIT

Copyright 2018

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



node_modules/unicode-trie 3.0.0 · MIT

Copyright 2018

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.



node_modules/unicode-trie/node_modules/fflate 0.8.3 · MIT

MIT License

Copyright (c) 2026 Arjun Barrett

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

node_modules/xmldoc 2.0.3 · MIT

Copyright 2012 Nick Farina.
All rights reserved.

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.


*/
/*
licenses/Noto-OFL.txt

Noto Sans CJK SC Regular and Bold
© 2014–2021 Adobe.

This Font Software is licensed under the SIL Open Font License,
Version 1.1.

This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to
provide a free and open framework in which fonts may be shared and
improved in partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply to
any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software
components as distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to,
deleting, or substituting -- in part or in whole -- any of the
components of the Original Version, by changing formats or by porting
the Font Software to a new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed,
modify, redistribute, and sell modified and unmodified copies of the
Font Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components, in
Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created using
the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.

*/

(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return (fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res);
  };
  var __export = (target, all) => {
    for (var name in all) {
      __defProp(target, name, { get: all[name], enumerable: true });
      }
  };

  // cached-pdf:assets
  var assets_exports = {};
  __export(assets_exports, {
    resourceHashes: () => resourceHashes,
    workerSource: () => workerSource
  });
  var resourceHashes, workerSource;
  var init_assets = __esm({
    "cached-pdf:assets"() {
      resourceHashes = { "pdfEngine": "34561e07851000e186ab22e1cb8e38b84e54f2de618946de4053f692c8d2003b", "pdfFonts": "76df3504ffe8e93e530e75807ef7cc48ecf844c584e3d7224f19b6c2e35d1a3c" };
      workerSource = "(" + function pdfWorkerBootstrap() {
        (() => {
          function safeStem2(name) {
            let value = Array.from(String(name).normalize("NFC")).slice(0, 60).join("").replace(/[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/gu, "_").replace(/^[.\s]+|[.\s]+$/gu, "");
            if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(value)) value = "_" + value;
            return value || "文档";
          }
          var warnings2 = {
            missing_image: "缺少本地图片",
            invalid_image: "图片无法解码",
            remote_image: "外部图片已保留为文字说明",
            missing_attachment: "缺少附件",
            unsupported_link: "已移除无法安全打开的链接",
            unsupported_block: "内容块未完整转换",
            missing_block: "可能缺少文档块",
            missing_code: "缺少代码块内容",
            code_unreadable: "未能读取代码块",
            code_lines_missing: "缺少代码行",
            image_unreadable: "未能读取图片",
            image_download_failed: "未能保存图片",
            duplicate_image: "图片路径重复",
            code_tail_unconfirmed: "未能确认代码末行",
            capture_step_limit: "未能确认文末",
            table_cell_unconfirmed: "未能确认表格单元格内容",
            table_structure_unconfirmed: "未能确认表格结构",
            capture_content_changed: "采集期间内容发生变化，请重新保存核对",
            pdf_conversion_note: "PDF 转换提示"
          };
          function warningLabel2(code) {
            return warnings2[code] || "内容已简化";
          }
          var horizontal2 = /* @__PURE__ */ new Set(["left", "center", "right", "justify"]);
          var vertical2 = /* @__PURE__ */ new Set(["top", "middle", "bottom"]);
          function normalizeAlign2(value) {
            const text = typeof value === "string" ? value.trim().toLowerCase() : "";
            return horizontal2.has(text) ? text : void 0;
          }
          function normalizeValign2(value) {
            const text = typeof value === "string" ? value.trim().toLowerCase() : "";
            return vertical2.has(text) ? text : void 0;
          }
          function normalizeColor2(value) {
            if (typeof value !== "string" || value.length > 64) return;
            const text = value.trim().toLowerCase();
            if (/^#[\da-f]{6}$/u.test(text)) return text;
            if (/^#[\da-f]{3}$/u.test(text)) return "#" + [...text.slice(1)].map((char) => char + char).join("");
            const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u.exec(text) || /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*1(?:\.0+)?\s*\)$/u.exec(text);
            if (rgb && rgb.slice(1).every((channel) => Number(channel) <= 255)) {
              return "#" + rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("");
            }
          }
          function normalizeCellStyle2(fields = {}) {
            const result = {};
            for (const field of ["background", "color"]) {
              const value = normalizeColor2(fields?.[field]);
              if (value) result[field] = value;
            }
            const align = normalizeAlign2(fields?.align), valign = normalizeValign2(fields?.valign);
            if (align) result.align = align;
            if (valign) result.valign = valign;
            return result;
          }
          function normalizeColumnWidths2(values) {
            if (!Array.isArray(values) || !values.length || values.length > 64 || !values.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) return;
            if (values.every(Number.isInteger) && values.reduce((sum, value) => sum + value, 0) === 1e4) return values.slice();
            const maximum = Math.max(...values);
            const weights = values.map((value) => value / maximum);
            const total = weights.reduce((sum, value) => sum + value, 0);
            const exact = weights.map((value) => value * 1e4 / total);
            const widths = exact.map((value) => Math.max(1, Math.floor(value)));
            let remaining = 1e4 - widths.reduce((sum, value) => sum + value, 0);
            const order = exact.map((value, index) => index).sort((a, b) => remaining >= 0 ? exact[b] % 1 - exact[a] % 1 || a - b : widths[b] - widths[a] || a - b);
            for (const index of order) {
              if (remaining > 0) {
                widths[index]++;
                remaining--;
              } else if (remaining < 0) {
                const removed = Math.min(-remaining, widths[index] - 1);
                widths[index] -= removed;
                remaining += removed;
              }
            }
            return widths;
          }
          var INLINE = /* @__PURE__ */ new Set(["a", "span", "strong", "b", "em", "i", "s", "del", "strike", "small", "u", "code", "mark", "sub", "sup", "br"]);
          var SECTIONS = /* @__PURE__ */ new Set(["thead", "tbody", "tfoot"]);
          var MiB2 = 1024 * 1024;
          var PAGE_MARGINS = [42, 44, 42, 43];
          var PAGE_WIDTH = 595.28 - PAGE_MARGINS[0] - PAGE_MARGINS[2];
          var COLUMN_GAP = 16;
          var MIN_COLUMN_WIDTH = 24;
          var MAX_IMAGE_HEIGHT = 600;
          function limit() {
            throw Object.assign(new Error("PDF_LIMIT"), { code: "PDF_LIMIT" });
          }
          function plain(node) {
            if (typeof node === "string") return node;
            if (node.tag === "br") return "\n";
            if (node.tag === "img") return node.alt || "图片";
            return (node.children || []).map(plain).join("");
          }
          function checkedSize(snapshot) {
            let chars = 0, nodes = 0;
            function check(node) {
              if (++nodes > 2e4) limit();
              if (typeof node === "string") {
                chars += node.length;
                if (chars > 3e5) limit();
              } else (node.children || []).forEach(check);
            }
            snapshot.blocks.forEach(check);
          }
          function dataUrl2(bytes, type) {
            const pieces = [];
            for (let i2 = 0; i2 < bytes.length; i2 += 16384) {
              pieces.push(String.fromCharCode(...bytes.subarray(i2, i2 + 16384)));
            }
            return "data:" + type + ";base64," + btoa(pieces.join(""));
          }
          function staticPng(bytes) {
            const signature = [137, 80, 78, 71, 13, 10, 26, 10];
            if (!signature.every((byte, index) => bytes[index] === byte)) return false;
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            for (let offset = 8; offset + 12 <= bytes.length; ) {
              const length = view.getUint32(offset);
              if (length > bytes.length - offset - 12) return false;
              const kind = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
              if (kind === "acTL") return false;
              if (kind === "IEND") return length === 0;
              offset += length + 12;
            }
            return false;
          }
          async function prepareImages(snapshot) {
            checkedSize(snapshot);
            const referenced = /* @__PURE__ */ new Set();
            function visit(node) {
              if (typeof node === "string") return;
              if (node.tag === "img" && node.path) referenced.add(node.path);
              (node.children || []).forEach(visit);
            }
            snapshot.blocks.forEach(visit);
            const images = {}, names = /* @__PURE__ */ new Map(), dimensions2 = /* @__PURE__ */ new Map(), slices = /* @__PURE__ */ new Map();
            let pixels = 0, bytes = 0, renderedBytes = 0, skipped = 0, staticImages = 0;
            for (const asset of snapshot.assets) {
              if (asset.role !== "image" || !referenced.has(asset.path)) continue;
              bytes += asset.bytes.length;
              if (bytes > 24 * MiB2 || referenced.size > 110) limit();
              let bitmap;
              try {
                bitmap = await createImageBitmap(new Blob([asset.bytes], { type: asset.type }));
                pixels += bitmap.width * bitmap.height;
                if (pixels > 28e6) limit();
                const { width, height } = bitmap;
                const displayWidth = Math.min(PAGE_WIDTH, width * 0.75);
                const sliceHeight = Math.max(1, Math.floor(MAX_IMAGE_HEIGHT * width / displayWidth));
                const entries = [], parts = [];
                let assetBytes = 0;
                for (let top = 0; top < height; top += sliceHeight) {
                  const partHeight = Math.min(sliceHeight, height - top);
                  let preparedBytes, type = "image/png";
                  if (height <= sliceHeight && (asset.type === "image/jpeg" || asset.type === "image/png" && staticPng(asset.bytes))) {
                    preparedBytes = asset.bytes;
                    type = asset.type;
                  } else {
                    const canvas = new OffscreenCanvas(width, partHeight);
                    try {
                      canvas.getContext("2d").drawImage(bitmap, 0, top, width, partHeight, 0, 0, width, partHeight);
                      const rendered = await canvas.convertToBlob({ type: "image/png" });
                      if (renderedBytes + assetBytes + rendered.size > 32 * MiB2) limit();
                      preparedBytes = new Uint8Array(await rendered.arrayBuffer());
                    } finally {
                      canvas.width = 0;
                      canvas.height = 0;
                    }
                  }
                  assetBytes += preparedBytes.length;
                  if (renderedBytes + assetBytes > 32 * MiB2) limit();
                  const id = "image" + names.size + "_" + parts.length;
                  entries.push([id, dataUrl2(preparedBytes, type)]);
                  parts.push({ id, width, height: partHeight });
                }
                renderedBytes += assetBytes;
                Object.assign(images, Object.fromEntries(entries));
                names.set(asset.path, parts[0].id);
                dimensions2.set(asset.path, { width, height });
                if (parts.length > 1) slices.set(asset.path, parts);
                if (asset.type === "image/gif" || asset.type === "image/webp") staticImages++;
              } catch (error) {
                if (error.code === "PDF_LIMIT") throw error;
                skipped++;
              } finally {
                bitmap?.close();
              }
            }
            return { images, names, dimensions: dimensions2, slices, skipped, staticImages };
          }
          function tableRows(table) {
            const rows = [];
            for (const node of table.children || []) {
              if (node.tag === "tr") rows.push({ node, header: false });
              if (SECTIONS.has(node.tag)) {
                for (const row of node.children || []) {
                  if (row.tag === "tr") rows.push({ node: row, header: node.tag === "thead" });
                }
              }
            }
            return rows;
          }
          function isHeading(tag) {
            return /^h[1-6]$/.test(tag);
          }
          function withDecoration(inherited = [], decoration) {
            return inherited.includes(decoration) ? inherited : [...inherited, decoration];
          }
          function boundLongTokens(value) {
            return value.replace(/[^\s\u200b\u3000-\u9fff]{128,}/gu, (token) => token.match(/.{1,64}/gu).join("​"));
          }
          function columnWidths(grid, count, availableWidth, hints) {
            const source = normalizeColumnWidths2(hints);
            if (source?.length === count) {
              const padding = source.map((_, index) => (index ? COLUMN_GAP / 2 : 0) + (index < count - 1 ? COLUMN_GAP / 2 : 0));
              const widths = Array(count);
              let pending = source.map((_, index) => index), remaining2 = availableWidth, total = 1e4;
              while (pending.length) {
                const available = remaining2, weightTotal = total;
                const narrow = pending.filter((index) => available * source[index] / weightTotal - padding[index] < MIN_COLUMN_WIDTH);
                if (!narrow.length) {
                  for (const index of pending) widths[index] = remaining2 * source[index] / total - padding[index];
                  break;
                }
                for (const index of narrow) {
                  widths[index] = MIN_COLUMN_WIDTH;
                  remaining2 -= MIN_COLUMN_WIDTH + padding[index];
                  total -= source[index];
                }
                pending = pending.filter((index) => widths[index] === void 0);
              }
              return widths;
            }
            const weights = Array(count).fill(1);
            function contentUnits(node) {
              let longest = 0, line = 0;
              for (const character of plain(node)) {
                if (character === "\n" || character === "\r") {
                  longest = Math.max(longest, line);
                  line = 0;
                } else line += character.codePointAt(0) < 128 ? 0.55 : 1;
              }
              function hasImage(item) {
                return typeof item !== "string" && (item.tag === "img" || (item.children || []).some(hasImage));
              }
              return Math.min(160, Math.max(1, longest, line, hasImage(node) ? 20 : 0));
            }
            for (const row of grid) {
              for (let column = 0; column < row.length; column++) {
                const entry = row[column];
                if (!entry?.cell) continue;
                const weight = Math.sqrt(contentUnits(entry.cell) / entry.colSpan);
                for (let index = column; index < column + entry.colSpan; index++) weights[index] = Math.max(weights[index], weight);
              }
            }
            const budget = availableWidth - (count - 1) * COLUMN_GAP;
            const remaining = budget - count * MIN_COLUMN_WIDTH;
            const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
            return weights.map((weight) => MIN_COLUMN_WIDTH + remaining * weight / totalWeight);
          }
          function pdfDefinition(snapshot, prepared = { images: {}, names: /* @__PURE__ */ new Map() }) {
            checkedSize(snapshot);
            let denseTables = 0;
            const textLine = (str, add = {}) => ({ text: boundLongTokens(str), ...add });
            function sequence(nodes, availableWidth, fontSize, cellColor) {
              const out = [], buffer = [];
              function flush() {
                if (buffer.length) out.push({ text: buffer.splice(0) });
              }
              function walk(node, style) {
                if (typeof node === "string") {
                  if (node) buffer.push(textLine(node, style));
                  return;
                }
                const tag = node.tag;
                if (tag === "br") {
                  buffer.push(textLine("\n", style));
                  return;
                }
                if (tag === "img") {
                  flush();
                  const id = prepared.names.get(node.path);
                  if (id) {
                    const slices = prepared.slices?.get(node.path);
                    const size = prepared.dimensions?.get(node.path);
                    if (slices) {
                      for (const part of slices) out.push({ image: part.id, width: Math.min(availableWidth, part.width * 0.75), margin: [0, 3, 0, 3] });
                    } else {
                      const fit = size ? [Math.min(availableWidth, size.width * 0.75), Math.min(MAX_IMAGE_HEIGHT, size.height * 0.75)] : [Math.min(315, availableWidth), 245];
                      out.push({ image: id, fit, margin: [0, 3, 0, 3] });
                    }
                  }
                  if (node.alt || !id) out.push(textLine(node.alt || "图片无法排版", { fontSize: 9, color: cellColor ?? "#596960" }));
                  return;
                }
                if (INLINE.has(tag)) {
                  const next = { ...style };
                  if (tag === "strong" || tag === "b") next.bold = true;
                  if (tag === "em" || tag === "i") next.italics = true;
                  if (tag === "s" || tag === "del" || tag === "strike") next.decoration = withDecoration(style.decoration, "lineThrough");
                  if (tag === "small" || tag === "sup" || tag === "sub") next.fontSize = 8;
                  if (tag === "u") next.decoration = withDecoration(style.decoration, "underline");
                  if (tag === "a" && /^(?:https?:\/\/|mailto:)/i.test(node.href || "")) {
                    next.link = node.href;
                    next.color = cellColor ?? "#155e50";
                    next.decoration = withDecoration(style.decoration, "underline");
                  }
                  if (tag === "code" && !cellColor) next.background = "#edf1ee";
                  (node.children || []).forEach((child) => walk(child, next));
                  return;
                }
                flush();
                out.push(block(node, availableWidth, fontSize, cellColor));
              }
              nodes.forEach((node) => walk(node, {}));
              flush();
              return out.length ? out : [{ text: "" }];
            }
            function table(node, availableWidth, fontSize, cellColor) {
              const rows = tableRows(node);
              if (!rows.length) return textLine("");
              const rowCells = rows.map(({ node: node2 }) => (node2.children || []).filter((cell) => cell.tag === "td" || cell.tag === "th"));
              const grid = rows.map(() => []);
              let width = 0, headers = 0;
              for (let r = 0; r < rows.length; r++) {
                const cells = rowCells[r];
                if (r === headers && (rows[r].header || cells.length && cells.every((c2) => c2.tag === "th"))) headers++;
                let c = 0;
                for (const cell of cells) {
                  while (grid[r][c] !== void 0) c++;
                  const cs = Math.max(1, cell.colspan || 1), rs = Math.max(1, Math.min(rows.length - r, cell.rowspan || 1));
                  if (c + cs > 12 || (c + cs) * rows.length > 14e3) return flatTable();
                  for (let y = r; y < r + rs; y++) {
                    for (let x2 = c; x2 < c + cs; x2++) {
                      if (grid[y][x2] !== void 0) return flatTable();
                      grid[y][x2] = {};
                    }
                  }
                  grid[r][c] = { cell, colSpan: cs, rowSpan: rs };
                  width = Math.max(width, c + cs);
                  c += cs;
                }
              }
              if (!width) return textLine("");
              const columnWidth2 = (availableWidth - (width - 1) * COLUMN_GAP) / width;
              if (columnWidth2 < MIN_COLUMN_WIDTH) return flatTable();
              const widths = columnWidths(grid, width, availableWidth, node.columnWidths);
              if (headers >= rows.length) headers = 0;
              const body = grid.map((row) => Array.from({ length: width }, (_, index) => {
                const entry = row[index];
                if (!entry) return { text: "" };
                if (!entry.cell) return {};
                const { cell, colSpan, rowSpan } = entry;
                const style = normalizeCellStyle2(cell);
                const color2 = style.color ?? cellColor;
                const cellWidth = widths.slice(index, index + colSpan).reduce((sum, value) => sum + value, 0) + (colSpan - 1) * COLUMN_GAP;
                return {
                  stack: sequence(cell.children || [], cellWidth, 9, color2),
                  bold: cell.tag === "th",
                  fillColor: style.background ?? (cell.tag === "th" && !cellColor ? "#e5eee8" : void 0),
                  color: color2,
                  alignment: style.align,
                  verticalAlignment: style.valign,
                  colSpan,
                  rowSpan
                };
              }));
              return { table: { headerRows: headers, widths, body }, layout: "lightHorizontalLines", fontSize: 9, margin: [0, 5, 0, 6] };
              function flatTable() {
                denseTables++;
                const stack = rowCells.map((cells) => {
                  const nodes = cells.flatMap((cell, index) => [...index ? ["　｜　"] : [], ...cell.children || []]);
                  return { stack: sequence(nodes, availableWidth, fontSize, cellColor), margin: [0, 0, 0, 4] };
                });
                return { stack, margin: [0, 4, 0, 6] };
              }
            }
            function block(node, availableWidth, fontSize, cellColor) {
              const tag = node.tag, kids = node.children || [];
              if (isHeading(tag)) {
                const level = Number(tag[1]);
                const headingSize = [22, 17, 14, 12, 11, 10][level - 1];
                return { stack: sequence(kids, availableWidth, headingSize, cellColor), bold: true, fontSize: headingSize, margin: [0, 8, 0, 4], headlineLevel: level };
              }
              if (tag === "table") {
                const caption = kids.find((k) => k.tag === "caption");
                const content2 = table(node, availableWidth, fontSize, cellColor);
                return caption ? { stack: [{ stack: sequence(caption.children || [], availableWidth, fontSize, cellColor), bold: true }, content2] } : content2;
              }
              if (tag === "ul" || tag === "ol") {
                const items = kids.filter((x2) => x2.tag === "li");
                if (!items.length) return textLine("");
                const start = Number.isSafeInteger(node.start) ? node.start : 1;
                const markerChars = tag === "ol" ? Math.max(String(start).length, String(start + items.length - 1).length) : 1;
                const itemWidth = availableWidth - fontSize * (markerChars * 0.6 + 0.7);
                const margin = [0, 3, 0, 4];
                if (itemWidth < MIN_COLUMN_WIDTH) {
                  return {
                    stack: items.map((item, index) => ({ stack: [
                      textLine(tag === "ol" ? start + index + "." : "•"),
                      ...sequence(item.children || [], availableWidth, fontSize, cellColor)
                    ] })),
                    margin
                  };
                }
                return {
                  [tag]: items.map((item) => ({ stack: sequence(item.children || [], itemWidth, fontSize, cellColor) })),
                  ...tag === "ol" ? { start } : {},
                  margin
                };
              }
              if (tag === "hr") return { canvas: [{ type: "line", x1: 0, y1: 0, x2: Math.min(200, availableWidth), y2: 0, lineWidth: 0.5, lineColor: "#9bafa4" }], margin: [0, 6, 0, 6] };
              if (tag === "pre") {
                const runs = plain(node).match(/[\x00-\x7f]+|[^\x00-\x7f]+/gu) || [];
                return {
                  text: runs.map((text) => textLine(text, { font: /^[\x00-\x7f]+$/u.test(text) ? "Courier" : "Noto" })),
                  preserveLeadingSpaces: true,
                  fontSize: 9,
                  margin: [Math.min(6, availableWidth - MIN_COLUMN_WIDTH), 4, 0, 5],
                  color: cellColor ?? "#314d40"
                };
              }
              if (tag === "blockquote") {
                const indent = Math.min(14, availableWidth - MIN_COLUMN_WIDTH);
                return { stack: sequence(kids, availableWidth - indent, fontSize, cellColor), margin: [indent, 4, 0, 5], color: cellColor ?? "#4b6057" };
              }
              return { stack: sequence(kids, availableWidth, fontSize, cellColor), margin: [0, 1, 0, 3] };
            }
            const content = sequence(snapshot.blocks, PAGE_WIDTH, 10);
            function matchesTitle(node) {
              if (typeof node === "string") return false;
              return node.tag === "h1" && plain(node).replace(/\s+/gu, " ").trim() === snapshot.title.trim() || (node.children || []).some(matchesTitle);
            }
            const hasTitle = snapshot.blocks.some(matchesTitle);
            if (!hasTitle) content.unshift(textLine(snapshot.title, { bold: true, fontSize: 22, margin: [0, 0, 0, 9] }));
            const notes = [];
            if (prepared.skipped) notes.push(prepared.skipped + " 幅图片已用文字说明");
            if (prepared.staticImages) notes.push(prepared.staticImages + " 幅图片以静态画面排版");
            if (denseTables) notes.push(denseTables + " 个宽表已按行展开");
            const notices = new Map((snapshot.warnings || []).map(({ code, label }) => [
              label || warningLabel2(code),
              warningLabel2(code) + (label ? " · " + label : "")
            ]));
            for (const note of notes) if (!notices.has(note)) notices.set(note, note);
            if (prepared.slices?.size) {
              const note = prepared.slices.size + " 幅长图已按原分辨率连续分段排版";
              notices.set(note, note);
            }
            if (notices.size) {
              content.push(
                { text: "保存提示", bold: true, fontSize: 12, margin: [0, 10, 0, 5] },
                { ul: [...notices.values()], fontSize: 9, color: "#715522" }
              );
            }
            return { denseTables, notes, doc: {
              info: { title: snapshot.title, creator: "本地导出工具" },
              pageSize: "A4",
              pageMargins: PAGE_MARGINS,
              defaultStyle: { font: "Noto", fontSize: 10, lineHeight: 1.2, color: "#202c25" },
              images: prepared.images,
              content,
              footer: (page, pages) => ({ text: page + " / " + pages, alignment: "center", fontSize: 8, color: "#68756d", margin: [0, 10, 0, 0] })
            } };
          }
          /* eslint-disable curly, no-redeclare, no-return-assign, no-sequences -- @preserve Upstream fflate conventions only. */
          var u82 = Uint8Array;
          var u162 = Uint16Array;
          var i322 = Int32Array;
          var fleb2 = new u82([
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            0,
            1,
            1,
            1,
            1,
            2,
            2,
            2,
            2,
            3,
            3,
            3,
            3,
            4,
            4,
            4,
            4,
            5,
            5,
            5,
            5,
            0,
            /* unused */
            0,
            0,
            /* impossible */
            0
          ]);
          var fdeb2 = new u82([
            0,
            0,
            0,
            0,
            1,
            1,
            2,
            2,
            3,
            3,
            4,
            4,
            5,
            5,
            6,
            6,
            7,
            7,
            8,
            8,
            9,
            9,
            10,
            10,
            11,
            11,
            12,
            12,
            13,
            13,
            /* unused */
            0,
            0
          ]);
          var clim2 = new u82([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
          var freb2 = function(eb, start) {
            var b = new u162(31);
            for (var i2 = 0; i2 < 31; ++i2) {
              b[i2] = start += 1 << eb[i2 - 1];
            }
            var r = new i322(b[30]);
            for (var i2 = 1; i2 < 30; ++i2) {
              for (var j = b[i2]; j < b[i2 + 1]; ++j) {
                r[j] = j - b[i2] << 5 | i2;
              }
            }
            return { b, r };
          };
          var _a3 = freb2(fleb2, 2);
          var fl2 = _a3.b;
          var revfl2 = _a3.r;
          fl2[28] = 258, revfl2[258] = 28;
          var _b2 = freb2(fdeb2, 0);
          var fd2 = _b2.b;
          var revfd2 = _b2.r;
          var rev2 = new u162(32768);
          for (i = 0; i < 32768; ++i) {
            x = (i & 43690) >> 1 | (i & 21845) << 1;
            x = (x & 52428) >> 2 | (x & 13107) << 2;
            x = (x & 61680) >> 4 | (x & 3855) << 4;
            rev2[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
          }
          var x;
          var i;
          var hMap2 = (function(cd, mb, r) {
            var s = cd.length;
            var i2 = 0;
            var l = new u162(mb);
            for (; i2 < s; ++i2) {
              if (cd[i2])
                ++l[cd[i2] - 1];
            }
            var le = new u162(mb);
            for (i2 = 1; i2 < mb; ++i2) {
              le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
            }
            var co;
            if (r) {
              co = new u162(1 << mb);
              var rvb = 15 - mb;
              for (i2 = 0; i2 < s; ++i2) {
                if (cd[i2]) {
                  var sv = i2 << 4 | cd[i2];
                  var r_1 = mb - cd[i2];
                  var v = le[cd[i2] - 1]++ << r_1;
                  for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
                    co[rev2[v] >> rvb] = sv;
                  }
                }
              }
            } else {
              co = new u162(s);
              for (i2 = 0; i2 < s; ++i2) {
                if (cd[i2]) {
                  co[i2] = rev2[le[cd[i2] - 1]++] >> 15 - cd[i2];
                }
              }
            }
            return co;
          });
          var flt2 = new u82(288);
          for (i = 0; i < 144; ++i)
            flt2[i] = 8;
          var i;
          for (i = 144; i < 256; ++i)
            flt2[i] = 9;
          var i;
          for (i = 256; i < 280; ++i)
            flt2[i] = 7;
          var i;
          for (i = 280; i < 288; ++i)
            flt2[i] = 8;
          var i;
          var fdt2 = new u82(32);
          for (i = 0; i < 32; ++i)
            fdt2[i] = 5;
          var i;
          var flrm = /* @__PURE__ */ hMap2(flt2, 9, 1);
          var fdrm = /* @__PURE__ */ hMap2(fdt2, 5, 1);
          var max = function(a) {
            var m = a[0];
            for (var i2 = 1; i2 < a.length; ++i2) {
              if (a[i2] > m)
                m = a[i2];
            }
            return m;
          };
          var bits = function(d, p, m) {
            var o = p / 8 | 0;
            return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
          };
          var bits16 = function(d, p) {
            var o = p / 8 | 0;
            return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
          };
          var shft2 = function(p) {
            return (p + 7) / 8 | 0;
          };
          var slc2 = function(v, s, e) {
            if (s == null || s < 0)
              s = 0;
            if (e == null || e > v.length)
              e = v.length;
            return new u82(v.subarray(s, e));
          };
          var ec2 = [
            "unexpected EOF",
            "invalid block type",
            "invalid length/literal",
            "invalid distance",
            "stream finished",
            "no stream handler",
            ,
            "no callback",
            "invalid UTF-8 data",
            "extra field too long",
            "date not in range 1980-2099",
            "filename too long",
            "stream finishing",
            "invalid zip data"
            // determined by unknown compression method
          ];
          var err2 = function(ind, msg, nt) {
            var e = new Error(msg || ec2[ind]);
            e.code = ind;
            if (Error.captureStackTrace)
              Error.captureStackTrace(e, err2);
            if (!nt)
              throw e;
            return e;
          };
          var inflt = function(dat, st, buf, dict) {
            var sl = dat.length, dl = dict ? dict.length : 0;
            if (!sl || st.f && !st.l)
              return buf || new u82(0);
            var noBuf = !buf;
            var resize = noBuf || st.i != 2;
            var noSt = st.i;
            if (noBuf)
              buf = new u82(sl * 3);
            var cbuf = function(l2) {
              var bl = buf.length;
              if (l2 > bl) {
                var nbuf = new u82(Math.max(bl * 2, l2));
                nbuf.set(buf);
                buf = nbuf;
              }
            };
            var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
            var tbts = sl * 8;
            do {
              if (!lm) {
                final = bits(dat, pos, 1);
                var type = bits(dat, pos + 1, 3);
                pos += 3;
                if (!type) {
                  var s = shft2(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
                  if (t > sl) {
                    if (noSt)
                      err2(0);
                    break;
                  }
                  if (resize)
                    cbuf(bt + l);
                  buf.set(dat.subarray(s, t), bt);
                  st.b = bt += l, st.p = pos = t * 8, st.f = final;
                  continue;
                } else if (type == 1)
                  lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
                else if (type == 2) {
                  var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
                  var tl = hLit + bits(dat, pos + 5, 31) + 1;
                  pos += 14;
                  var ldt = new u82(tl);
                  var clt = new u82(19);
                  for (var i2 = 0; i2 < hcLen; ++i2) {
                    clt[clim2[i2]] = bits(dat, pos + i2 * 3, 7);
                  }
                  pos += hcLen * 3;
                  var clb = max(clt), clbmsk = (1 << clb) - 1;
                  var clm = hMap2(clt, clb, 1);
                  for (var i2 = 0; i2 < tl; ) {
                    var r = clm[bits(dat, pos, clbmsk)];
                    pos += r & 15;
                    var s = r >> 4;
                    if (s < 16) {
                      ldt[i2++] = s;
                    } else {
                      var c = 0, n = 0;
                      if (s == 16)
                        n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
                      else if (s == 17)
                        n = 3 + bits(dat, pos, 7), pos += 3;
                      else if (s == 18)
                        n = 11 + bits(dat, pos, 127), pos += 7;
                      while (n--)
                        ldt[i2++] = c;
                    }
                  }
                  var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
                  lbt = max(lt);
                  dbt = max(dt);
                  lm = hMap2(lt, lbt, 1);
                  dm = hMap2(dt, dbt, 1);
                } else
                  err2(1);
                if (pos > tbts) {
                  if (noSt)
                    err2(0);
                  break;
                }
              }
              if (resize)
                cbuf(bt + 131072);
              var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
              var lpos = pos;
              for (; ; lpos = pos) {
                var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
                pos += c & 15;
                if (pos > tbts) {
                  if (noSt)
                    err2(0);
                  break;
                }
                if (!c)
                  err2(2);
                if (sym < 256)
                  buf[bt++] = sym;
                else if (sym == 256) {
                  lpos = pos, lm = null;
                  break;
                } else {
                  var add = sym - 254;
                  if (sym > 264) {
                    var i2 = sym - 257, b = fleb2[i2];
                    add = bits(dat, pos, (1 << b) - 1) + fl2[i2];
                    pos += b;
                  }
                  var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
                  if (!d)
                    err2(3);
                  pos += d & 15;
                  var dt = fd2[dsym];
                  if (dsym > 3) {
                    var b = fdeb2[dsym];
                    dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
                  }
                  if (pos > tbts) {
                    if (noSt)
                      err2(0);
                    break;
                  }
                  if (resize)
                    cbuf(bt + 131072);
                  var end = bt + add;
                  if (bt < dt) {
                    var shift = dl - dt, dend = Math.min(dt, end);
                    if (shift + bt < 0)
                      err2(3);
                    for (; bt < dend; ++bt)
                      buf[bt] = dict[shift + bt];
                  }
                  for (; bt < end; ++bt)
                    buf[bt] = buf[bt - dt];
                }
              }
              st.l = lm, st.p = lpos, st.b = bt, st.f = final;
              if (lm)
                final = 1, st.m = lbt, st.d = dm, st.n = dbt;
            } while (!final);
            return bt != buf.length && noBuf ? slc2(buf, 0, bt) : buf.subarray(0, bt);
          };
          var et2 = /* @__PURE__ */ new u82(0);
          var gzs = function(d) {
            if (d[0] != 31 || d[1] != 139 || d[2] != 8)
              err2(6, "invalid gzip data");
            var flg = d[3];
            var st = 10;
            if (flg & 4)
              st += (d[10] | d[11] << 8) + 2;
            for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
              ;
            return st + (flg & 2);
          };
          var gzl = function(d) {
            var l = d.length;
            return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
          };
          function gunzipSync(data, opts) {
            var st = gzs(data);
            if (st + 8 > data.length)
              err2(6, "invalid gzip data");
            return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u82(gzl(data)), opts && opts.dictionary);
          }
          var td2 = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
          var tds2 = 0;
          try {
            td2.decode(et2, { stream: true });
            tds2 = 1;
          } catch (e) {
          }
          /* eslint-enable curly, no-redeclare, no-return-assign, no-sequences -- @preserve End upstream fflate. */
          var Z85 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";
          function decodeZ85(encoded, size) {
            if (typeof encoded !== "string" || !Number.isSafeInteger(size) || size < 0 || encoded.length !== Math.ceil(size / 4) * 5) throw invalid();
            const bytes = new Uint8Array(Math.ceil(size / 4) * 4);
            for (let offset = 0; offset < encoded.length; offset += 5) {
              let value = 0;
              for (let index = 0; index < 5; index++) {
                const digit = Z85.indexOf(encoded[offset + index]);
                if (digit < 0) throw invalid();
                value = value * 85 + digit;
              }
              if (value > 4294967295) throw invalid();
              const target = offset / 5 * 4;
              for (let index = 3; index >= 0; index--) {
                bytes[target + index] = value % 256;
                value = Math.floor(value / 256);
              }
            }
            return bytes.subarray(0, size);
          }
          function invalid() {
            return Object.assign(new Error("PDF 字体校验失败，请重新安装脚本。"), { code: "PDF_FONT_INVALID" });
          }
          async function readEmbeddedFont({ compressed, compressedSize, size, hash }) {
            let bytes;
            try {
              bytes = gunzipSync(decodeZ85(compressed, compressedSize));
            } catch {
              throw invalid();
            }
            if (bytes.length !== size) throw invalid();
            const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
            const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
            if (actual !== hash) throw invalid();
            return bytes;
          }
          self.onmessage = async ({ data }) => {
            try {
              const pdfMake = self.pdfMake;
              if (!pdfMake || typeof pdfMake.createPdf !== "function") throw Object.assign(new Error(), { code: "PDF_RESOURCE_INVALID" });
              postMessage({ stage: "准备 PDF 字体" });
              const fonts = {};
              for (const font of data.fontArchive) fonts[font.name] = { data: await readEmbeddedFont(font) };
              pdfMake.addVirtualFileSystem(fonts);
              pdfMake.addFonts({ Noto: { normal: "Regular.woff2", bold: "Bold.woff2", italics: "Regular.woff2", bolditalics: "Bold.woff2" } });
              postMessage({ stage: "排版图片与正文" });
              const prepared = await prepareImages(data.snapshot);
              const { doc, notes } = pdfDefinition(data.snapshot, prepared);
              postMessage({ stage: "生成 PDF" });
              const bytes = await pdfMake.createPdf(doc).getBuffer();
              if (bytes.length > 64 * 1024 * 1024) throw Object.assign(new Error(), { code: "PDF_LIMIT" });
              postMessage({ result: { filename: safeStem2(data.snapshot.title) + ".pdf", blob: new Blob([bytes], { type: "application/pdf" }), notes } });
            } catch (error) {
              postMessage({ error: ["PDF_LIMIT", "PDF_FONT_INVALID", "PDF_RESOURCE_INVALID"].includes(error.code) ? error.code : "PDF_FAILED" });
            }
          };
        })();
      }.toString() + ")();";
    }
  });

  // src/userscript/pdf.js
  var pdf_exports = {};
  __export(pdf_exports, {
    renderPdf: () => renderPdf
  });
  function cancelled() {
    return new DOMException("保存已取消", "AbortError");
  }
  function invalidResource() {
    return Object.assign(new Error("PDF 资源校验失败，请重新安装脚本。"), { code: "PDF_RESOURCE_INVALID" });
  }
  async function readCachedPdfResources(hashes, shouldStop) {
    const resources = {};
    for (const name of ["pdfEngine", "pdfFonts"]) {
      if (shouldStop()) throw cancelled();
      let source;
      try {
        source = GM_getResourceText(name);
      } catch {
        throw invalidResource();
      }
      if (shouldStop()) throw cancelled();
      if (typeof source !== "string" || !source) throw invalidResource();
      let digest;
      try {
        digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source)));
      } catch {
        throw invalidResource();
      }
      if (shouldStop()) throw cancelled();
      const actual = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
      if (actual !== hashes[name]) throw invalidResource();
      resources[name] = source;
    }
    let fontArchive;
    try {
      fontArchive = JSON.parse(resources.pdfFonts);
    } catch {
      throw invalidResource();
    }
    const names = ["Regular.woff2", "Bold.woff2"];
    if (!Array.isArray(fontArchive) || fontArchive.length !== names.length || names.some((name) => fontArchive.filter((font) => font?.name === name).length !== 1) || fontArchive.some((font) => !Number.isSafeInteger(font.size) || font.size <= 0 || !Number.isSafeInteger(font.compressedSize) || font.compressedSize <= 0 || typeof font.compressed !== "string" || font.compressed.length !== Math.ceil(font.compressedSize / 4) * 5 || !/^[a-f0-9]{64}$/.test(font.hash))) throw invalidResource();
    return { engineSource: resources.pdfEngine, fontArchive };
  }
  async function renderPdf(snapshot, { shouldStop = () => false, onProgress } = {}) {
    if (shouldStop()) throw cancelled();
    const { workerSource: workerSource2, resourceHashes: resourceHashes2 } = await Promise.resolve().then(() => ((init_assets(), assets_exports)));
    if (shouldStop()) throw cancelled();
    const { engineSource, fontArchive } = await readCachedPdfResources(resourceHashes2, shouldStop);
    if (shouldStop()) throw cancelled();
    return new Promise((resolve, reject) => {
      let worker, url, cancellationTimer;
      let settled = false;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearInterval(cancellationTimer);
        worker?.terminate();
        if (url) URL.revokeObjectURL(url);
        if (error) reject(error);
        else resolve(result);
      }
      try {
        url = URL.createObjectURL(new Blob([engineSource, "\n;\n", workerSource2], { type: "text/javascript" }));
        worker = new Worker(url);
        cancellationTimer = setInterval(() => {
          if (shouldStop()) finish(cancelled());
        }, 50);
        worker.onmessage = ({ data }) => {
          if (settled) return;
          if (shouldStop()) {
            finish(cancelled());
            return;
          }
          if (data.stage) {
            try {
              onProgress?.(data.stage);
            } catch {
            }
          } else if (data.error) {
            const messages = {
              PDF_LIMIT: "文档超过 PDF 排版容量上限，请选择其他格式。",
              PDF_FONT_INVALID: "PDF 字体校验失败，请重新安装脚本。",
              PDF_RESOURCE_INVALID: "PDF 资源校验失败，请重新安装脚本。"
            };
            const message = messages[data.error] || "PDF 生成失败，请重试。";
            finish(Object.assign(new Error(message), { code: data.error }));
          } else if (data.result) finish(null, data.result);
        };
        worker.onerror = (event) => {
          event.preventDefault();
          finish(Object.assign(new Error("PDF 生成失败，请重试。"), { code: "PDF_FAILED" }));
        };
        worker.onmessageerror = () => finish(Object.assign(new Error("无法读取 PDF 生成结果，请重试。"), { code: "PDF_FAILED" }));
        worker.postMessage({ snapshot, fontArchive });
      } catch (error) {
        finish(error);
      }
    });
  }
  var init_pdf = __esm({
    "src/userscript/pdf.js"() {
    }
  });

  // node_modules/parse5/dist/common/unicode.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var UNDEFINED_CODE_POINTS = /* @__PURE__ */ new Set([
    65534,
    65535,
    131070,
    131071,
    196606,
    196607,
    262142,
    262143,
    327678,
    327679,
    393214,
    393215,
    458750,
    458751,
    524286,
    524287,
    589822,
    589823,
    655358,
    655359,
    720894,
    720895,
    786430,
    786431,
    851966,
    851967,
    917502,
    917503,
    983038,
    983039,
    1048574,
    1048575,
    1114110,
    1114111
  ]);
  var REPLACEMENT_CHARACTER = "�";
  var CODE_POINTS;
  (function(CODE_POINTS2) {
    CODE_POINTS2[CODE_POINTS2["EOF"] = -1] = "EOF";
    CODE_POINTS2[CODE_POINTS2["NULL"] = 0] = "NULL";
    CODE_POINTS2[CODE_POINTS2["TABULATION"] = 9] = "TABULATION";
    CODE_POINTS2[CODE_POINTS2["CARRIAGE_RETURN"] = 13] = "CARRIAGE_RETURN";
    CODE_POINTS2[CODE_POINTS2["LINE_FEED"] = 10] = "LINE_FEED";
    CODE_POINTS2[CODE_POINTS2["FORM_FEED"] = 12] = "FORM_FEED";
    CODE_POINTS2[CODE_POINTS2["SPACE"] = 32] = "SPACE";
    CODE_POINTS2[CODE_POINTS2["EXCLAMATION_MARK"] = 33] = "EXCLAMATION_MARK";
    CODE_POINTS2[CODE_POINTS2["QUOTATION_MARK"] = 34] = "QUOTATION_MARK";
    CODE_POINTS2[CODE_POINTS2["AMPERSAND"] = 38] = "AMPERSAND";
    CODE_POINTS2[CODE_POINTS2["APOSTROPHE"] = 39] = "APOSTROPHE";
    CODE_POINTS2[CODE_POINTS2["HYPHEN_MINUS"] = 45] = "HYPHEN_MINUS";
    CODE_POINTS2[CODE_POINTS2["SOLIDUS"] = 47] = "SOLIDUS";
    CODE_POINTS2[CODE_POINTS2["DIGIT_0"] = 48] = "DIGIT_0";
    CODE_POINTS2[CODE_POINTS2["DIGIT_9"] = 57] = "DIGIT_9";
    CODE_POINTS2[CODE_POINTS2["SEMICOLON"] = 59] = "SEMICOLON";
    CODE_POINTS2[CODE_POINTS2["LESS_THAN_SIGN"] = 60] = "LESS_THAN_SIGN";
    CODE_POINTS2[CODE_POINTS2["EQUALS_SIGN"] = 61] = "EQUALS_SIGN";
    CODE_POINTS2[CODE_POINTS2["GREATER_THAN_SIGN"] = 62] = "GREATER_THAN_SIGN";
    CODE_POINTS2[CODE_POINTS2["QUESTION_MARK"] = 63] = "QUESTION_MARK";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_A"] = 65] = "LATIN_CAPITAL_A";
    CODE_POINTS2[CODE_POINTS2["LATIN_CAPITAL_Z"] = 90] = "LATIN_CAPITAL_Z";
    CODE_POINTS2[CODE_POINTS2["RIGHT_SQUARE_BRACKET"] = 93] = "RIGHT_SQUARE_BRACKET";
    CODE_POINTS2[CODE_POINTS2["GRAVE_ACCENT"] = 96] = "GRAVE_ACCENT";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_A"] = 97] = "LATIN_SMALL_A";
    CODE_POINTS2[CODE_POINTS2["LATIN_SMALL_Z"] = 122] = "LATIN_SMALL_Z";
  })(CODE_POINTS || (CODE_POINTS = {}));
  var SEQUENCES = {
    DASH_DASH: "--",
    CDATA_START: "[CDATA[",
    DOCTYPE: "doctype",
    SCRIPT: "script",
    PUBLIC: "public",
    SYSTEM: "system"
  };
  function isSurrogate(cp) {
    return cp >= 55296 && cp <= 57343;
  }
  function isSurrogatePair(cp) {
    return cp >= 56320 && cp <= 57343;
  }
  function getSurrogatePairCodePoint(cp1, cp2) {
    return (cp1 - 55296) * 1024 + 9216 + cp2;
  }
  function isControlCodePoint(cp) {
    return cp !== 32 && cp !== 10 && cp !== 13 && cp !== 9 && cp !== 12 && cp >= 1 && cp <= 31 || cp >= 127 && cp <= 159;
  }
  function isUndefinedCodePoint(cp) {
    return cp >= 64976 && cp <= 65007 || UNDEFINED_CODE_POINTS.has(cp);
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/common/error-codes.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var ERR;
  (function(ERR2) {
    ERR2["controlCharacterInInputStream"] = "control-character-in-input-stream";
    ERR2["noncharacterInInputStream"] = "noncharacter-in-input-stream";
    ERR2["surrogateInInputStream"] = "surrogate-in-input-stream";
    ERR2["nonVoidHtmlElementStartTagWithTrailingSolidus"] = "non-void-html-element-start-tag-with-trailing-solidus";
    ERR2["endTagWithAttributes"] = "end-tag-with-attributes";
    ERR2["endTagWithTrailingSolidus"] = "end-tag-with-trailing-solidus";
    ERR2["unexpectedSolidusInTag"] = "unexpected-solidus-in-tag";
    ERR2["unexpectedNullCharacter"] = "unexpected-null-character";
    ERR2["unexpectedQuestionMarkInsteadOfTagName"] = "unexpected-question-mark-instead-of-tag-name";
    ERR2["invalidFirstCharacterOfTagName"] = "invalid-first-character-of-tag-name";
    ERR2["unexpectedEqualsSignBeforeAttributeName"] = "unexpected-equals-sign-before-attribute-name";
    ERR2["missingEndTagName"] = "missing-end-tag-name";
    ERR2["unexpectedCharacterInAttributeName"] = "unexpected-character-in-attribute-name";
    ERR2["unknownNamedCharacterReference"] = "unknown-named-character-reference";
    ERR2["missingSemicolonAfterCharacterReference"] = "missing-semicolon-after-character-reference";
    ERR2["unexpectedCharacterAfterDoctypeSystemIdentifier"] = "unexpected-character-after-doctype-system-identifier";
    ERR2["unexpectedCharacterInUnquotedAttributeValue"] = "unexpected-character-in-unquoted-attribute-value";
    ERR2["eofBeforeTagName"] = "eof-before-tag-name";
    ERR2["eofInTag"] = "eof-in-tag";
    ERR2["missingAttributeValue"] = "missing-attribute-value";
    ERR2["missingWhitespaceBetweenAttributes"] = "missing-whitespace-between-attributes";
    ERR2["missingWhitespaceAfterDoctypePublicKeyword"] = "missing-whitespace-after-doctype-public-keyword";
    ERR2["missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers"] = "missing-whitespace-between-doctype-public-and-system-identifiers";
    ERR2["missingWhitespaceAfterDoctypeSystemKeyword"] = "missing-whitespace-after-doctype-system-keyword";
    ERR2["missingQuoteBeforeDoctypePublicIdentifier"] = "missing-quote-before-doctype-public-identifier";
    ERR2["missingQuoteBeforeDoctypeSystemIdentifier"] = "missing-quote-before-doctype-system-identifier";
    ERR2["missingDoctypePublicIdentifier"] = "missing-doctype-public-identifier";
    ERR2["missingDoctypeSystemIdentifier"] = "missing-doctype-system-identifier";
    ERR2["abruptDoctypePublicIdentifier"] = "abrupt-doctype-public-identifier";
    ERR2["abruptDoctypeSystemIdentifier"] = "abrupt-doctype-system-identifier";
    ERR2["cdataInHtmlContent"] = "cdata-in-html-content";
    ERR2["incorrectlyOpenedComment"] = "incorrectly-opened-comment";
    ERR2["eofInScriptHtmlCommentLikeText"] = "eof-in-script-html-comment-like-text";
    ERR2["eofInDoctype"] = "eof-in-doctype";
    ERR2["nestedComment"] = "nested-comment";
    ERR2["abruptClosingOfEmptyComment"] = "abrupt-closing-of-empty-comment";
    ERR2["eofInComment"] = "eof-in-comment";
    ERR2["incorrectlyClosedComment"] = "incorrectly-closed-comment";
    ERR2["eofInCdata"] = "eof-in-cdata";
    ERR2["absenceOfDigitsInNumericCharacterReference"] = "absence-of-digits-in-numeric-character-reference";
    ERR2["nullCharacterReference"] = "null-character-reference";
    ERR2["surrogateCharacterReference"] = "surrogate-character-reference";
    ERR2["characterReferenceOutsideUnicodeRange"] = "character-reference-outside-unicode-range";
    ERR2["controlCharacterReference"] = "control-character-reference";
    ERR2["noncharacterCharacterReference"] = "noncharacter-character-reference";
    ERR2["missingWhitespaceBeforeDoctypeName"] = "missing-whitespace-before-doctype-name";
    ERR2["missingDoctypeName"] = "missing-doctype-name";
    ERR2["invalidCharacterSequenceAfterDoctypeName"] = "invalid-character-sequence-after-doctype-name";
    ERR2["duplicateAttribute"] = "duplicate-attribute";
    ERR2["nonConformingDoctype"] = "non-conforming-doctype";
    ERR2["missingDoctype"] = "missing-doctype";
    ERR2["misplacedDoctype"] = "misplaced-doctype";
    ERR2["endTagWithoutMatchingOpenElement"] = "end-tag-without-matching-open-element";
    ERR2["closingOfElementWithOpenChildElements"] = "closing-of-element-with-open-child-elements";
    ERR2["disallowedContentInNoscriptInHead"] = "disallowed-content-in-noscript-in-head";
    ERR2["openElementsLeftAfterEof"] = "open-elements-left-after-eof";
    ERR2["abandonedHeadElementChild"] = "abandoned-head-element-child";
    ERR2["misplacedStartTagForHeadElement"] = "misplaced-start-tag-for-head-element";
    ERR2["nestedNoscriptInHead"] = "nested-noscript-in-head";
    ERR2["eofInElementThatCanContainOnlyText"] = "eof-in-element-that-can-contain-only-text";
  })(ERR || (ERR = {}));
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/tokenizer/preprocessor.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var DEFAULT_BUFFER_WATERLINE = 1 << 16;
  var Preprocessor = class {
    constructor(handler) {
      this.handler = handler;
      this.html = "";
      this.pos = -1;
      this.lastGapPos = -2;
      this.gapStack = [];
      this.skipNextNewLine = false;
      this.lastChunkWritten = false;
      this.endOfChunkHit = false;
      this.bufferWaterline = DEFAULT_BUFFER_WATERLINE;
      this.isEol = false;
      this.lineStartPos = 0;
      this.droppedBufferSize = 0;
      this.line = 1;
      this.lastErrOffset = -1;
    }
    /** The column on the current line. If we just saw a gap (eg. a surrogate pair), return the index before. */
    get col() {
      return this.pos - this.lineStartPos + Number(this.lastGapPos !== this.pos);
    }
    get offset() {
      return this.droppedBufferSize + this.pos;
    }
    getError(code, cpOffset) {
      const { line, col, offset } = this;
      const startCol = col + cpOffset;
      const startOffset = offset + cpOffset;
      return {
        code,
        startLine: line,
        endLine: line,
        startCol,
        endCol: startCol,
        startOffset,
        endOffset: startOffset
      };
    }
    _err(code) {
      if (this.handler.onParseError && this.lastErrOffset !== this.offset) {
        this.lastErrOffset = this.offset;
        this.handler.onParseError(this.getError(code, 0));
      }
    }
    _addGap() {
      this.gapStack.push(this.lastGapPos);
      this.lastGapPos = this.pos;
    }
    _processSurrogate(cp) {
      if (this.pos !== this.html.length - 1) {
        const nextCp = this.html.charCodeAt(this.pos + 1);
        if (isSurrogatePair(nextCp)) {
          this.pos++;
          this._addGap();
          return getSurrogatePairCodePoint(cp, nextCp);
        }
      } else if (!this.lastChunkWritten) {
        this.endOfChunkHit = true;
        return CODE_POINTS.EOF;
      }
      this._err(ERR.surrogateInInputStream);
      return cp;
    }
    willDropParsedChunk() {
      return this.pos > this.bufferWaterline;
    }
    dropParsedChunk() {
      if (this.willDropParsedChunk()) {
        this.html = this.html.substring(this.pos);
        this.lineStartPos -= this.pos;
        this.droppedBufferSize += this.pos;
        this.pos = 0;
        this.lastGapPos = -2;
        this.gapStack.length = 0;
      }
    }
    write(chunk, isLastChunk) {
      if (this.html.length > 0) {
        this.html += chunk;
      } else {
        this.html = chunk;
      }
      this.endOfChunkHit = false;
      this.lastChunkWritten = isLastChunk;
    }
    insertHtmlAtCurrentPos(chunk) {
      this.html = this.html.substring(0, this.pos + 1) + chunk + this.html.substring(this.pos + 1);
      this.endOfChunkHit = false;
    }
    startsWith(pattern, caseSensitive) {
      if (this.pos + pattern.length > this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return false;
      }
      if (caseSensitive) {
        return this.html.startsWith(pattern, this.pos);
      }
      for (let i = 0; i < pattern.length; i++) {
        const cp = this.html.charCodeAt(this.pos + i) | 32;
        if (cp !== pattern.charCodeAt(i)) {
          return false;
        }
      }
      return true;
    }
    peek(offset) {
      const pos = this.pos + offset;
      if (pos >= this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return CODE_POINTS.EOF;
      }
      const code = this.html.charCodeAt(pos);
      return code === CODE_POINTS.CARRIAGE_RETURN ? CODE_POINTS.LINE_FEED : code;
    }
    advance() {
      this.pos++;
      if (this.isEol) {
        this.isEol = false;
        this.line++;
        this.lineStartPos = this.pos;
      }
      if (this.pos >= this.html.length) {
        this.endOfChunkHit = !this.lastChunkWritten;
        return CODE_POINTS.EOF;
      }
      let cp = this.html.charCodeAt(this.pos);
      if (cp === CODE_POINTS.CARRIAGE_RETURN) {
        this.isEol = true;
        this.skipNextNewLine = true;
        return CODE_POINTS.LINE_FEED;
      }
      if (cp === CODE_POINTS.LINE_FEED) {
        this.isEol = true;
        if (this.skipNextNewLine) {
          this.line--;
          this.skipNextNewLine = false;
          this._addGap();
          return this.advance();
        }
      }
      this.skipNextNewLine = false;
      if (isSurrogate(cp)) {
        cp = this._processSurrogate(cp);
      }
      const isCommonValidRange = this.handler.onParseError === null || cp > 31 && cp < 127 || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.CARRIAGE_RETURN || cp > 159 && cp < 64976;
      if (!isCommonValidRange) {
        this._checkForProblematicCharacters(cp);
      }
      return cp;
    }
    _checkForProblematicCharacters(cp) {
      if (isControlCodePoint(cp)) {
        this._err(ERR.controlCharacterInInputStream);
      } else if (isUndefinedCodePoint(cp)) {
        this._err(ERR.noncharacterInInputStream);
      }
    }
    retreat(count) {
      this.pos -= count;
      while (this.pos < this.lastGapPos) {
        this.lastGapPos = this.gapStack.pop();
        this.pos--;
      }
      this.isEol = false;
    }
  };
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/common/token.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var TokenType;
  (function(TokenType2) {
    TokenType2[TokenType2["CHARACTER"] = 0] = "CHARACTER";
    TokenType2[TokenType2["NULL_CHARACTER"] = 1] = "NULL_CHARACTER";
    TokenType2[TokenType2["WHITESPACE_CHARACTER"] = 2] = "WHITESPACE_CHARACTER";
    TokenType2[TokenType2["START_TAG"] = 3] = "START_TAG";
    TokenType2[TokenType2["END_TAG"] = 4] = "END_TAG";
    TokenType2[TokenType2["COMMENT"] = 5] = "COMMENT";
    TokenType2[TokenType2["DOCTYPE"] = 6] = "DOCTYPE";
    TokenType2[TokenType2["EOF"] = 7] = "EOF";
    TokenType2[TokenType2["HIBERNATION"] = 8] = "HIBERNATION";
  })(TokenType || (TokenType = {}));
  function getTokenAttr(token, attrName) {
    for (let i = token.attrs.length - 1; i >= 0; i--) {
      if (token.attrs[i].name === attrName) {
        return token.attrs[i].value;
      }
    }
    return null;
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/entities/dist/esm/generated/decode-data-html.js
  /* eslint-disable dot-notation -- @preserve Upstream entities conventions only. */
  var htmlDecodeTree = /* @__PURE__ */ new Uint16Array(
    // prettier-ignore
    /* @__PURE__ */ 'ᵁ<Õıʊҝջאٵ۞ޢߖࠏ੊ઑඡ๭༉༦჊ረዡᐕᒝᓃᓟᔥ\0\0\0\0\0\0ᕫᛍᦍᰒᷝ὾⁠↰⊍⏀⏻⑂⠤⤒ⴈ⹈⿎〖㊺㘹㞬㣾㨨㩱㫠㬮ࠀEMabcfglmnoprstu\\bfms¦³¹ÈÏlig耻Æ䃆P耻&䀦cute耻Á䃁reve;䄂Āiyx}rc耻Â䃂;䐐r;쀀𝔄rave耻À䃀pha;䎑acr;䄀d;橓Āgp¡on;䄄f;쀀𝔸plyFunction;恡ing耻Å䃅Ācs¾Ãr;쀀𝒜ign;扔ilde耻Ã䃃ml耻Ä䃄ЀaceforsuåûþėĜĢħĪĀcrêòkslash;或Ŷöø;櫧ed;挆y;䐑ƀcrtąċĔause;戵noullis;愬a;䎒r;쀀𝔅pf;쀀𝔹eve;䋘còēmpeq;扎܀HOacdefhilorsuōőŖƀƞƢƵƷƺǜȕɳɸɾcy;䐧PY耻©䂩ƀcpyŝŢźute;䄆Ā;iŧŨ拒talDifferentialD;慅leys;愭ȀaeioƉƎƔƘron;䄌dil耻Ç䃇rc;䄈nint;戰ot;䄊ĀdnƧƭilla;䂸terDot;䂷òſi;䎧rcleȀDMPTǇǋǑǖot;抙inus;抖lus;投imes;抗oĀcsǢǸkwiseContourIntegral;戲eCurlyĀDQȃȏoubleQuote;思uote;怙ȀlnpuȞȨɇɕonĀ;eȥȦ户;橴ƀgitȯȶȺruent;扡nt;戯ourIntegral;戮ĀfrɌɎ;愂oduct;成nterClockwiseContourIntegral;戳oss;樯cr;쀀𝒞pĀ;Cʄʅ拓ap;才րDJSZacefiosʠʬʰʴʸˋ˗ˡ˦̳ҍĀ;oŹʥtrahd;椑cy;䐂cy;䐅cy;䐏ƀgrsʿ˄ˇger;怡r;憡hv;櫤Āayː˕ron;䄎;䐔lĀ;t˝˞戇a;䎔r;쀀𝔇Āaf˫̧Ācm˰̢riticalȀADGT̖̜̀̆cute;䂴oŴ̋̍;䋙bleAcute;䋝rave;䁠ilde;䋜ond;拄ferentialD;慆Ѱ̽\0\0\0͔͂\0Ѕf;쀀𝔻ƀ;DE͈͉͍䂨ot;惜qual;扐blèCDLRUVͣͲ΂ϏϢϸontourIntegraìȹoɴ͹\0\0ͻ»͉nArrow;懓Āeo·ΤftƀARTΐΖΡrrow;懐ightArrow;懔eåˊngĀLRΫτeftĀARγιrrow;柸ightArrow;柺ightArrow;柹ightĀATϘϞrrow;懒ee;抨pɁϩ\0\0ϯrrow;懑ownArrow;懕erticalBar;戥ǹABLRTaВЪаўѿͼrrowƀ;BUНОТ憓ar;椓pArrow;懵reve;䌑eft˒к\0ц\0ѐightVector;楐eeVector;楞ectorĀ;Bљњ憽ar;楖ightǔѧ\0ѱeeVector;楟ectorĀ;BѺѻ懁ar;楗eeĀ;A҆҇护rrow;憧ĀctҒҗr;쀀𝒟rok;䄐ࠀNTacdfglmopqstuxҽӀӄӋӞӢӧӮӵԡԯԶՒ՝ՠեG;䅊H耻Ð䃐cute耻É䃉ƀaiyӒӗӜron;䄚rc耻Ê䃊;䐭ot;䄖r;쀀𝔈rave耻È䃈ement;戈ĀapӺӾcr;䄒tyɓԆ\0\0ԒmallSquare;旻erySmallSquare;斫ĀgpԦԪon;䄘f;쀀𝔼silon;䎕uĀaiԼՉlĀ;TՂՃ橵ilde;扂librium;懌Āci՗՚r;愰m;橳a;䎗ml耻Ë䃋Āipժկsts;戃onentialE;慇ʀcfiosօֈ֍ֲ׌y;䐤r;쀀𝔉lledɓ֗\0\0֣mallSquare;旼erySmallSquare;斪Ͱֺ\0ֿ\0\0ׄf;쀀𝔽All;戀riertrf;愱cò׋؀JTabcdfgorstר׬ׯ׺؀ؒؖ؛؝أ٬ٲcy;䐃耻>䀾mmaĀ;d׷׸䎓;䏜reve;䄞ƀeiy؇،ؐdil;䄢rc;䄜;䐓ot;䄠r;쀀𝔊;拙pf;쀀𝔾eater̀EFGLSTصلَٖٛ٦qualĀ;Lؾؿ扥ess;招ullEqual;执reater;檢ess;扷lantEqual;橾ilde;扳cr;쀀𝒢;扫ЀAacfiosuڅڋږڛڞڪھۊRDcy;䐪Āctڐڔek;䋇;䁞irc;䄤r;愌lbertSpace;愋ǰگ\0ڲf;愍izontalLine;攀Āctۃۅòکrok;䄦mpńېۘownHumðįqual;扏܀EJOacdfgmnostuۺ۾܃܇܎ܚܞܡܨ݄ݸދޏޕcy;䐕lig;䄲cy;䐁cute耻Í䃍Āiyܓܘrc耻Î䃎;䐘ot;䄰r;愑rave耻Ì䃌ƀ;apܠܯܿĀcgܴܷr;䄪inaryI;慈lieóϝǴ݉\0ݢĀ;eݍݎ戬Āgrݓݘral;戫section;拂isibleĀCTݬݲomma;恣imes;恢ƀgptݿރވon;䄮f;쀀𝕀a;䎙cr;愐ilde;䄨ǫޚ\0ޞcy;䐆l耻Ï䃏ʀcfosuެ޷޼߂ߐĀiyޱ޵rc;䄴;䐙r;쀀𝔍pf;쀀𝕁ǣ߇\0ߌr;쀀𝒥rcy;䐈kcy;䐄΀HJacfosߤߨ߽߬߱ࠂࠈcy;䐥cy;䐌ppa;䎚Āey߶߻dil;䄶;䐚r;쀀𝔎pf;쀀𝕂cr;쀀𝒦րJTaceflmostࠥࠩࠬࡐࡣ঳সে্਷ੇcy;䐉耻<䀼ʀcmnpr࠷࠼ࡁࡄࡍute;䄹bda;䎛g;柪lacetrf;愒r;憞ƀaeyࡗ࡜ࡡron;䄽dil;䄻;䐛Āfsࡨ॰tԀACDFRTUVarࡾࢩࢱࣦ࣠ࣼयज़ΐ४Ānrࢃ࢏gleBracket;柨rowƀ;BR࢙࢚࢞憐ar;懤ightArrow;懆eiling;挈oǵࢷ\0ࣃbleBracket;柦nǔࣈ\0࣒eeVector;楡ectorĀ;Bࣛࣜ懃ar;楙loor;挊ightĀAV࣯ࣵrrow;憔ector;楎Āerँगeƀ;AVउऊऐ抣rrow;憤ector;楚iangleƀ;BEतथऩ抲ar;槏qual;抴pƀDTVषूौownVector;楑eeVector;楠ectorĀ;Bॖॗ憿ar;楘ectorĀ;B॥०憼ar;楒ightáΜs̀EFGLSTॾঋকঝঢভqualGreater;拚ullEqual;扦reater;扶ess;檡lantEqual;橽ilde;扲r;쀀𝔏Ā;eঽা拘ftarrow;懚idot;䄿ƀnpw৔ਖਛgȀLRlr৞৷ਂਐeftĀAR০৬rrow;柵ightArrow;柷ightArrow;柶eftĀarγਊightáοightáϊf;쀀𝕃erĀLRਢਬeftArrow;憙ightArrow;憘ƀchtਾੀੂòࡌ;憰rok;䅁;扪Ѐacefiosuਗ਼੝੠੷੼અઋ઎p;椅y;䐜Ādl੥੯iumSpace;恟lintrf;愳r;쀀𝔐nusPlus;戓pf;쀀𝕄cò੶;䎜ҀJacefostuણધભીଔଙඑ඗ඞcy;䐊cute;䅃ƀaey઴હાron;䅇dil;䅅;䐝ƀgswે૰଎ativeƀMTV૓૟૨ediumSpace;怋hiĀcn૦૘ë૙eryThiî૙tedĀGL૸ଆreaterGreateòٳessLesóੈLine;䀊r;쀀𝔑ȀBnptଢନଷ଺reak;恠BreakingSpace;䂠f;愕ڀ;CDEGHLNPRSTV୕ୖ୪୼஡௫ఄ౞಄ದ೘ൡඅ櫬Āou୛୤ngruent;扢pCap;扭oubleVerticalBar;戦ƀlqxஃஊ஛ement;戉ualĀ;Tஒஓ扠ilde;쀀≂̸ists;戄reater΀;EFGLSTஶஷ஽௉௓௘௥扯qual;扱ullEqual;쀀≧̸reater;쀀≫̸ess;批lantEqual;쀀⩾̸ilde;扵umpń௲௽ownHump;쀀≎̸qual;쀀≏̸eĀfsఊధtTriangleƀ;BEచఛడ拪ar;쀀⧏̸qual;括s̀;EGLSTవశ఼ౄోౘ扮qual;扰reater;扸ess;쀀≪̸lantEqual;쀀⩽̸ilde;扴estedĀGL౨౹reaterGreater;쀀⪢̸essLess;쀀⪡̸recedesƀ;ESಒಓಛ技qual;쀀⪯̸lantEqual;拠ĀeiಫಹverseElement;戌ghtTriangleƀ;BEೋೌ೒拫ar;쀀⧐̸qual;拭ĀquೝഌuareSuĀbp೨೹setĀ;E೰ೳ쀀⊏̸qual;拢ersetĀ;Eഃആ쀀⊐̸qual;拣ƀbcpഓതൎsetĀ;Eഛഞ쀀⊂⃒qual;抈ceedsȀ;ESTലള഻െ抁qual;쀀⪰̸lantEqual;拡ilde;쀀≿̸ersetĀ;E൘൛쀀⊃⃒qual;抉ildeȀ;EFT൮൯൵ൿ扁qual;扄ullEqual;扇ilde;扉erticalBar;戤cr;쀀𝒩ilde耻Ñ䃑;䎝܀Eacdfgmoprstuvලෂ෉෕ෛ෠෧෼ขภยา฿ไlig;䅒cute耻Ó䃓Āiy෎ීrc耻Ô䃔;䐞blac;䅐r;쀀𝔒rave耻Ò䃒ƀaei෮ෲ෶cr;䅌ga;䎩cron;䎟pf;쀀𝕆enCurlyĀDQฎบoubleQuote;怜uote;怘;橔Āclวฬr;쀀𝒪ash耻Ø䃘iŬื฼de耻Õ䃕es;樷ml耻Ö䃖erĀBP๋๠Āar๐๓r;怾acĀek๚๜;揞et;掴arenthesis;揜Ҁacfhilors๿ງຊຏຒດຝະ໼rtialD;戂y;䐟r;쀀𝔓i;䎦;䎠usMinus;䂱Āipຢອncareplanåڝf;愙Ȁ;eio຺ູ໠໤檻cedesȀ;EST່້໏໚扺qual;檯lantEqual;扼ilde;找me;怳Ādp໩໮uct;戏ortionĀ;aȥ໹l;戝Āci༁༆r;쀀𝒫;䎨ȀUfos༑༖༛༟OT耻"䀢r;쀀𝔔pf;愚cr;쀀𝒬؀BEacefhiorsu༾གྷཇའཱིྦྷྪྭ႖ႩႴႾarr;椐G耻®䂮ƀcnrཎནབute;䅔g;柫rĀ;tཛྷཝ憠l;椖ƀaeyཧཬཱron;䅘dil;䅖;䐠Ā;vླྀཹ愜erseĀEUྂྙĀlq྇ྎement;戋uilibrium;懋pEquilibrium;楯r»ཹo;䎡ghtЀACDFTUVa࿁࿫࿳ဢဨၛႇϘĀnr࿆࿒gleBracket;柩rowƀ;BL࿜࿝࿡憒ar;懥eftArrow;懄eiling;按oǵ࿹\0စbleBracket;柧nǔည\0နeeVector;楝ectorĀ;Bဝသ懂ar;楕loor;挋Āerိ၃eƀ;AVဵံြ抢rrow;憦ector;楛iangleƀ;BEၐၑၕ抳ar;槐qual;抵pƀDTVၣၮၸownVector;楏eeVector;楜ectorĀ;Bႂႃ憾ar;楔ectorĀ;B႑႒懀ar;楓Āpuႛ႞f;愝ndImplies;楰ightarrow;懛ĀchႹႼr;愛;憱leDelayed;槴ڀHOacfhimoqstuფჱჷჽᄙᄞᅑᅖᅡᅧᆵᆻᆿĀCcჩხHcy;䐩y;䐨FTcy;䐬cute;䅚ʀ;aeiyᄈᄉᄎᄓᄗ檼ron;䅠dil;䅞rc;䅜;䐡r;쀀𝔖ortȀDLRUᄪᄴᄾᅉownArrow»ОeftArrow»࢚ightArrow»࿝pArrow;憑gma;䎣allCircle;战pf;쀀𝕊ɲᅭ\0\0ᅰt;戚areȀ;ISUᅻᅼᆉᆯ斡ntersection;抓uĀbpᆏᆞsetĀ;Eᆗᆘ抏qual;抑ersetĀ;Eᆨᆩ抐qual;抒nion;抔cr;쀀𝒮ar;拆ȀbcmpᇈᇛሉላĀ;sᇍᇎ拐etĀ;Eᇍᇕqual;抆ĀchᇠህeedsȀ;ESTᇭᇮᇴᇿ扻qual;檰lantEqual;扽ilde;承Tháྌ;我ƀ;esሒሓሣ拑rsetĀ;Eሜም抃qual;抇et»ሓրHRSacfhiorsሾቄ቉ቕ቞ቱቶኟዂወዑORN耻Þ䃞ADE;愢ĀHc቎ቒcy;䐋y;䐦Ābuቚቜ;䀉;䎤ƀaeyብቪቯron;䅤dil;䅢;䐢r;쀀𝔗Āeiቻ኉ǲኀ\0ኇefore;戴a;䎘Ācn኎ኘkSpace;쀀  Space;怉ldeȀ;EFTካኬኲኼ戼qual;扃ullEqual;扅ilde;扈pf;쀀𝕋ipleDot;惛Āctዖዛr;쀀𝒯rok;䅦ૡዷጎጚጦ\0ጬጱ\0\0\0\0\0ጸጽ፷ᎅ\0᏿ᐄᐊᐐĀcrዻጁute耻Ú䃚rĀ;oጇገ憟cir;楉rǣጓ\0጖y;䐎ve;䅬Āiyጞጣrc耻Û䃛;䐣blac;䅰r;쀀𝔘rave耻Ù䃙acr;䅪Ādiፁ፩erĀBPፈ፝Āarፍፐr;䁟acĀekፗፙ;揟et;掵arenthesis;揝onĀ;P፰፱拃lus;抎Āgp፻፿on;䅲f;쀀𝕌ЀADETadps᎕ᎮᎸᏄϨᏒᏗᏳrrowƀ;BDᅐᎠᎤar;椒ownArrow;懅ownArrow;憕quilibrium;楮eeĀ;AᏋᏌ报rrow;憥ownáϳerĀLRᏞᏨeftArrow;憖ightArrow;憗iĀ;lᏹᏺ䏒on;䎥ing;䅮cr;쀀𝒰ilde;䅨ml耻Ü䃜ҀDbcdefosvᐧᐬᐰᐳᐾᒅᒊᒐᒖash;披ar;櫫y;䐒ashĀ;lᐻᐼ抩;櫦Āerᑃᑅ;拁ƀbtyᑌᑐᑺar;怖Ā;iᑏᑕcalȀBLSTᑡᑥᑪᑴar;戣ine;䁼eparator;杘ilde;所ThinSpace;怊r;쀀𝔙pf;쀀𝕍cr;쀀𝒱dash;抪ʀcefosᒧᒬᒱᒶᒼirc;䅴dge;拀r;쀀𝔚pf;쀀𝕎cr;쀀𝒲Ȁfiosᓋᓐᓒᓘr;쀀𝔛;䎞pf;쀀𝕏cr;쀀𝒳ҀAIUacfosuᓱᓵᓹᓽᔄᔏᔔᔚᔠcy;䐯cy;䐇cy;䐮cute耻Ý䃝Āiyᔉᔍrc;䅶;䐫r;쀀𝔜pf;쀀𝕐cr;쀀𝒴ml;䅸ЀHacdefosᔵᔹᔿᕋᕏᕝᕠᕤcy;䐖cute;䅹Āayᕄᕉron;䅽;䐗ot;䅻ǲᕔ\0ᕛoWidtè૙a;䎖r;愨pf;愤cr;쀀𝒵௡ᖃᖊᖐ\0ᖰᖶᖿ\0\0\0\0ᗆᗛᗫᙟ᙭\0ᚕ᚛ᚲᚹ\0ᚾcute耻á䃡reve;䄃̀;Ediuyᖜᖝᖡᖣᖨᖭ戾;쀀∾̳;房rc耻â䃢te肻´̆;䐰lig耻æ䃦Ā;r²ᖺ;쀀𝔞rave耻à䃠ĀepᗊᗖĀfpᗏᗔsym;愵èᗓha;䎱ĀapᗟcĀclᗤᗧr;䄁g;樿ɤᗰ\0\0ᘊʀ;adsvᗺᗻᗿᘁᘇ戧nd;橕;橜lope;橘;橚΀;elmrszᘘᘙᘛᘞᘿᙏᙙ戠;榤e»ᘙsdĀ;aᘥᘦ戡ѡᘰᘲᘴᘶᘸᘺᘼᘾ;榨;榩;榪;榫;榬;榭;榮;榯tĀ;vᙅᙆ戟bĀ;dᙌᙍ抾;榝Āptᙔᙗh;戢»¹arr;捼Āgpᙣᙧon;䄅f;쀀𝕒΀;Eaeiop዁ᙻᙽᚂᚄᚇᚊ;橰cir;橯;扊d;手s;䀧roxĀ;e዁ᚒñᚃing耻å䃥ƀctyᚡᚦᚨr;쀀𝒶;䀪mpĀ;e዁ᚯñʈilde耻ã䃣ml耻ä䃤Āciᛂᛈoninôɲnt;樑ࠀNabcdefiklnoprsu᛭ᛱᜰ᜼ᝃᝈ᝸᝽០៦ᠹᡐᜍ᤽᥈ᥰot;櫭Ācrᛶ᜞kȀcepsᜀᜅᜍᜓong;扌psilon;䏶rime;怵imĀ;e᜚᜛戽q;拍Ŷᜢᜦee;抽edĀ;gᜬᜭ挅e»ᜭrkĀ;t፜᜷brk;掶Āoyᜁᝁ;䐱quo;怞ʀcmprtᝓ᝛ᝡᝤᝨausĀ;eĊĉptyv;榰séᜌnoõēƀahwᝯ᝱ᝳ;䎲;愶een;扬r;쀀𝔟g΀costuvwឍឝឳេ៕៛៞ƀaiuបពរðݠrc;旯p»፱ƀdptឤឨឭot;樀lus;樁imes;樂ɱឹ\0\0ើcup;樆ar;昅riangleĀdu៍្own;施p;斳plus;樄eåᑄåᒭarow;植ƀako៭ᠦᠵĀcn៲ᠣkƀlst៺֫᠂ozenge;槫riangleȀ;dlr᠒᠓᠘᠝斴own;斾eft;旂ight;斸k;搣Ʊᠫ\0ᠳƲᠯ\0ᠱ;斒;斑4;斓ck;斈ĀeoᠾᡍĀ;qᡃᡆ쀀=⃥uiv;쀀≡⃥t;挐Ȁptwxᡙᡞᡧᡬf;쀀𝕓Ā;tᏋᡣom»Ꮜtie;拈؀DHUVbdhmptuvᢅᢖᢪᢻᣗᣛᣬ᣿ᤅᤊᤐᤡȀLRlrᢎᢐᢒᢔ;敗;敔;敖;敓ʀ;DUduᢡᢢᢤᢦᢨ敐;敦;敩;敤;敧ȀLRlrᢳᢵᢷᢹ;敝;敚;敜;教΀;HLRhlrᣊᣋᣍᣏᣑᣓᣕ救;敬;散;敠;敫;敢;敟ox;槉ȀLRlrᣤᣦᣨᣪ;敕;敒;攐;攌ʀ;DUduڽ᣷᣹᣻᣽;敥;敨;攬;攴inus;抟lus;択imes;抠ȀLRlrᤙᤛᤝ᤟;敛;敘;攘;攔΀;HLRhlrᤰᤱᤳᤵᤷ᤻᤹攂;敪;敡;敞;攼;攤;攜Āevģ᥂bar耻¦䂦Ȁceioᥑᥖᥚᥠr;쀀𝒷mi;恏mĀ;e᜚᜜lƀ;bhᥨᥩᥫ䁜;槅sub;柈Ŭᥴ᥾lĀ;e᥹᥺怢t»᥺pƀ;Eeįᦅᦇ;檮Ā;qۜۛೡᦧ\0᧨ᨑᨕᨲ\0ᨷᩐ\0\0᪴\0\0᫁\0\0ᬡᬮ᭍᭒\0᯽\0ᰌƀcpr᦭ᦲ᧝ute;䄇̀;abcdsᦿᧀᧄ᧊᧕᧙戩nd;橄rcup;橉Āau᧏᧒p;橋p;橇ot;橀;쀀∩︀Āeo᧢᧥t;恁îړȀaeiu᧰᧻ᨁᨅǰ᧵\0᧸s;橍on;䄍dil耻ç䃧rc;䄉psĀ;sᨌᨍ橌m;橐ot;䄋ƀdmnᨛᨠᨦil肻¸ƭptyv;榲t脀¢;eᨭᨮ䂢räƲr;쀀𝔠ƀceiᨽᩀᩍy;䑇ckĀ;mᩇᩈ朓ark»ᩈ;䏇r΀;Ecefms᩟᩠ᩢᩫ᪤᪪᪮旋;槃ƀ;elᩩᩪᩭ䋆q;扗eɡᩴ\0\0᪈rrowĀlr᩼᪁eft;憺ight;憻ʀRSacd᪒᪔᪖᪚᪟»ཇ;擈st;抛irc;抚ash;抝nint;樐id;櫯cir;槂ubsĀ;u᪻᪼晣it»᪼ˬ᫇᫔᫺\0ᬊonĀ;eᫍᫎ䀺Ā;qÇÆɭ᫙\0\0᫢aĀ;t᫞᫟䀬;䁀ƀ;fl᫨᫩᫫戁îᅠeĀmx᫱᫶ent»᫩eóɍǧ᫾\0ᬇĀ;dኻᬂot;橭nôɆƀfryᬐᬔᬗ;쀀𝕔oäɔ脀©;sŕᬝr;愗Āaoᬥᬩrr;憵ss;朗Ācuᬲᬷr;쀀𝒸Ābpᬼ᭄Ā;eᭁᭂ櫏;櫑Ā;eᭉᭊ櫐;櫒dot;拯΀delprvw᭠᭬᭷ᮂᮬᯔ᯹arrĀlr᭨᭪;椸;椵ɰ᭲\0\0᭵r;拞c;拟arrĀ;p᭿ᮀ憶;椽̀;bcdosᮏᮐᮖᮡᮥᮨ截rcap;橈Āauᮛᮞp;橆p;橊ot;抍r;橅;쀀∪︀Ȁalrv᮵ᮿᯞᯣrrĀ;mᮼᮽ憷;椼yƀevwᯇᯔᯘqɰᯎ\0\0ᯒreã᭳uã᭵ee;拎edge;拏en耻¤䂤earrowĀlrᯮ᯳eft»ᮀight»ᮽeäᯝĀciᰁᰇoninôǷnt;戱lcty;挭ঀAHabcdefhijlorstuwz᰸᰻᰿ᱝᱩᱵᲊᲞᲬᲷ᳻᳿ᴍᵻᶑᶫᶻ᷆᷍rò΁ar;楥Ȁglrs᱈ᱍ᱒᱔ger;怠eth;愸òᄳhĀ;vᱚᱛ怐»ऊūᱡᱧarow;椏aã̕Āayᱮᱳron;䄏;䐴ƀ;ao̲ᱼᲄĀgrʿᲁr;懊tseq;橷ƀglmᲑᲔᲘ耻°䂰ta;䎴ptyv;榱ĀirᲣᲨsht;楿;쀀𝔡arĀlrᲳᲵ»ࣜ»သʀaegsv᳂͸᳖᳜᳠mƀ;oș᳊᳔ndĀ;ș᳑uit;晦amma;䏝in;拲ƀ;io᳧᳨᳸䃷de脀÷;o᳧ᳰntimes;拇nø᳷cy;䑒cɯᴆ\0\0ᴊrn;挞op;挍ʀlptuwᴘᴝᴢᵉᵕlar;䀤f;쀀𝕕ʀ;emps̋ᴭᴷᴽᵂqĀ;d͒ᴳot;扑inus;戸lus;戔quare;抡blebarwedgåúnƀadhᄮᵝᵧownarrowóᲃarpoonĀlrᵲᵶefôᲴighôᲶŢᵿᶅkaro÷གɯᶊ\0\0ᶎrn;挟op;挌ƀcotᶘᶣᶦĀryᶝᶡ;쀀𝒹;䑕l;槶rok;䄑Ādrᶰᶴot;拱iĀ;fᶺ᠖斿Āah᷀᷃ròЩaòྦangle;榦Āci᷒ᷕy;䑟grarr;柿ऀDacdefglmnopqrstuxḁḉḙḸոḼṉṡṾấắẽỡἪἷὄ὎὚ĀDoḆᴴoôᲉĀcsḎḔute耻é䃩ter;橮ȀaioyḢḧḱḶron;䄛rĀ;cḭḮ扖耻ê䃪lon;払;䑍ot;䄗ĀDrṁṅot;扒;쀀𝔢ƀ;rsṐṑṗ檚ave耻è䃨Ā;dṜṝ檖ot;檘Ȁ;ilsṪṫṲṴ檙nters;揧;愓Ā;dṹṺ檕ot;檗ƀapsẅẉẗcr;䄓tyƀ;svẒẓẕ戅et»ẓpĀ1;ẝẤĳạả;怄;怅怃ĀgsẪẬ;䅋p;怂ĀgpẴẸon;䄙f;쀀𝕖ƀalsỄỎỒrĀ;sỊị拕l;槣us;橱iƀ;lvỚớở䎵on»ớ;䏵ȀcsuvỪỳἋἣĀioữḱrc»Ḯɩỹ\0\0ỻíՈantĀglἂἆtr»ṝess»Ṻƀaeiἒ἖Ἒls;䀽st;扟vĀ;DȵἠD;橸parsl;槥ĀDaἯἳot;打rr;楱ƀcdiἾὁỸr;愯oô͒ĀahὉὋ;䎷耻ð䃰Āmrὓὗl耻ë䃫o;悬ƀcipὡὤὧl;䀡sôծĀeoὬὴctatioîՙnentialåչৡᾒ\0ᾞ\0ᾡᾧ\0\0ῆῌ\0ΐ\0ῦῪ \0 ⁚llingdotseñṄy;䑄male;晀ƀilrᾭᾳ῁lig;耀ﬃɩᾹ\0\0᾽g;耀ﬀig;耀ﬄ;쀀𝔣lig;耀ﬁlig;쀀fjƀaltῙ῜ῡt;晭ig;耀ﬂns;斱of;䆒ǰ΅\0ῳf;쀀𝕗ĀakֿῷĀ;vῼ´拔;櫙artint;樍Āao‌⁕Ācs‑⁒α‚‰‸⁅⁈\0⁐β•‥‧‪‬\0‮耻½䂽;慓耻¼䂼;慕;慙;慛Ƴ‴\0‶;慔;慖ʴ‾⁁\0\0⁃耻¾䂾;慗;慜5;慘ƶ⁌\0⁎;慚;慝8;慞l;恄wn;挢cr;쀀𝒻ࢀEabcdefgijlnorstv₂₉₟₥₰₴⃰⃵⃺⃿℃ℒℸ̗ℾ⅒↞Ā;lٍ₇;檌ƀcmpₐₕ₝ute;䇵maĀ;dₜ᳚䎳;檆reve;䄟Āiy₪₮rc;䄝;䐳ot;䄡Ȁ;lqsؾق₽⃉ƀ;qsؾٌ⃄lanô٥Ȁ;cdl٥⃒⃥⃕c;檩otĀ;o⃜⃝檀Ā;l⃢⃣檂;檄Ā;e⃪⃭쀀⋛︀s;檔r;쀀𝔤Ā;gٳ؛mel;愷cy;䑓Ȁ;Eajٚℌℎℐ;檒;檥;檤ȀEaesℛℝ℩ℴ;扩pĀ;p℣ℤ檊rox»ℤĀ;q℮ℯ檈Ā;q℮ℛim;拧pf;쀀𝕘Āci⅃ⅆr;愊mƀ;el٫ⅎ⅐;檎;檐茀>;cdlqr׮ⅠⅪⅮⅳⅹĀciⅥⅧ;檧r;橺ot;拗Par;榕uest;橼ʀadelsↄⅪ←ٖ↛ǰ↉\0↎proø₞r;楸qĀlqؿ↖lesó₈ií٫Āen↣↭rtneqq;쀀≩︀Å↪ԀAabcefkosy⇄⇇⇱⇵⇺∘∝∯≨≽ròΠȀilmr⇐⇔⇗⇛rsðᒄf»․ilôکĀdr⇠⇤cy;䑊ƀ;cwࣴ⇫⇯ir;楈;憭ar;意irc;䄥ƀalr∁∎∓rtsĀ;u∉∊晥it»∊lip;怦con;抹r;쀀𝔥sĀew∣∩arow;椥arow;椦ʀamopr∺∾≃≞≣rr;懿tht;戻kĀlr≉≓eftarrow;憩ightarrow;憪f;쀀𝕙bar;怕ƀclt≯≴≸r;쀀𝒽asè⇴rok;䄧Ābp⊂⊇ull;恃hen»ᱛૡ⊣\0⊪\0⊸⋅⋎\0⋕⋳\0\0⋸⌢⍧⍢⍿\0⎆⎪⎴cute耻í䃭ƀ;iyݱ⊰⊵rc耻î䃮;䐸Ācx⊼⊿y;䐵cl耻¡䂡ĀfrΟ⋉;쀀𝔦rave耻ì䃬Ȁ;inoܾ⋝⋩⋮Āin⋢⋦nt;樌t;戭fin;槜ta;愩lig;䄳ƀaop⋾⌚⌝ƀcgt⌅⌈⌗r;䄫ƀelpܟ⌏⌓inåގarôܠh;䄱f;抷ed;䆵ʀ;cfotӴ⌬⌱⌽⍁are;愅inĀ;t⌸⌹戞ie;槝doô⌙ʀ;celpݗ⍌⍐⍛⍡al;抺Āgr⍕⍙eróᕣã⍍arhk;樗rod;樼Ȁcgpt⍯⍲⍶⍻y;䑑on;䄯f;쀀𝕚a;䎹uest耻¿䂿Āci⎊⎏r;쀀𝒾nʀ;EdsvӴ⎛⎝⎡ӳ;拹ot;拵Ā;v⎦⎧拴;拳Ā;iݷ⎮lde;䄩ǫ⎸\0⎼cy;䑖l耻ï䃯̀cfmosu⏌⏗⏜⏡⏧⏵Āiy⏑⏕rc;䄵;䐹r;쀀𝔧ath;䈷pf;쀀𝕛ǣ⏬\0⏱r;쀀𝒿rcy;䑘kcy;䑔Ѐacfghjos␋␖␢␧␭␱␵␻ppaĀ;v␓␔䎺;䏰Āey␛␠dil;䄷;䐺r;쀀𝔨reen;䄸cy;䑅cy;䑜pf;쀀𝕜cr;쀀𝓀஀ABEHabcdefghjlmnoprstuv⑰⒁⒆⒍⒑┎┽╚▀♎♞♥♹♽⚚⚲⛘❝❨➋⟀⠁⠒ƀart⑷⑺⑼rò৆òΕail;椛arr;椎Ā;gঔ⒋;檋ar;楢ॣ⒥\0⒪\0⒱\0\0\0\0\0⒵Ⓔ\0ⓆⓈⓍ\0⓹ute;䄺mptyv;榴raîࡌbda;䎻gƀ;dlࢎⓁⓃ;榑åࢎ;檅uo耻«䂫rЀ;bfhlpst࢙ⓞⓦⓩ⓫⓮⓱⓵Ā;f࢝ⓣs;椟s;椝ë≒p;憫l;椹im;楳l;憢ƀ;ae⓿─┄檫il;椙Ā;s┉┊檭;쀀⪭︀ƀabr┕┙┝rr;椌rk;杲Āak┢┬cĀek┨┪;䁻;䁛Āes┱┳;榋lĀdu┹┻;榏;榍Ȁaeuy╆╋╖╘ron;䄾Ādi═╔il;䄼ìࢰâ┩;䐻Ȁcqrs╣╦╭╽a;椶uoĀ;rนᝆĀdu╲╷har;楧shar;楋h;憲ʀ;fgqs▋▌উ◳◿扤tʀahlrt▘▤▷◂◨rrowĀ;t࢙□aé⓶arpoonĀdu▯▴own»њp»०eftarrows;懇ightƀahs◍◖◞rrowĀ;sࣴࢧarpoonó྘quigarro÷⇰hreetimes;拋ƀ;qs▋ও◺lanôবʀ;cdgsব☊☍☝☨c;檨otĀ;o☔☕橿Ā;r☚☛檁;檃Ā;e☢☥쀀⋚︀s;檓ʀadegs☳☹☽♉♋pproøⓆot;拖qĀgq♃♅ôউgtò⒌ôছiíলƀilr♕࣡♚sht;楼;쀀𝔩Ā;Eজ♣;檑š♩♶rĀdu▲♮Ā;l॥♳;楪lk;斄cy;䑙ʀ;achtੈ⚈⚋⚑⚖rò◁orneòᴈard;楫ri;旺Āio⚟⚤dot;䅀ustĀ;a⚬⚭掰che»⚭ȀEaes⚻⚽⛉⛔;扨pĀ;p⛃⛄檉rox»⛄Ā;q⛎⛏檇Ā;q⛎⚻im;拦Ѐabnoptwz⛩⛴⛷✚✯❁❇❐Ānr⛮⛱g;柬r;懽rëࣁgƀlmr⛿✍✔eftĀar০✇ightá৲apsto;柼ightá৽parrowĀlr✥✩efô⓭ight;憬ƀafl✶✹✽r;榅;쀀𝕝us;樭imes;樴š❋❏st;戗áፎƀ;ef❗❘᠀旊nge»❘arĀ;l❤❥䀨t;榓ʀachmt❳❶❼➅➇ròࢨorneòᶌarĀ;d྘➃;業;怎ri;抿̀achiqt➘➝ੀ➢➮➻quo;怹r;쀀𝓁mƀ;egল➪➬;檍;檏Ābu┪➳oĀ;rฟ➹;怚rok;䅂萀<;cdhilqrࠫ⟒☹⟜⟠⟥⟪⟰Āci⟗⟙;檦r;橹reå◲mes;拉arr;楶uest;橻ĀPi⟵⟹ar;榖ƀ;ef⠀भ᠛旃rĀdu⠇⠍shar;楊har;楦Āen⠗⠡rtneqq;쀀≨︀Å⠞܀Dacdefhilnopsu⡀⡅⢂⢎⢓⢠⢥⢨⣚⣢⣤ઃ⣳⤂Dot;戺Ȁclpr⡎⡒⡣⡽r耻¯䂯Āet⡗⡙;時Ā;e⡞⡟朠se»⡟Ā;sျ⡨toȀ;dluျ⡳⡷⡻owîҌefôएðᏑker;斮Āoy⢇⢌mma;権;䐼ash;怔asuredangle»ᘦr;쀀𝔪o;愧ƀcdn⢯⢴⣉ro耻µ䂵Ȁ;acdᑤ⢽⣀⣄sôᚧir;櫰ot肻·Ƶusƀ;bd⣒ᤃ⣓戒Ā;uᴼ⣘;横ţ⣞⣡p;櫛ò−ðઁĀdp⣩⣮els;抧f;쀀𝕞Āct⣸⣽r;쀀𝓂pos»ᖝƀ;lm⤉⤊⤍䎼timap;抸ఀGLRVabcdefghijlmoprstuvw⥂⥓⥾⦉⦘⧚⧩⨕⨚⩘⩝⪃⪕⪤⪨⬄⬇⭄⭿⮮ⰴⱧⱼ⳩Āgt⥇⥋;쀀⋙̸Ā;v⥐௏쀀≫⃒ƀelt⥚⥲⥶ftĀar⥡⥧rrow;懍ightarrow;懎;쀀⋘̸Ā;v⥻ే쀀≪⃒ightarrow;懏ĀDd⦎⦓ash;抯ash;抮ʀbcnpt⦣⦧⦬⦱⧌la»˞ute;䅄g;쀀∠⃒ʀ;Eiop඄⦼⧀⧅⧈;쀀⩰̸d;쀀≋̸s;䅉roø඄urĀ;a⧓⧔普lĀ;s⧓ସǳ⧟\0⧣p肻 ଷmpĀ;e௹ఀʀaeouy⧴⧾⨃⨐⨓ǰ⧹\0⧻;橃on;䅈dil;䅆ngĀ;dൾ⨊ot;쀀⩭̸p;橂;䐽ash;怓΀;Aadqsxஒ⨩⨭⨻⩁⩅⩐rr;懗rĀhr⨳⨶k;椤Ā;oᏲᏰot;쀀≐̸uiöୣĀei⩊⩎ar;椨í஘istĀ;s஠டr;쀀𝔫ȀEest௅⩦⩹⩼ƀ;qs஼⩭௡ƀ;qs஼௅⩴lanô௢ií௪Ā;rஶ⪁»ஷƀAap⪊⪍⪑rò⥱rr;憮ar;櫲ƀ;svྍ⪜ྌĀ;d⪡⪢拼;拺cy;䑚΀AEadest⪷⪺⪾⫂⫅⫶⫹rò⥦;쀀≦̸rr;憚r;急Ȁ;fqs఻⫎⫣⫯tĀar⫔⫙rro÷⫁ightarro÷⪐ƀ;qs఻⪺⫪lanôౕĀ;sౕ⫴»శiíౝĀ;rవ⫾iĀ;eచథiäඐĀpt⬌⬑f;쀀𝕟膀¬;in⬙⬚⬶䂬nȀ;Edvஉ⬤⬨⬮;쀀⋹̸ot;쀀⋵̸ǡஉ⬳⬵;拷;拶iĀ;vಸ⬼ǡಸ⭁⭃;拾;拽ƀaor⭋⭣⭩rȀ;ast୻⭕⭚⭟lleì୻l;쀀⫽⃥;쀀∂̸lint;樔ƀ;ceಒ⭰⭳uåಥĀ;cಘ⭸Ā;eಒ⭽ñಘȀAait⮈⮋⮝⮧rò⦈rrƀ;cw⮔⮕⮙憛;쀀⤳̸;쀀↝̸ghtarrow»⮕riĀ;eೋೖ΀chimpqu⮽⯍⯙⬄୸⯤⯯Ȁ;cerല⯆ഷ⯉uå൅;쀀𝓃ortɭ⬅\0\0⯖ará⭖mĀ;e൮⯟Ā;q൴൳suĀbp⯫⯭å೸åഋƀbcp⯶ⰑⰙȀ;Ees⯿ⰀഢⰄ抄;쀀⫅̸etĀ;eഛⰋqĀ;qണⰀcĀ;eലⰗñസȀ;EesⰢⰣൟⰧ抅;쀀⫆̸etĀ;e൘ⰮqĀ;qൠⰣȀgilrⰽⰿⱅⱇìௗlde耻ñ䃱çృiangleĀlrⱒⱜeftĀ;eచⱚñదightĀ;eೋⱥñ೗Ā;mⱬⱭ䎽ƀ;esⱴⱵⱹ䀣ro;愖p;怇ҀDHadgilrsⲏⲔⲙⲞⲣⲰⲶⳓⳣash;抭arr;椄p;쀀≍⃒ash;抬ĀetⲨⲬ;쀀≥⃒;쀀>⃒nfin;槞ƀAetⲽⳁⳅrr;椂;쀀≤⃒Ā;rⳊⳍ쀀<⃒ie;쀀⊴⃒ĀAtⳘⳜrr;椃rie;쀀⊵⃒im;쀀∼⃒ƀAan⳰⳴ⴂrr;懖rĀhr⳺⳽k;椣Ā;oᏧᏥear;椧ቓ᪕\0\0\0\0\0\0\0\0\0\0\0\0\0ⴭ\0ⴸⵈⵠⵥ⵲ⶄᬇ\0\0ⶍⶫ\0ⷈⷎ\0ⷜ⸙⸫⸾⹃Ācsⴱ᪗ute耻ó䃳ĀiyⴼⵅrĀ;c᪞ⵂ耻ô䃴;䐾ʀabios᪠ⵒⵗǈⵚlac;䅑v;樸old;榼lig;䅓Ācr⵩⵭ir;榿;쀀𝔬ͯ⵹\0\0⵼\0ⶂn;䋛ave耻ò䃲;槁Ābmⶈ෴ar;榵Ȁacitⶕ⶘ⶥⶨrò᪀Āir⶝ⶠr;榾oss;榻nå๒;槀ƀaeiⶱⶵⶹcr;䅍ga;䏉ƀcdnⷀⷅǍron;䎿;榶pf;쀀𝕠ƀaelⷔ⷗ǒr;榷rp;榹΀;adiosvⷪⷫⷮ⸈⸍⸐⸖戨rò᪆Ȁ;efmⷷⷸ⸂⸅橝rĀ;oⷾⷿ愴f»ⷿ耻ª䂪耻º䂺gof;抶r;橖lope;橗;橛ƀclo⸟⸡⸧ò⸁ash耻ø䃸l;折iŬⸯ⸴de耻õ䃵esĀ;aǛ⸺s;樶ml耻ö䃶bar;挽ૡ⹞\0⹽\0⺀⺝\0⺢⺹\0\0⻋ຜ\0⼓\0\0⼫⾼\0⿈rȀ;astЃ⹧⹲຅脀¶;l⹭⹮䂶leìЃɩ⹸\0\0⹻m;櫳;櫽y;䐿rʀcimpt⺋⺏⺓ᡥ⺗nt;䀥od;䀮il;怰enk;怱r;쀀𝔭ƀimo⺨⺰⺴Ā;v⺭⺮䏆;䏕maô੶ne;明ƀ;tv⺿⻀⻈䏀chfork»´;䏖Āau⻏⻟nĀck⻕⻝kĀ;h⇴⻛;愎ö⇴sҀ;abcdemst⻳⻴ᤈ⻹⻽⼄⼆⼊⼎䀫cir;樣ir;樢Āouᵀ⼂;樥;橲n肻±ຝim;樦wo;樧ƀipu⼙⼠⼥ntint;樕f;쀀𝕡nd耻£䂣Ԁ;Eaceinosu່⼿⽁⽄⽇⾁⾉⾒⽾⾶;檳p;檷uå໙Ā;c໎⽌̀;acens່⽙⽟⽦⽨⽾pproø⽃urlyeñ໙ñ໎ƀaes⽯⽶⽺pprox;檹qq;檵im;拨iíໟmeĀ;s⾈ຮ怲ƀEas⽸⾐⽺ð⽵ƀdfp໬⾙⾯ƀals⾠⾥⾪lar;挮ine;挒urf;挓Ā;t໻⾴ï໻rel;抰Āci⿀⿅r;쀀𝓅;䏈ncsp;怈̀fiopsu⿚⋢⿟⿥⿫⿱r;쀀𝔮pf;쀀𝕢rime;恗cr;쀀𝓆ƀaeo⿸〉〓tĀei⿾々rnionóڰnt;樖stĀ;e【】䀿ñἙô༔઀ABHabcdefhilmnoprstux぀けさすムㄎㄫㅇㅢㅲㆎ㈆㈕㈤㈩㉘㉮㉲㊐㊰㊷ƀartぇおがròႳòϝail;検aròᱥar;楤΀cdenqrtとふへみわゔヌĀeuねぱ;쀀∽̱te;䅕iãᅮmptyv;榳gȀ;del࿑らるろ;榒;榥å࿑uo耻»䂻rր;abcfhlpstw࿜ガクシスゼゾダッデナp;極Ā;f࿠ゴs;椠;椳s;椞ë≝ð✮l;楅im;楴l;憣;憝Āaiパフil;椚oĀ;nホボ戶aló༞ƀabrョリヮrò៥rk;杳ĀakンヽcĀekヹ・;䁽;䁝Āes㄂㄄;榌lĀduㄊㄌ;榎;榐Ȁaeuyㄗㄜㄧㄩron;䅙Ādiㄡㄥil;䅗ì࿲âヺ;䑀Ȁclqsㄴㄷㄽㅄa;椷dhar;楩uoĀ;rȎȍh;憳ƀacgㅎㅟངlȀ;ipsླྀㅘㅛႜnåႻarôྩt;断ƀilrㅩဣㅮsht;楽;쀀𝔯ĀaoㅷㆆrĀduㅽㅿ»ѻĀ;l႑ㆄ;楬Ā;vㆋㆌ䏁;䏱ƀgns㆕ㇹㇼht̀ahlrstㆤㆰ㇂㇘㇤㇮rrowĀ;t࿜ㆭaéトarpoonĀduㆻㆿowîㅾp»႒eftĀah㇊㇐rrowó࿪arpoonóՑightarrows;應quigarro÷ニhreetimes;拌g;䋚ingdotseñἲƀahm㈍㈐㈓rò࿪aòՑ;怏oustĀ;a㈞㈟掱che»㈟mid;櫮Ȁabpt㈲㈽㉀㉒Ānr㈷㈺g;柭r;懾rëဃƀafl㉇㉊㉎r;榆;쀀𝕣us;樮imes;樵Āap㉝㉧rĀ;g㉣㉤䀩t;榔olint;樒arò㇣Ȁachq㉻㊀Ⴜ㊅quo;怺r;쀀𝓇Ābu・㊊oĀ;rȔȓƀhir㊗㊛㊠reåㇸmes;拊iȀ;efl㊪ၙᠡ㊫方tri;槎luhar;楨;愞ൡ㋕㋛㋟㌬㌸㍱\0㍺㎤\0\0㏬㏰\0㐨㑈㑚㒭㒱㓊㓱\0㘖\0\0㘳cute;䅛quï➺Ԁ;Eaceinpsyᇭ㋳㋵㋿㌂㌋㌏㌟㌦㌩;檴ǰ㋺\0㋼;檸on;䅡uåᇾĀ;dᇳ㌇il;䅟rc;䅝ƀEas㌖㌘㌛;檶p;檺im;择olint;樓iíሄ;䑁otƀ;be㌴ᵇ㌵担;橦΀Aacmstx㍆㍊㍗㍛㍞㍣㍭rr;懘rĀhr㍐㍒ë∨Ā;oਸ਼਴t耻§䂧i;䀻war;椩mĀin㍩ðnuóñt;朶rĀ;o㍶⁕쀀𝔰Ȁacoy㎂㎆㎑㎠rp;景Āhy㎋㎏cy;䑉;䑈rtɭ㎙\0\0㎜iäᑤaraì⹯耻­䂭Āgm㎨㎴maƀ;fv㎱㎲㎲䏃;䏂Ѐ;deglnprካ㏅㏉㏎㏖㏞㏡㏦ot;橪Ā;q኱ኰĀ;E㏓㏔檞;檠Ā;E㏛㏜檝;檟e;扆lus;樤arr;楲aròᄽȀaeit㏸㐈㐏㐗Āls㏽㐄lsetmé㍪hp;樳parsl;槤Ādlᑣ㐔e;挣Ā;e㐜㐝檪Ā;s㐢㐣檬;쀀⪬︀ƀflp㐮㐳㑂tcy;䑌Ā;b㐸㐹䀯Ā;a㐾㐿槄r;挿f;쀀𝕤aĀdr㑍ЂesĀ;u㑔㑕晠it»㑕ƀcsu㑠㑹㒟Āau㑥㑯pĀ;sᆈ㑫;쀀⊓︀pĀ;sᆴ㑵;쀀⊔︀uĀbp㑿㒏ƀ;esᆗᆜ㒆etĀ;eᆗ㒍ñᆝƀ;esᆨᆭ㒖etĀ;eᆨ㒝ñᆮƀ;afᅻ㒦ְrť㒫ֱ»ᅼaròᅈȀcemt㒹㒾㓂㓅r;쀀𝓈tmîñiì㐕aræᆾĀar㓎㓕rĀ;f㓔ឿ昆Āan㓚㓭ightĀep㓣㓪psiloîỠhé⺯s»⡒ʀbcmnp㓻㕞ሉ㖋㖎Ҁ;Edemnprs㔎㔏㔑㔕㔞㔣㔬㔱㔶抂;櫅ot;檽Ā;dᇚ㔚ot;櫃ult;櫁ĀEe㔨㔪;櫋;把lus;檿arr;楹ƀeiu㔽㕒㕕tƀ;en㔎㕅㕋qĀ;qᇚ㔏eqĀ;q㔫㔨m;櫇Ābp㕚㕜;櫕;櫓c̀;acensᇭ㕬㕲㕹㕻㌦pproø㋺urlyeñᇾñᇳƀaes㖂㖈㌛pproø㌚qñ㌗g;晪ڀ123;Edehlmnps㖩㖬㖯ሜ㖲㖴㗀㗉㗕㗚㗟㗨㗭耻¹䂹耻²䂲耻³䂳;櫆Āos㖹㖼t;檾ub;櫘Ā;dሢ㗅ot;櫄sĀou㗏㗒l;柉b;櫗arr;楻ult;櫂ĀEe㗤㗦;櫌;抋lus;櫀ƀeiu㗴㘉㘌tƀ;enሜ㗼㘂qĀ;qሢ㖲eqĀ;q㗧㗤m;櫈Ābp㘑㘓;櫔;櫖ƀAan㘜㘠㘭rr;懙rĀhr㘦㘨ë∮Ā;oਫ਩war;椪lig耻ß䃟௡㙑㙝㙠ዎ㙳㙹\0㙾㛂\0\0\0\0\0㛛㜃\0㜉㝬\0\0\0㞇ɲ㙖\0\0㙛get;挖;䏄rë๟ƀaey㙦㙫㙰ron;䅥dil;䅣;䑂lrec;挕r;쀀𝔱Ȁeiko㚆㚝㚵㚼ǲ㚋\0㚑eĀ4fኄኁaƀ;sv㚘㚙㚛䎸ym;䏑Ācn㚢㚲kĀas㚨㚮pproø዁im»ኬsðኞĀas㚺㚮ð዁rn耻þ䃾Ǭ̟㛆⋧es膀×;bd㛏㛐㛘䃗Ā;aᤏ㛕r;樱;樰ƀeps㛡㛣㜀á⩍Ȁ;bcf҆㛬㛰㛴ot;挶ir;櫱Ā;o㛹㛼쀀𝕥rk;櫚á㍢rime;怴ƀaip㜏㜒㝤dåቈ΀adempst㜡㝍㝀㝑㝗㝜㝟ngleʀ;dlqr㜰㜱㜶㝀㝂斵own»ᶻeftĀ;e⠀㜾ñम;扜ightĀ;e㊪㝋ñၚot;旬inus;樺lus;樹b;槍ime;樻ezium;揢ƀcht㝲㝽㞁Āry㝷㝻;쀀𝓉;䑆cy;䑛rok;䅧Āio㞋㞎xô᝷headĀlr㞗㞠eftarro÷ࡏightarrow»ཝऀAHabcdfghlmoprstuw㟐㟓㟗㟤㟰㟼㠎㠜㠣㠴㡑㡝㡫㢩㣌㣒㣪㣶ròϭar;楣Ācr㟜㟢ute耻ú䃺òᅐrǣ㟪\0㟭y;䑞ve;䅭Āiy㟵㟺rc耻û䃻;䑃ƀabh㠃㠆㠋ròᎭlac;䅱aòᏃĀir㠓㠘sht;楾;쀀𝔲rave耻ù䃹š㠧㠱rĀlr㠬㠮»ॗ»ႃlk;斀Āct㠹㡍ɯ㠿\0\0㡊rnĀ;e㡅㡆挜r»㡆op;挏ri;旸Āal㡖㡚cr;䅫肻¨͉Āgp㡢㡦on;䅳f;쀀𝕦̀adhlsuᅋ㡸㡽፲㢑㢠ownáᎳarpoonĀlr㢈㢌efô㠭ighô㠯iƀ;hl㢙㢚㢜䏅»ᏺon»㢚parrows;懈ƀcit㢰㣄㣈ɯ㢶\0\0㣁rnĀ;e㢼㢽挝r»㢽op;挎ng;䅯ri;旹cr;쀀𝓊ƀdir㣙㣝㣢ot;拰lde;䅩iĀ;f㜰㣨»᠓Āam㣯㣲rò㢨l耻ü䃼angle;榧ހABDacdeflnoprsz㤜㤟㤩㤭㦵㦸㦽㧟㧤㧨㧳㧹㧽㨁㨠ròϷarĀ;v㤦㤧櫨;櫩asèϡĀnr㤲㤷grt;榜΀eknprst㓣㥆㥋㥒㥝㥤㦖appá␕othinçẖƀhir㓫⻈㥙opô⾵Ā;hᎷ㥢ïㆍĀiu㥩㥭gmá㎳Ābp㥲㦄setneqĀ;q㥽㦀쀀⊊︀;쀀⫋︀setneqĀ;q㦏㦒쀀⊋︀;쀀⫌︀Āhr㦛㦟etá㚜iangleĀlr㦪㦯eft»थight»ၑy;䐲ash»ံƀelr㧄㧒㧗ƀ;beⷪ㧋㧏ar;抻q;扚lip;拮Ābt㧜ᑨaòᑩr;쀀𝔳tré㦮suĀbp㧯㧱»ജ»൙pf;쀀𝕧roð໻tré㦴Ācu㨆㨋r;쀀𝓋Ābp㨐㨘nĀEe㦀㨖»㥾nĀEe㦒㨞»㦐igzag;榚΀cefoprs㨶㨻㩖㩛㩔㩡㩪irc;䅵Ādi㩀㩑Ābg㩅㩉ar;機eĀ;qᗺ㩏;扙erp;愘r;쀀𝔴pf;쀀𝕨Ā;eᑹ㩦atèᑹcr;쀀𝓌ૣណ㪇\0㪋\0㪐㪛\0\0㪝㪨㪫㪯\0\0㫃㫎\0㫘ៜ៟tré៑r;쀀𝔵ĀAa㪔㪗ròσrò৶;䎾ĀAa㪡㪤ròθrò৫að✓is;拻ƀdptឤ㪵㪾Āfl㪺ឩ;쀀𝕩imåឲĀAa㫇㫊ròώròਁĀcq㫒ីr;쀀𝓍Āpt៖㫜ré។Ѐacefiosu㫰㫽㬈㬌㬑㬕㬛㬡cĀuy㫶㫻te耻ý䃽;䑏Āiy㬂㬆rc;䅷;䑋n耻¥䂥r;쀀𝔶cy;䑗pf;쀀𝕪cr;쀀𝓎Ācm㬦㬩y;䑎l耻ÿ䃿Ԁacdefhiosw㭂㭈㭔㭘㭤㭩㭭㭴㭺㮀cute;䅺Āay㭍㭒ron;䅾;䐷ot;䅼Āet㭝㭡træᕟa;䎶r;쀀𝔷cy;䐶grarr;懝pf;쀀𝕫cr;쀀𝓏Ājn㮅㮇;怍j;怌'.split("").map((c) => c.charCodeAt(0))
  );
  /* eslint-enable dot-notation -- @preserve End upstream entities. */

  // node_modules/entities/dist/esm/generated/decode-data-xml.js
  /* eslint-disable dot-notation -- @preserve Upstream entities conventions only. */
  /* eslint-enable dot-notation -- @preserve End upstream entities. */

  // node_modules/entities/dist/esm/decode-codepoint.js
  /* eslint-disable dot-notation -- @preserve Upstream entities conventions only. */
  var _a;
  var decodeMap = /* @__PURE__ */ new Map([
    [0, 65533],
    // C1 Unicode control character reference replacements
    [128, 8364],
    [130, 8218],
    [131, 402],
    [132, 8222],
    [133, 8230],
    [134, 8224],
    [135, 8225],
    [136, 710],
    [137, 8240],
    [138, 352],
    [139, 8249],
    [140, 338],
    [142, 381],
    [145, 8216],
    [146, 8217],
    [147, 8220],
    [148, 8221],
    [149, 8226],
    [150, 8211],
    [151, 8212],
    [152, 732],
    [153, 8482],
    [154, 353],
    [155, 8250],
    [156, 339],
    [158, 382],
    [159, 376]
  ]);
  var fromCodePoint = (_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function(codePoint) {
    let output = "";
    if (codePoint > 65535) {
      codePoint -= 65536;
      output += String.fromCharCode(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    output += String.fromCharCode(codePoint);
    return output;
  };
  function replaceCodePoint(codePoint) {
    var _a3;
    if (codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111) {
      return 65533;
    }
    return (_a3 = decodeMap.get(codePoint)) !== null && _a3 !== void 0 ? _a3 : codePoint;
  }
  /* eslint-enable dot-notation -- @preserve End upstream entities. */

  // node_modules/entities/dist/esm/decode.js
  /* eslint-disable dot-notation -- @preserve Upstream entities conventions only. */
  var CharCodes;
  (function(CharCodes2) {
    CharCodes2[CharCodes2["NUM"] = 35] = "NUM";
    CharCodes2[CharCodes2["SEMI"] = 59] = "SEMI";
    CharCodes2[CharCodes2["EQUALS"] = 61] = "EQUALS";
    CharCodes2[CharCodes2["ZERO"] = 48] = "ZERO";
    CharCodes2[CharCodes2["NINE"] = 57] = "NINE";
    CharCodes2[CharCodes2["LOWER_A"] = 97] = "LOWER_A";
    CharCodes2[CharCodes2["LOWER_F"] = 102] = "LOWER_F";
    CharCodes2[CharCodes2["LOWER_X"] = 120] = "LOWER_X";
    CharCodes2[CharCodes2["LOWER_Z"] = 122] = "LOWER_Z";
    CharCodes2[CharCodes2["UPPER_A"] = 65] = "UPPER_A";
    CharCodes2[CharCodes2["UPPER_F"] = 70] = "UPPER_F";
    CharCodes2[CharCodes2["UPPER_Z"] = 90] = "UPPER_Z";
  })(CharCodes || (CharCodes = {}));
  var TO_LOWER_BIT = 32;
  var BinTrieFlags;
  (function(BinTrieFlags2) {
    BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
    BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
    BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  })(BinTrieFlags || (BinTrieFlags = {}));
  function isNumber(code) {
    return code >= CharCodes.ZERO && code <= CharCodes.NINE;
  }
  function isHexadecimalCharacter(code) {
    return code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_F || code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_F;
  }
  function isAsciiAlphaNumeric(code) {
    return code >= CharCodes.UPPER_A && code <= CharCodes.UPPER_Z || code >= CharCodes.LOWER_A && code <= CharCodes.LOWER_Z || isNumber(code);
  }
  function isEntityInAttributeInvalidEnd(code) {
    return code === CharCodes.EQUALS || isAsciiAlphaNumeric(code);
  }
  var EntityDecoderState;
  (function(EntityDecoderState2) {
    EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
    EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
    EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
    EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
    EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
  })(EntityDecoderState || (EntityDecoderState = {}));
  var DecodingMode;
  (function(DecodingMode2) {
    DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
    DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
    DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
  })(DecodingMode || (DecodingMode = {}));
  var EntityDecoder = class {
    constructor(decodeTree, emitCodePoint, errors) {
      this.decodeTree = decodeTree;
      this.emitCodePoint = emitCodePoint;
      this.errors = errors;
      this.state = EntityDecoderState.EntityStart;
      this.consumed = 1;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.decodeMode = DecodingMode.Strict;
    }
    /** Resets the instance to make it reusable. */
    startEntity(decodeMode) {
      this.decodeMode = decodeMode;
      this.state = EntityDecoderState.EntityStart;
      this.result = 0;
      this.treeIndex = 0;
      this.excess = 1;
      this.consumed = 1;
    }
    /**
     * Write an entity to the decoder. This can be called multiple times with partial entities.
     * If the entity is incomplete, the decoder will return -1.
     *
     * Mirrors the implementation of `getDecoder`, but with the ability to stop decoding if the
     * entity is incomplete, and resume when the next string is written.
     *
     * @param input The string containing the entity (or a continuation of the entity).
     * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    write(input, offset) {
      switch (this.state) {
        case EntityDecoderState.EntityStart: {
          if (input.charCodeAt(offset) === CharCodes.NUM) {
            this.state = EntityDecoderState.NumericStart;
            this.consumed += 1;
            return this.stateNumericStart(input, offset + 1);
          }
          this.state = EntityDecoderState.NamedEntity;
          return this.stateNamedEntity(input, offset);
        }
        case EntityDecoderState.NumericStart: {
          return this.stateNumericStart(input, offset);
        }
        case EntityDecoderState.NumericDecimal: {
          return this.stateNumericDecimal(input, offset);
        }
        case EntityDecoderState.NumericHex: {
          return this.stateNumericHex(input, offset);
        }
        case EntityDecoderState.NamedEntity: {
          return this.stateNamedEntity(input, offset);
        }
      }
    }
    /**
     * Switches between the numeric decimal and hexadecimal states.
     *
     * Equivalent to the `Numeric character reference state` in the HTML spec.
     *
     * @param input The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericStart(input, offset) {
      if (offset >= input.length) {
        return -1;
      }
      if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
        this.state = EntityDecoderState.NumericHex;
        this.consumed += 1;
        return this.stateNumericHex(input, offset + 1);
      }
      this.state = EntityDecoderState.NumericDecimal;
      return this.stateNumericDecimal(input, offset);
    }
    addToNumericResult(input, start, end, base) {
      if (start !== end) {
        const digitCount = end - start;
        this.result = this.result * Math.pow(base, digitCount) + Number.parseInt(input.substr(start, digitCount), base);
        this.consumed += digitCount;
      }
    }
    /**
     * Parses a hexadecimal numeric entity.
     *
     * Equivalent to the `Hexademical character reference state` in the HTML spec.
     *
     * @param input The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericHex(input, offset) {
      const startIndex = offset;
      while (offset < input.length) {
        const char = input.charCodeAt(offset);
        if (isNumber(char) || isHexadecimalCharacter(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(input, startIndex, offset, 16);
          return this.emitNumericEntity(char, 3);
        }
      }
      this.addToNumericResult(input, startIndex, offset, 16);
      return -1;
    }
    /**
     * Parses a decimal numeric entity.
     *
     * Equivalent to the `Decimal character reference state` in the HTML spec.
     *
     * @param input The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNumericDecimal(input, offset) {
      const startIndex = offset;
      while (offset < input.length) {
        const char = input.charCodeAt(offset);
        if (isNumber(char)) {
          offset += 1;
        } else {
          this.addToNumericResult(input, startIndex, offset, 10);
          return this.emitNumericEntity(char, 2);
        }
      }
      this.addToNumericResult(input, startIndex, offset, 10);
      return -1;
    }
    /**
     * Validate and emit a numeric entity.
     *
     * Implements the logic from the `Hexademical character reference start
     * state` and `Numeric character reference end state` in the HTML spec.
     *
     * @param lastCp The last code point of the entity. Used to see if the
     *               entity was terminated with a semicolon.
     * @param expectedLength The minimum number of characters that should be
     *                       consumed. Used to validate that at least one digit
     *                       was consumed.
     * @returns The number of characters that were consumed.
     */
    emitNumericEntity(lastCp, expectedLength) {
      var _a3;
      if (this.consumed <= expectedLength) {
        (_a3 = this.errors) === null || _a3 === void 0 ? void 0 : _a3.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      if (lastCp === CharCodes.SEMI) {
        this.consumed += 1;
      } else if (this.decodeMode === DecodingMode.Strict) {
        return 0;
      }
      this.emitCodePoint(replaceCodePoint(this.result), this.consumed);
      if (this.errors) {
        if (lastCp !== CharCodes.SEMI) {
          this.errors.missingSemicolonAfterCharacterReference();
        }
        this.errors.validateNumericCharacterReference(this.result);
      }
      return this.consumed;
    }
    /**
     * Parses a named entity.
     *
     * Equivalent to the `Named character reference state` in the HTML spec.
     *
     * @param input The string containing the entity (or a continuation of the entity).
     * @param offset The current offset.
     * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
     */
    stateNamedEntity(input, offset) {
      const { decodeTree } = this;
      let current = decodeTree[this.treeIndex];
      let valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
      for (; offset < input.length; offset++, this.excess++) {
        const char = input.charCodeAt(offset);
        this.treeIndex = determineBranch(decodeTree, current, this.treeIndex + Math.max(1, valueLength), char);
        if (this.treeIndex < 0) {
          return this.result === 0 || // If we are parsing an attribute
          this.decodeMode === DecodingMode.Attribute && // We shouldn't have consumed any characters after the entity,
          (valueLength === 0 || // And there should be no invalid characters.
          isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
        }
        current = decodeTree[this.treeIndex];
        valueLength = (current & BinTrieFlags.VALUE_LENGTH) >> 14;
        if (valueLength !== 0) {
          if (char === CharCodes.SEMI) {
            return this.emitNamedEntityData(this.treeIndex, valueLength, this.consumed + this.excess);
          }
          if (this.decodeMode !== DecodingMode.Strict) {
            this.result = this.treeIndex;
            this.consumed += this.excess;
            this.excess = 0;
          }
        }
      }
      return -1;
    }
    /**
     * Emit a named entity that was not terminated with a semicolon.
     *
     * @returns The number of characters consumed.
     */
    emitNotTerminatedNamedEntity() {
      var _a3;
      const { result, decodeTree } = this;
      const valueLength = (decodeTree[result] & BinTrieFlags.VALUE_LENGTH) >> 14;
      this.emitNamedEntityData(result, valueLength, this.consumed);
      (_a3 = this.errors) === null || _a3 === void 0 ? void 0 : _a3.missingSemicolonAfterCharacterReference();
      return this.consumed;
    }
    /**
     * Emit a named entity.
     *
     * @param result The index of the entity in the decode tree.
     * @param valueLength The number of bytes in the entity.
     * @param consumed The number of characters consumed.
     *
     * @returns The number of characters consumed.
     */
    emitNamedEntityData(result, valueLength, consumed) {
      const { decodeTree } = this;
      this.emitCodePoint(valueLength === 1 ? decodeTree[result] & ~BinTrieFlags.VALUE_LENGTH : decodeTree[result + 1], consumed);
      if (valueLength === 3) {
        this.emitCodePoint(decodeTree[result + 2], consumed);
      }
      return consumed;
    }
    /**
     * Signal to the parser that the end of the input was reached.
     *
     * Remaining data will be emitted and relevant errors will be produced.
     *
     * @returns The number of characters consumed.
     */
    end() {
      var _a3;
      switch (this.state) {
        case EntityDecoderState.NamedEntity: {
          return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
        }
        // Otherwise, emit a numeric entity if we have one.
        case EntityDecoderState.NumericDecimal: {
          return this.emitNumericEntity(0, 2);
        }
        case EntityDecoderState.NumericHex: {
          return this.emitNumericEntity(0, 3);
        }
        case EntityDecoderState.NumericStart: {
          (_a3 = this.errors) === null || _a3 === void 0 ? void 0 : _a3.absenceOfDigitsInNumericCharacterReference(this.consumed);
          return 0;
        }
        case EntityDecoderState.EntityStart: {
          return 0;
        }
      }
    }
  };
  function determineBranch(decodeTree, current, nodeIndex, char) {
    const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
    const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
    if (branchCount === 0) {
      return jumpOffset !== 0 && char === jumpOffset ? nodeIndex : -1;
    }
    if (jumpOffset) {
      const value = char - jumpOffset;
      return value < 0 || value >= branchCount ? -1 : decodeTree[nodeIndex + value] - 1;
    }
    let lo = nodeIndex;
    let hi = lo + branchCount - 1;
    while (lo <= hi) {
      const mid = lo + hi >>> 1;
      const midValue = decodeTree[mid];
      if (midValue < char) {
        lo = mid + 1;
      } else if (midValue > char) {
        hi = mid - 1;
      } else {
        return decodeTree[mid + branchCount];
      }
    }
    return -1;
  }
  /* eslint-enable dot-notation -- @preserve End upstream entities. */

  // node_modules/parse5/dist/common/html.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var NS;
  (function(NS2) {
    NS2["HTML"] = "http://www.w3.org/1999/xhtml";
    NS2["MATHML"] = "http://www.w3.org/1998/Math/MathML";
    NS2["SVG"] = "http://www.w3.org/2000/svg";
    NS2["XLINK"] = "http://www.w3.org/1999/xlink";
    NS2["XML"] = "http://www.w3.org/XML/1998/namespace";
    NS2["XMLNS"] = "http://www.w3.org/2000/xmlns/";
  })(NS || (NS = {}));
  var ATTRS;
  (function(ATTRS2) {
    ATTRS2["TYPE"] = "type";
    ATTRS2["ACTION"] = "action";
    ATTRS2["ENCODING"] = "encoding";
    ATTRS2["PROMPT"] = "prompt";
    ATTRS2["NAME"] = "name";
    ATTRS2["COLOR"] = "color";
    ATTRS2["FACE"] = "face";
    ATTRS2["SIZE"] = "size";
  })(ATTRS || (ATTRS = {}));
  var DOCUMENT_MODE;
  (function(DOCUMENT_MODE2) {
    DOCUMENT_MODE2["NO_QUIRKS"] = "no-quirks";
    DOCUMENT_MODE2["QUIRKS"] = "quirks";
    DOCUMENT_MODE2["LIMITED_QUIRKS"] = "limited-quirks";
  })(DOCUMENT_MODE || (DOCUMENT_MODE = {}));
  var TAG_NAMES;
  (function(TAG_NAMES2) {
    TAG_NAMES2["A"] = "a";
    TAG_NAMES2["ADDRESS"] = "address";
    TAG_NAMES2["ANNOTATION_XML"] = "annotation-xml";
    TAG_NAMES2["APPLET"] = "applet";
    TAG_NAMES2["AREA"] = "area";
    TAG_NAMES2["ARTICLE"] = "article";
    TAG_NAMES2["ASIDE"] = "aside";
    TAG_NAMES2["B"] = "b";
    TAG_NAMES2["BASE"] = "base";
    TAG_NAMES2["BASEFONT"] = "basefont";
    TAG_NAMES2["BGSOUND"] = "bgsound";
    TAG_NAMES2["BIG"] = "big";
    TAG_NAMES2["BLOCKQUOTE"] = "blockquote";
    TAG_NAMES2["BODY"] = "body";
    TAG_NAMES2["BR"] = "br";
    TAG_NAMES2["BUTTON"] = "button";
    TAG_NAMES2["CAPTION"] = "caption";
    TAG_NAMES2["CENTER"] = "center";
    TAG_NAMES2["CODE"] = "code";
    TAG_NAMES2["COL"] = "col";
    TAG_NAMES2["COLGROUP"] = "colgroup";
    TAG_NAMES2["DD"] = "dd";
    TAG_NAMES2["DESC"] = "desc";
    TAG_NAMES2["DETAILS"] = "details";
    TAG_NAMES2["DIALOG"] = "dialog";
    TAG_NAMES2["DIR"] = "dir";
    TAG_NAMES2["DIV"] = "div";
    TAG_NAMES2["DL"] = "dl";
    TAG_NAMES2["DT"] = "dt";
    TAG_NAMES2["EM"] = "em";
    TAG_NAMES2["EMBED"] = "embed";
    TAG_NAMES2["FIELDSET"] = "fieldset";
    TAG_NAMES2["FIGCAPTION"] = "figcaption";
    TAG_NAMES2["FIGURE"] = "figure";
    TAG_NAMES2["FONT"] = "font";
    TAG_NAMES2["FOOTER"] = "footer";
    TAG_NAMES2["FOREIGN_OBJECT"] = "foreignObject";
    TAG_NAMES2["FORM"] = "form";
    TAG_NAMES2["FRAME"] = "frame";
    TAG_NAMES2["FRAMESET"] = "frameset";
    TAG_NAMES2["H1"] = "h1";
    TAG_NAMES2["H2"] = "h2";
    TAG_NAMES2["H3"] = "h3";
    TAG_NAMES2["H4"] = "h4";
    TAG_NAMES2["H5"] = "h5";
    TAG_NAMES2["H6"] = "h6";
    TAG_NAMES2["HEAD"] = "head";
    TAG_NAMES2["HEADER"] = "header";
    TAG_NAMES2["HGROUP"] = "hgroup";
    TAG_NAMES2["HR"] = "hr";
    TAG_NAMES2["HTML"] = "html";
    TAG_NAMES2["I"] = "i";
    TAG_NAMES2["IMG"] = "img";
    TAG_NAMES2["IMAGE"] = "image";
    TAG_NAMES2["INPUT"] = "input";
    TAG_NAMES2["IFRAME"] = "iframe";
    TAG_NAMES2["KEYGEN"] = "keygen";
    TAG_NAMES2["LABEL"] = "label";
    TAG_NAMES2["LI"] = "li";
    TAG_NAMES2["LINK"] = "link";
    TAG_NAMES2["LISTING"] = "listing";
    TAG_NAMES2["MAIN"] = "main";
    TAG_NAMES2["MALIGNMARK"] = "malignmark";
    TAG_NAMES2["MARQUEE"] = "marquee";
    TAG_NAMES2["MATH"] = "math";
    TAG_NAMES2["MENU"] = "menu";
    TAG_NAMES2["META"] = "meta";
    TAG_NAMES2["MGLYPH"] = "mglyph";
    TAG_NAMES2["MI"] = "mi";
    TAG_NAMES2["MO"] = "mo";
    TAG_NAMES2["MN"] = "mn";
    TAG_NAMES2["MS"] = "ms";
    TAG_NAMES2["MTEXT"] = "mtext";
    TAG_NAMES2["NAV"] = "nav";
    TAG_NAMES2["NOBR"] = "nobr";
    TAG_NAMES2["NOFRAMES"] = "noframes";
    TAG_NAMES2["NOEMBED"] = "noembed";
    TAG_NAMES2["NOSCRIPT"] = "noscript";
    TAG_NAMES2["OBJECT"] = "object";
    TAG_NAMES2["OL"] = "ol";
    TAG_NAMES2["OPTGROUP"] = "optgroup";
    TAG_NAMES2["OPTION"] = "option";
    TAG_NAMES2["P"] = "p";
    TAG_NAMES2["PARAM"] = "param";
    TAG_NAMES2["PLAINTEXT"] = "plaintext";
    TAG_NAMES2["PRE"] = "pre";
    TAG_NAMES2["RB"] = "rb";
    TAG_NAMES2["RP"] = "rp";
    TAG_NAMES2["RT"] = "rt";
    TAG_NAMES2["RTC"] = "rtc";
    TAG_NAMES2["RUBY"] = "ruby";
    TAG_NAMES2["S"] = "s";
    TAG_NAMES2["SCRIPT"] = "script";
    TAG_NAMES2["SEARCH"] = "search";
    TAG_NAMES2["SECTION"] = "section";
    TAG_NAMES2["SELECT"] = "select";
    TAG_NAMES2["SOURCE"] = "source";
    TAG_NAMES2["SMALL"] = "small";
    TAG_NAMES2["SPAN"] = "span";
    TAG_NAMES2["STRIKE"] = "strike";
    TAG_NAMES2["STRONG"] = "strong";
    TAG_NAMES2["STYLE"] = "style";
    TAG_NAMES2["SUB"] = "sub";
    TAG_NAMES2["SUMMARY"] = "summary";
    TAG_NAMES2["SUP"] = "sup";
    TAG_NAMES2["TABLE"] = "table";
    TAG_NAMES2["TBODY"] = "tbody";
    TAG_NAMES2["TEMPLATE"] = "template";
    TAG_NAMES2["TEXTAREA"] = "textarea";
    TAG_NAMES2["TFOOT"] = "tfoot";
    TAG_NAMES2["TD"] = "td";
    TAG_NAMES2["TH"] = "th";
    TAG_NAMES2["THEAD"] = "thead";
    TAG_NAMES2["TITLE"] = "title";
    TAG_NAMES2["TR"] = "tr";
    TAG_NAMES2["TRACK"] = "track";
    TAG_NAMES2["TT"] = "tt";
    TAG_NAMES2["U"] = "u";
    TAG_NAMES2["UL"] = "ul";
    TAG_NAMES2["SVG"] = "svg";
    TAG_NAMES2["VAR"] = "var";
    TAG_NAMES2["WBR"] = "wbr";
    TAG_NAMES2["XMP"] = "xmp";
  })(TAG_NAMES || (TAG_NAMES = {}));
  var TAG_ID;
  (function(TAG_ID2) {
    TAG_ID2[TAG_ID2["UNKNOWN"] = 0] = "UNKNOWN";
    TAG_ID2[TAG_ID2["A"] = 1] = "A";
    TAG_ID2[TAG_ID2["ADDRESS"] = 2] = "ADDRESS";
    TAG_ID2[TAG_ID2["ANNOTATION_XML"] = 3] = "ANNOTATION_XML";
    TAG_ID2[TAG_ID2["APPLET"] = 4] = "APPLET";
    TAG_ID2[TAG_ID2["AREA"] = 5] = "AREA";
    TAG_ID2[TAG_ID2["ARTICLE"] = 6] = "ARTICLE";
    TAG_ID2[TAG_ID2["ASIDE"] = 7] = "ASIDE";
    TAG_ID2[TAG_ID2["B"] = 8] = "B";
    TAG_ID2[TAG_ID2["BASE"] = 9] = "BASE";
    TAG_ID2[TAG_ID2["BASEFONT"] = 10] = "BASEFONT";
    TAG_ID2[TAG_ID2["BGSOUND"] = 11] = "BGSOUND";
    TAG_ID2[TAG_ID2["BIG"] = 12] = "BIG";
    TAG_ID2[TAG_ID2["BLOCKQUOTE"] = 13] = "BLOCKQUOTE";
    TAG_ID2[TAG_ID2["BODY"] = 14] = "BODY";
    TAG_ID2[TAG_ID2["BR"] = 15] = "BR";
    TAG_ID2[TAG_ID2["BUTTON"] = 16] = "BUTTON";
    TAG_ID2[TAG_ID2["CAPTION"] = 17] = "CAPTION";
    TAG_ID2[TAG_ID2["CENTER"] = 18] = "CENTER";
    TAG_ID2[TAG_ID2["CODE"] = 19] = "CODE";
    TAG_ID2[TAG_ID2["COL"] = 20] = "COL";
    TAG_ID2[TAG_ID2["COLGROUP"] = 21] = "COLGROUP";
    TAG_ID2[TAG_ID2["DD"] = 22] = "DD";
    TAG_ID2[TAG_ID2["DESC"] = 23] = "DESC";
    TAG_ID2[TAG_ID2["DETAILS"] = 24] = "DETAILS";
    TAG_ID2[TAG_ID2["DIALOG"] = 25] = "DIALOG";
    TAG_ID2[TAG_ID2["DIR"] = 26] = "DIR";
    TAG_ID2[TAG_ID2["DIV"] = 27] = "DIV";
    TAG_ID2[TAG_ID2["DL"] = 28] = "DL";
    TAG_ID2[TAG_ID2["DT"] = 29] = "DT";
    TAG_ID2[TAG_ID2["EM"] = 30] = "EM";
    TAG_ID2[TAG_ID2["EMBED"] = 31] = "EMBED";
    TAG_ID2[TAG_ID2["FIELDSET"] = 32] = "FIELDSET";
    TAG_ID2[TAG_ID2["FIGCAPTION"] = 33] = "FIGCAPTION";
    TAG_ID2[TAG_ID2["FIGURE"] = 34] = "FIGURE";
    TAG_ID2[TAG_ID2["FONT"] = 35] = "FONT";
    TAG_ID2[TAG_ID2["FOOTER"] = 36] = "FOOTER";
    TAG_ID2[TAG_ID2["FOREIGN_OBJECT"] = 37] = "FOREIGN_OBJECT";
    TAG_ID2[TAG_ID2["FORM"] = 38] = "FORM";
    TAG_ID2[TAG_ID2["FRAME"] = 39] = "FRAME";
    TAG_ID2[TAG_ID2["FRAMESET"] = 40] = "FRAMESET";
    TAG_ID2[TAG_ID2["H1"] = 41] = "H1";
    TAG_ID2[TAG_ID2["H2"] = 42] = "H2";
    TAG_ID2[TAG_ID2["H3"] = 43] = "H3";
    TAG_ID2[TAG_ID2["H4"] = 44] = "H4";
    TAG_ID2[TAG_ID2["H5"] = 45] = "H5";
    TAG_ID2[TAG_ID2["H6"] = 46] = "H6";
    TAG_ID2[TAG_ID2["HEAD"] = 47] = "HEAD";
    TAG_ID2[TAG_ID2["HEADER"] = 48] = "HEADER";
    TAG_ID2[TAG_ID2["HGROUP"] = 49] = "HGROUP";
    TAG_ID2[TAG_ID2["HR"] = 50] = "HR";
    TAG_ID2[TAG_ID2["HTML"] = 51] = "HTML";
    TAG_ID2[TAG_ID2["I"] = 52] = "I";
    TAG_ID2[TAG_ID2["IMG"] = 53] = "IMG";
    TAG_ID2[TAG_ID2["IMAGE"] = 54] = "IMAGE";
    TAG_ID2[TAG_ID2["INPUT"] = 55] = "INPUT";
    TAG_ID2[TAG_ID2["IFRAME"] = 56] = "IFRAME";
    TAG_ID2[TAG_ID2["KEYGEN"] = 57] = "KEYGEN";
    TAG_ID2[TAG_ID2["LABEL"] = 58] = "LABEL";
    TAG_ID2[TAG_ID2["LI"] = 59] = "LI";
    TAG_ID2[TAG_ID2["LINK"] = 60] = "LINK";
    TAG_ID2[TAG_ID2["LISTING"] = 61] = "LISTING";
    TAG_ID2[TAG_ID2["MAIN"] = 62] = "MAIN";
    TAG_ID2[TAG_ID2["MALIGNMARK"] = 63] = "MALIGNMARK";
    TAG_ID2[TAG_ID2["MARQUEE"] = 64] = "MARQUEE";
    TAG_ID2[TAG_ID2["MATH"] = 65] = "MATH";
    TAG_ID2[TAG_ID2["MENU"] = 66] = "MENU";
    TAG_ID2[TAG_ID2["META"] = 67] = "META";
    TAG_ID2[TAG_ID2["MGLYPH"] = 68] = "MGLYPH";
    TAG_ID2[TAG_ID2["MI"] = 69] = "MI";
    TAG_ID2[TAG_ID2["MO"] = 70] = "MO";
    TAG_ID2[TAG_ID2["MN"] = 71] = "MN";
    TAG_ID2[TAG_ID2["MS"] = 72] = "MS";
    TAG_ID2[TAG_ID2["MTEXT"] = 73] = "MTEXT";
    TAG_ID2[TAG_ID2["NAV"] = 74] = "NAV";
    TAG_ID2[TAG_ID2["NOBR"] = 75] = "NOBR";
    TAG_ID2[TAG_ID2["NOFRAMES"] = 76] = "NOFRAMES";
    TAG_ID2[TAG_ID2["NOEMBED"] = 77] = "NOEMBED";
    TAG_ID2[TAG_ID2["NOSCRIPT"] = 78] = "NOSCRIPT";
    TAG_ID2[TAG_ID2["OBJECT"] = 79] = "OBJECT";
    TAG_ID2[TAG_ID2["OL"] = 80] = "OL";
    TAG_ID2[TAG_ID2["OPTGROUP"] = 81] = "OPTGROUP";
    TAG_ID2[TAG_ID2["OPTION"] = 82] = "OPTION";
    TAG_ID2[TAG_ID2["P"] = 83] = "P";
    TAG_ID2[TAG_ID2["PARAM"] = 84] = "PARAM";
    TAG_ID2[TAG_ID2["PLAINTEXT"] = 85] = "PLAINTEXT";
    TAG_ID2[TAG_ID2["PRE"] = 86] = "PRE";
    TAG_ID2[TAG_ID2["RB"] = 87] = "RB";
    TAG_ID2[TAG_ID2["RP"] = 88] = "RP";
    TAG_ID2[TAG_ID2["RT"] = 89] = "RT";
    TAG_ID2[TAG_ID2["RTC"] = 90] = "RTC";
    TAG_ID2[TAG_ID2["RUBY"] = 91] = "RUBY";
    TAG_ID2[TAG_ID2["S"] = 92] = "S";
    TAG_ID2[TAG_ID2["SCRIPT"] = 93] = "SCRIPT";
    TAG_ID2[TAG_ID2["SEARCH"] = 94] = "SEARCH";
    TAG_ID2[TAG_ID2["SECTION"] = 95] = "SECTION";
    TAG_ID2[TAG_ID2["SELECT"] = 96] = "SELECT";
    TAG_ID2[TAG_ID2["SOURCE"] = 97] = "SOURCE";
    TAG_ID2[TAG_ID2["SMALL"] = 98] = "SMALL";
    TAG_ID2[TAG_ID2["SPAN"] = 99] = "SPAN";
    TAG_ID2[TAG_ID2["STRIKE"] = 100] = "STRIKE";
    TAG_ID2[TAG_ID2["STRONG"] = 101] = "STRONG";
    TAG_ID2[TAG_ID2["STYLE"] = 102] = "STYLE";
    TAG_ID2[TAG_ID2["SUB"] = 103] = "SUB";
    TAG_ID2[TAG_ID2["SUMMARY"] = 104] = "SUMMARY";
    TAG_ID2[TAG_ID2["SUP"] = 105] = "SUP";
    TAG_ID2[TAG_ID2["TABLE"] = 106] = "TABLE";
    TAG_ID2[TAG_ID2["TBODY"] = 107] = "TBODY";
    TAG_ID2[TAG_ID2["TEMPLATE"] = 108] = "TEMPLATE";
    TAG_ID2[TAG_ID2["TEXTAREA"] = 109] = "TEXTAREA";
    TAG_ID2[TAG_ID2["TFOOT"] = 110] = "TFOOT";
    TAG_ID2[TAG_ID2["TD"] = 111] = "TD";
    TAG_ID2[TAG_ID2["TH"] = 112] = "TH";
    TAG_ID2[TAG_ID2["THEAD"] = 113] = "THEAD";
    TAG_ID2[TAG_ID2["TITLE"] = 114] = "TITLE";
    TAG_ID2[TAG_ID2["TR"] = 115] = "TR";
    TAG_ID2[TAG_ID2["TRACK"] = 116] = "TRACK";
    TAG_ID2[TAG_ID2["TT"] = 117] = "TT";
    TAG_ID2[TAG_ID2["U"] = 118] = "U";
    TAG_ID2[TAG_ID2["UL"] = 119] = "UL";
    TAG_ID2[TAG_ID2["SVG"] = 120] = "SVG";
    TAG_ID2[TAG_ID2["VAR"] = 121] = "VAR";
    TAG_ID2[TAG_ID2["WBR"] = 122] = "WBR";
    TAG_ID2[TAG_ID2["XMP"] = 123] = "XMP";
  })(TAG_ID || (TAG_ID = {}));
  var TAG_NAME_TO_ID = /* @__PURE__ */ new Map([
    [TAG_NAMES.A, TAG_ID.A],
    [TAG_NAMES.ADDRESS, TAG_ID.ADDRESS],
    [TAG_NAMES.ANNOTATION_XML, TAG_ID.ANNOTATION_XML],
    [TAG_NAMES.APPLET, TAG_ID.APPLET],
    [TAG_NAMES.AREA, TAG_ID.AREA],
    [TAG_NAMES.ARTICLE, TAG_ID.ARTICLE],
    [TAG_NAMES.ASIDE, TAG_ID.ASIDE],
    [TAG_NAMES.B, TAG_ID.B],
    [TAG_NAMES.BASE, TAG_ID.BASE],
    [TAG_NAMES.BASEFONT, TAG_ID.BASEFONT],
    [TAG_NAMES.BGSOUND, TAG_ID.BGSOUND],
    [TAG_NAMES.BIG, TAG_ID.BIG],
    [TAG_NAMES.BLOCKQUOTE, TAG_ID.BLOCKQUOTE],
    [TAG_NAMES.BODY, TAG_ID.BODY],
    [TAG_NAMES.BR, TAG_ID.BR],
    [TAG_NAMES.BUTTON, TAG_ID.BUTTON],
    [TAG_NAMES.CAPTION, TAG_ID.CAPTION],
    [TAG_NAMES.CENTER, TAG_ID.CENTER],
    [TAG_NAMES.CODE, TAG_ID.CODE],
    [TAG_NAMES.COL, TAG_ID.COL],
    [TAG_NAMES.COLGROUP, TAG_ID.COLGROUP],
    [TAG_NAMES.DD, TAG_ID.DD],
    [TAG_NAMES.DESC, TAG_ID.DESC],
    [TAG_NAMES.DETAILS, TAG_ID.DETAILS],
    [TAG_NAMES.DIALOG, TAG_ID.DIALOG],
    [TAG_NAMES.DIR, TAG_ID.DIR],
    [TAG_NAMES.DIV, TAG_ID.DIV],
    [TAG_NAMES.DL, TAG_ID.DL],
    [TAG_NAMES.DT, TAG_ID.DT],
    [TAG_NAMES.EM, TAG_ID.EM],
    [TAG_NAMES.EMBED, TAG_ID.EMBED],
    [TAG_NAMES.FIELDSET, TAG_ID.FIELDSET],
    [TAG_NAMES.FIGCAPTION, TAG_ID.FIGCAPTION],
    [TAG_NAMES.FIGURE, TAG_ID.FIGURE],
    [TAG_NAMES.FONT, TAG_ID.FONT],
    [TAG_NAMES.FOOTER, TAG_ID.FOOTER],
    [TAG_NAMES.FOREIGN_OBJECT, TAG_ID.FOREIGN_OBJECT],
    [TAG_NAMES.FORM, TAG_ID.FORM],
    [TAG_NAMES.FRAME, TAG_ID.FRAME],
    [TAG_NAMES.FRAMESET, TAG_ID.FRAMESET],
    [TAG_NAMES.H1, TAG_ID.H1],
    [TAG_NAMES.H2, TAG_ID.H2],
    [TAG_NAMES.H3, TAG_ID.H3],
    [TAG_NAMES.H4, TAG_ID.H4],
    [TAG_NAMES.H5, TAG_ID.H5],
    [TAG_NAMES.H6, TAG_ID.H6],
    [TAG_NAMES.HEAD, TAG_ID.HEAD],
    [TAG_NAMES.HEADER, TAG_ID.HEADER],
    [TAG_NAMES.HGROUP, TAG_ID.HGROUP],
    [TAG_NAMES.HR, TAG_ID.HR],
    [TAG_NAMES.HTML, TAG_ID.HTML],
    [TAG_NAMES.I, TAG_ID.I],
    [TAG_NAMES.IMG, TAG_ID.IMG],
    [TAG_NAMES.IMAGE, TAG_ID.IMAGE],
    [TAG_NAMES.INPUT, TAG_ID.INPUT],
    [TAG_NAMES.IFRAME, TAG_ID.IFRAME],
    [TAG_NAMES.KEYGEN, TAG_ID.KEYGEN],
    [TAG_NAMES.LABEL, TAG_ID.LABEL],
    [TAG_NAMES.LI, TAG_ID.LI],
    [TAG_NAMES.LINK, TAG_ID.LINK],
    [TAG_NAMES.LISTING, TAG_ID.LISTING],
    [TAG_NAMES.MAIN, TAG_ID.MAIN],
    [TAG_NAMES.MALIGNMARK, TAG_ID.MALIGNMARK],
    [TAG_NAMES.MARQUEE, TAG_ID.MARQUEE],
    [TAG_NAMES.MATH, TAG_ID.MATH],
    [TAG_NAMES.MENU, TAG_ID.MENU],
    [TAG_NAMES.META, TAG_ID.META],
    [TAG_NAMES.MGLYPH, TAG_ID.MGLYPH],
    [TAG_NAMES.MI, TAG_ID.MI],
    [TAG_NAMES.MO, TAG_ID.MO],
    [TAG_NAMES.MN, TAG_ID.MN],
    [TAG_NAMES.MS, TAG_ID.MS],
    [TAG_NAMES.MTEXT, TAG_ID.MTEXT],
    [TAG_NAMES.NAV, TAG_ID.NAV],
    [TAG_NAMES.NOBR, TAG_ID.NOBR],
    [TAG_NAMES.NOFRAMES, TAG_ID.NOFRAMES],
    [TAG_NAMES.NOEMBED, TAG_ID.NOEMBED],
    [TAG_NAMES.NOSCRIPT, TAG_ID.NOSCRIPT],
    [TAG_NAMES.OBJECT, TAG_ID.OBJECT],
    [TAG_NAMES.OL, TAG_ID.OL],
    [TAG_NAMES.OPTGROUP, TAG_ID.OPTGROUP],
    [TAG_NAMES.OPTION, TAG_ID.OPTION],
    [TAG_NAMES.P, TAG_ID.P],
    [TAG_NAMES.PARAM, TAG_ID.PARAM],
    [TAG_NAMES.PLAINTEXT, TAG_ID.PLAINTEXT],
    [TAG_NAMES.PRE, TAG_ID.PRE],
    [TAG_NAMES.RB, TAG_ID.RB],
    [TAG_NAMES.RP, TAG_ID.RP],
    [TAG_NAMES.RT, TAG_ID.RT],
    [TAG_NAMES.RTC, TAG_ID.RTC],
    [TAG_NAMES.RUBY, TAG_ID.RUBY],
    [TAG_NAMES.S, TAG_ID.S],
    [TAG_NAMES.SCRIPT, TAG_ID.SCRIPT],
    [TAG_NAMES.SEARCH, TAG_ID.SEARCH],
    [TAG_NAMES.SECTION, TAG_ID.SECTION],
    [TAG_NAMES.SELECT, TAG_ID.SELECT],
    [TAG_NAMES.SOURCE, TAG_ID.SOURCE],
    [TAG_NAMES.SMALL, TAG_ID.SMALL],
    [TAG_NAMES.SPAN, TAG_ID.SPAN],
    [TAG_NAMES.STRIKE, TAG_ID.STRIKE],
    [TAG_NAMES.STRONG, TAG_ID.STRONG],
    [TAG_NAMES.STYLE, TAG_ID.STYLE],
    [TAG_NAMES.SUB, TAG_ID.SUB],
    [TAG_NAMES.SUMMARY, TAG_ID.SUMMARY],
    [TAG_NAMES.SUP, TAG_ID.SUP],
    [TAG_NAMES.TABLE, TAG_ID.TABLE],
    [TAG_NAMES.TBODY, TAG_ID.TBODY],
    [TAG_NAMES.TEMPLATE, TAG_ID.TEMPLATE],
    [TAG_NAMES.TEXTAREA, TAG_ID.TEXTAREA],
    [TAG_NAMES.TFOOT, TAG_ID.TFOOT],
    [TAG_NAMES.TD, TAG_ID.TD],
    [TAG_NAMES.TH, TAG_ID.TH],
    [TAG_NAMES.THEAD, TAG_ID.THEAD],
    [TAG_NAMES.TITLE, TAG_ID.TITLE],
    [TAG_NAMES.TR, TAG_ID.TR],
    [TAG_NAMES.TRACK, TAG_ID.TRACK],
    [TAG_NAMES.TT, TAG_ID.TT],
    [TAG_NAMES.U, TAG_ID.U],
    [TAG_NAMES.UL, TAG_ID.UL],
    [TAG_NAMES.SVG, TAG_ID.SVG],
    [TAG_NAMES.VAR, TAG_ID.VAR],
    [TAG_NAMES.WBR, TAG_ID.WBR],
    [TAG_NAMES.XMP, TAG_ID.XMP]
  ]);
  function getTagID(tagName2) {
    var _a3;
    return (_a3 = TAG_NAME_TO_ID.get(tagName2)) !== null && _a3 !== void 0 ? _a3 : TAG_ID.UNKNOWN;
  }
  var $ = TAG_ID;
  var SPECIAL_ELEMENTS = {
    [NS.HTML]: /* @__PURE__ */ new Set([
      $.ADDRESS,
      $.APPLET,
      $.AREA,
      $.ARTICLE,
      $.ASIDE,
      $.BASE,
      $.BASEFONT,
      $.BGSOUND,
      $.BLOCKQUOTE,
      $.BODY,
      $.BR,
      $.BUTTON,
      $.CAPTION,
      $.CENTER,
      $.COL,
      $.COLGROUP,
      $.DD,
      $.DETAILS,
      $.DIR,
      $.DIV,
      $.DL,
      $.DT,
      $.EMBED,
      $.FIELDSET,
      $.FIGCAPTION,
      $.FIGURE,
      $.FOOTER,
      $.FORM,
      $.FRAME,
      $.FRAMESET,
      $.H1,
      $.H2,
      $.H3,
      $.H4,
      $.H5,
      $.H6,
      $.HEAD,
      $.HEADER,
      $.HGROUP,
      $.HR,
      $.HTML,
      $.IFRAME,
      $.IMG,
      $.INPUT,
      $.LI,
      $.LINK,
      $.LISTING,
      $.MAIN,
      $.MARQUEE,
      $.MENU,
      $.META,
      $.NAV,
      $.NOEMBED,
      $.NOFRAMES,
      $.NOSCRIPT,
      $.OBJECT,
      $.OL,
      $.P,
      $.PARAM,
      $.PLAINTEXT,
      $.PRE,
      $.SCRIPT,
      $.SECTION,
      $.SELECT,
      $.SOURCE,
      $.STYLE,
      $.SUMMARY,
      $.TABLE,
      $.TBODY,
      $.TD,
      $.TEMPLATE,
      $.TEXTAREA,
      $.TFOOT,
      $.TH,
      $.THEAD,
      $.TITLE,
      $.TR,
      $.TRACK,
      $.UL,
      $.WBR,
      $.XMP
    ]),
    [NS.MATHML]: /* @__PURE__ */ new Set([$.MI, $.MO, $.MN, $.MS, $.MTEXT, $.ANNOTATION_XML]),
    [NS.SVG]: /* @__PURE__ */ new Set([$.TITLE, $.FOREIGN_OBJECT, $.DESC]),
    [NS.XLINK]: /* @__PURE__ */ new Set(),
    [NS.XML]: /* @__PURE__ */ new Set(),
    [NS.XMLNS]: /* @__PURE__ */ new Set()
  };
  var NUMBERED_HEADERS = /* @__PURE__ */ new Set([$.H1, $.H2, $.H3, $.H4, $.H5, $.H6]);
  var UNESCAPED_TEXT = /* @__PURE__ */ new Set([
    TAG_NAMES.STYLE,
    TAG_NAMES.SCRIPT,
    TAG_NAMES.XMP,
    TAG_NAMES.IFRAME,
    TAG_NAMES.NOEMBED,
    TAG_NAMES.NOFRAMES,
    TAG_NAMES.PLAINTEXT
  ]);
  function hasUnescapedText(tn, scriptingEnabled) {
    return UNESCAPED_TEXT.has(tn) || scriptingEnabled && tn === TAG_NAMES.NOSCRIPT;
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/tokenizer/index.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var State;
  (function(State2) {
    State2[State2["DATA"] = 0] = "DATA";
    State2[State2["RCDATA"] = 1] = "RCDATA";
    State2[State2["RAWTEXT"] = 2] = "RAWTEXT";
    State2[State2["SCRIPT_DATA"] = 3] = "SCRIPT_DATA";
    State2[State2["PLAINTEXT"] = 4] = "PLAINTEXT";
    State2[State2["TAG_OPEN"] = 5] = "TAG_OPEN";
    State2[State2["END_TAG_OPEN"] = 6] = "END_TAG_OPEN";
    State2[State2["TAG_NAME"] = 7] = "TAG_NAME";
    State2[State2["RCDATA_LESS_THAN_SIGN"] = 8] = "RCDATA_LESS_THAN_SIGN";
    State2[State2["RCDATA_END_TAG_OPEN"] = 9] = "RCDATA_END_TAG_OPEN";
    State2[State2["RCDATA_END_TAG_NAME"] = 10] = "RCDATA_END_TAG_NAME";
    State2[State2["RAWTEXT_LESS_THAN_SIGN"] = 11] = "RAWTEXT_LESS_THAN_SIGN";
    State2[State2["RAWTEXT_END_TAG_OPEN"] = 12] = "RAWTEXT_END_TAG_OPEN";
    State2[State2["RAWTEXT_END_TAG_NAME"] = 13] = "RAWTEXT_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_LESS_THAN_SIGN"] = 14] = "SCRIPT_DATA_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_END_TAG_OPEN"] = 15] = "SCRIPT_DATA_END_TAG_OPEN";
    State2[State2["SCRIPT_DATA_END_TAG_NAME"] = 16] = "SCRIPT_DATA_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_ESCAPE_START"] = 17] = "SCRIPT_DATA_ESCAPE_START";
    State2[State2["SCRIPT_DATA_ESCAPE_START_DASH"] = 18] = "SCRIPT_DATA_ESCAPE_START_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED"] = 19] = "SCRIPT_DATA_ESCAPED";
    State2[State2["SCRIPT_DATA_ESCAPED_DASH"] = 20] = "SCRIPT_DATA_ESCAPED_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED_DASH_DASH"] = 21] = "SCRIPT_DATA_ESCAPED_DASH_DASH";
    State2[State2["SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN"] = 22] = "SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_OPEN"] = 23] = "SCRIPT_DATA_ESCAPED_END_TAG_OPEN";
    State2[State2["SCRIPT_DATA_ESCAPED_END_TAG_NAME"] = 24] = "SCRIPT_DATA_ESCAPED_END_TAG_NAME";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_START"] = 25] = "SCRIPT_DATA_DOUBLE_ESCAPE_START";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED"] = 26] = "SCRIPT_DATA_DOUBLE_ESCAPED";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH"] = 27] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH"] = 28] = "SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN"] = 29] = "SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN";
    State2[State2["SCRIPT_DATA_DOUBLE_ESCAPE_END"] = 30] = "SCRIPT_DATA_DOUBLE_ESCAPE_END";
    State2[State2["BEFORE_ATTRIBUTE_NAME"] = 31] = "BEFORE_ATTRIBUTE_NAME";
    State2[State2["ATTRIBUTE_NAME"] = 32] = "ATTRIBUTE_NAME";
    State2[State2["AFTER_ATTRIBUTE_NAME"] = 33] = "AFTER_ATTRIBUTE_NAME";
    State2[State2["BEFORE_ATTRIBUTE_VALUE"] = 34] = "BEFORE_ATTRIBUTE_VALUE";
    State2[State2["ATTRIBUTE_VALUE_DOUBLE_QUOTED"] = 35] = "ATTRIBUTE_VALUE_DOUBLE_QUOTED";
    State2[State2["ATTRIBUTE_VALUE_SINGLE_QUOTED"] = 36] = "ATTRIBUTE_VALUE_SINGLE_QUOTED";
    State2[State2["ATTRIBUTE_VALUE_UNQUOTED"] = 37] = "ATTRIBUTE_VALUE_UNQUOTED";
    State2[State2["AFTER_ATTRIBUTE_VALUE_QUOTED"] = 38] = "AFTER_ATTRIBUTE_VALUE_QUOTED";
    State2[State2["SELF_CLOSING_START_TAG"] = 39] = "SELF_CLOSING_START_TAG";
    State2[State2["BOGUS_COMMENT"] = 40] = "BOGUS_COMMENT";
    State2[State2["MARKUP_DECLARATION_OPEN"] = 41] = "MARKUP_DECLARATION_OPEN";
    State2[State2["COMMENT_START"] = 42] = "COMMENT_START";
    State2[State2["COMMENT_START_DASH"] = 43] = "COMMENT_START_DASH";
    State2[State2["COMMENT"] = 44] = "COMMENT";
    State2[State2["COMMENT_LESS_THAN_SIGN"] = 45] = "COMMENT_LESS_THAN_SIGN";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG"] = 46] = "COMMENT_LESS_THAN_SIGN_BANG";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH"] = 47] = "COMMENT_LESS_THAN_SIGN_BANG_DASH";
    State2[State2["COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH"] = 48] = "COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH";
    State2[State2["COMMENT_END_DASH"] = 49] = "COMMENT_END_DASH";
    State2[State2["COMMENT_END"] = 50] = "COMMENT_END";
    State2[State2["COMMENT_END_BANG"] = 51] = "COMMENT_END_BANG";
    State2[State2["DOCTYPE"] = 52] = "DOCTYPE";
    State2[State2["BEFORE_DOCTYPE_NAME"] = 53] = "BEFORE_DOCTYPE_NAME";
    State2[State2["DOCTYPE_NAME"] = 54] = "DOCTYPE_NAME";
    State2[State2["AFTER_DOCTYPE_NAME"] = 55] = "AFTER_DOCTYPE_NAME";
    State2[State2["AFTER_DOCTYPE_PUBLIC_KEYWORD"] = 56] = "AFTER_DOCTYPE_PUBLIC_KEYWORD";
    State2[State2["BEFORE_DOCTYPE_PUBLIC_IDENTIFIER"] = 57] = "BEFORE_DOCTYPE_PUBLIC_IDENTIFIER";
    State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED"] = 58] = "DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED";
    State2[State2["DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED"] = 59] = "DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED";
    State2[State2["AFTER_DOCTYPE_PUBLIC_IDENTIFIER"] = 60] = "AFTER_DOCTYPE_PUBLIC_IDENTIFIER";
    State2[State2["BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS"] = 61] = "BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS";
    State2[State2["AFTER_DOCTYPE_SYSTEM_KEYWORD"] = 62] = "AFTER_DOCTYPE_SYSTEM_KEYWORD";
    State2[State2["BEFORE_DOCTYPE_SYSTEM_IDENTIFIER"] = 63] = "BEFORE_DOCTYPE_SYSTEM_IDENTIFIER";
    State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED"] = 64] = "DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED";
    State2[State2["DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED"] = 65] = "DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED";
    State2[State2["AFTER_DOCTYPE_SYSTEM_IDENTIFIER"] = 66] = "AFTER_DOCTYPE_SYSTEM_IDENTIFIER";
    State2[State2["BOGUS_DOCTYPE"] = 67] = "BOGUS_DOCTYPE";
    State2[State2["CDATA_SECTION"] = 68] = "CDATA_SECTION";
    State2[State2["CDATA_SECTION_BRACKET"] = 69] = "CDATA_SECTION_BRACKET";
    State2[State2["CDATA_SECTION_END"] = 70] = "CDATA_SECTION_END";
    State2[State2["CHARACTER_REFERENCE"] = 71] = "CHARACTER_REFERENCE";
    State2[State2["AMBIGUOUS_AMPERSAND"] = 72] = "AMBIGUOUS_AMPERSAND";
  })(State || (State = {}));
  var TokenizerMode = {
    DATA: State.DATA,
    RCDATA: State.RCDATA,
    RAWTEXT: State.RAWTEXT,
    SCRIPT_DATA: State.SCRIPT_DATA,
    PLAINTEXT: State.PLAINTEXT,
    CDATA_SECTION: State.CDATA_SECTION
  };
  function isAsciiDigit(cp) {
    return cp >= CODE_POINTS.DIGIT_0 && cp <= CODE_POINTS.DIGIT_9;
  }
  function isAsciiUpper(cp) {
    return cp >= CODE_POINTS.LATIN_CAPITAL_A && cp <= CODE_POINTS.LATIN_CAPITAL_Z;
  }
  function isAsciiLower(cp) {
    return cp >= CODE_POINTS.LATIN_SMALL_A && cp <= CODE_POINTS.LATIN_SMALL_Z;
  }
  function isAsciiLetter(cp) {
    return isAsciiLower(cp) || isAsciiUpper(cp);
  }
  function isAsciiAlphaNumeric2(cp) {
    return isAsciiLetter(cp) || isAsciiDigit(cp);
  }
  function toAsciiLower(cp) {
    return cp + 32;
  }
  function isWhitespace(cp) {
    return cp === CODE_POINTS.SPACE || cp === CODE_POINTS.LINE_FEED || cp === CODE_POINTS.TABULATION || cp === CODE_POINTS.FORM_FEED;
  }
  function isScriptDataDoubleEscapeSequenceEnd(cp) {
    return isWhitespace(cp) || cp === CODE_POINTS.SOLIDUS || cp === CODE_POINTS.GREATER_THAN_SIGN;
  }
  function getErrorForNumericCharacterReference(code) {
    if (code === CODE_POINTS.NULL) {
      return ERR.nullCharacterReference;
    } else if (code > 1114111) {
      return ERR.characterReferenceOutsideUnicodeRange;
    } else if (isSurrogate(code)) {
      return ERR.surrogateCharacterReference;
    } else if (isUndefinedCodePoint(code)) {
      return ERR.noncharacterCharacterReference;
    } else if (isControlCodePoint(code) || code === CODE_POINTS.CARRIAGE_RETURN) {
      return ERR.controlCharacterReference;
    }
    return null;
  }
  var Tokenizer = class {
    constructor(options, handler) {
      this.options = options;
      this.handler = handler;
      this.paused = false;
      this.inLoop = false;
      this.inForeignNode = false;
      this.lastStartTagName = "";
      this.active = false;
      this.state = State.DATA;
      this.returnState = State.DATA;
      this.entityStartPos = 0;
      this.consumedAfterSnapshot = -1;
      this.currentCharacterToken = null;
      this.currentToken = null;
      this.currentAttr = { name: "", value: "" };
      this.preprocessor = new Preprocessor(handler);
      this.currentLocation = this.getCurrentLocation(-1);
      this.entityDecoder = new EntityDecoder(htmlDecodeTree, (cp, consumed) => {
        this.preprocessor.pos = this.entityStartPos + consumed - 1;
        this._flushCodePointConsumedAsCharacterReference(cp);
      }, handler.onParseError ? {
        missingSemicolonAfterCharacterReference: () => {
          this._err(ERR.missingSemicolonAfterCharacterReference, 1);
        },
        absenceOfDigitsInNumericCharacterReference: (consumed) => {
          this._err(ERR.absenceOfDigitsInNumericCharacterReference, this.entityStartPos - this.preprocessor.pos + consumed);
        },
        validateNumericCharacterReference: (code) => {
          const error = getErrorForNumericCharacterReference(code);
          if (error)
            this._err(error, 1);
        }
      } : void 0);
    }
    //Errors
    _err(code, cpOffset = 0) {
      var _a3, _b2;
      (_b2 = (_a3 = this.handler).onParseError) === null || _b2 === void 0 ? void 0 : _b2.call(_a3, this.preprocessor.getError(code, cpOffset));
    }
    // NOTE: `offset` may never run across line boundaries.
    getCurrentLocation(offset) {
      if (!this.options.sourceCodeLocationInfo) {
        return null;
      }
      return {
        startLine: this.preprocessor.line,
        startCol: this.preprocessor.col - offset,
        startOffset: this.preprocessor.offset - offset,
        endLine: -1,
        endCol: -1,
        endOffset: -1
      };
    }
    _runParsingLoop() {
      if (this.inLoop)
        return;
      this.inLoop = true;
      while (this.active && !this.paused) {
        this.consumedAfterSnapshot = 0;
        const cp = this._consume();
        if (!this._ensureHibernation()) {
          this._callState(cp);
        }
      }
      this.inLoop = false;
    }
    //API
    pause() {
      this.paused = true;
    }
    resume(writeCallback) {
      if (!this.paused) {
        throw new Error("Parser was already resumed");
      }
      this.paused = false;
      if (this.inLoop)
        return;
      this._runParsingLoop();
      if (!this.paused) {
        writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
      }
    }
    write(chunk, isLastChunk, writeCallback) {
      this.active = true;
      this.preprocessor.write(chunk, isLastChunk);
      this._runParsingLoop();
      if (!this.paused) {
        writeCallback === null || writeCallback === void 0 ? void 0 : writeCallback();
      }
    }
    insertHtmlAtCurrentPos(chunk) {
      this.active = true;
      this.preprocessor.insertHtmlAtCurrentPos(chunk);
      this._runParsingLoop();
    }
    //Hibernation
    _ensureHibernation() {
      if (this.preprocessor.endOfChunkHit) {
        this.preprocessor.retreat(this.consumedAfterSnapshot);
        this.consumedAfterSnapshot = 0;
        this.active = false;
        return true;
      }
      return false;
    }
    //Consumption
    _consume() {
      this.consumedAfterSnapshot++;
      return this.preprocessor.advance();
    }
    _advanceBy(count) {
      this.consumedAfterSnapshot += count;
      for (let i = 0; i < count; i++) {
        this.preprocessor.advance();
      }
    }
    _consumeSequenceIfMatch(pattern, caseSensitive) {
      if (this.preprocessor.startsWith(pattern, caseSensitive)) {
        this._advanceBy(pattern.length - 1);
        return true;
      }
      return false;
    }
    //Token creation
    _createStartTagToken() {
      this.currentToken = {
        type: TokenType.START_TAG,
        tagName: "",
        tagID: TAG_ID.UNKNOWN,
        selfClosing: false,
        ackSelfClosing: false,
        attrs: [],
        location: this.getCurrentLocation(1)
      };
    }
    _createEndTagToken() {
      this.currentToken = {
        type: TokenType.END_TAG,
        tagName: "",
        tagID: TAG_ID.UNKNOWN,
        selfClosing: false,
        ackSelfClosing: false,
        attrs: [],
        location: this.getCurrentLocation(2)
      };
    }
    _createCommentToken(offset) {
      this.currentToken = {
        type: TokenType.COMMENT,
        data: "",
        location: this.getCurrentLocation(offset)
      };
    }
    _createDoctypeToken(initialName) {
      this.currentToken = {
        type: TokenType.DOCTYPE,
        name: initialName,
        forceQuirks: false,
        publicId: null,
        systemId: null,
        location: this.currentLocation
      };
    }
    _createCharacterToken(type, chars) {
      this.currentCharacterToken = {
        type,
        chars,
        location: this.currentLocation
      };
    }
    //Tag attributes
    _createAttr(attrNameFirstCh) {
      this.currentAttr = {
        name: attrNameFirstCh,
        value: ""
      };
      this.currentLocation = this.getCurrentLocation(0);
    }
    _leaveAttrName() {
      var _a3;
      var _b2;
      const token = this.currentToken;
      if (getTokenAttr(token, this.currentAttr.name) === null) {
        token.attrs.push(this.currentAttr);
        if (token.location && this.currentLocation) {
          const attrLocations = (_a3 = (_b2 = token.location).attrs) !== null && _a3 !== void 0 ? _a3 : _b2.attrs = /* @__PURE__ */ Object.create(null);
          attrLocations[this.currentAttr.name] = this.currentLocation;
          this._leaveAttrValue();
        }
      } else {
        this._err(ERR.duplicateAttribute);
      }
    }
    _leaveAttrValue() {
      if (this.currentLocation) {
        this.currentLocation.endLine = this.preprocessor.line;
        this.currentLocation.endCol = this.preprocessor.col;
        this.currentLocation.endOffset = this.preprocessor.offset;
      }
    }
    //Token emission
    prepareToken(ct) {
      this._emitCurrentCharacterToken(ct.location);
      this.currentToken = null;
      if (ct.location) {
        ct.location.endLine = this.preprocessor.line;
        ct.location.endCol = this.preprocessor.col + 1;
        ct.location.endOffset = this.preprocessor.offset + 1;
      }
      this.currentLocation = this.getCurrentLocation(-1);
    }
    emitCurrentTagToken() {
      const ct = this.currentToken;
      this.prepareToken(ct);
      ct.tagID = getTagID(ct.tagName);
      if (ct.type === TokenType.START_TAG) {
        this.lastStartTagName = ct.tagName;
        this.handler.onStartTag(ct);
      } else {
        if (ct.attrs.length > 0) {
          this._err(ERR.endTagWithAttributes);
        }
        if (ct.selfClosing) {
          this._err(ERR.endTagWithTrailingSolidus);
        }
        this.handler.onEndTag(ct);
      }
      this.preprocessor.dropParsedChunk();
    }
    emitCurrentComment(ct) {
      this.prepareToken(ct);
      this.handler.onComment(ct);
      this.preprocessor.dropParsedChunk();
    }
    emitCurrentDoctype(ct) {
      this.prepareToken(ct);
      this.handler.onDoctype(ct);
      this.preprocessor.dropParsedChunk();
    }
    _emitCurrentCharacterToken(nextLocation) {
      if (this.currentCharacterToken) {
        if (nextLocation && this.currentCharacterToken.location) {
          this.currentCharacterToken.location.endLine = nextLocation.startLine;
          this.currentCharacterToken.location.endCol = nextLocation.startCol;
          this.currentCharacterToken.location.endOffset = nextLocation.startOffset;
        }
        switch (this.currentCharacterToken.type) {
          case TokenType.CHARACTER: {
            this.handler.onCharacter(this.currentCharacterToken);
            break;
          }
          case TokenType.NULL_CHARACTER: {
            this.handler.onNullCharacter(this.currentCharacterToken);
            break;
          }
          case TokenType.WHITESPACE_CHARACTER: {
            this.handler.onWhitespaceCharacter(this.currentCharacterToken);
            break;
          }
        }
        this.currentCharacterToken = null;
      }
    }
    _emitEOFToken() {
      const location2 = this.getCurrentLocation(0);
      if (location2) {
        location2.endLine = location2.startLine;
        location2.endCol = location2.startCol;
        location2.endOffset = location2.startOffset;
      }
      this._emitCurrentCharacterToken(location2);
      this.handler.onEof({ type: TokenType.EOF, location: location2 });
      this.active = false;
    }
    //Characters emission
    //OPTIMIZATION: The specification uses only one type of character token (one token per character).
    //This causes a huge memory overhead and a lot of unnecessary parser loops. parse5 uses 3 groups of characters.
    //If we have a sequence of characters that belong to the same group, the parser can process it
    //as a single solid character token.
    //So, there are 3 types of character tokens in parse5:
    //1)TokenType.NULL_CHARACTER - \u0000-character sequences (e.g. '\u0000\u0000\u0000')
    //2)TokenType.WHITESPACE_CHARACTER - any whitespace/new-line character sequences (e.g. '\n  \r\t   \f')
    //3)TokenType.CHARACTER - any character sequence which don't belong to groups 1 and 2 (e.g. 'abcdef1234@@#$%^')
    _appendCharToCurrentCharacterToken(type, ch) {
      if (this.currentCharacterToken) {
        if (this.currentCharacterToken.type === type) {
          this.currentCharacterToken.chars += ch;
          return;
        } else {
          this.currentLocation = this.getCurrentLocation(0);
          this._emitCurrentCharacterToken(this.currentLocation);
          this.preprocessor.dropParsedChunk();
        }
      }
      this._createCharacterToken(type, ch);
    }
    _emitCodePoint(cp) {
      const type = isWhitespace(cp) ? TokenType.WHITESPACE_CHARACTER : cp === CODE_POINTS.NULL ? TokenType.NULL_CHARACTER : TokenType.CHARACTER;
      this._appendCharToCurrentCharacterToken(type, String.fromCodePoint(cp));
    }
    //NOTE: used when we emit characters explicitly.
    //This is always for non-whitespace and non-null characters, which allows us to avoid additional checks.
    _emitChars(ch) {
      this._appendCharToCurrentCharacterToken(TokenType.CHARACTER, ch);
    }
    // Character reference helpers
    _startCharacterReference() {
      this.returnState = this.state;
      this.state = State.CHARACTER_REFERENCE;
      this.entityStartPos = this.preprocessor.pos;
      this.entityDecoder.startEntity(this._isCharacterReferenceInAttribute() ? DecodingMode.Attribute : DecodingMode.Legacy);
    }
    _isCharacterReferenceInAttribute() {
      return this.returnState === State.ATTRIBUTE_VALUE_DOUBLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_SINGLE_QUOTED || this.returnState === State.ATTRIBUTE_VALUE_UNQUOTED;
    }
    _flushCodePointConsumedAsCharacterReference(cp) {
      if (this._isCharacterReferenceInAttribute()) {
        this.currentAttr.value += String.fromCodePoint(cp);
      } else {
        this._emitCodePoint(cp);
      }
    }
    // Calling states this way turns out to be much faster than any other approach.
    _callState(cp) {
      switch (this.state) {
        case State.DATA: {
          this._stateData(cp);
          break;
        }
        case State.RCDATA: {
          this._stateRcdata(cp);
          break;
        }
        case State.RAWTEXT: {
          this._stateRawtext(cp);
          break;
        }
        case State.SCRIPT_DATA: {
          this._stateScriptData(cp);
          break;
        }
        case State.PLAINTEXT: {
          this._statePlaintext(cp);
          break;
        }
        case State.TAG_OPEN: {
          this._stateTagOpen(cp);
          break;
        }
        case State.END_TAG_OPEN: {
          this._stateEndTagOpen(cp);
          break;
        }
        case State.TAG_NAME: {
          this._stateTagName(cp);
          break;
        }
        case State.RCDATA_LESS_THAN_SIGN: {
          this._stateRcdataLessThanSign(cp);
          break;
        }
        case State.RCDATA_END_TAG_OPEN: {
          this._stateRcdataEndTagOpen(cp);
          break;
        }
        case State.RCDATA_END_TAG_NAME: {
          this._stateRcdataEndTagName(cp);
          break;
        }
        case State.RAWTEXT_LESS_THAN_SIGN: {
          this._stateRawtextLessThanSign(cp);
          break;
        }
        case State.RAWTEXT_END_TAG_OPEN: {
          this._stateRawtextEndTagOpen(cp);
          break;
        }
        case State.RAWTEXT_END_TAG_NAME: {
          this._stateRawtextEndTagName(cp);
          break;
        }
        case State.SCRIPT_DATA_LESS_THAN_SIGN: {
          this._stateScriptDataLessThanSign(cp);
          break;
        }
        case State.SCRIPT_DATA_END_TAG_OPEN: {
          this._stateScriptDataEndTagOpen(cp);
          break;
        }
        case State.SCRIPT_DATA_END_TAG_NAME: {
          this._stateScriptDataEndTagName(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPE_START: {
          this._stateScriptDataEscapeStart(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPE_START_DASH: {
          this._stateScriptDataEscapeStartDash(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED: {
          this._stateScriptDataEscaped(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED_DASH: {
          this._stateScriptDataEscapedDash(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED_DASH_DASH: {
          this._stateScriptDataEscapedDashDash(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN: {
          this._stateScriptDataEscapedLessThanSign(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN: {
          this._stateScriptDataEscapedEndTagOpen(cp);
          break;
        }
        case State.SCRIPT_DATA_ESCAPED_END_TAG_NAME: {
          this._stateScriptDataEscapedEndTagName(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPE_START: {
          this._stateScriptDataDoubleEscapeStart(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPED: {
          this._stateScriptDataDoubleEscaped(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH: {
          this._stateScriptDataDoubleEscapedDash(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH: {
          this._stateScriptDataDoubleEscapedDashDash(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN: {
          this._stateScriptDataDoubleEscapedLessThanSign(cp);
          break;
        }
        case State.SCRIPT_DATA_DOUBLE_ESCAPE_END: {
          this._stateScriptDataDoubleEscapeEnd(cp);
          break;
        }
        case State.BEFORE_ATTRIBUTE_NAME: {
          this._stateBeforeAttributeName(cp);
          break;
        }
        case State.ATTRIBUTE_NAME: {
          this._stateAttributeName(cp);
          break;
        }
        case State.AFTER_ATTRIBUTE_NAME: {
          this._stateAfterAttributeName(cp);
          break;
        }
        case State.BEFORE_ATTRIBUTE_VALUE: {
          this._stateBeforeAttributeValue(cp);
          break;
        }
        case State.ATTRIBUTE_VALUE_DOUBLE_QUOTED: {
          this._stateAttributeValueDoubleQuoted(cp);
          break;
        }
        case State.ATTRIBUTE_VALUE_SINGLE_QUOTED: {
          this._stateAttributeValueSingleQuoted(cp);
          break;
        }
        case State.ATTRIBUTE_VALUE_UNQUOTED: {
          this._stateAttributeValueUnquoted(cp);
          break;
        }
        case State.AFTER_ATTRIBUTE_VALUE_QUOTED: {
          this._stateAfterAttributeValueQuoted(cp);
          break;
        }
        case State.SELF_CLOSING_START_TAG: {
          this._stateSelfClosingStartTag(cp);
          break;
        }
        case State.BOGUS_COMMENT: {
          this._stateBogusComment(cp);
          break;
        }
        case State.MARKUP_DECLARATION_OPEN: {
          this._stateMarkupDeclarationOpen(cp);
          break;
        }
        case State.COMMENT_START: {
          this._stateCommentStart(cp);
          break;
        }
        case State.COMMENT_START_DASH: {
          this._stateCommentStartDash(cp);
          break;
        }
        case State.COMMENT: {
          this._stateComment(cp);
          break;
        }
        case State.COMMENT_LESS_THAN_SIGN: {
          this._stateCommentLessThanSign(cp);
          break;
        }
        case State.COMMENT_LESS_THAN_SIGN_BANG: {
          this._stateCommentLessThanSignBang(cp);
          break;
        }
        case State.COMMENT_LESS_THAN_SIGN_BANG_DASH: {
          this._stateCommentLessThanSignBangDash(cp);
          break;
        }
        case State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH: {
          this._stateCommentLessThanSignBangDashDash(cp);
          break;
        }
        case State.COMMENT_END_DASH: {
          this._stateCommentEndDash(cp);
          break;
        }
        case State.COMMENT_END: {
          this._stateCommentEnd(cp);
          break;
        }
        case State.COMMENT_END_BANG: {
          this._stateCommentEndBang(cp);
          break;
        }
        case State.DOCTYPE: {
          this._stateDoctype(cp);
          break;
        }
        case State.BEFORE_DOCTYPE_NAME: {
          this._stateBeforeDoctypeName(cp);
          break;
        }
        case State.DOCTYPE_NAME: {
          this._stateDoctypeName(cp);
          break;
        }
        case State.AFTER_DOCTYPE_NAME: {
          this._stateAfterDoctypeName(cp);
          break;
        }
        case State.AFTER_DOCTYPE_PUBLIC_KEYWORD: {
          this._stateAfterDoctypePublicKeyword(cp);
          break;
        }
        case State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER: {
          this._stateBeforeDoctypePublicIdentifier(cp);
          break;
        }
        case State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED: {
          this._stateDoctypePublicIdentifierDoubleQuoted(cp);
          break;
        }
        case State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED: {
          this._stateDoctypePublicIdentifierSingleQuoted(cp);
          break;
        }
        case State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER: {
          this._stateAfterDoctypePublicIdentifier(cp);
          break;
        }
        case State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS: {
          this._stateBetweenDoctypePublicAndSystemIdentifiers(cp);
          break;
        }
        case State.AFTER_DOCTYPE_SYSTEM_KEYWORD: {
          this._stateAfterDoctypeSystemKeyword(cp);
          break;
        }
        case State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER: {
          this._stateBeforeDoctypeSystemIdentifier(cp);
          break;
        }
        case State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED: {
          this._stateDoctypeSystemIdentifierDoubleQuoted(cp);
          break;
        }
        case State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED: {
          this._stateDoctypeSystemIdentifierSingleQuoted(cp);
          break;
        }
        case State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER: {
          this._stateAfterDoctypeSystemIdentifier(cp);
          break;
        }
        case State.BOGUS_DOCTYPE: {
          this._stateBogusDoctype(cp);
          break;
        }
        case State.CDATA_SECTION: {
          this._stateCdataSection(cp);
          break;
        }
        case State.CDATA_SECTION_BRACKET: {
          this._stateCdataSectionBracket(cp);
          break;
        }
        case State.CDATA_SECTION_END: {
          this._stateCdataSectionEnd(cp);
          break;
        }
        case State.CHARACTER_REFERENCE: {
          this._stateCharacterReference();
          break;
        }
        case State.AMBIGUOUS_AMPERSAND: {
          this._stateAmbiguousAmpersand(cp);
          break;
        }
        default: {
          throw new Error("Unknown state");
        }
      }
    }
    // State machine
    // Data state
    //------------------------------------------------------------------
    _stateData(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.TAG_OPEN;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this._startCharacterReference();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitCodePoint(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    //  RCDATA state
    //------------------------------------------------------------------
    _stateRcdata(cp) {
      switch (cp) {
        case CODE_POINTS.AMPERSAND: {
          this._startCharacterReference();
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.RCDATA_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // RAWTEXT state
    //------------------------------------------------------------------
    _stateRawtext(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.RAWTEXT_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data state
    //------------------------------------------------------------------
    _stateScriptData(cp) {
      switch (cp) {
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // PLAINTEXT state
    //------------------------------------------------------------------
    _statePlaintext(cp) {
      switch (cp) {
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Tag open state
    //------------------------------------------------------------------
    _stateTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this._createStartTagToken();
        this.state = State.TAG_NAME;
        this._stateTagName(cp);
      } else
        switch (cp) {
          case CODE_POINTS.EXCLAMATION_MARK: {
            this.state = State.MARKUP_DECLARATION_OPEN;
            break;
          }
          case CODE_POINTS.SOLIDUS: {
            this.state = State.END_TAG_OPEN;
            break;
          }
          case CODE_POINTS.QUESTION_MARK: {
            this._err(ERR.unexpectedQuestionMarkInsteadOfTagName);
            this._createCommentToken(1);
            this.state = State.BOGUS_COMMENT;
            this._stateBogusComment(cp);
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofBeforeTagName);
            this._emitChars("<");
            this._emitEOFToken();
            break;
          }
          default: {
            this._err(ERR.invalidFirstCharacterOfTagName);
            this._emitChars("<");
            this.state = State.DATA;
            this._stateData(cp);
          }
        }
    }
    // End tag open state
    //------------------------------------------------------------------
    _stateEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this._createEndTagToken();
        this.state = State.TAG_NAME;
        this._stateTagName(cp);
      } else
        switch (cp) {
          case CODE_POINTS.GREATER_THAN_SIGN: {
            this._err(ERR.missingEndTagName);
            this.state = State.DATA;
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofBeforeTagName);
            this._emitChars("</");
            this._emitEOFToken();
            break;
          }
          default: {
            this._err(ERR.invalidFirstCharacterOfTagName);
            this._createCommentToken(2);
            this.state = State.BOGUS_COMMENT;
            this._stateBogusComment(cp);
          }
        }
    }
    // Tag name state
    //------------------------------------------------------------------
    _stateTagName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.tagName += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          token.tagName += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // RCDATA less-than sign state
    //------------------------------------------------------------------
    _stateRcdataLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State.RCDATA_END_TAG_OPEN;
      } else {
        this._emitChars("<");
        this.state = State.RCDATA;
        this._stateRcdata(cp);
      }
    }
    // RCDATA end tag open state
    //------------------------------------------------------------------
    _stateRcdataEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State.RCDATA_END_TAG_NAME;
        this._stateRcdataEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State.RCDATA;
        this._stateRcdata(cp);
      }
    }
    handleSpecialEndTag(_cp) {
      if (!this.preprocessor.startsWith(this.lastStartTagName, false)) {
        return !this._ensureHibernation();
      }
      this._createEndTagToken();
      const token = this.currentToken;
      token.tagName = this.lastStartTagName;
      const cp = this.preprocessor.peek(this.lastStartTagName.length);
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._advanceBy(this.lastStartTagName.length);
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          return false;
        }
        case CODE_POINTS.SOLIDUS: {
          this._advanceBy(this.lastStartTagName.length);
          this.state = State.SELF_CLOSING_START_TAG;
          return false;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._advanceBy(this.lastStartTagName.length);
          this.emitCurrentTagToken();
          this.state = State.DATA;
          return false;
        }
        default: {
          return !this._ensureHibernation();
        }
      }
    }
    // RCDATA end tag name state
    //------------------------------------------------------------------
    _stateRcdataEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State.RCDATA;
        this._stateRcdata(cp);
      }
    }
    // RAWTEXT less-than sign state
    //------------------------------------------------------------------
    _stateRawtextLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State.RAWTEXT_END_TAG_OPEN;
      } else {
        this._emitChars("<");
        this.state = State.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // RAWTEXT end tag open state
    //------------------------------------------------------------------
    _stateRawtextEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State.RAWTEXT_END_TAG_NAME;
        this._stateRawtextEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // RAWTEXT end tag name state
    //------------------------------------------------------------------
    _stateRawtextEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State.RAWTEXT;
        this._stateRawtext(cp);
      }
    }
    // Script data less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataLessThanSign(cp) {
      switch (cp) {
        case CODE_POINTS.SOLIDUS: {
          this.state = State.SCRIPT_DATA_END_TAG_OPEN;
          break;
        }
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State.SCRIPT_DATA_ESCAPE_START;
          this._emitChars("<!");
          break;
        }
        default: {
          this._emitChars("<");
          this.state = State.SCRIPT_DATA;
          this._stateScriptData(cp);
        }
      }
    }
    // Script data end tag open state
    //------------------------------------------------------------------
    _stateScriptDataEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State.SCRIPT_DATA_END_TAG_NAME;
        this._stateScriptDataEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data end tag name state
    //------------------------------------------------------------------
    _stateScriptDataEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escape start state
    //------------------------------------------------------------------
    _stateScriptDataEscapeStart(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State.SCRIPT_DATA_ESCAPE_START_DASH;
        this._emitChars("-");
      } else {
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escape start dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapeStartDash(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
        this._emitChars("-");
      } else {
        this.state = State.SCRIPT_DATA;
        this._stateScriptData(cp);
      }
    }
    // Script data escaped state
    //------------------------------------------------------------------
    _stateScriptDataEscaped(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.SCRIPT_DATA_ESCAPED_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapedDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.SCRIPT_DATA_ESCAPED_DASH_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State.SCRIPT_DATA_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State.SCRIPT_DATA_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped dash dash state
    //------------------------------------------------------------------
    _stateScriptDataEscapedDashDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_ESCAPED_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.SCRIPT_DATA;
          this._emitChars(">");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State.SCRIPT_DATA_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State.SCRIPT_DATA_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data escaped less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataEscapedLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_OPEN;
      } else if (isAsciiLetter(cp)) {
        this._emitChars("<");
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_START;
        this._stateScriptDataDoubleEscapeStart(cp);
      } else {
        this._emitChars("<");
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data escaped end tag open state
    //------------------------------------------------------------------
    _stateScriptDataEscapedEndTagOpen(cp) {
      if (isAsciiLetter(cp)) {
        this.state = State.SCRIPT_DATA_ESCAPED_END_TAG_NAME;
        this._stateScriptDataEscapedEndTagName(cp);
      } else {
        this._emitChars("</");
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data escaped end tag name state
    //------------------------------------------------------------------
    _stateScriptDataEscapedEndTagName(cp) {
      if (this.handleSpecialEndTag(cp)) {
        this._emitChars("</");
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data double escape start state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapeStart(cp) {
      if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
        this._emitCodePoint(cp);
        for (let i = 0; i < SEQUENCES.SCRIPT.length; i++) {
          this._emitCodePoint(this._consume());
        }
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
      } else if (!this._ensureHibernation()) {
        this.state = State.SCRIPT_DATA_ESCAPED;
        this._stateScriptDataEscaped(cp);
      }
    }
    // Script data double escaped state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscaped(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped dash state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_DASH_DASH;
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped dash dash state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedDashDash(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this._emitChars("-");
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED_LESS_THAN_SIGN;
          this._emitChars("<");
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.SCRIPT_DATA;
          this._emitChars(">");
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitChars(REPLACEMENT_CHARACTER);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInScriptHtmlCommentLikeText);
          this._emitEOFToken();
          break;
        }
        default: {
          this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
          this._emitCodePoint(cp);
        }
      }
    }
    // Script data double escaped less-than sign state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapedLessThanSign(cp) {
      if (cp === CODE_POINTS.SOLIDUS) {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPE_END;
        this._emitChars("/");
      } else {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._stateScriptDataDoubleEscaped(cp);
      }
    }
    // Script data double escape end state
    //------------------------------------------------------------------
    _stateScriptDataDoubleEscapeEnd(cp) {
      if (this.preprocessor.startsWith(SEQUENCES.SCRIPT, false) && isScriptDataDoubleEscapeSequenceEnd(this.preprocessor.peek(SEQUENCES.SCRIPT.length))) {
        this._emitCodePoint(cp);
        for (let i = 0; i < SEQUENCES.SCRIPT.length; i++) {
          this._emitCodePoint(this._consume());
        }
        this.state = State.SCRIPT_DATA_ESCAPED;
      } else if (!this._ensureHibernation()) {
        this.state = State.SCRIPT_DATA_DOUBLE_ESCAPED;
        this._stateScriptDataDoubleEscaped(cp);
      }
    }
    // Before attribute name state
    //------------------------------------------------------------------
    _stateBeforeAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.SOLIDUS:
        case CODE_POINTS.GREATER_THAN_SIGN:
        case CODE_POINTS.EOF: {
          this.state = State.AFTER_ATTRIBUTE_NAME;
          this._stateAfterAttributeName(cp);
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this._err(ERR.unexpectedEqualsSignBeforeAttributeName);
          this._createAttr("=");
          this.state = State.ATTRIBUTE_NAME;
          break;
        }
        default: {
          this._createAttr("");
          this.state = State.ATTRIBUTE_NAME;
          this._stateAttributeName(cp);
        }
      }
    }
    // Attribute name state
    //------------------------------------------------------------------
    _stateAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED:
        case CODE_POINTS.SOLIDUS:
        case CODE_POINTS.GREATER_THAN_SIGN:
        case CODE_POINTS.EOF: {
          this._leaveAttrName();
          this.state = State.AFTER_ATTRIBUTE_NAME;
          this._stateAfterAttributeName(cp);
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this._leaveAttrName();
          this.state = State.BEFORE_ATTRIBUTE_VALUE;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK:
        case CODE_POINTS.APOSTROPHE:
        case CODE_POINTS.LESS_THAN_SIGN: {
          this._err(ERR.unexpectedCharacterInAttributeName);
          this.currentAttr.name += String.fromCodePoint(cp);
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.name += REPLACEMENT_CHARACTER;
          break;
        }
        default: {
          this.currentAttr.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // After attribute name state
    //------------------------------------------------------------------
    _stateAfterAttributeName(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this.state = State.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.EQUALS_SIGN: {
          this.state = State.BEFORE_ATTRIBUTE_VALUE;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._createAttr("");
          this.state = State.ATTRIBUTE_NAME;
          this._stateAttributeName(cp);
        }
      }
    }
    // Before attribute value state
    //------------------------------------------------------------------
    _stateBeforeAttributeValue(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State.ATTRIBUTE_VALUE_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this.state = State.ATTRIBUTE_VALUE_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingAttributeValue);
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        default: {
          this.state = State.ATTRIBUTE_VALUE_UNQUOTED;
          this._stateAttributeValueUnquoted(cp);
        }
      }
    }
    // Attribute value (double-quoted) state
    //------------------------------------------------------------------
    _stateAttributeValueDoubleQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this._startCharacterReference();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // Attribute value (single-quoted) state
    //------------------------------------------------------------------
    _stateAttributeValueSingleQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State.AFTER_ATTRIBUTE_VALUE_QUOTED;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this._startCharacterReference();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // Attribute value (unquoted) state
    //------------------------------------------------------------------
    _stateAttributeValueUnquoted(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._leaveAttrValue();
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.AMPERSAND: {
          this._startCharacterReference();
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._leaveAttrValue();
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          this.currentAttr.value += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK:
        case CODE_POINTS.APOSTROPHE:
        case CODE_POINTS.LESS_THAN_SIGN:
        case CODE_POINTS.EQUALS_SIGN:
        case CODE_POINTS.GRAVE_ACCENT: {
          this._err(ERR.unexpectedCharacterInUnquotedAttributeValue);
          this.currentAttr.value += String.fromCodePoint(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this.currentAttr.value += String.fromCodePoint(cp);
        }
      }
    }
    // After attribute value (quoted) state
    //------------------------------------------------------------------
    _stateAfterAttributeValueQuoted(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this._leaveAttrValue();
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          break;
        }
        case CODE_POINTS.SOLIDUS: {
          this._leaveAttrValue();
          this.state = State.SELF_CLOSING_START_TAG;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._leaveAttrValue();
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingWhitespaceBetweenAttributes);
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          this._stateBeforeAttributeName(cp);
        }
      }
    }
    // Self-closing start tag state
    //------------------------------------------------------------------
    _stateSelfClosingStartTag(cp) {
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          const token = this.currentToken;
          token.selfClosing = true;
          this.state = State.DATA;
          this.emitCurrentTagToken();
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInTag);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.unexpectedSolidusInTag);
          this.state = State.BEFORE_ATTRIBUTE_NAME;
          this._stateBeforeAttributeName(cp);
        }
      }
    }
    // Bogus comment state
    //------------------------------------------------------------------
    _stateBogusComment(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.data += REPLACEMENT_CHARACTER;
          break;
        }
        default: {
          token.data += String.fromCodePoint(cp);
        }
      }
    }
    // Markup declaration open state
    //------------------------------------------------------------------
    _stateMarkupDeclarationOpen(cp) {
      if (this._consumeSequenceIfMatch(SEQUENCES.DASH_DASH, true)) {
        this._createCommentToken(SEQUENCES.DASH_DASH.length + 1);
        this.state = State.COMMENT_START;
      } else if (this._consumeSequenceIfMatch(SEQUENCES.DOCTYPE, false)) {
        this.currentLocation = this.getCurrentLocation(SEQUENCES.DOCTYPE.length + 1);
        this.state = State.DOCTYPE;
      } else if (this._consumeSequenceIfMatch(SEQUENCES.CDATA_START, true)) {
        if (this.inForeignNode) {
          this.state = State.CDATA_SECTION;
        } else {
          this._err(ERR.cdataInHtmlContent);
          this._createCommentToken(SEQUENCES.CDATA_START.length + 1);
          this.currentToken.data = "[CDATA[";
          this.state = State.BOGUS_COMMENT;
        }
      } else if (!this._ensureHibernation()) {
        this._err(ERR.incorrectlyOpenedComment);
        this._createCommentToken(2);
        this.state = State.BOGUS_COMMENT;
        this._stateBogusComment(cp);
      }
    }
    // Comment start state
    //------------------------------------------------------------------
    _stateCommentStart(cp) {
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.COMMENT_START_DASH;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptClosingOfEmptyComment);
          this.state = State.DATA;
          const token = this.currentToken;
          this.emitCurrentComment(token);
          break;
        }
        default: {
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment start dash state
    //------------------------------------------------------------------
    _stateCommentStartDash(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.COMMENT_END;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptClosingOfEmptyComment);
          this.state = State.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "-";
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment state
    //------------------------------------------------------------------
    _stateComment(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.COMMENT_END_DASH;
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          token.data += "<";
          this.state = State.COMMENT_LESS_THAN_SIGN;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.data += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += String.fromCodePoint(cp);
        }
      }
    }
    // Comment less-than sign state
    //------------------------------------------------------------------
    _stateCommentLessThanSign(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.EXCLAMATION_MARK: {
          token.data += "!";
          this.state = State.COMMENT_LESS_THAN_SIGN_BANG;
          break;
        }
        case CODE_POINTS.LESS_THAN_SIGN: {
          token.data += "<";
          break;
        }
        default: {
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment less-than sign bang state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBang(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH;
      } else {
        this.state = State.COMMENT;
        this._stateComment(cp);
      }
    }
    // Comment less-than sign bang dash state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBangDash(cp) {
      if (cp === CODE_POINTS.HYPHEN_MINUS) {
        this.state = State.COMMENT_LESS_THAN_SIGN_BANG_DASH_DASH;
      } else {
        this.state = State.COMMENT_END_DASH;
        this._stateCommentEndDash(cp);
      }
    }
    // Comment less-than sign bang dash dash state
    //------------------------------------------------------------------
    _stateCommentLessThanSignBangDashDash(cp) {
      if (cp !== CODE_POINTS.GREATER_THAN_SIGN && cp !== CODE_POINTS.EOF) {
        this._err(ERR.nestedComment);
      }
      this.state = State.COMMENT_END;
      this._stateCommentEnd(cp);
    }
    // Comment end dash state
    //------------------------------------------------------------------
    _stateCommentEndDash(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          this.state = State.COMMENT_END;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "-";
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment end state
    //------------------------------------------------------------------
    _stateCommentEnd(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EXCLAMATION_MARK: {
          this.state = State.COMMENT_END_BANG;
          break;
        }
        case CODE_POINTS.HYPHEN_MINUS: {
          token.data += "-";
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "--";
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // Comment end bang state
    //------------------------------------------------------------------
    _stateCommentEndBang(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.HYPHEN_MINUS: {
          token.data += "--!";
          this.state = State.COMMENT_END_DASH;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.incorrectlyClosedComment);
          this.state = State.DATA;
          this.emitCurrentComment(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInComment);
          this.emitCurrentComment(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.data += "--!";
          this.state = State.COMMENT;
          this._stateComment(cp);
        }
      }
    }
    // DOCTYPE state
    //------------------------------------------------------------------
    _stateDoctype(cp) {
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.BEFORE_DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.BEFORE_DOCTYPE_NAME;
          this._stateBeforeDoctypeName(cp);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          this._createDoctypeToken(null);
          const token = this.currentToken;
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingWhitespaceBeforeDoctypeName);
          this.state = State.BEFORE_DOCTYPE_NAME;
          this._stateBeforeDoctypeName(cp);
        }
      }
    }
    // Before DOCTYPE name state
    //------------------------------------------------------------------
    _stateBeforeDoctypeName(cp) {
      if (isAsciiUpper(cp)) {
        this._createDoctypeToken(String.fromCharCode(toAsciiLower(cp)));
        this.state = State.DOCTYPE_NAME;
      } else
        switch (cp) {
          case CODE_POINTS.SPACE:
          case CODE_POINTS.LINE_FEED:
          case CODE_POINTS.TABULATION:
          case CODE_POINTS.FORM_FEED: {
            break;
          }
          case CODE_POINTS.NULL: {
            this._err(ERR.unexpectedNullCharacter);
            this._createDoctypeToken(REPLACEMENT_CHARACTER);
            this.state = State.DOCTYPE_NAME;
            break;
          }
          case CODE_POINTS.GREATER_THAN_SIGN: {
            this._err(ERR.missingDoctypeName);
            this._createDoctypeToken(null);
            const token = this.currentToken;
            token.forceQuirks = true;
            this.emitCurrentDoctype(token);
            this.state = State.DATA;
            break;
          }
          case CODE_POINTS.EOF: {
            this._err(ERR.eofInDoctype);
            this._createDoctypeToken(null);
            const token = this.currentToken;
            token.forceQuirks = true;
            this.emitCurrentDoctype(token);
            this._emitEOFToken();
            break;
          }
          default: {
            this._createDoctypeToken(String.fromCodePoint(cp));
            this.state = State.DOCTYPE_NAME;
          }
        }
    }
    // DOCTYPE name state
    //------------------------------------------------------------------
    _stateDoctypeName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.AFTER_DOCTYPE_NAME;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.name += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.name += String.fromCodePoint(isAsciiUpper(cp) ? toAsciiLower(cp) : cp);
        }
      }
    }
    // After DOCTYPE name state
    //------------------------------------------------------------------
    _stateAfterDoctypeName(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          if (this._consumeSequenceIfMatch(SEQUENCES.PUBLIC, false)) {
            this.state = State.AFTER_DOCTYPE_PUBLIC_KEYWORD;
          } else if (this._consumeSequenceIfMatch(SEQUENCES.SYSTEM, false)) {
            this.state = State.AFTER_DOCTYPE_SYSTEM_KEYWORD;
          } else if (!this._ensureHibernation()) {
            this._err(ERR.invalidCharacterSequenceAfterDoctypeName);
            token.forceQuirks = true;
            this.state = State.BOGUS_DOCTYPE;
            this._stateBogusDoctype(cp);
          }
        }
      }
    }
    // After DOCTYPE public keyword state
    //------------------------------------------------------------------
    _stateAfterDoctypePublicKeyword(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.BEFORE_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
          token.publicId = "";
          this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceAfterDoctypePublicKeyword);
          token.publicId = "";
          this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Before DOCTYPE public identifier state
    //------------------------------------------------------------------
    _stateBeforeDoctypePublicIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.publicId = "";
          this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.publicId = "";
          this.state = State.DOCTYPE_PUBLIC_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // DOCTYPE public identifier (double-quoted) state
    //------------------------------------------------------------------
    _stateDoctypePublicIdentifierDoubleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.publicId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.publicId += String.fromCodePoint(cp);
        }
      }
    }
    // DOCTYPE public identifier (single-quoted) state
    //------------------------------------------------------------------
    _stateDoctypePublicIdentifierSingleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State.AFTER_DOCTYPE_PUBLIC_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.publicId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypePublicIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.publicId += String.fromCodePoint(cp);
        }
      }
    }
    // After DOCTYPE public identifier state
    //------------------------------------------------------------------
    _stateAfterDoctypePublicIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.BETWEEN_DOCTYPE_PUBLIC_AND_SYSTEM_IDENTIFIERS;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceBetweenDoctypePublicAndSystemIdentifiers);
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Between DOCTYPE public and system identifiers state
    //------------------------------------------------------------------
    _stateBetweenDoctypePublicAndSystemIdentifiers(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // After DOCTYPE system keyword state
    //------------------------------------------------------------------
    _stateAfterDoctypeSystemKeyword(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          this.state = State.BEFORE_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          this._err(ERR.missingWhitespaceAfterDoctypeSystemKeyword);
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Before DOCTYPE system identifier state
    //------------------------------------------------------------------
    _stateBeforeDoctypeSystemIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.QUOTATION_MARK: {
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_DOUBLE_QUOTED;
          break;
        }
        case CODE_POINTS.APOSTROPHE: {
          token.systemId = "";
          this.state = State.DOCTYPE_SYSTEM_IDENTIFIER_SINGLE_QUOTED;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.missingDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.DATA;
          this.emitCurrentDoctype(token);
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.missingQuoteBeforeDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // DOCTYPE system identifier (double-quoted) state
    //------------------------------------------------------------------
    _stateDoctypeSystemIdentifierDoubleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.QUOTATION_MARK: {
          this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.systemId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.systemId += String.fromCodePoint(cp);
        }
      }
    }
    // DOCTYPE system identifier (single-quoted) state
    //------------------------------------------------------------------
    _stateDoctypeSystemIdentifierSingleQuoted(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.APOSTROPHE: {
          this.state = State.AFTER_DOCTYPE_SYSTEM_IDENTIFIER;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          token.systemId += REPLACEMENT_CHARACTER;
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this._err(ERR.abruptDoctypeSystemIdentifier);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          token.systemId += String.fromCodePoint(cp);
        }
      }
    }
    // After DOCTYPE system identifier state
    //------------------------------------------------------------------
    _stateAfterDoctypeSystemIdentifier(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.SPACE:
        case CODE_POINTS.LINE_FEED:
        case CODE_POINTS.TABULATION:
        case CODE_POINTS.FORM_FEED: {
          break;
        }
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInDoctype);
          token.forceQuirks = true;
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default: {
          this._err(ERR.unexpectedCharacterAfterDoctypeSystemIdentifier);
          this.state = State.BOGUS_DOCTYPE;
          this._stateBogusDoctype(cp);
        }
      }
    }
    // Bogus DOCTYPE state
    //------------------------------------------------------------------
    _stateBogusDoctype(cp) {
      const token = this.currentToken;
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.emitCurrentDoctype(token);
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.NULL: {
          this._err(ERR.unexpectedNullCharacter);
          break;
        }
        case CODE_POINTS.EOF: {
          this.emitCurrentDoctype(token);
          this._emitEOFToken();
          break;
        }
        default:
      }
    }
    // CDATA section state
    //------------------------------------------------------------------
    _stateCdataSection(cp) {
      switch (cp) {
        case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
          this.state = State.CDATA_SECTION_BRACKET;
          break;
        }
        case CODE_POINTS.EOF: {
          this._err(ERR.eofInCdata);
          this._emitEOFToken();
          break;
        }
        default: {
          this._emitCodePoint(cp);
        }
      }
    }
    // CDATA section bracket state
    //------------------------------------------------------------------
    _stateCdataSectionBracket(cp) {
      if (cp === CODE_POINTS.RIGHT_SQUARE_BRACKET) {
        this.state = State.CDATA_SECTION_END;
      } else {
        this._emitChars("]");
        this.state = State.CDATA_SECTION;
        this._stateCdataSection(cp);
      }
    }
    // CDATA section end state
    //------------------------------------------------------------------
    _stateCdataSectionEnd(cp) {
      switch (cp) {
        case CODE_POINTS.GREATER_THAN_SIGN: {
          this.state = State.DATA;
          break;
        }
        case CODE_POINTS.RIGHT_SQUARE_BRACKET: {
          this._emitChars("]");
          break;
        }
        default: {
          this._emitChars("]]");
          this.state = State.CDATA_SECTION;
          this._stateCdataSection(cp);
        }
      }
    }
    // Character reference state
    //------------------------------------------------------------------
    _stateCharacterReference() {
      let length = this.entityDecoder.write(this.preprocessor.html, this.preprocessor.pos);
      if (length < 0) {
        if (this.preprocessor.lastChunkWritten) {
          length = this.entityDecoder.end();
        } else {
          this.active = false;
          this.preprocessor.pos = this.preprocessor.html.length - 1;
          this.consumedAfterSnapshot = 0;
          this.preprocessor.endOfChunkHit = true;
          return;
        }
      }
      if (length === 0) {
        this.preprocessor.pos = this.entityStartPos;
        this._flushCodePointConsumedAsCharacterReference(CODE_POINTS.AMPERSAND);
        this.state = !this._isCharacterReferenceInAttribute() && isAsciiAlphaNumeric2(this.preprocessor.peek(1)) ? State.AMBIGUOUS_AMPERSAND : this.returnState;
      } else {
        this.state = this.returnState;
      }
    }
    // Ambiguos ampersand state
    //------------------------------------------------------------------
    _stateAmbiguousAmpersand(cp) {
      if (isAsciiAlphaNumeric2(cp)) {
        this._flushCodePointConsumedAsCharacterReference(cp);
      } else {
        if (cp === CODE_POINTS.SEMICOLON) {
          this._err(ERR.unknownNamedCharacterReference);
        }
        this.state = this.returnState;
        this._callState(cp);
      }
    }
  };
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/parser/open-element-stack.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var IMPLICIT_END_TAG_REQUIRED = /* @__PURE__ */ new Set([TAG_ID.DD, TAG_ID.DT, TAG_ID.LI, TAG_ID.OPTGROUP, TAG_ID.OPTION, TAG_ID.P, TAG_ID.RB, TAG_ID.RP, TAG_ID.RT, TAG_ID.RTC]);
  var IMPLICIT_END_TAG_REQUIRED_THOROUGHLY = /* @__PURE__ */ new Set([
    ...IMPLICIT_END_TAG_REQUIRED,
    TAG_ID.CAPTION,
    TAG_ID.COLGROUP,
    TAG_ID.TBODY,
    TAG_ID.TD,
    TAG_ID.TFOOT,
    TAG_ID.TH,
    TAG_ID.THEAD,
    TAG_ID.TR
  ]);
  var SCOPING_ELEMENTS_HTML = /* @__PURE__ */ new Set([
    TAG_ID.APPLET,
    TAG_ID.CAPTION,
    TAG_ID.HTML,
    TAG_ID.MARQUEE,
    TAG_ID.OBJECT,
    TAG_ID.TABLE,
    TAG_ID.TD,
    TAG_ID.TEMPLATE,
    TAG_ID.TH
  ]);
  var SCOPING_ELEMENTS_HTML_LIST = /* @__PURE__ */ new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.OL, TAG_ID.UL]);
  var SCOPING_ELEMENTS_HTML_BUTTON = /* @__PURE__ */ new Set([...SCOPING_ELEMENTS_HTML, TAG_ID.BUTTON]);
  var SCOPING_ELEMENTS_MATHML = /* @__PURE__ */ new Set([TAG_ID.ANNOTATION_XML, TAG_ID.MI, TAG_ID.MN, TAG_ID.MO, TAG_ID.MS, TAG_ID.MTEXT]);
  var SCOPING_ELEMENTS_SVG = /* @__PURE__ */ new Set([TAG_ID.DESC, TAG_ID.FOREIGN_OBJECT, TAG_ID.TITLE]);
  var TABLE_ROW_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TR, TAG_ID.TEMPLATE, TAG_ID.HTML]);
  var TABLE_BODY_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TEMPLATE, TAG_ID.HTML]);
  var TABLE_CONTEXT = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TEMPLATE, TAG_ID.HTML]);
  var TABLE_CELLS = /* @__PURE__ */ new Set([TAG_ID.TD, TAG_ID.TH]);
  var OpenElementStack = class {
    get currentTmplContentOrNode() {
      return this._isInTemplate() ? this.treeAdapter.getTemplateContent(this.current) : this.current;
    }
    constructor(document2, treeAdapter, handler) {
      this.treeAdapter = treeAdapter;
      this.handler = handler;
      this.items = [];
      this.tagIDs = [];
      this.stackTop = -1;
      this.tmplCount = 0;
      this.currentTagId = TAG_ID.UNKNOWN;
      this.current = document2;
    }
    //Index of element
    _indexOf(element) {
      return this.items.lastIndexOf(element, this.stackTop);
    }
    //Update current element
    _isInTemplate() {
      return this.currentTagId === TAG_ID.TEMPLATE && this.treeAdapter.getNamespaceURI(this.current) === NS.HTML;
    }
    _updateCurrentElement() {
      this.current = this.items[this.stackTop];
      this.currentTagId = this.tagIDs[this.stackTop];
    }
    //Mutations
    push(element, tagID) {
      this.stackTop++;
      this.items[this.stackTop] = element;
      this.current = element;
      this.tagIDs[this.stackTop] = tagID;
      this.currentTagId = tagID;
      if (this._isInTemplate()) {
        this.tmplCount++;
      }
      this.handler.onItemPush(element, tagID, true);
    }
    pop() {
      const popped = this.current;
      if (this.tmplCount > 0 && this._isInTemplate()) {
        this.tmplCount--;
      }
      this.stackTop--;
      this._updateCurrentElement();
      this.handler.onItemPop(popped, true);
    }
    replace(oldElement, newElement) {
      const idx = this._indexOf(oldElement);
      this.items[idx] = newElement;
      if (idx === this.stackTop) {
        this.current = newElement;
      }
    }
    insertAfter(referenceElement, newElement, newElementID) {
      const insertionIdx = this._indexOf(referenceElement) + 1;
      this.items.splice(insertionIdx, 0, newElement);
      this.tagIDs.splice(insertionIdx, 0, newElementID);
      this.stackTop++;
      if (insertionIdx === this.stackTop) {
        this._updateCurrentElement();
      }
      if (this.current && this.currentTagId !== void 0) {
        this.handler.onItemPush(this.current, this.currentTagId, insertionIdx === this.stackTop);
      }
    }
    popUntilTagNamePopped(tagName2) {
      let targetIdx = this.stackTop + 1;
      do {
        targetIdx = this.tagIDs.lastIndexOf(tagName2, targetIdx - 1);
      } while (targetIdx > 0 && this.treeAdapter.getNamespaceURI(this.items[targetIdx]) !== NS.HTML);
      this.shortenToLength(Math.max(targetIdx, 0));
    }
    shortenToLength(idx) {
      while (this.stackTop >= idx) {
        const popped = this.current;
        if (this.tmplCount > 0 && this._isInTemplate()) {
          this.tmplCount -= 1;
        }
        this.stackTop--;
        this._updateCurrentElement();
        this.handler.onItemPop(popped, this.stackTop < idx);
      }
    }
    popUntilElementPopped(element) {
      const idx = this._indexOf(element);
      this.shortenToLength(Math.max(idx, 0));
    }
    popUntilPopped(tagNames, targetNS) {
      const idx = this._indexOfTagNames(tagNames, targetNS);
      this.shortenToLength(Math.max(idx, 0));
    }
    popUntilNumberedHeaderPopped() {
      this.popUntilPopped(NUMBERED_HEADERS, NS.HTML);
    }
    popUntilTableCellPopped() {
      this.popUntilPopped(TABLE_CELLS, NS.HTML);
    }
    popAllUpToHtmlElement() {
      this.tmplCount = 0;
      this.shortenToLength(1);
    }
    _indexOfTagNames(tagNames, namespace) {
      for (let i = this.stackTop; i >= 0; i--) {
        if (tagNames.has(this.tagIDs[i]) && this.treeAdapter.getNamespaceURI(this.items[i]) === namespace) {
          return i;
        }
      }
      return -1;
    }
    clearBackTo(tagNames, targetNS) {
      const idx = this._indexOfTagNames(tagNames, targetNS);
      this.shortenToLength(idx + 1);
    }
    clearBackToTableContext() {
      this.clearBackTo(TABLE_CONTEXT, NS.HTML);
    }
    clearBackToTableBodyContext() {
      this.clearBackTo(TABLE_BODY_CONTEXT, NS.HTML);
    }
    clearBackToTableRowContext() {
      this.clearBackTo(TABLE_ROW_CONTEXT, NS.HTML);
    }
    remove(element) {
      const idx = this._indexOf(element);
      if (idx >= 0) {
        if (idx === this.stackTop) {
          this.pop();
        } else {
          this.items.splice(idx, 1);
          this.tagIDs.splice(idx, 1);
          this.stackTop--;
          this._updateCurrentElement();
          this.handler.onItemPop(element, false);
        }
      }
    }
    //Search
    tryPeekProperlyNestedBodyElement() {
      return this.stackTop >= 1 && this.tagIDs[1] === TAG_ID.BODY ? this.items[1] : null;
    }
    contains(element) {
      return this._indexOf(element) > -1;
    }
    getCommonAncestor(element) {
      const elementIdx = this._indexOf(element) - 1;
      return elementIdx >= 0 ? this.items[elementIdx] : null;
    }
    isRootHtmlElementCurrent() {
      return this.stackTop === 0 && this.tagIDs[0] === TAG_ID.HTML;
    }
    //Element in scope
    hasInDynamicScope(tagName2, htmlScope) {
      for (let i = this.stackTop; i >= 0; i--) {
        const tn = this.tagIDs[i];
        switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
          case NS.HTML: {
            if (tn === tagName2)
              return true;
            if (htmlScope.has(tn))
              return false;
            break;
          }
          case NS.SVG: {
            if (SCOPING_ELEMENTS_SVG.has(tn))
              return false;
            break;
          }
          case NS.MATHML: {
            if (SCOPING_ELEMENTS_MATHML.has(tn))
              return false;
            break;
          }
        }
      }
      return true;
    }
    hasInScope(tagName2) {
      return this.hasInDynamicScope(tagName2, SCOPING_ELEMENTS_HTML);
    }
    hasInListItemScope(tagName2) {
      return this.hasInDynamicScope(tagName2, SCOPING_ELEMENTS_HTML_LIST);
    }
    hasInButtonScope(tagName2) {
      return this.hasInDynamicScope(tagName2, SCOPING_ELEMENTS_HTML_BUTTON);
    }
    hasNumberedHeaderInScope() {
      for (let i = this.stackTop; i >= 0; i--) {
        const tn = this.tagIDs[i];
        switch (this.treeAdapter.getNamespaceURI(this.items[i])) {
          case NS.HTML: {
            if (NUMBERED_HEADERS.has(tn))
              return true;
            if (SCOPING_ELEMENTS_HTML.has(tn))
              return false;
            break;
          }
          case NS.SVG: {
            if (SCOPING_ELEMENTS_SVG.has(tn))
              return false;
            break;
          }
          case NS.MATHML: {
            if (SCOPING_ELEMENTS_MATHML.has(tn))
              return false;
            break;
          }
        }
      }
      return true;
    }
    hasInTableScope(tagName2) {
      for (let i = this.stackTop; i >= 0; i--) {
        if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
          continue;
        }
        switch (this.tagIDs[i]) {
          case tagName2: {
            return true;
          }
          case TAG_ID.TABLE:
          case TAG_ID.HTML: {
            return false;
          }
        }
      }
      return true;
    }
    hasTableBodyContextInTableScope() {
      for (let i = this.stackTop; i >= 0; i--) {
        if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
          continue;
        }
        switch (this.tagIDs[i]) {
          case TAG_ID.TBODY:
          case TAG_ID.THEAD:
          case TAG_ID.TFOOT: {
            return true;
          }
          case TAG_ID.TABLE:
          case TAG_ID.HTML: {
            return false;
          }
        }
      }
      return true;
    }
    hasInSelectScope(tagName2) {
      for (let i = this.stackTop; i >= 0; i--) {
        if (this.treeAdapter.getNamespaceURI(this.items[i]) !== NS.HTML) {
          continue;
        }
        switch (this.tagIDs[i]) {
          case tagName2: {
            return true;
          }
          case TAG_ID.OPTION:
          case TAG_ID.OPTGROUP: {
            break;
          }
          default: {
            return false;
          }
        }
      }
      return true;
    }
    //Implied end tags
    generateImpliedEndTags() {
      while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED.has(this.currentTagId)) {
        this.pop();
      }
    }
    generateImpliedEndTagsThoroughly() {
      while (this.currentTagId !== void 0 && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
        this.pop();
      }
    }
    generateImpliedEndTagsWithExclusion(exclusionId) {
      while (this.currentTagId !== void 0 && this.currentTagId !== exclusionId && IMPLICIT_END_TAG_REQUIRED_THOROUGHLY.has(this.currentTagId)) {
        this.pop();
      }
    }
  };
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/parser/formatting-element-list.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var NOAH_ARK_CAPACITY = 3;
  var EntryType;
  (function(EntryType2) {
    EntryType2[EntryType2["Marker"] = 0] = "Marker";
    EntryType2[EntryType2["Element"] = 1] = "Element";
  })(EntryType || (EntryType = {}));
  var MARKER = { type: EntryType.Marker };
  var FormattingElementList = class {
    constructor(treeAdapter) {
      this.treeAdapter = treeAdapter;
      this.entries = [];
      this.bookmark = null;
    }
    //Noah Ark's condition
    //OPTIMIZATION: at first we try to find possible candidates for exclusion using
    //lightweight heuristics without thorough attributes check.
    _getNoahArkConditionCandidates(newElement, neAttrs) {
      const candidates = [];
      const neAttrsLength = neAttrs.length;
      const neTagName = this.treeAdapter.getTagName(newElement);
      const neNamespaceURI = this.treeAdapter.getNamespaceURI(newElement);
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        if (entry.type === EntryType.Marker) {
          break;
        }
        const { element } = entry;
        if (this.treeAdapter.getTagName(element) === neTagName && this.treeAdapter.getNamespaceURI(element) === neNamespaceURI) {
          const elementAttrs = this.treeAdapter.getAttrList(element);
          if (elementAttrs.length === neAttrsLength) {
            candidates.push({ idx: i, attrs: elementAttrs });
          }
        }
      }
      return candidates;
    }
    _ensureNoahArkCondition(newElement) {
      if (this.entries.length < NOAH_ARK_CAPACITY)
        return;
      const neAttrs = this.treeAdapter.getAttrList(newElement);
      const candidates = this._getNoahArkConditionCandidates(newElement, neAttrs);
      if (candidates.length < NOAH_ARK_CAPACITY)
        return;
      const neAttrsMap = new Map(neAttrs.map((neAttr) => [neAttr.name, neAttr.value]));
      let validCandidates = 0;
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        if (candidate.attrs.every((cAttr) => neAttrsMap.get(cAttr.name) === cAttr.value)) {
          validCandidates += 1;
          if (validCandidates >= NOAH_ARK_CAPACITY) {
            this.entries.splice(candidate.idx, 1);
          }
        }
      }
    }
    //Mutations
    insertMarker() {
      this.entries.unshift(MARKER);
    }
    pushElement(element, token) {
      this._ensureNoahArkCondition(element);
      this.entries.unshift({
        type: EntryType.Element,
        element,
        token
      });
    }
    insertElementAfterBookmark(element, token) {
      const bookmarkIdx = this.entries.indexOf(this.bookmark);
      this.entries.splice(bookmarkIdx, 0, {
        type: EntryType.Element,
        element,
        token
      });
    }
    removeEntry(entry) {
      const entryIndex = this.entries.indexOf(entry);
      if (entryIndex !== -1) {
        this.entries.splice(entryIndex, 1);
      }
    }
    /**
     * Clears the list of formatting elements up to the last marker.
     *
     * @see https://html.spec.whatwg.org/multipage/parsing.html#clear-the-list-of-active-formatting-elements-up-to-the-last-marker
     */
    clearToLastMarker() {
      const markerIdx = this.entries.indexOf(MARKER);
      if (markerIdx === -1) {
        this.entries.length = 0;
      } else {
        this.entries.splice(0, markerIdx + 1);
      }
    }
    //Search
    getElementEntryInScopeWithTagName(tagName2) {
      const entry = this.entries.find((entry2) => entry2.type === EntryType.Marker || this.treeAdapter.getTagName(entry2.element) === tagName2);
      return entry && entry.type === EntryType.Element ? entry : null;
    }
    getElementEntry(element) {
      return this.entries.find((entry) => entry.type === EntryType.Element && entry.element === element);
    }
  };
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/tree-adapters/default.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var defaultTreeAdapter = {
    //Node construction
    createDocument() {
      return {
        nodeName: "#document",
        mode: DOCUMENT_MODE.NO_QUIRKS,
        childNodes: []
      };
    },
    createDocumentFragment() {
      return {
        nodeName: "#document-fragment",
        childNodes: []
      };
    },
    createElement(tagName2, namespaceURI, attrs) {
      return {
        nodeName: tagName2,
        tagName: tagName2,
        attrs,
        namespaceURI,
        childNodes: [],
        parentNode: null
      };
    },
    createCommentNode(data) {
      return {
        nodeName: "#comment",
        data,
        parentNode: null
      };
    },
    createTextNode(value) {
      return {
        nodeName: "#text",
        value,
        parentNode: null
      };
    },
    //Tree mutation
    appendChild(parentNode, newNode) {
      parentNode.childNodes.push(newNode);
      newNode.parentNode = parentNode;
    },
    insertBefore(parentNode, newNode, referenceNode) {
      const insertionIdx = parentNode.childNodes.indexOf(referenceNode);
      parentNode.childNodes.splice(insertionIdx, 0, newNode);
      newNode.parentNode = parentNode;
    },
    setTemplateContent(templateElement, contentElement) {
      templateElement.content = contentElement;
    },
    getTemplateContent(templateElement) {
      return templateElement.content;
    },
    setDocumentType(document2, name, publicId, systemId) {
      const doctypeNode = document2.childNodes.find((node) => node.nodeName === "#documentType");
      if (doctypeNode) {
        doctypeNode.name = name;
        doctypeNode.publicId = publicId;
        doctypeNode.systemId = systemId;
      } else {
        const node = {
          nodeName: "#documentType",
          name,
          publicId,
          systemId,
          parentNode: null
        };
        defaultTreeAdapter.appendChild(document2, node);
      }
    },
    setDocumentMode(document2, mode) {
      document2.mode = mode;
    },
    getDocumentMode(document2) {
      return document2.mode;
    },
    detachNode(node) {
      if (node.parentNode) {
        const idx = node.parentNode.childNodes.indexOf(node);
        node.parentNode.childNodes.splice(idx, 1);
        node.parentNode = null;
      }
    },
    insertText(parentNode, text) {
      if (parentNode.childNodes.length > 0) {
        const prevNode = parentNode.childNodes[parentNode.childNodes.length - 1];
        if (defaultTreeAdapter.isTextNode(prevNode)) {
          prevNode.value += text;
          return;
        }
      }
      defaultTreeAdapter.appendChild(parentNode, defaultTreeAdapter.createTextNode(text));
    },
    insertTextBefore(parentNode, text, referenceNode) {
      const prevNode = parentNode.childNodes[parentNode.childNodes.indexOf(referenceNode) - 1];
      if (prevNode && defaultTreeAdapter.isTextNode(prevNode)) {
        prevNode.value += text;
      } else {
        defaultTreeAdapter.insertBefore(parentNode, defaultTreeAdapter.createTextNode(text), referenceNode);
      }
    },
    adoptAttributes(recipient, attrs) {
      const recipientAttrsMap = new Set(recipient.attrs.map((attr3) => attr3.name));
      for (let j = 0; j < attrs.length; j++) {
        if (!recipientAttrsMap.has(attrs[j].name)) {
          recipient.attrs.push(attrs[j]);
        }
      }
    },
    //Tree traversing
    getFirstChild(node) {
      return node.childNodes[0];
    },
    getChildNodes(node) {
      return node.childNodes;
    },
    getParentNode(node) {
      return node.parentNode;
    },
    getAttrList(element) {
      return element.attrs;
    },
    //Node data
    getTagName(element) {
      return element.tagName;
    },
    getNamespaceURI(element) {
      return element.namespaceURI;
    },
    getTextNodeContent(textNode) {
      return textNode.value;
    },
    getCommentNodeContent(commentNode) {
      return commentNode.data;
    },
    getDocumentTypeNodeName(doctypeNode) {
      return doctypeNode.name;
    },
    getDocumentTypeNodePublicId(doctypeNode) {
      return doctypeNode.publicId;
    },
    getDocumentTypeNodeSystemId(doctypeNode) {
      return doctypeNode.systemId;
    },
    //Node types
    isTextNode(node) {
      return node.nodeName === "#text";
    },
    isCommentNode(node) {
      return node.nodeName === "#comment";
    },
    isDocumentTypeNode(node) {
      return node.nodeName === "#documentType";
    },
    isElementNode(node) {
      return Object.prototype.hasOwnProperty.call(node, "tagName");
    },
    // Source code location
    setNodeSourceCodeLocation(node, location2) {
      node.sourceCodeLocation = location2;
    },
    getNodeSourceCodeLocation(node) {
      return node.sourceCodeLocation;
    },
    updateNodeSourceCodeLocation(node, endLocation) {
      node.sourceCodeLocation = { ...node.sourceCodeLocation, ...endLocation };
    }
  };
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/common/doctype.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var VALID_DOCTYPE_NAME = "html";
  var VALID_SYSTEM_ID = "about:legacy-compat";
  var QUIRKS_MODE_SYSTEM_ID = "http://www.ibm.com/data/dtd/v11/ibmxhtml1-transitional.dtd";
  var QUIRKS_MODE_PUBLIC_ID_PREFIXES = [
    "+//silmaril//dtd html pro v0r11 19970101//",
    "-//as//dtd html 3.0 aswedit + extensions//",
    "-//advasoft ltd//dtd html 3.0 aswedit + extensions//",
    "-//ietf//dtd html 2.0 level 1//",
    "-//ietf//dtd html 2.0 level 2//",
    "-//ietf//dtd html 2.0 strict level 1//",
    "-//ietf//dtd html 2.0 strict level 2//",
    "-//ietf//dtd html 2.0 strict//",
    "-//ietf//dtd html 2.0//",
    "-//ietf//dtd html 2.1e//",
    "-//ietf//dtd html 3.0//",
    "-//ietf//dtd html 3.2 final//",
    "-//ietf//dtd html 3.2//",
    "-//ietf//dtd html 3//",
    "-//ietf//dtd html level 0//",
    "-//ietf//dtd html level 1//",
    "-//ietf//dtd html level 2//",
    "-//ietf//dtd html level 3//",
    "-//ietf//dtd html strict level 0//",
    "-//ietf//dtd html strict level 1//",
    "-//ietf//dtd html strict level 2//",
    "-//ietf//dtd html strict level 3//",
    "-//ietf//dtd html strict//",
    "-//ietf//dtd html//",
    "-//metrius//dtd metrius presentational//",
    "-//microsoft//dtd internet explorer 2.0 html strict//",
    "-//microsoft//dtd internet explorer 2.0 html//",
    "-//microsoft//dtd internet explorer 2.0 tables//",
    "-//microsoft//dtd internet explorer 3.0 html strict//",
    "-//microsoft//dtd internet explorer 3.0 html//",
    "-//microsoft//dtd internet explorer 3.0 tables//",
    "-//netscape comm. corp.//dtd html//",
    "-//netscape comm. corp.//dtd strict html//",
    "-//o'reilly and associates//dtd html 2.0//",
    "-//o'reilly and associates//dtd html extended 1.0//",
    "-//o'reilly and associates//dtd html extended relaxed 1.0//",
    "-//sq//dtd html 2.0 hotmetal + extensions//",
    "-//softquad software//dtd hotmetal pro 6.0::19990601::extensions to html 4.0//",
    "-//softquad//dtd hotmetal pro 4.0::19971010::extensions to html 4.0//",
    "-//spyglass//dtd html 2.0 extended//",
    "-//sun microsystems corp.//dtd hotjava html//",
    "-//sun microsystems corp.//dtd hotjava strict html//",
    "-//w3c//dtd html 3 1995-03-24//",
    "-//w3c//dtd html 3.2 draft//",
    "-//w3c//dtd html 3.2 final//",
    "-//w3c//dtd html 3.2//",
    "-//w3c//dtd html 3.2s draft//",
    "-//w3c//dtd html 4.0 frameset//",
    "-//w3c//dtd html 4.0 transitional//",
    "-//w3c//dtd html experimental 19960712//",
    "-//w3c//dtd html experimental 970421//",
    "-//w3c//dtd w3 html//",
    "-//w3o//dtd w3 html 3.0//",
    "-//webtechs//dtd mozilla html 2.0//",
    "-//webtechs//dtd mozilla html//"
  ];
  var QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
    ...QUIRKS_MODE_PUBLIC_ID_PREFIXES,
    "-//w3c//dtd html 4.01 frameset//",
    "-//w3c//dtd html 4.01 transitional//"
  ];
  var QUIRKS_MODE_PUBLIC_IDS = /* @__PURE__ */ new Set([
    "-//w3o//dtd w3 html strict 3.0//en//",
    "-/w3c/dtd html 4.0 transitional/en",
    "html"
  ]);
  var LIMITED_QUIRKS_PUBLIC_ID_PREFIXES = ["-//w3c//dtd xhtml 1.0 frameset//", "-//w3c//dtd xhtml 1.0 transitional//"];
  var LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES = [
    ...LIMITED_QUIRKS_PUBLIC_ID_PREFIXES,
    "-//w3c//dtd html 4.01 frameset//",
    "-//w3c//dtd html 4.01 transitional//"
  ];
  function hasPrefix(publicId, prefixes) {
    return prefixes.some((prefix2) => publicId.startsWith(prefix2));
  }
  function isConforming(token) {
    return token.name === VALID_DOCTYPE_NAME && token.publicId === null && (token.systemId === null || token.systemId === VALID_SYSTEM_ID);
  }
  function getDocumentMode(token) {
    if (token.name !== VALID_DOCTYPE_NAME) {
      return DOCUMENT_MODE.QUIRKS;
    }
    const { systemId } = token;
    if (systemId && systemId.toLowerCase() === QUIRKS_MODE_SYSTEM_ID) {
      return DOCUMENT_MODE.QUIRKS;
    }
    let { publicId } = token;
    if (publicId !== null) {
      publicId = publicId.toLowerCase();
      if (QUIRKS_MODE_PUBLIC_IDS.has(publicId)) {
        return DOCUMENT_MODE.QUIRKS;
      }
      let prefixes = systemId === null ? QUIRKS_MODE_NO_SYSTEM_ID_PUBLIC_ID_PREFIXES : QUIRKS_MODE_PUBLIC_ID_PREFIXES;
      if (hasPrefix(publicId, prefixes)) {
        return DOCUMENT_MODE.QUIRKS;
      }
      prefixes = systemId === null ? LIMITED_QUIRKS_PUBLIC_ID_PREFIXES : LIMITED_QUIRKS_WITH_SYSTEM_ID_PUBLIC_ID_PREFIXES;
      if (hasPrefix(publicId, prefixes)) {
        return DOCUMENT_MODE.LIMITED_QUIRKS;
      }
    }
    return DOCUMENT_MODE.NO_QUIRKS;
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/common/foreign-content.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var MIME_TYPES = {
    TEXT_HTML: "text/html",
    APPLICATION_XML: "application/xhtml+xml"
  };
  var DEFINITION_URL_ATTR = "definitionurl";
  var ADJUSTED_DEFINITION_URL_ATTR = "definitionURL";
  var SVG_ATTRS_ADJUSTMENT_MAP = new Map([
    "attributeName",
    "attributeType",
    "baseFrequency",
    "baseProfile",
    "calcMode",
    "clipPathUnits",
    "diffuseConstant",
    "edgeMode",
    "filterUnits",
    "glyphRef",
    "gradientTransform",
    "gradientUnits",
    "kernelMatrix",
    "kernelUnitLength",
    "keyPoints",
    "keySplines",
    "keyTimes",
    "lengthAdjust",
    "limitingConeAngle",
    "markerHeight",
    "markerUnits",
    "markerWidth",
    "maskContentUnits",
    "maskUnits",
    "numOctaves",
    "pathLength",
    "patternContentUnits",
    "patternTransform",
    "patternUnits",
    "pointsAtX",
    "pointsAtY",
    "pointsAtZ",
    "preserveAlpha",
    "preserveAspectRatio",
    "primitiveUnits",
    "refX",
    "refY",
    "repeatCount",
    "repeatDur",
    "requiredExtensions",
    "requiredFeatures",
    "specularConstant",
    "specularExponent",
    "spreadMethod",
    "startOffset",
    "stdDeviation",
    "stitchTiles",
    "surfaceScale",
    "systemLanguage",
    "tableValues",
    "targetX",
    "targetY",
    "textLength",
    "viewBox",
    "viewTarget",
    "xChannelSelector",
    "yChannelSelector",
    "zoomAndPan"
  ].map((attr3) => [attr3.toLowerCase(), attr3]));
  var XML_ATTRS_ADJUSTMENT_MAP = /* @__PURE__ */ new Map([
    ["xlink:actuate", { prefix: "xlink", name: "actuate", namespace: NS.XLINK }],
    ["xlink:arcrole", { prefix: "xlink", name: "arcrole", namespace: NS.XLINK }],
    ["xlink:href", { prefix: "xlink", name: "href", namespace: NS.XLINK }],
    ["xlink:role", { prefix: "xlink", name: "role", namespace: NS.XLINK }],
    ["xlink:show", { prefix: "xlink", name: "show", namespace: NS.XLINK }],
    ["xlink:title", { prefix: "xlink", name: "title", namespace: NS.XLINK }],
    ["xlink:type", { prefix: "xlink", name: "type", namespace: NS.XLINK }],
    ["xml:lang", { prefix: "xml", name: "lang", namespace: NS.XML }],
    ["xml:space", { prefix: "xml", name: "space", namespace: NS.XML }],
    ["xmlns", { prefix: "", name: "xmlns", namespace: NS.XMLNS }],
    ["xmlns:xlink", { prefix: "xmlns", name: "xlink", namespace: NS.XMLNS }]
  ]);
  var SVG_TAG_NAMES_ADJUSTMENT_MAP = new Map([
    "altGlyph",
    "altGlyphDef",
    "altGlyphItem",
    "animateColor",
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath"
  ].map((tn) => [tn.toLowerCase(), tn]));
  var EXITS_FOREIGN_CONTENT = /* @__PURE__ */ new Set([
    TAG_ID.B,
    TAG_ID.BIG,
    TAG_ID.BLOCKQUOTE,
    TAG_ID.BODY,
    TAG_ID.BR,
    TAG_ID.CENTER,
    TAG_ID.CODE,
    TAG_ID.DD,
    TAG_ID.DIV,
    TAG_ID.DL,
    TAG_ID.DT,
    TAG_ID.EM,
    TAG_ID.EMBED,
    TAG_ID.H1,
    TAG_ID.H2,
    TAG_ID.H3,
    TAG_ID.H4,
    TAG_ID.H5,
    TAG_ID.H6,
    TAG_ID.HEAD,
    TAG_ID.HR,
    TAG_ID.I,
    TAG_ID.IMG,
    TAG_ID.LI,
    TAG_ID.LISTING,
    TAG_ID.MENU,
    TAG_ID.META,
    TAG_ID.NOBR,
    TAG_ID.OL,
    TAG_ID.P,
    TAG_ID.PRE,
    TAG_ID.RUBY,
    TAG_ID.S,
    TAG_ID.SMALL,
    TAG_ID.SPAN,
    TAG_ID.STRONG,
    TAG_ID.STRIKE,
    TAG_ID.SUB,
    TAG_ID.SUP,
    TAG_ID.TABLE,
    TAG_ID.TT,
    TAG_ID.U,
    TAG_ID.UL,
    TAG_ID.VAR
  ]);
  function causesExit(startTagToken) {
    const tn = startTagToken.tagID;
    const isFontWithAttrs = tn === TAG_ID.FONT && startTagToken.attrs.some(({ name }) => name === ATTRS.COLOR || name === ATTRS.SIZE || name === ATTRS.FACE);
    return isFontWithAttrs || EXITS_FOREIGN_CONTENT.has(tn);
  }
  function adjustTokenMathMLAttrs(token) {
    for (let i = 0; i < token.attrs.length; i++) {
      if (token.attrs[i].name === DEFINITION_URL_ATTR) {
        token.attrs[i].name = ADJUSTED_DEFINITION_URL_ATTR;
        break;
      }
    }
  }
  function adjustTokenSVGAttrs(token) {
    for (let i = 0; i < token.attrs.length; i++) {
      const adjustedAttrName = SVG_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
      if (adjustedAttrName != null) {
        token.attrs[i].name = adjustedAttrName;
      }
    }
  }
  function adjustTokenXMLAttrs(token) {
    for (let i = 0; i < token.attrs.length; i++) {
      const adjustedAttrEntry = XML_ATTRS_ADJUSTMENT_MAP.get(token.attrs[i].name);
      if (adjustedAttrEntry) {
        token.attrs[i].prefix = adjustedAttrEntry.prefix;
        token.attrs[i].name = adjustedAttrEntry.name;
        token.attrs[i].namespace = adjustedAttrEntry.namespace;
      }
    }
  }
  function adjustTokenSVGTagName(token) {
    const adjustedTagName = SVG_TAG_NAMES_ADJUSTMENT_MAP.get(token.tagName);
    if (adjustedTagName != null) {
      token.tagName = adjustedTagName;
      token.tagID = getTagID(token.tagName);
    }
  }
  function isMathMLTextIntegrationPoint(tn, ns) {
    return ns === NS.MATHML && (tn === TAG_ID.MI || tn === TAG_ID.MO || tn === TAG_ID.MN || tn === TAG_ID.MS || tn === TAG_ID.MTEXT);
  }
  function isHtmlIntegrationPoint(tn, ns, attrs) {
    if (ns === NS.MATHML && tn === TAG_ID.ANNOTATION_XML) {
      for (let i = 0; i < attrs.length; i++) {
        if (attrs[i].name === ATTRS.ENCODING) {
          const value = attrs[i].value.toLowerCase();
          return value === MIME_TYPES.TEXT_HTML || value === MIME_TYPES.APPLICATION_XML;
        }
      }
    }
    return ns === NS.SVG && (tn === TAG_ID.FOREIGN_OBJECT || tn === TAG_ID.DESC || tn === TAG_ID.TITLE);
  }
  function isIntegrationPoint(tn, ns, attrs, foreignNS) {
    return (!foreignNS || foreignNS === NS.HTML) && isHtmlIntegrationPoint(tn, ns, attrs) || (!foreignNS || foreignNS === NS.MATHML) && isMathMLTextIntegrationPoint(tn, ns);
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/parser/index.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var HIDDEN_INPUT_TYPE = "hidden";
  var AA_OUTER_LOOP_ITER = 8;
  var AA_INNER_LOOP_ITER = 3;
  var InsertionMode;
  (function(InsertionMode2) {
    InsertionMode2[InsertionMode2["INITIAL"] = 0] = "INITIAL";
    InsertionMode2[InsertionMode2["BEFORE_HTML"] = 1] = "BEFORE_HTML";
    InsertionMode2[InsertionMode2["BEFORE_HEAD"] = 2] = "BEFORE_HEAD";
    InsertionMode2[InsertionMode2["IN_HEAD"] = 3] = "IN_HEAD";
    InsertionMode2[InsertionMode2["IN_HEAD_NO_SCRIPT"] = 4] = "IN_HEAD_NO_SCRIPT";
    InsertionMode2[InsertionMode2["AFTER_HEAD"] = 5] = "AFTER_HEAD";
    InsertionMode2[InsertionMode2["IN_BODY"] = 6] = "IN_BODY";
    InsertionMode2[InsertionMode2["TEXT"] = 7] = "TEXT";
    InsertionMode2[InsertionMode2["IN_TABLE"] = 8] = "IN_TABLE";
    InsertionMode2[InsertionMode2["IN_TABLE_TEXT"] = 9] = "IN_TABLE_TEXT";
    InsertionMode2[InsertionMode2["IN_CAPTION"] = 10] = "IN_CAPTION";
    InsertionMode2[InsertionMode2["IN_COLUMN_GROUP"] = 11] = "IN_COLUMN_GROUP";
    InsertionMode2[InsertionMode2["IN_TABLE_BODY"] = 12] = "IN_TABLE_BODY";
    InsertionMode2[InsertionMode2["IN_ROW"] = 13] = "IN_ROW";
    InsertionMode2[InsertionMode2["IN_CELL"] = 14] = "IN_CELL";
    InsertionMode2[InsertionMode2["IN_SELECT"] = 15] = "IN_SELECT";
    InsertionMode2[InsertionMode2["IN_SELECT_IN_TABLE"] = 16] = "IN_SELECT_IN_TABLE";
    InsertionMode2[InsertionMode2["IN_TEMPLATE"] = 17] = "IN_TEMPLATE";
    InsertionMode2[InsertionMode2["AFTER_BODY"] = 18] = "AFTER_BODY";
    InsertionMode2[InsertionMode2["IN_FRAMESET"] = 19] = "IN_FRAMESET";
    InsertionMode2[InsertionMode2["AFTER_FRAMESET"] = 20] = "AFTER_FRAMESET";
    InsertionMode2[InsertionMode2["AFTER_AFTER_BODY"] = 21] = "AFTER_AFTER_BODY";
    InsertionMode2[InsertionMode2["AFTER_AFTER_FRAMESET"] = 22] = "AFTER_AFTER_FRAMESET";
  })(InsertionMode || (InsertionMode = {}));
  var BASE_LOC = {
    startLine: -1,
    startCol: -1,
    startOffset: -1,
    endLine: -1,
    endCol: -1,
    endOffset: -1
  };
  var TABLE_STRUCTURE_TAGS = /* @__PURE__ */ new Set([TAG_ID.TABLE, TAG_ID.TBODY, TAG_ID.TFOOT, TAG_ID.THEAD, TAG_ID.TR]);
  var defaultParserOptions = {
    scriptingEnabled: true,
    sourceCodeLocationInfo: false,
    treeAdapter: defaultTreeAdapter,
    onParseError: null
  };
  var Parser = class {
    constructor(options, document2, fragmentContext = null, scriptHandler = null) {
      this.fragmentContext = fragmentContext;
      this.scriptHandler = scriptHandler;
      this.currentToken = null;
      this.stopped = false;
      this.insertionMode = InsertionMode.INITIAL;
      this.originalInsertionMode = InsertionMode.INITIAL;
      this.headElement = null;
      this.formElement = null;
      this.currentNotInHTML = false;
      this.tmplInsertionModeStack = [];
      this.pendingCharacterTokens = [];
      this.hasNonWhitespacePendingCharacterToken = false;
      this.framesetOk = true;
      this.skipNextNewLine = false;
      this.fosterParentingEnabled = false;
      this.options = {
        ...defaultParserOptions,
        ...options
      };
      this.treeAdapter = this.options.treeAdapter;
      this.onParseError = this.options.onParseError;
      if (this.onParseError) {
        this.options.sourceCodeLocationInfo = true;
      }
      this.document = document2 !== null && document2 !== void 0 ? document2 : this.treeAdapter.createDocument();
      this.tokenizer = new Tokenizer(this.options, this);
      this.activeFormattingElements = new FormattingElementList(this.treeAdapter);
      this.fragmentContextID = fragmentContext ? getTagID(this.treeAdapter.getTagName(fragmentContext)) : TAG_ID.UNKNOWN;
      this._setContextModes(fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : this.document, this.fragmentContextID);
      this.openElements = new OpenElementStack(this.document, this.treeAdapter, this);
    }
    // API
    static parse(html, options) {
      const parser = new this(options);
      parser.tokenizer.write(html, true);
      return parser.document;
    }
    static getFragmentParser(fragmentContext, options) {
      const opts = {
        ...defaultParserOptions,
        ...options
      };
      fragmentContext !== null && fragmentContext !== void 0 ? fragmentContext : fragmentContext = opts.treeAdapter.createElement(TAG_NAMES.TEMPLATE, NS.HTML, []);
      const documentMock = opts.treeAdapter.createElement("documentmock", NS.HTML, []);
      const parser = new this(opts, documentMock, fragmentContext);
      if (parser.fragmentContextID === TAG_ID.TEMPLATE) {
        parser.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
      }
      parser._initTokenizerForFragmentParsing();
      parser._insertFakeRootElement();
      parser._resetInsertionMode();
      parser._findFormInFragmentContext();
      return parser;
    }
    getFragment() {
      const rootElement = this.treeAdapter.getFirstChild(this.document);
      const fragment = this.treeAdapter.createDocumentFragment();
      this._adoptNodes(rootElement, fragment);
      return fragment;
    }
    //Errors
    /** @internal */
    _err(token, code, beforeToken) {
      var _a3;
      if (!this.onParseError)
        return;
      const loc = (_a3 = token.location) !== null && _a3 !== void 0 ? _a3 : BASE_LOC;
      const err2 = {
        code,
        startLine: loc.startLine,
        startCol: loc.startCol,
        startOffset: loc.startOffset,
        endLine: beforeToken ? loc.startLine : loc.endLine,
        endCol: beforeToken ? loc.startCol : loc.endCol,
        endOffset: beforeToken ? loc.startOffset : loc.endOffset
      };
      this.onParseError(err2);
    }
    //Stack events
    /** @internal */
    onItemPush(node, tid, isTop) {
      var _a3, _b2;
      (_b2 = (_a3 = this.treeAdapter).onItemPush) === null || _b2 === void 0 ? void 0 : _b2.call(_a3, node);
      if (isTop && this.openElements.stackTop > 0)
        this._setContextModes(node, tid);
    }
    /** @internal */
    onItemPop(node, isTop) {
      var _a3, _b2;
      if (this.options.sourceCodeLocationInfo) {
        this._setEndLocation(node, this.currentToken);
      }
      (_b2 = (_a3 = this.treeAdapter).onItemPop) === null || _b2 === void 0 ? void 0 : _b2.call(_a3, node, this.openElements.current);
      if (isTop) {
        let current;
        let currentTagId;
        if (this.openElements.stackTop === 0 && this.fragmentContext) {
          current = this.fragmentContext;
          currentTagId = this.fragmentContextID;
        } else {
          ({ current, currentTagId } = this.openElements);
        }
        this._setContextModes(current, currentTagId);
      }
    }
    _setContextModes(current, tid) {
      const isHTML = current === this.document || current && this.treeAdapter.getNamespaceURI(current) === NS.HTML;
      this.currentNotInHTML = !isHTML;
      this.tokenizer.inForeignNode = !isHTML && current !== void 0 && tid !== void 0 && !this._isIntegrationPoint(tid, current);
    }
    /** @protected */
    _switchToTextParsing(currentToken, nextTokenizerState) {
      this._insertElement(currentToken, NS.HTML);
      this.tokenizer.state = nextTokenizerState;
      this.originalInsertionMode = this.insertionMode;
      this.insertionMode = InsertionMode.TEXT;
    }
    switchToPlaintextParsing() {
      this.insertionMode = InsertionMode.TEXT;
      this.originalInsertionMode = InsertionMode.IN_BODY;
      this.tokenizer.state = TokenizerMode.PLAINTEXT;
    }
    //Fragment parsing
    /** @protected */
    _getAdjustedCurrentElement() {
      return this.openElements.stackTop === 0 && this.fragmentContext ? this.fragmentContext : this.openElements.current;
    }
    /** @protected */
    _findFormInFragmentContext() {
      let node = this.fragmentContext;
      while (node) {
        if (this.treeAdapter.getTagName(node) === TAG_NAMES.FORM) {
          this.formElement = node;
          break;
        }
        node = this.treeAdapter.getParentNode(node);
      }
    }
    _initTokenizerForFragmentParsing() {
      if (!this.fragmentContext || this.treeAdapter.getNamespaceURI(this.fragmentContext) !== NS.HTML) {
        return;
      }
      switch (this.fragmentContextID) {
        case TAG_ID.TITLE:
        case TAG_ID.TEXTAREA: {
          this.tokenizer.state = TokenizerMode.RCDATA;
          break;
        }
        case TAG_ID.STYLE:
        case TAG_ID.XMP:
        case TAG_ID.IFRAME:
        case TAG_ID.NOEMBED:
        case TAG_ID.NOFRAMES:
        case TAG_ID.NOSCRIPT: {
          this.tokenizer.state = TokenizerMode.RAWTEXT;
          break;
        }
        case TAG_ID.SCRIPT: {
          this.tokenizer.state = TokenizerMode.SCRIPT_DATA;
          break;
        }
        case TAG_ID.PLAINTEXT: {
          this.tokenizer.state = TokenizerMode.PLAINTEXT;
          break;
        }
        default:
      }
    }
    //Tree mutation
    /** @protected */
    _setDocumentType(token) {
      const name = token.name || "";
      const publicId = token.publicId || "";
      const systemId = token.systemId || "";
      this.treeAdapter.setDocumentType(this.document, name, publicId, systemId);
      if (token.location) {
        const documentChildren = this.treeAdapter.getChildNodes(this.document);
        const docTypeNode = documentChildren.find((node) => this.treeAdapter.isDocumentTypeNode(node));
        if (docTypeNode) {
          this.treeAdapter.setNodeSourceCodeLocation(docTypeNode, token.location);
        }
      }
    }
    /** @protected */
    _attachElementToTree(element, location2) {
      if (this.options.sourceCodeLocationInfo) {
        const loc = location2 && {
          ...location2,
          startTag: location2
        };
        this.treeAdapter.setNodeSourceCodeLocation(element, loc);
      }
      if (this._shouldFosterParentOnInsertion()) {
        this._fosterParentElement(element);
      } else {
        const parent = this.openElements.currentTmplContentOrNode;
        this.treeAdapter.appendChild(parent !== null && parent !== void 0 ? parent : this.document, element);
      }
    }
    /**
     * For self-closing tags. Add an element to the tree, but skip adding it
     * to the stack.
     */
    /** @protected */
    _appendElement(token, namespaceURI) {
      const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
      this._attachElementToTree(element, token.location);
    }
    /** @protected */
    _insertElement(token, namespaceURI) {
      const element = this.treeAdapter.createElement(token.tagName, namespaceURI, token.attrs);
      this._attachElementToTree(element, token.location);
      this.openElements.push(element, token.tagID);
    }
    /** @protected */
    _insertFakeElement(tagName2, tagID) {
      const element = this.treeAdapter.createElement(tagName2, NS.HTML, []);
      this._attachElementToTree(element, null);
      this.openElements.push(element, tagID);
    }
    /** @protected */
    _insertTemplate(token) {
      const tmpl = this.treeAdapter.createElement(token.tagName, NS.HTML, token.attrs);
      const content = this.treeAdapter.createDocumentFragment();
      this.treeAdapter.setTemplateContent(tmpl, content);
      this._attachElementToTree(tmpl, token.location);
      this.openElements.push(tmpl, token.tagID);
      if (this.options.sourceCodeLocationInfo)
        this.treeAdapter.setNodeSourceCodeLocation(content, null);
    }
    /** @protected */
    _insertFakeRootElement() {
      const element = this.treeAdapter.createElement(TAG_NAMES.HTML, NS.HTML, []);
      if (this.options.sourceCodeLocationInfo)
        this.treeAdapter.setNodeSourceCodeLocation(element, null);
      this.treeAdapter.appendChild(this.openElements.current, element);
      this.openElements.push(element, TAG_ID.HTML);
    }
    /** @protected */
    _appendCommentNode(token, parent) {
      const commentNode = this.treeAdapter.createCommentNode(token.data);
      this.treeAdapter.appendChild(parent, commentNode);
      if (this.options.sourceCodeLocationInfo) {
        this.treeAdapter.setNodeSourceCodeLocation(commentNode, token.location);
      }
    }
    /** @protected */
    _insertCharacters(token) {
      let parent;
      let beforeElement;
      if (this._shouldFosterParentOnInsertion()) {
        ({ parent, beforeElement } = this._findFosterParentingLocation());
        if (beforeElement) {
          this.treeAdapter.insertTextBefore(parent, token.chars, beforeElement);
        } else {
          this.treeAdapter.insertText(parent, token.chars);
        }
      } else {
        parent = this.openElements.currentTmplContentOrNode;
        this.treeAdapter.insertText(parent, token.chars);
      }
      if (!token.location)
        return;
      const siblings = this.treeAdapter.getChildNodes(parent);
      const textNodeIdx = beforeElement ? siblings.lastIndexOf(beforeElement) : siblings.length;
      const textNode = siblings[textNodeIdx - 1];
      const tnLoc = this.treeAdapter.getNodeSourceCodeLocation(textNode);
      if (tnLoc) {
        const { endLine, endCol, endOffset } = token.location;
        this.treeAdapter.updateNodeSourceCodeLocation(textNode, { endLine, endCol, endOffset });
      } else if (this.options.sourceCodeLocationInfo) {
        this.treeAdapter.setNodeSourceCodeLocation(textNode, token.location);
      }
    }
    /** @protected */
    _adoptNodes(donor, recipient) {
      for (let child = this.treeAdapter.getFirstChild(donor); child; child = this.treeAdapter.getFirstChild(donor)) {
        this.treeAdapter.detachNode(child);
        this.treeAdapter.appendChild(recipient, child);
      }
    }
    /** @protected */
    _setEndLocation(element, closingToken) {
      if (this.treeAdapter.getNodeSourceCodeLocation(element) && closingToken.location) {
        const ctLoc = closingToken.location;
        const tn = this.treeAdapter.getTagName(element);
        const endLoc = (
          // NOTE: For cases like <p> <p> </p> - First 'p' closes without a closing
          // tag and for cases like <td> <p> </td> - 'p' closes without a closing tag.
          closingToken.type === TokenType.END_TAG && tn === closingToken.tagName ? {
            endTag: { ...ctLoc },
            endLine: ctLoc.endLine,
            endCol: ctLoc.endCol,
            endOffset: ctLoc.endOffset
          } : {
            endLine: ctLoc.startLine,
            endCol: ctLoc.startCol,
            endOffset: ctLoc.startOffset
          }
        );
        this.treeAdapter.updateNodeSourceCodeLocation(element, endLoc);
      }
    }
    //Token processing
    shouldProcessStartTagTokenInForeignContent(token) {
      if (!this.currentNotInHTML)
        return false;
      let current;
      let currentTagId;
      if (this.openElements.stackTop === 0 && this.fragmentContext) {
        current = this.fragmentContext;
        currentTagId = this.fragmentContextID;
      } else {
        ({ current, currentTagId } = this.openElements);
      }
      if (token.tagID === TAG_ID.SVG && this.treeAdapter.getTagName(current) === TAG_NAMES.ANNOTATION_XML && this.treeAdapter.getNamespaceURI(current) === NS.MATHML) {
        return false;
      }
      return (
        // Check that `current` is not an integration point for HTML or MathML elements.
        this.tokenizer.inForeignNode || // If it _is_ an integration point, then we might have to check that it is not an HTML
        // integration point.
        (token.tagID === TAG_ID.MGLYPH || token.tagID === TAG_ID.MALIGNMARK) && currentTagId !== void 0 && !this._isIntegrationPoint(currentTagId, current, NS.HTML)
      );
    }
    /** @protected */
    _processToken(token) {
      switch (token.type) {
        case TokenType.CHARACTER: {
          this.onCharacter(token);
          break;
        }
        case TokenType.NULL_CHARACTER: {
          this.onNullCharacter(token);
          break;
        }
        case TokenType.COMMENT: {
          this.onComment(token);
          break;
        }
        case TokenType.DOCTYPE: {
          this.onDoctype(token);
          break;
        }
        case TokenType.START_TAG: {
          this._processStartTag(token);
          break;
        }
        case TokenType.END_TAG: {
          this.onEndTag(token);
          break;
        }
        case TokenType.EOF: {
          this.onEof(token);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          this.onWhitespaceCharacter(token);
          break;
        }
      }
    }
    //Integration points
    /** @protected */
    _isIntegrationPoint(tid, element, foreignNS) {
      const ns = this.treeAdapter.getNamespaceURI(element);
      const attrs = this.treeAdapter.getAttrList(element);
      return isIntegrationPoint(tid, ns, attrs, foreignNS);
    }
    //Active formatting elements reconstruction
    /** @protected */
    _reconstructActiveFormattingElements() {
      const listLength = this.activeFormattingElements.entries.length;
      if (listLength) {
        const endIndex = this.activeFormattingElements.entries.findIndex((entry) => entry.type === EntryType.Marker || this.openElements.contains(entry.element));
        const unopenIdx = endIndex === -1 ? listLength - 1 : endIndex - 1;
        for (let i = unopenIdx; i >= 0; i--) {
          const entry = this.activeFormattingElements.entries[i];
          this._insertElement(entry.token, this.treeAdapter.getNamespaceURI(entry.element));
          entry.element = this.openElements.current;
        }
      }
    }
    //Close elements
    /** @protected */
    _closeTableCell() {
      this.openElements.generateImpliedEndTags();
      this.openElements.popUntilTableCellPopped();
      this.activeFormattingElements.clearToLastMarker();
      this.insertionMode = InsertionMode.IN_ROW;
    }
    /** @protected */
    _closePElement() {
      this.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.P);
      this.openElements.popUntilTagNamePopped(TAG_ID.P);
    }
    //Insertion modes
    /** @protected */
    _resetInsertionMode() {
      for (let i = this.openElements.stackTop; i >= 0; i--) {
        switch (i === 0 && this.fragmentContext ? this.fragmentContextID : this.openElements.tagIDs[i]) {
          case TAG_ID.TR: {
            this.insertionMode = InsertionMode.IN_ROW;
            return;
          }
          case TAG_ID.TBODY:
          case TAG_ID.THEAD:
          case TAG_ID.TFOOT: {
            this.insertionMode = InsertionMode.IN_TABLE_BODY;
            return;
          }
          case TAG_ID.CAPTION: {
            this.insertionMode = InsertionMode.IN_CAPTION;
            return;
          }
          case TAG_ID.COLGROUP: {
            this.insertionMode = InsertionMode.IN_COLUMN_GROUP;
            return;
          }
          case TAG_ID.TABLE: {
            this.insertionMode = InsertionMode.IN_TABLE;
            return;
          }
          case TAG_ID.BODY: {
            this.insertionMode = InsertionMode.IN_BODY;
            return;
          }
          case TAG_ID.FRAMESET: {
            this.insertionMode = InsertionMode.IN_FRAMESET;
            return;
          }
          case TAG_ID.SELECT: {
            this._resetInsertionModeForSelect(i);
            return;
          }
          case TAG_ID.TEMPLATE: {
            this.insertionMode = this.tmplInsertionModeStack[0];
            return;
          }
          case TAG_ID.HTML: {
            this.insertionMode = this.headElement ? InsertionMode.AFTER_HEAD : InsertionMode.BEFORE_HEAD;
            return;
          }
          case TAG_ID.TD:
          case TAG_ID.TH: {
            if (i > 0) {
              this.insertionMode = InsertionMode.IN_CELL;
              return;
            }
            break;
          }
          case TAG_ID.HEAD: {
            if (i > 0) {
              this.insertionMode = InsertionMode.IN_HEAD;
              return;
            }
            break;
          }
        }
      }
      this.insertionMode = InsertionMode.IN_BODY;
    }
    /** @protected */
    _resetInsertionModeForSelect(selectIdx) {
      if (selectIdx > 0) {
        for (let i = selectIdx - 1; i > 0; i--) {
          const tn = this.openElements.tagIDs[i];
          if (tn === TAG_ID.TEMPLATE) {
            break;
          } else if (tn === TAG_ID.TABLE) {
            this.insertionMode = InsertionMode.IN_SELECT_IN_TABLE;
            return;
          }
        }
      }
      this.insertionMode = InsertionMode.IN_SELECT;
    }
    //Foster parenting
    /** @protected */
    _isElementCausesFosterParenting(tn) {
      return TABLE_STRUCTURE_TAGS.has(tn);
    }
    /** @protected */
    _shouldFosterParentOnInsertion() {
      return this.fosterParentingEnabled && this.openElements.currentTagId !== void 0 && this._isElementCausesFosterParenting(this.openElements.currentTagId);
    }
    /** @protected */
    _findFosterParentingLocation() {
      for (let i = this.openElements.stackTop; i >= 0; i--) {
        const openElement = this.openElements.items[i];
        switch (this.openElements.tagIDs[i]) {
          case TAG_ID.TEMPLATE: {
            if (this.treeAdapter.getNamespaceURI(openElement) === NS.HTML) {
              return { parent: this.treeAdapter.getTemplateContent(openElement), beforeElement: null };
            }
            break;
          }
          case TAG_ID.TABLE: {
            const parent = this.treeAdapter.getParentNode(openElement);
            if (parent) {
              return { parent, beforeElement: openElement };
            }
            return { parent: this.openElements.items[i - 1], beforeElement: null };
          }
          default:
        }
      }
      return { parent: this.openElements.items[0], beforeElement: null };
    }
    /** @protected */
    _fosterParentElement(element) {
      const location2 = this._findFosterParentingLocation();
      if (location2.beforeElement) {
        this.treeAdapter.insertBefore(location2.parent, element, location2.beforeElement);
      } else {
        this.treeAdapter.appendChild(location2.parent, element);
      }
    }
    //Special elements
    /** @protected */
    _isSpecialElement(element, id) {
      const ns = this.treeAdapter.getNamespaceURI(element);
      return SPECIAL_ELEMENTS[ns].has(id);
    }
    /** @internal */
    onCharacter(token) {
      this.skipNextNewLine = false;
      if (this.tokenizer.inForeignNode) {
        characterInForeignContent(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_TEMPLATE: {
          characterInBody(this, token);
          break;
        }
        case InsertionMode.TEXT:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          characterInTableText(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          tokenInColumnGroup(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          tokenAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onNullCharacter(token) {
      this.skipNextNewLine = false;
      if (this.tokenizer.inForeignNode) {
        nullCharacterInForeignContent(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          tokenInColumnGroup(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          tokenAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onComment(token) {
      this.skipNextNewLine = false;
      if (this.currentNotInHTML) {
        appendComment(this, token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.INITIAL:
        case InsertionMode.BEFORE_HTML:
        case InsertionMode.BEFORE_HEAD:
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD:
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE:
        case InsertionMode.IN_TEMPLATE:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET: {
          appendComment(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          appendCommentToRootHtmlElement(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          appendCommentToDocument(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onDoctype(token) {
      this.skipNextNewLine = false;
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          doctypeInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD:
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD: {
          this._err(token, ERR.misplacedDoctype);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onStartTag(token) {
      this.skipNextNewLine = false;
      this.currentToken = token;
      this._processStartTag(token);
      if (token.selfClosing && !token.ackSelfClosing) {
        this._err(token, ERR.nonVoidHtmlElementStartTagWithTrailingSolidus);
      }
    }
    /**
     * Processes a given start tag.
     *
     * `onStartTag` checks if a self-closing tag was recognized. When a token
     * is moved inbetween multiple insertion modes, this check for self-closing
     * could lead to false positives. To avoid this, `_processStartTag` is used
     * for nested calls.
     *
     * @param token The token to process.
     * @protected
     */
    _processStartTag(token) {
      if (this.shouldProcessStartTagTokenInForeignContent(token)) {
        startTagInForeignContent(this, token);
      } else {
        this._startTagOutsideForeignContent(token);
      }
    }
    /** @protected */
    _startTagOutsideForeignContent(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          startTagBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          startTagBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          startTagInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          startTagInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          startTagAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY: {
          startTagInBody(this, token);
          break;
        }
        case InsertionMode.IN_TABLE: {
          startTagInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_CAPTION: {
          startTagInCaption(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          startTagInColumnGroup(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_BODY: {
          startTagInTableBody(this, token);
          break;
        }
        case InsertionMode.IN_ROW: {
          startTagInRow(this, token);
          break;
        }
        case InsertionMode.IN_CELL: {
          startTagInCell(this, token);
          break;
        }
        case InsertionMode.IN_SELECT: {
          startTagInSelect(this, token);
          break;
        }
        case InsertionMode.IN_SELECT_IN_TABLE: {
          startTagInSelectInTable(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          startTagInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          startTagAfterBody(this, token);
          break;
        }
        case InsertionMode.IN_FRAMESET: {
          startTagInFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_FRAMESET: {
          startTagAfterFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          startTagAfterAfterBody(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          startTagAfterAfterFrameset(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onEndTag(token) {
      this.skipNextNewLine = false;
      this.currentToken = token;
      if (this.currentNotInHTML) {
        endTagInForeignContent(this, token);
      } else {
        this._endTagOutsideForeignContent(token);
      }
    }
    /** @protected */
    _endTagOutsideForeignContent(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          endTagBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          endTagBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          endTagInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          endTagInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          endTagAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY: {
          endTagInBody(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          endTagInText(this, token);
          break;
        }
        case InsertionMode.IN_TABLE: {
          endTagInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_CAPTION: {
          endTagInCaption(this, token);
          break;
        }
        case InsertionMode.IN_COLUMN_GROUP: {
          endTagInColumnGroup(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_BODY: {
          endTagInTableBody(this, token);
          break;
        }
        case InsertionMode.IN_ROW: {
          endTagInRow(this, token);
          break;
        }
        case InsertionMode.IN_CELL: {
          endTagInCell(this, token);
          break;
        }
        case InsertionMode.IN_SELECT: {
          endTagInSelect(this, token);
          break;
        }
        case InsertionMode.IN_SELECT_IN_TABLE: {
          endTagInSelectInTable(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          endTagInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY: {
          endTagAfterBody(this, token);
          break;
        }
        case InsertionMode.IN_FRAMESET: {
          endTagInFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_FRAMESET: {
          endTagAfterFrameset(this, token);
          break;
        }
        case InsertionMode.AFTER_AFTER_BODY: {
          tokenAfterAfterBody(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onEof(token) {
      switch (this.insertionMode) {
        case InsertionMode.INITIAL: {
          tokenInInitialMode(this, token);
          break;
        }
        case InsertionMode.BEFORE_HTML: {
          tokenBeforeHtml(this, token);
          break;
        }
        case InsertionMode.BEFORE_HEAD: {
          tokenBeforeHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD: {
          tokenInHead(this, token);
          break;
        }
        case InsertionMode.IN_HEAD_NO_SCRIPT: {
          tokenInHeadNoScript(this, token);
          break;
        }
        case InsertionMode.AFTER_HEAD: {
          tokenAfterHead(this, token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE: {
          eofInBody(this, token);
          break;
        }
        case InsertionMode.TEXT: {
          eofInText(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          tokenInTableText(this, token);
          break;
        }
        case InsertionMode.IN_TEMPLATE: {
          eofInTemplate(this, token);
          break;
        }
        case InsertionMode.AFTER_BODY:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET:
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          stopParsing(this, token);
          break;
        }
        default:
      }
    }
    /** @internal */
    onWhitespaceCharacter(token) {
      if (this.skipNextNewLine) {
        this.skipNextNewLine = false;
        if (token.chars.charCodeAt(0) === CODE_POINTS.LINE_FEED) {
          if (token.chars.length === 1) {
            return;
          }
          token.chars = token.chars.substr(1);
        }
      }
      if (this.tokenizer.inForeignNode) {
        this._insertCharacters(token);
        return;
      }
      switch (this.insertionMode) {
        case InsertionMode.IN_HEAD:
        case InsertionMode.IN_HEAD_NO_SCRIPT:
        case InsertionMode.AFTER_HEAD:
        case InsertionMode.TEXT:
        case InsertionMode.IN_COLUMN_GROUP:
        case InsertionMode.IN_SELECT:
        case InsertionMode.IN_SELECT_IN_TABLE:
        case InsertionMode.IN_FRAMESET:
        case InsertionMode.AFTER_FRAMESET: {
          this._insertCharacters(token);
          break;
        }
        case InsertionMode.IN_BODY:
        case InsertionMode.IN_CAPTION:
        case InsertionMode.IN_CELL:
        case InsertionMode.IN_TEMPLATE:
        case InsertionMode.AFTER_BODY:
        case InsertionMode.AFTER_AFTER_BODY:
        case InsertionMode.AFTER_AFTER_FRAMESET: {
          whitespaceCharacterInBody(this, token);
          break;
        }
        case InsertionMode.IN_TABLE:
        case InsertionMode.IN_TABLE_BODY:
        case InsertionMode.IN_ROW: {
          characterInTable(this, token);
          break;
        }
        case InsertionMode.IN_TABLE_TEXT: {
          whitespaceCharacterInTableText(this, token);
          break;
        }
        default:
      }
    }
  };
  function aaObtainFormattingElementEntry(p, token) {
    let formattingElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(token.tagName);
    if (formattingElementEntry) {
      if (!p.openElements.contains(formattingElementEntry.element)) {
        p.activeFormattingElements.removeEntry(formattingElementEntry);
        formattingElementEntry = null;
      } else if (!p.openElements.hasInScope(token.tagID)) {
        formattingElementEntry = null;
      }
    } else {
      genericEndTagInBody(p, token);
    }
    return formattingElementEntry;
  }
  function aaObtainFurthestBlock(p, formattingElementEntry) {
    let furthestBlock = null;
    let idx = p.openElements.stackTop;
    for (; idx >= 0; idx--) {
      const element = p.openElements.items[idx];
      if (element === formattingElementEntry.element) {
        break;
      }
      if (p._isSpecialElement(element, p.openElements.tagIDs[idx])) {
        furthestBlock = element;
      }
    }
    if (!furthestBlock) {
      p.openElements.shortenToLength(Math.max(idx, 0));
      p.activeFormattingElements.removeEntry(formattingElementEntry);
    }
    return furthestBlock;
  }
  function aaInnerLoop(p, furthestBlock, formattingElement) {
    let lastElement = furthestBlock;
    let nextElement = p.openElements.getCommonAncestor(furthestBlock);
    for (let i = 0, element = nextElement; element !== formattingElement; i++, element = nextElement) {
      nextElement = p.openElements.getCommonAncestor(element);
      const elementEntry = p.activeFormattingElements.getElementEntry(element);
      const counterOverflow = elementEntry && i >= AA_INNER_LOOP_ITER;
      const shouldRemoveFromOpenElements = !elementEntry || counterOverflow;
      if (shouldRemoveFromOpenElements) {
        if (counterOverflow) {
          p.activeFormattingElements.removeEntry(elementEntry);
        }
        p.openElements.remove(element);
      } else {
        element = aaRecreateElementFromEntry(p, elementEntry);
        if (lastElement === furthestBlock) {
          p.activeFormattingElements.bookmark = elementEntry;
        }
        p.treeAdapter.detachNode(lastElement);
        p.treeAdapter.appendChild(element, lastElement);
        lastElement = element;
      }
    }
    return lastElement;
  }
  function aaRecreateElementFromEntry(p, elementEntry) {
    const ns = p.treeAdapter.getNamespaceURI(elementEntry.element);
    const newElement = p.treeAdapter.createElement(elementEntry.token.tagName, ns, elementEntry.token.attrs);
    p.openElements.replace(elementEntry.element, newElement);
    elementEntry.element = newElement;
    return newElement;
  }
  function aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement) {
    const tn = p.treeAdapter.getTagName(commonAncestor);
    const tid = getTagID(tn);
    if (p._isElementCausesFosterParenting(tid)) {
      p._fosterParentElement(lastElement);
    } else {
      const ns = p.treeAdapter.getNamespaceURI(commonAncestor);
      if (tid === TAG_ID.TEMPLATE && ns === NS.HTML) {
        commonAncestor = p.treeAdapter.getTemplateContent(commonAncestor);
      }
      p.treeAdapter.appendChild(commonAncestor, lastElement);
    }
  }
  function aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry) {
    const ns = p.treeAdapter.getNamespaceURI(formattingElementEntry.element);
    const { token } = formattingElementEntry;
    const newElement = p.treeAdapter.createElement(token.tagName, ns, token.attrs);
    p._adoptNodes(furthestBlock, newElement);
    p.treeAdapter.appendChild(furthestBlock, newElement);
    p.activeFormattingElements.insertElementAfterBookmark(newElement, token);
    p.activeFormattingElements.removeEntry(formattingElementEntry);
    p.openElements.remove(formattingElementEntry.element);
    p.openElements.insertAfter(furthestBlock, newElement, token.tagID);
  }
  function callAdoptionAgency(p, token) {
    for (let i = 0; i < AA_OUTER_LOOP_ITER; i++) {
      const formattingElementEntry = aaObtainFormattingElementEntry(p, token);
      if (!formattingElementEntry) {
        break;
      }
      const furthestBlock = aaObtainFurthestBlock(p, formattingElementEntry);
      if (!furthestBlock) {
        break;
      }
      p.activeFormattingElements.bookmark = formattingElementEntry;
      const lastElement = aaInnerLoop(p, furthestBlock, formattingElementEntry.element);
      const commonAncestor = p.openElements.getCommonAncestor(formattingElementEntry.element);
      p.treeAdapter.detachNode(lastElement);
      if (commonAncestor)
        aaInsertLastNodeInCommonAncestor(p, commonAncestor, lastElement);
      aaReplaceFormattingElement(p, furthestBlock, formattingElementEntry);
    }
  }
  function appendComment(p, token) {
    p._appendCommentNode(token, p.openElements.currentTmplContentOrNode);
  }
  function appendCommentToRootHtmlElement(p, token) {
    p._appendCommentNode(token, p.openElements.items[0]);
  }
  function appendCommentToDocument(p, token) {
    p._appendCommentNode(token, p.document);
  }
  function stopParsing(p, token) {
    p.stopped = true;
    if (token.location) {
      const target = p.fragmentContext ? 0 : 2;
      for (let i = p.openElements.stackTop; i >= target; i--) {
        p._setEndLocation(p.openElements.items[i], token);
      }
      if (!p.fragmentContext && p.openElements.stackTop >= 0) {
        const htmlElement = p.openElements.items[0];
        const htmlLocation = p.treeAdapter.getNodeSourceCodeLocation(htmlElement);
        if (htmlLocation && !htmlLocation.endTag) {
          p._setEndLocation(htmlElement, token);
          if (p.openElements.stackTop >= 1) {
            const bodyElement = p.openElements.items[1];
            const bodyLocation = p.treeAdapter.getNodeSourceCodeLocation(bodyElement);
            if (bodyLocation && !bodyLocation.endTag) {
              p._setEndLocation(bodyElement, token);
            }
          }
        }
      }
    }
  }
  function doctypeInInitialMode(p, token) {
    p._setDocumentType(token);
    const mode = token.forceQuirks ? DOCUMENT_MODE.QUIRKS : getDocumentMode(token);
    if (!isConforming(token)) {
      p._err(token, ERR.nonConformingDoctype);
    }
    p.treeAdapter.setDocumentMode(p.document, mode);
    p.insertionMode = InsertionMode.BEFORE_HTML;
  }
  function tokenInInitialMode(p, token) {
    p._err(token, ERR.missingDoctype, true);
    p.treeAdapter.setDocumentMode(p.document, DOCUMENT_MODE.QUIRKS);
    p.insertionMode = InsertionMode.BEFORE_HTML;
    p._processToken(token);
  }
  function startTagBeforeHtml(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.BEFORE_HEAD;
    } else {
      tokenBeforeHtml(p, token);
    }
  }
  function endTagBeforeHtml(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.HTML || tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.BR) {
      tokenBeforeHtml(p, token);
    }
  }
  function tokenBeforeHtml(p, token) {
    p._insertFakeRootElement();
    p.insertionMode = InsertionMode.BEFORE_HEAD;
    p._processToken(token);
  }
  function startTagBeforeHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.HEAD: {
        p._insertElement(token, NS.HTML);
        p.headElement = p.openElements.current;
        p.insertionMode = InsertionMode.IN_HEAD;
        break;
      }
      default: {
        tokenBeforeHead(p, token);
      }
    }
  }
  function endTagBeforeHead(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.HEAD || tn === TAG_ID.BODY || tn === TAG_ID.HTML || tn === TAG_ID.BR) {
      tokenBeforeHead(p, token);
    } else {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
  function tokenBeforeHead(p, token) {
    p._insertFakeElement(TAG_NAMES.HEAD, TAG_ID.HEAD);
    p.headElement = p.openElements.current;
    p.insertionMode = InsertionMode.IN_HEAD;
    p._processToken(token);
  }
  function startTagInHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.TITLE: {
        p._switchToTextParsing(token, TokenizerMode.RCDATA);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        if (p.options.scriptingEnabled) {
          p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
        } else {
          p._insertElement(token, NS.HTML);
          p.insertionMode = InsertionMode.IN_HEAD_NO_SCRIPT;
        }
        break;
      }
      case TAG_ID.NOFRAMES:
      case TAG_ID.STYLE: {
        p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
        break;
      }
      case TAG_ID.SCRIPT: {
        p._switchToTextParsing(token, TokenizerMode.SCRIPT_DATA);
        break;
      }
      case TAG_ID.TEMPLATE: {
        p._insertTemplate(token);
        p.activeFormattingElements.insertMarker();
        p.framesetOk = false;
        p.insertionMode = InsertionMode.IN_TEMPLATE;
        p.tmplInsertionModeStack.unshift(InsertionMode.IN_TEMPLATE);
        break;
      }
      case TAG_ID.HEAD: {
        p._err(token, ERR.misplacedStartTagForHeadElement);
        break;
      }
      default: {
        tokenInHead(p, token);
      }
    }
  }
  function endTagInHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HEAD: {
        p.openElements.pop();
        p.insertionMode = InsertionMode.AFTER_HEAD;
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.BR:
      case TAG_ID.HTML: {
        tokenInHead(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function templateEndTagInHead(p, token) {
    if (p.openElements.tmplCount > 0) {
      p.openElements.generateImpliedEndTagsThoroughly();
      if (p.openElements.currentTagId !== TAG_ID.TEMPLATE) {
        p._err(token, ERR.closingOfElementWithOpenChildElements);
      }
      p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
      p.activeFormattingElements.clearToLastMarker();
      p.tmplInsertionModeStack.shift();
      p._resetInsertionMode();
    } else {
      p._err(token, ERR.endTagWithoutMatchingOpenElement);
    }
  }
  function tokenInHead(p, token) {
    p.openElements.pop();
    p.insertionMode = InsertionMode.AFTER_HEAD;
    p._processToken(token);
  }
  function startTagInHeadNoScript(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.HEAD:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.STYLE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        p._err(token, ERR.nestedNoscriptInHead);
        break;
      }
      default: {
        tokenInHeadNoScript(p, token);
      }
    }
  }
  function endTagInHeadNoScript(p, token) {
    switch (token.tagID) {
      case TAG_ID.NOSCRIPT: {
        p.openElements.pop();
        p.insertionMode = InsertionMode.IN_HEAD;
        break;
      }
      case TAG_ID.BR: {
        tokenInHeadNoScript(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function tokenInHeadNoScript(p, token) {
    const errCode = token.type === TokenType.EOF ? ERR.openElementsLeftAfterEof : ERR.disallowedContentInNoscriptInHead;
    p._err(token, errCode);
    p.openElements.pop();
    p.insertionMode = InsertionMode.IN_HEAD;
    p._processToken(token);
  }
  function startTagAfterHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.BODY: {
        p._insertElement(token, NS.HTML);
        p.framesetOk = false;
        p.insertionMode = InsertionMode.IN_BODY;
        break;
      }
      case TAG_ID.FRAMESET: {
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_FRAMESET;
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.SCRIPT:
      case TAG_ID.STYLE:
      case TAG_ID.TEMPLATE:
      case TAG_ID.TITLE: {
        p._err(token, ERR.abandonedHeadElementChild);
        p.openElements.push(p.headElement, TAG_ID.HEAD);
        startTagInHead(p, token);
        p.openElements.remove(p.headElement);
        break;
      }
      case TAG_ID.HEAD: {
        p._err(token, ERR.misplacedStartTagForHeadElement);
        break;
      }
      default: {
        tokenAfterHead(p, token);
      }
    }
  }
  function endTagAfterHead(p, token) {
    switch (token.tagID) {
      case TAG_ID.BODY:
      case TAG_ID.HTML:
      case TAG_ID.BR: {
        tokenAfterHead(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        p._err(token, ERR.endTagWithoutMatchingOpenElement);
      }
    }
  }
  function tokenAfterHead(p, token) {
    p._insertFakeElement(TAG_NAMES.BODY, TAG_ID.BODY);
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function modeInBody(p, token) {
    switch (token.type) {
      case TokenType.CHARACTER: {
        characterInBody(p, token);
        break;
      }
      case TokenType.WHITESPACE_CHARACTER: {
        whitespaceCharacterInBody(p, token);
        break;
      }
      case TokenType.COMMENT: {
        appendComment(p, token);
        break;
      }
      case TokenType.START_TAG: {
        startTagInBody(p, token);
        break;
      }
      case TokenType.END_TAG: {
        endTagInBody(p, token);
        break;
      }
      case TokenType.EOF: {
        eofInBody(p, token);
        break;
      }
      default:
    }
  }
  function whitespaceCharacterInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertCharacters(token);
  }
  function characterInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertCharacters(token);
    p.framesetOk = false;
  }
  function htmlStartTagInBody(p, token) {
    if (p.openElements.tmplCount === 0) {
      p.treeAdapter.adoptAttributes(p.openElements.items[0], token.attrs);
    }
  }
  function bodyStartTagInBody(p, token) {
    const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
    if (bodyElement && p.openElements.tmplCount === 0) {
      p.framesetOk = false;
      p.treeAdapter.adoptAttributes(bodyElement, token.attrs);
    }
  }
  function framesetStartTagInBody(p, token) {
    const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
    if (p.framesetOk && bodyElement) {
      p.treeAdapter.detachNode(bodyElement);
      p.openElements.popAllUpToHtmlElement();
      p._insertElement(token, NS.HTML);
      p.insertionMode = InsertionMode.IN_FRAMESET;
    }
  }
  function addressStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
  }
  function numberedHeaderStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    if (p.openElements.currentTagId !== void 0 && NUMBERED_HEADERS.has(p.openElements.currentTagId)) {
      p.openElements.pop();
    }
    p._insertElement(token, NS.HTML);
  }
  function preStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.skipNextNewLine = true;
    p.framesetOk = false;
  }
  function formStartTagInBody(p, token) {
    const inTemplate = p.openElements.tmplCount > 0;
    if (!p.formElement || inTemplate) {
      if (p.openElements.hasInButtonScope(TAG_ID.P)) {
        p._closePElement();
      }
      p._insertElement(token, NS.HTML);
      if (!inTemplate) {
        p.formElement = p.openElements.current;
      }
    }
  }
  function listItemStartTagInBody(p, token) {
    p.framesetOk = false;
    const tn = token.tagID;
    for (let i = p.openElements.stackTop; i >= 0; i--) {
      const elementId = p.openElements.tagIDs[i];
      if (tn === TAG_ID.LI && elementId === TAG_ID.LI || (tn === TAG_ID.DD || tn === TAG_ID.DT) && (elementId === TAG_ID.DD || elementId === TAG_ID.DT)) {
        p.openElements.generateImpliedEndTagsWithExclusion(elementId);
        p.openElements.popUntilTagNamePopped(elementId);
        break;
      }
      if (elementId !== TAG_ID.ADDRESS && elementId !== TAG_ID.DIV && elementId !== TAG_ID.P && p._isSpecialElement(p.openElements.items[i], elementId)) {
        break;
      }
    }
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
  }
  function plaintextStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.tokenizer.state = TokenizerMode.PLAINTEXT;
  }
  function buttonStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BUTTON)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(TAG_ID.BUTTON);
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
  }
  function aStartTagInBody(p, token) {
    const activeElementEntry = p.activeFormattingElements.getElementEntryInScopeWithTagName(TAG_NAMES.A);
    if (activeElementEntry) {
      callAdoptionAgency(p, token);
      p.openElements.remove(activeElementEntry.element);
      p.activeFormattingElements.removeEntry(activeElementEntry);
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function bStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function nobrStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    if (p.openElements.hasInScope(TAG_ID.NOBR)) {
      callAdoptionAgency(p, token);
      p._reconstructActiveFormattingElements();
    }
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.pushElement(p.openElements.current, token);
  }
  function appletStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.activeFormattingElements.insertMarker();
    p.framesetOk = false;
  }
  function tableStartTagInBody(p, token) {
    if (p.treeAdapter.getDocumentMode(p.document) !== DOCUMENT_MODE.QUIRKS && p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
    p.insertionMode = InsertionMode.IN_TABLE;
  }
  function areaStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElement(token, NS.HTML);
    p.framesetOk = false;
    token.ackSelfClosing = true;
  }
  function isHiddenInput(token) {
    const inputType = getTokenAttr(token, ATTRS.TYPE);
    return inputType != null && inputType.toLowerCase() === HIDDEN_INPUT_TYPE;
  }
  function inputStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._appendElement(token, NS.HTML);
    if (!isHiddenInput(token)) {
      p.framesetOk = false;
    }
    token.ackSelfClosing = true;
  }
  function paramStartTagInBody(p, token) {
    p._appendElement(token, NS.HTML);
    token.ackSelfClosing = true;
  }
  function hrStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._appendElement(token, NS.HTML);
    p.framesetOk = false;
    token.ackSelfClosing = true;
  }
  function imageStartTagInBody(p, token) {
    token.tagName = TAG_NAMES.IMG;
    token.tagID = TAG_ID.IMG;
    areaStartTagInBody(p, token);
  }
  function textareaStartTagInBody(p, token) {
    p._insertElement(token, NS.HTML);
    p.skipNextNewLine = true;
    p.tokenizer.state = TokenizerMode.RCDATA;
    p.originalInsertionMode = p.insertionMode;
    p.framesetOk = false;
    p.insertionMode = InsertionMode.TEXT;
  }
  function xmpStartTagInBody(p, token) {
    if (p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._closePElement();
    }
    p._reconstructActiveFormattingElements();
    p.framesetOk = false;
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function iframeStartTagInBody(p, token) {
    p.framesetOk = false;
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function rawTextStartTagInBody(p, token) {
    p._switchToTextParsing(token, TokenizerMode.RAWTEXT);
  }
  function selectStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
    p.framesetOk = false;
    p.insertionMode = p.insertionMode === InsertionMode.IN_TABLE || p.insertionMode === InsertionMode.IN_CAPTION || p.insertionMode === InsertionMode.IN_TABLE_BODY || p.insertionMode === InsertionMode.IN_ROW || p.insertionMode === InsertionMode.IN_CELL ? InsertionMode.IN_SELECT_IN_TABLE : InsertionMode.IN_SELECT;
  }
  function optgroupStartTagInBody(p, token) {
    if (p.openElements.currentTagId === TAG_ID.OPTION) {
      p.openElements.pop();
    }
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
  }
  function rbStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.RUBY)) {
      p.openElements.generateImpliedEndTags();
    }
    p._insertElement(token, NS.HTML);
  }
  function rtStartTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.RUBY)) {
      p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.RTC);
    }
    p._insertElement(token, NS.HTML);
  }
  function mathStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    adjustTokenMathMLAttrs(token);
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, NS.MATHML);
    } else {
      p._insertElement(token, NS.MATHML);
    }
    token.ackSelfClosing = true;
  }
  function svgStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    adjustTokenSVGAttrs(token);
    adjustTokenXMLAttrs(token);
    if (token.selfClosing) {
      p._appendElement(token, NS.SVG);
    } else {
      p._insertElement(token, NS.SVG);
    }
    token.ackSelfClosing = true;
  }
  function genericStartTagInBody(p, token) {
    p._reconstructActiveFormattingElements();
    p._insertElement(token, NS.HTML);
  }
  function startTagInBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.I:
      case TAG_ID.S:
      case TAG_ID.B:
      case TAG_ID.U:
      case TAG_ID.EM:
      case TAG_ID.TT:
      case TAG_ID.BIG:
      case TAG_ID.CODE:
      case TAG_ID.FONT:
      case TAG_ID.SMALL:
      case TAG_ID.STRIKE:
      case TAG_ID.STRONG: {
        bStartTagInBody(p, token);
        break;
      }
      case TAG_ID.A: {
        aStartTagInBody(p, token);
        break;
      }
      case TAG_ID.H1:
      case TAG_ID.H2:
      case TAG_ID.H3:
      case TAG_ID.H4:
      case TAG_ID.H5:
      case TAG_ID.H6: {
        numberedHeaderStartTagInBody(p, token);
        break;
      }
      case TAG_ID.P:
      case TAG_ID.DL:
      case TAG_ID.OL:
      case TAG_ID.UL:
      case TAG_ID.DIV:
      case TAG_ID.DIR:
      case TAG_ID.NAV:
      case TAG_ID.MAIN:
      case TAG_ID.MENU:
      case TAG_ID.ASIDE:
      case TAG_ID.CENTER:
      case TAG_ID.FIGURE:
      case TAG_ID.FOOTER:
      case TAG_ID.HEADER:
      case TAG_ID.HGROUP:
      case TAG_ID.DIALOG:
      case TAG_ID.DETAILS:
      case TAG_ID.ADDRESS:
      case TAG_ID.ARTICLE:
      case TAG_ID.SEARCH:
      case TAG_ID.SECTION:
      case TAG_ID.SUMMARY:
      case TAG_ID.FIELDSET:
      case TAG_ID.BLOCKQUOTE:
      case TAG_ID.FIGCAPTION: {
        addressStartTagInBody(p, token);
        break;
      }
      case TAG_ID.LI:
      case TAG_ID.DD:
      case TAG_ID.DT: {
        listItemStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BR:
      case TAG_ID.IMG:
      case TAG_ID.WBR:
      case TAG_ID.AREA:
      case TAG_ID.EMBED:
      case TAG_ID.KEYGEN: {
        areaStartTagInBody(p, token);
        break;
      }
      case TAG_ID.HR: {
        hrStartTagInBody(p, token);
        break;
      }
      case TAG_ID.RB:
      case TAG_ID.RTC: {
        rbStartTagInBody(p, token);
        break;
      }
      case TAG_ID.RT:
      case TAG_ID.RP: {
        rtStartTagInBody(p, token);
        break;
      }
      case TAG_ID.PRE:
      case TAG_ID.LISTING: {
        preStartTagInBody(p, token);
        break;
      }
      case TAG_ID.XMP: {
        xmpStartTagInBody(p, token);
        break;
      }
      case TAG_ID.SVG: {
        svgStartTagInBody(p, token);
        break;
      }
      case TAG_ID.HTML: {
        htmlStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BASE:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.STYLE:
      case TAG_ID.TITLE:
      case TAG_ID.SCRIPT:
      case TAG_ID.BGSOUND:
      case TAG_ID.BASEFONT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.BODY: {
        bodyStartTagInBody(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOBR: {
        nobrStartTagInBody(p, token);
        break;
      }
      case TAG_ID.MATH: {
        mathStartTagInBody(p, token);
        break;
      }
      case TAG_ID.TABLE: {
        tableStartTagInBody(p, token);
        break;
      }
      case TAG_ID.INPUT: {
        inputStartTagInBody(p, token);
        break;
      }
      case TAG_ID.PARAM:
      case TAG_ID.TRACK:
      case TAG_ID.SOURCE: {
        paramStartTagInBody(p, token);
        break;
      }
      case TAG_ID.IMAGE: {
        imageStartTagInBody(p, token);
        break;
      }
      case TAG_ID.BUTTON: {
        buttonStartTagInBody(p, token);
        break;
      }
      case TAG_ID.APPLET:
      case TAG_ID.OBJECT:
      case TAG_ID.MARQUEE: {
        appletStartTagInBody(p, token);
        break;
      }
      case TAG_ID.IFRAME: {
        iframeStartTagInBody(p, token);
        break;
      }
      case TAG_ID.SELECT: {
        selectStartTagInBody(p, token);
        break;
      }
      case TAG_ID.OPTION:
      case TAG_ID.OPTGROUP: {
        optgroupStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOEMBED:
      case TAG_ID.NOFRAMES: {
        rawTextStartTagInBody(p, token);
        break;
      }
      case TAG_ID.FRAMESET: {
        framesetStartTagInBody(p, token);
        break;
      }
      case TAG_ID.TEXTAREA: {
        textareaStartTagInBody(p, token);
        break;
      }
      case TAG_ID.NOSCRIPT: {
        if (p.options.scriptingEnabled) {
          rawTextStartTagInBody(p, token);
        } else {
          genericStartTagInBody(p, token);
        }
        break;
      }
      case TAG_ID.PLAINTEXT: {
        plaintextStartTagInBody(p, token);
        break;
      }
      case TAG_ID.COL:
      case TAG_ID.TH:
      case TAG_ID.TD:
      case TAG_ID.TR:
      case TAG_ID.HEAD:
      case TAG_ID.FRAME:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.CAPTION:
      case TAG_ID.COLGROUP: {
        break;
      }
      default: {
        genericStartTagInBody(p, token);
      }
    }
  }
  function bodyEndTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BODY)) {
      p.insertionMode = InsertionMode.AFTER_BODY;
      if (p.options.sourceCodeLocationInfo) {
        const bodyElement = p.openElements.tryPeekProperlyNestedBodyElement();
        if (bodyElement) {
          p._setEndLocation(bodyElement, token);
        }
      }
    }
  }
  function htmlEndTagInBody(p, token) {
    if (p.openElements.hasInScope(TAG_ID.BODY)) {
      p.insertionMode = InsertionMode.AFTER_BODY;
      endTagAfterBody(p, token);
    }
  }
  function addressEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(tn);
    }
  }
  function formEndTagInBody(p) {
    const inTemplate = p.openElements.tmplCount > 0;
    const { formElement } = p;
    if (!inTemplate) {
      p.formElement = null;
    }
    if ((formElement || inTemplate) && p.openElements.hasInScope(TAG_ID.FORM)) {
      p.openElements.generateImpliedEndTags();
      if (inTemplate) {
        p.openElements.popUntilTagNamePopped(TAG_ID.FORM);
      } else if (formElement) {
        p.openElements.remove(formElement);
      }
    }
  }
  function pEndTagInBody(p) {
    if (!p.openElements.hasInButtonScope(TAG_ID.P)) {
      p._insertFakeElement(TAG_NAMES.P, TAG_ID.P);
    }
    p._closePElement();
  }
  function liEndTagInBody(p) {
    if (p.openElements.hasInListItemScope(TAG_ID.LI)) {
      p.openElements.generateImpliedEndTagsWithExclusion(TAG_ID.LI);
      p.openElements.popUntilTagNamePopped(TAG_ID.LI);
    }
  }
  function ddEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTagsWithExclusion(tn);
      p.openElements.popUntilTagNamePopped(tn);
    }
  }
  function numberedHeaderEndTagInBody(p) {
    if (p.openElements.hasNumberedHeaderInScope()) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilNumberedHeaderPopped();
    }
  }
  function appletEndTagInBody(p, token) {
    const tn = token.tagID;
    if (p.openElements.hasInScope(tn)) {
      p.openElements.generateImpliedEndTags();
      p.openElements.popUntilTagNamePopped(tn);
      p.activeFormattingElements.clearToLastMarker();
    }
  }
  function brEndTagInBody(p) {
    p._reconstructActiveFormattingElements();
    p._insertFakeElement(TAG_NAMES.BR, TAG_ID.BR);
    p.openElements.pop();
    p.framesetOk = false;
  }
  function genericEndTagInBody(p, token) {
    const tn = token.tagName;
    const tid = token.tagID;
    for (let i = p.openElements.stackTop; i > 0; i--) {
      const element = p.openElements.items[i];
      const elementId = p.openElements.tagIDs[i];
      if (tid === elementId && (tid !== TAG_ID.UNKNOWN || p.treeAdapter.getTagName(element) === tn)) {
        p.openElements.generateImpliedEndTagsWithExclusion(tid);
        if (p.openElements.stackTop >= i)
          p.openElements.shortenToLength(i);
        break;
      }
      if (p._isSpecialElement(element, elementId)) {
        break;
      }
    }
  }
  function endTagInBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.A:
      case TAG_ID.B:
      case TAG_ID.I:
      case TAG_ID.S:
      case TAG_ID.U:
      case TAG_ID.EM:
      case TAG_ID.TT:
      case TAG_ID.BIG:
      case TAG_ID.CODE:
      case TAG_ID.FONT:
      case TAG_ID.NOBR:
      case TAG_ID.SMALL:
      case TAG_ID.STRIKE:
      case TAG_ID.STRONG: {
        callAdoptionAgency(p, token);
        break;
      }
      case TAG_ID.P: {
        pEndTagInBody(p);
        break;
      }
      case TAG_ID.DL:
      case TAG_ID.UL:
      case TAG_ID.OL:
      case TAG_ID.DIR:
      case TAG_ID.DIV:
      case TAG_ID.NAV:
      case TAG_ID.PRE:
      case TAG_ID.MAIN:
      case TAG_ID.MENU:
      case TAG_ID.ASIDE:
      case TAG_ID.BUTTON:
      case TAG_ID.CENTER:
      case TAG_ID.FIGURE:
      case TAG_ID.FOOTER:
      case TAG_ID.HEADER:
      case TAG_ID.HGROUP:
      case TAG_ID.DIALOG:
      case TAG_ID.ADDRESS:
      case TAG_ID.ARTICLE:
      case TAG_ID.DETAILS:
      case TAG_ID.SEARCH:
      case TAG_ID.SECTION:
      case TAG_ID.SUMMARY:
      case TAG_ID.LISTING:
      case TAG_ID.FIELDSET:
      case TAG_ID.BLOCKQUOTE:
      case TAG_ID.FIGCAPTION: {
        addressEndTagInBody(p, token);
        break;
      }
      case TAG_ID.LI: {
        liEndTagInBody(p);
        break;
      }
      case TAG_ID.DD:
      case TAG_ID.DT: {
        ddEndTagInBody(p, token);
        break;
      }
      case TAG_ID.H1:
      case TAG_ID.H2:
      case TAG_ID.H3:
      case TAG_ID.H4:
      case TAG_ID.H5:
      case TAG_ID.H6: {
        numberedHeaderEndTagInBody(p);
        break;
      }
      case TAG_ID.BR: {
        brEndTagInBody(p);
        break;
      }
      case TAG_ID.BODY: {
        bodyEndTagInBody(p, token);
        break;
      }
      case TAG_ID.HTML: {
        htmlEndTagInBody(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formEndTagInBody(p);
        break;
      }
      case TAG_ID.APPLET:
      case TAG_ID.OBJECT:
      case TAG_ID.MARQUEE: {
        appletEndTagInBody(p, token);
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default: {
        genericEndTagInBody(p, token);
      }
    }
  }
  function eofInBody(p, token) {
    if (p.tmplInsertionModeStack.length > 0) {
      eofInTemplate(p, token);
    } else {
      stopParsing(p, token);
    }
  }
  function endTagInText(p, token) {
    var _a3;
    if (token.tagID === TAG_ID.SCRIPT) {
      (_a3 = p.scriptHandler) === null || _a3 === void 0 ? void 0 : _a3.call(p, p.openElements.current);
    }
    p.openElements.pop();
    p.insertionMode = p.originalInsertionMode;
  }
  function eofInText(p, token) {
    p._err(token, ERR.eofInElementThatCanContainOnlyText);
    p.openElements.pop();
    p.insertionMode = p.originalInsertionMode;
    p.onEof(token);
  }
  function characterInTable(p, token) {
    if (p.openElements.currentTagId !== void 0 && TABLE_STRUCTURE_TAGS.has(p.openElements.currentTagId)) {
      p.pendingCharacterTokens.length = 0;
      p.hasNonWhitespacePendingCharacterToken = false;
      p.originalInsertionMode = p.insertionMode;
      p.insertionMode = InsertionMode.IN_TABLE_TEXT;
      switch (token.type) {
        case TokenType.CHARACTER: {
          characterInTableText(p, token);
          break;
        }
        case TokenType.WHITESPACE_CHARACTER: {
          whitespaceCharacterInTableText(p, token);
          break;
        }
      }
    } else {
      tokenInTable(p, token);
    }
  }
  function captionStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p.activeFormattingElements.insertMarker();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_CAPTION;
  }
  function colgroupStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
  }
  function colStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertFakeElement(TAG_NAMES.COLGROUP, TAG_ID.COLGROUP);
    p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
    startTagInColumnGroup(p, token);
  }
  function tbodyStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertElement(token, NS.HTML);
    p.insertionMode = InsertionMode.IN_TABLE_BODY;
  }
  function tdStartTagInTable(p, token) {
    p.openElements.clearBackToTableContext();
    p._insertFakeElement(TAG_NAMES.TBODY, TAG_ID.TBODY);
    p.insertionMode = InsertionMode.IN_TABLE_BODY;
    startTagInTableBody(p, token);
  }
  function tableStartTagInTable(p, token) {
    if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
      p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
      p._resetInsertionMode();
      p._processStartTag(token);
    }
  }
  function inputStartTagInTable(p, token) {
    if (isHiddenInput(token)) {
      p._appendElement(token, NS.HTML);
    } else {
      tokenInTable(p, token);
    }
    token.ackSelfClosing = true;
  }
  function formStartTagInTable(p, token) {
    if (!p.formElement && p.openElements.tmplCount === 0) {
      p._insertElement(token, NS.HTML);
      p.formElement = p.openElements.current;
      p.openElements.pop();
    }
  }
  function startTagInTable(p, token) {
    switch (token.tagID) {
      case TAG_ID.TD:
      case TAG_ID.TH:
      case TAG_ID.TR: {
        tdStartTagInTable(p, token);
        break;
      }
      case TAG_ID.STYLE:
      case TAG_ID.SCRIPT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      case TAG_ID.COL: {
        colStartTagInTable(p, token);
        break;
      }
      case TAG_ID.FORM: {
        formStartTagInTable(p, token);
        break;
      }
      case TAG_ID.TABLE: {
        tableStartTagInTable(p, token);
        break;
      }
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        tbodyStartTagInTable(p, token);
        break;
      }
      case TAG_ID.INPUT: {
        inputStartTagInTable(p, token);
        break;
      }
      case TAG_ID.CAPTION: {
        captionStartTagInTable(p, token);
        break;
      }
      case TAG_ID.COLGROUP: {
        colgroupStartTagInTable(p, token);
        break;
      }
      default: {
        tokenInTable(p, token);
      }
    }
  }
  function endTagInTable(p, token) {
    switch (token.tagID) {
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.TABLE)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.TABLE);
          p._resetInsertionMode();
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TBODY:
      case TAG_ID.TD:
      case TAG_ID.TFOOT:
      case TAG_ID.TH:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        break;
      }
      default: {
        tokenInTable(p, token);
      }
    }
  }
  function tokenInTable(p, token) {
    const savedFosterParentingState = p.fosterParentingEnabled;
    p.fosterParentingEnabled = true;
    modeInBody(p, token);
    p.fosterParentingEnabled = savedFosterParentingState;
  }
  function whitespaceCharacterInTableText(p, token) {
    p.pendingCharacterTokens.push(token);
  }
  function characterInTableText(p, token) {
    p.pendingCharacterTokens.push(token);
    p.hasNonWhitespacePendingCharacterToken = true;
  }
  function tokenInTableText(p, token) {
    let i = 0;
    if (p.hasNonWhitespacePendingCharacterToken) {
      for (; i < p.pendingCharacterTokens.length; i++) {
        tokenInTable(p, p.pendingCharacterTokens[i]);
      }
    } else {
      for (; i < p.pendingCharacterTokens.length; i++) {
        p._insertCharacters(p.pendingCharacterTokens[i]);
      }
    }
    p.insertionMode = p.originalInsertionMode;
    p._processToken(token);
  }
  var TABLE_VOID_ELEMENTS = /* @__PURE__ */ new Set([TAG_ID.CAPTION, TAG_ID.COL, TAG_ID.COLGROUP, TAG_ID.TBODY, TAG_ID.TD, TAG_ID.TFOOT, TAG_ID.TH, TAG_ID.THEAD, TAG_ID.TR]);
  function startTagInCaption(p, token) {
    const tn = token.tagID;
    if (TABLE_VOID_ELEMENTS.has(tn)) {
      if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
        p.openElements.generateImpliedEndTags();
        p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
        p.activeFormattingElements.clearToLastMarker();
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
      }
    } else {
      startTagInBody(p, token);
    }
  }
  function endTagInCaption(p, token) {
    const tn = token.tagID;
    switch (tn) {
      case TAG_ID.CAPTION:
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.CAPTION)) {
          p.openElements.generateImpliedEndTags();
          p.openElements.popUntilTagNamePopped(TAG_ID.CAPTION);
          p.activeFormattingElements.clearToLastMarker();
          p.insertionMode = InsertionMode.IN_TABLE;
          if (tn === TAG_ID.TABLE) {
            endTagInTable(p, token);
          }
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TBODY:
      case TAG_ID.TD:
      case TAG_ID.TFOOT:
      case TAG_ID.TH:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        break;
      }
      default: {
        endTagInBody(p, token);
      }
    }
  }
  function startTagInColumnGroup(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.COL: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      default: {
        tokenInColumnGroup(p, token);
      }
    }
  }
  function endTagInColumnGroup(p, token) {
    switch (token.tagID) {
      case TAG_ID.COLGROUP: {
        if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      case TAG_ID.COL: {
        break;
      }
      default: {
        tokenInColumnGroup(p, token);
      }
    }
  }
  function tokenInColumnGroup(p, token) {
    if (p.openElements.currentTagId === TAG_ID.COLGROUP) {
      p.openElements.pop();
      p.insertionMode = InsertionMode.IN_TABLE;
      p._processToken(token);
    }
  }
  function startTagInTableBody(p, token) {
    switch (token.tagID) {
      case TAG_ID.TR: {
        p.openElements.clearBackToTableBodyContext();
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_ROW;
        break;
      }
      case TAG_ID.TH:
      case TAG_ID.TD: {
        p.openElements.clearBackToTableBodyContext();
        p._insertFakeElement(TAG_NAMES.TR, TAG_ID.TR);
        p.insertionMode = InsertionMode.IN_ROW;
        startTagInRow(p, token);
        break;
      }
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasTableBodyContextInTableScope()) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
          startTagInTable(p, token);
        }
        break;
      }
      default: {
        startTagInTable(p, token);
      }
    }
  }
  function endTagInTableBody(p, token) {
    const tn = token.tagID;
    switch (token.tagID) {
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasInTableScope(tn)) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
        }
        break;
      }
      case TAG_ID.TABLE: {
        if (p.openElements.hasTableBodyContextInTableScope()) {
          p.openElements.clearBackToTableBodyContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE;
          endTagInTable(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TD:
      case TAG_ID.TH:
      case TAG_ID.TR: {
        break;
      }
      default: {
        endTagInTable(p, token);
      }
    }
  }
  function startTagInRow(p, token) {
    switch (token.tagID) {
      case TAG_ID.TH:
      case TAG_ID.TD: {
        p.openElements.clearBackToTableRowContext();
        p._insertElement(token, NS.HTML);
        p.insertionMode = InsertionMode.IN_CELL;
        p.activeFormattingElements.insertMarker();
        break;
      }
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          startTagInTableBody(p, token);
        }
        break;
      }
      default: {
        startTagInTable(p, token);
      }
    }
  }
  function endTagInRow(p, token) {
    switch (token.tagID) {
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
        }
        break;
      }
      case TAG_ID.TABLE: {
        if (p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          endTagInTableBody(p, token);
        }
        break;
      }
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        if (p.openElements.hasInTableScope(token.tagID) || p.openElements.hasInTableScope(TAG_ID.TR)) {
          p.openElements.clearBackToTableRowContext();
          p.openElements.pop();
          p.insertionMode = InsertionMode.IN_TABLE_BODY;
          endTagInTableBody(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML:
      case TAG_ID.TD:
      case TAG_ID.TH: {
        break;
      }
      default: {
        endTagInTable(p, token);
      }
    }
  }
  function startTagInCell(p, token) {
    const tn = token.tagID;
    if (TABLE_VOID_ELEMENTS.has(tn)) {
      if (p.openElements.hasInTableScope(TAG_ID.TD) || p.openElements.hasInTableScope(TAG_ID.TH)) {
        p._closeTableCell();
        startTagInRow(p, token);
      }
    } else {
      startTagInBody(p, token);
    }
  }
  function endTagInCell(p, token) {
    const tn = token.tagID;
    switch (tn) {
      case TAG_ID.TD:
      case TAG_ID.TH: {
        if (p.openElements.hasInTableScope(tn)) {
          p.openElements.generateImpliedEndTags();
          p.openElements.popUntilTagNamePopped(tn);
          p.activeFormattingElements.clearToLastMarker();
          p.insertionMode = InsertionMode.IN_ROW;
        }
        break;
      }
      case TAG_ID.TABLE:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD:
      case TAG_ID.TR: {
        if (p.openElements.hasInTableScope(tn)) {
          p._closeTableCell();
          endTagInRow(p, token);
        }
        break;
      }
      case TAG_ID.BODY:
      case TAG_ID.CAPTION:
      case TAG_ID.COL:
      case TAG_ID.COLGROUP:
      case TAG_ID.HTML: {
        break;
      }
      default: {
        endTagInBody(p, token);
      }
    }
  }
  function startTagInSelect(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.OPTION: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.OPTGROUP: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.HR: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.INPUT:
      case TAG_ID.KEYGEN:
      case TAG_ID.TEXTAREA:
      case TAG_ID.SELECT: {
        if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
          p._resetInsertionMode();
          if (token.tagID !== TAG_ID.SELECT) {
            p._processStartTag(token);
          }
        }
        break;
      }
      case TAG_ID.SCRIPT:
      case TAG_ID.TEMPLATE: {
        startTagInHead(p, token);
        break;
      }
      default:
    }
  }
  function endTagInSelect(p, token) {
    switch (token.tagID) {
      case TAG_ID.OPTGROUP: {
        if (p.openElements.stackTop > 0 && p.openElements.currentTagId === TAG_ID.OPTION && p.openElements.tagIDs[p.openElements.stackTop - 1] === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        if (p.openElements.currentTagId === TAG_ID.OPTGROUP) {
          p.openElements.pop();
        }
        break;
      }
      case TAG_ID.OPTION: {
        if (p.openElements.currentTagId === TAG_ID.OPTION) {
          p.openElements.pop();
        }
        break;
      }
      case TAG_ID.SELECT: {
        if (p.openElements.hasInSelectScope(TAG_ID.SELECT)) {
          p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
          p._resetInsertionMode();
        }
        break;
      }
      case TAG_ID.TEMPLATE: {
        templateEndTagInHead(p, token);
        break;
      }
      default:
    }
  }
  function startTagInSelectInTable(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
      p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
      p._resetInsertionMode();
      p._processStartTag(token);
    } else {
      startTagInSelect(p, token);
    }
  }
  function endTagInSelectInTable(p, token) {
    const tn = token.tagID;
    if (tn === TAG_ID.CAPTION || tn === TAG_ID.TABLE || tn === TAG_ID.TBODY || tn === TAG_ID.TFOOT || tn === TAG_ID.THEAD || tn === TAG_ID.TR || tn === TAG_ID.TD || tn === TAG_ID.TH) {
      if (p.openElements.hasInTableScope(tn)) {
        p.openElements.popUntilTagNamePopped(TAG_ID.SELECT);
        p._resetInsertionMode();
        p.onEndTag(token);
      }
    } else {
      endTagInSelect(p, token);
    }
  }
  function startTagInTemplate(p, token) {
    switch (token.tagID) {
      // First, handle tags that can start without a mode change
      case TAG_ID.BASE:
      case TAG_ID.BASEFONT:
      case TAG_ID.BGSOUND:
      case TAG_ID.LINK:
      case TAG_ID.META:
      case TAG_ID.NOFRAMES:
      case TAG_ID.SCRIPT:
      case TAG_ID.STYLE:
      case TAG_ID.TEMPLATE:
      case TAG_ID.TITLE: {
        startTagInHead(p, token);
        break;
      }
      // Re-process the token in the appropriate mode
      case TAG_ID.CAPTION:
      case TAG_ID.COLGROUP:
      case TAG_ID.TBODY:
      case TAG_ID.TFOOT:
      case TAG_ID.THEAD: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE;
        p.insertionMode = InsertionMode.IN_TABLE;
        startTagInTable(p, token);
        break;
      }
      case TAG_ID.COL: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_COLUMN_GROUP;
        p.insertionMode = InsertionMode.IN_COLUMN_GROUP;
        startTagInColumnGroup(p, token);
        break;
      }
      case TAG_ID.TR: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_TABLE_BODY;
        p.insertionMode = InsertionMode.IN_TABLE_BODY;
        startTagInTableBody(p, token);
        break;
      }
      case TAG_ID.TD:
      case TAG_ID.TH: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_ROW;
        p.insertionMode = InsertionMode.IN_ROW;
        startTagInRow(p, token);
        break;
      }
      default: {
        p.tmplInsertionModeStack[0] = InsertionMode.IN_BODY;
        p.insertionMode = InsertionMode.IN_BODY;
        startTagInBody(p, token);
      }
    }
  }
  function endTagInTemplate(p, token) {
    if (token.tagID === TAG_ID.TEMPLATE) {
      templateEndTagInHead(p, token);
    }
  }
  function eofInTemplate(p, token) {
    if (p.openElements.tmplCount > 0) {
      p.openElements.popUntilTagNamePopped(TAG_ID.TEMPLATE);
      p.activeFormattingElements.clearToLastMarker();
      p.tmplInsertionModeStack.shift();
      p._resetInsertionMode();
      p.onEof(token);
    } else {
      stopParsing(p, token);
    }
  }
  function startTagAfterBody(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      startTagInBody(p, token);
    } else {
      tokenAfterBody(p, token);
    }
  }
  function endTagAfterBody(p, token) {
    var _a3;
    if (token.tagID === TAG_ID.HTML) {
      if (!p.fragmentContext) {
        p.insertionMode = InsertionMode.AFTER_AFTER_BODY;
      }
      if (p.options.sourceCodeLocationInfo && p.openElements.tagIDs[0] === TAG_ID.HTML) {
        p._setEndLocation(p.openElements.items[0], token);
        const bodyElement = p.openElements.items[1];
        if (bodyElement && !((_a3 = p.treeAdapter.getNodeSourceCodeLocation(bodyElement)) === null || _a3 === void 0 ? void 0 : _a3.endTag)) {
          p._setEndLocation(bodyElement, token);
        }
      }
    } else {
      tokenAfterBody(p, token);
    }
  }
  function tokenAfterBody(p, token) {
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function startTagInFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.FRAMESET: {
        p._insertElement(token, NS.HTML);
        break;
      }
      case TAG_ID.FRAME: {
        p._appendElement(token, NS.HTML);
        token.ackSelfClosing = true;
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
      default:
    }
  }
  function endTagInFrameset(p, token) {
    if (token.tagID === TAG_ID.FRAMESET && !p.openElements.isRootHtmlElementCurrent()) {
      p.openElements.pop();
      if (!p.fragmentContext && p.openElements.currentTagId !== TAG_ID.FRAMESET) {
        p.insertionMode = InsertionMode.AFTER_FRAMESET;
      }
    }
  }
  function startTagAfterFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
      default:
    }
  }
  function endTagAfterFrameset(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      p.insertionMode = InsertionMode.AFTER_AFTER_FRAMESET;
    }
  }
  function startTagAfterAfterBody(p, token) {
    if (token.tagID === TAG_ID.HTML) {
      startTagInBody(p, token);
    } else {
      tokenAfterAfterBody(p, token);
    }
  }
  function tokenAfterAfterBody(p, token) {
    p.insertionMode = InsertionMode.IN_BODY;
    modeInBody(p, token);
  }
  function startTagAfterAfterFrameset(p, token) {
    switch (token.tagID) {
      case TAG_ID.HTML: {
        startTagInBody(p, token);
        break;
      }
      case TAG_ID.NOFRAMES: {
        startTagInHead(p, token);
        break;
      }
      default:
    }
  }
  function nullCharacterInForeignContent(p, token) {
    token.chars = REPLACEMENT_CHARACTER;
    p._insertCharacters(token);
  }
  function characterInForeignContent(p, token) {
    p._insertCharacters(token);
    p.framesetOk = false;
  }
  function popUntilHtmlOrIntegrationPoint(p) {
    while (p.treeAdapter.getNamespaceURI(p.openElements.current) !== NS.HTML && p.openElements.currentTagId !== void 0 && !p._isIntegrationPoint(p.openElements.currentTagId, p.openElements.current)) {
      p.openElements.pop();
    }
  }
  function startTagInForeignContent(p, token) {
    if (causesExit(token)) {
      popUntilHtmlOrIntegrationPoint(p);
      p._startTagOutsideForeignContent(token);
    } else {
      const current = p._getAdjustedCurrentElement();
      const currentNs = p.treeAdapter.getNamespaceURI(current);
      if (currentNs === NS.MATHML) {
        adjustTokenMathMLAttrs(token);
      } else if (currentNs === NS.SVG) {
        adjustTokenSVGTagName(token);
        adjustTokenSVGAttrs(token);
      }
      adjustTokenXMLAttrs(token);
      if (token.selfClosing) {
        p._appendElement(token, currentNs);
      } else {
        p._insertElement(token, currentNs);
      }
      token.ackSelfClosing = true;
    }
  }
  function endTagInForeignContent(p, token) {
    if (token.tagID === TAG_ID.P || token.tagID === TAG_ID.BR) {
      popUntilHtmlOrIntegrationPoint(p);
      p._endTagOutsideForeignContent(token);
      return;
    }
    for (let i = p.openElements.stackTop; i > 0; i--) {
      const element = p.openElements.items[i];
      if (p.treeAdapter.getNamespaceURI(element) === NS.HTML) {
        p._endTagOutsideForeignContent(token);
        break;
      }
      const tagName2 = p.treeAdapter.getTagName(element);
      if (tagName2.toLowerCase() === token.tagName) {
        token.tagName = tagName2;
        p.openElements.shortenToLength(i);
        break;
      }
    }
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/entities/dist/esm/escape.js
  /* eslint-disable dot-notation -- @preserve Upstream entities conventions only. */
  var getCodePoint = String.prototype.codePointAt == null ? (c, index) => (c.charCodeAt(index) & 64512) === 55296 ? (c.charCodeAt(index) - 55296) * 1024 + c.charCodeAt(index + 1) - 56320 + 65536 : c.charCodeAt(index) : (
    // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
    (input, index) => input.codePointAt(index)
  );
  function getEscaper(regex, map) {
    return function escape(data) {
      let match;
      let lastIndex = 0;
      let result = "";
      while (match = regex.exec(data)) {
        if (lastIndex !== match.index) {
          result += data.substring(lastIndex, match.index);
        }
        result += map.get(match[0].charCodeAt(0));
        lastIndex = match.index + 1;
      }
      return result + data.substring(lastIndex);
    };
  }
  var escapeAttribute = /* @__PURE__ */ getEscaper(/["&\u00A0]/g, /* @__PURE__ */ new Map([
    [34, "&quot;"],
    [38, "&amp;"],
    [160, "&nbsp;"]
  ]));
  var escapeText = /* @__PURE__ */ getEscaper(/[&<>\u00A0]/g, /* @__PURE__ */ new Map([
    [38, "&amp;"],
    [60, "&lt;"],
    [62, "&gt;"],
    [160, "&nbsp;"]
  ]));
  /* eslint-enable dot-notation -- @preserve End upstream entities. */

  // node_modules/parse5/dist/serializer/index.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  var VOID_ELEMENTS = /* @__PURE__ */ new Set([
    TAG_NAMES.AREA,
    TAG_NAMES.BASE,
    TAG_NAMES.BASEFONT,
    TAG_NAMES.BGSOUND,
    TAG_NAMES.BR,
    TAG_NAMES.COL,
    TAG_NAMES.EMBED,
    TAG_NAMES.FRAME,
    TAG_NAMES.HR,
    TAG_NAMES.IMG,
    TAG_NAMES.INPUT,
    TAG_NAMES.KEYGEN,
    TAG_NAMES.LINK,
    TAG_NAMES.META,
    TAG_NAMES.PARAM,
    TAG_NAMES.SOURCE,
    TAG_NAMES.TRACK,
    TAG_NAMES.WBR
  ]);
  function isVoidElement(node, options) {
    return options.treeAdapter.isElementNode(node) && options.treeAdapter.getNamespaceURI(node) === NS.HTML && VOID_ELEMENTS.has(options.treeAdapter.getTagName(node));
  }
  var defaultOpts = { treeAdapter: defaultTreeAdapter, scriptingEnabled: true };
  function serialize(node, options) {
    const opts = { ...defaultOpts, ...options };
    if (isVoidElement(node, opts)) {
      return "";
    }
    return serializeChildNodes(node, opts);
  }
  function serializeOuter(node, options) {
    const opts = { ...defaultOpts, ...options };
    return serializeNode(node, opts);
  }
  function serializeChildNodes(parentNode, options) {
    let html = "";
    const container = options.treeAdapter.isElementNode(parentNode) && options.treeAdapter.getTagName(parentNode) === TAG_NAMES.TEMPLATE && options.treeAdapter.getNamespaceURI(parentNode) === NS.HTML ? options.treeAdapter.getTemplateContent(parentNode) : parentNode;
    const childNodes = options.treeAdapter.getChildNodes(container);
    if (childNodes) {
      for (const currentNode of childNodes) {
        html += serializeNode(currentNode, options);
      }
    }
    return html;
  }
  function serializeNode(node, options) {
    if (options.treeAdapter.isElementNode(node)) {
      return serializeElement(node, options);
    }
    if (options.treeAdapter.isTextNode(node)) {
      return serializeTextNode(node, options);
    }
    if (options.treeAdapter.isCommentNode(node)) {
      return serializeCommentNode(node, options);
    }
    if (options.treeAdapter.isDocumentTypeNode(node)) {
      return serializeDocumentTypeNode(node, options);
    }
    return "";
  }
  function serializeElement(node, options) {
    const tn = options.treeAdapter.getTagName(node);
    return `<${tn}${serializeAttributes(node, options)}>${isVoidElement(node, options) ? "" : `${serializeChildNodes(node, options)}</${tn}>`}`;
  }
  function serializeAttributes(node, { treeAdapter }) {
    let html = "";
    for (const attr3 of treeAdapter.getAttrList(node)) {
      html += " ";
      if (attr3.namespace) {
        switch (attr3.namespace) {
          case NS.XML: {
            html += `xml:${attr3.name}`;
            break;
          }
          case NS.XMLNS: {
            if (attr3.name !== "xmlns") {
              html += "xmlns:";
            }
            html += attr3.name;
            break;
          }
          case NS.XLINK: {
            html += `xlink:${attr3.name}`;
            break;
          }
          default: {
            html += `${attr3.prefix}:${attr3.name}`;
          }
        }
      } else {
        html += attr3.name;
      }
      html += `="${escapeAttribute(attr3.value)}"`;
    }
    return html;
  }
  function serializeTextNode(node, options) {
    const { treeAdapter } = options;
    const content = treeAdapter.getTextNodeContent(node);
    const parent = treeAdapter.getParentNode(node);
    const parentTn = parent && treeAdapter.isElementNode(parent) && treeAdapter.getTagName(parent);
    return parentTn && treeAdapter.getNamespaceURI(parent) === NS.HTML && hasUnescapedText(parentTn, options.scriptingEnabled) ? content : escapeText(content);
  }
  function serializeCommentNode(node, { treeAdapter }) {
    return `<!--${treeAdapter.getCommentNodeContent(node)}-->`;
  }
  function serializeDocumentTypeNode(node, { treeAdapter }) {
    return `<!DOCTYPE ${treeAdapter.getDocumentTypeNodeName(node)}>`;
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // node_modules/parse5/dist/index.js
  /* eslint-disable curly, dot-notation -- @preserve Upstream parse5 conventions only. */
  function parse(html, options) {
    return Parser.parse(html, options);
  }
  function parseFragment(fragmentContext, html, options) {
    if (typeof fragmentContext === "string") {
      options = html;
      html = fragmentContext;
      fragmentContext = null;
    }
    const parser = Parser.getFragmentParser(fragmentContext, options);
    parser.tokenizer.write(html, true);
    return parser.getFragment();
  }
  /* eslint-enable curly, dot-notation -- @preserve End upstream parse5. */

  // src/shared.js
  var warningMarker = "feishu-local-exporter-warnings";
  function safeStem(name) {
    let value = Array.from(String(name).normalize("NFC")).slice(0, 60).join("").replace(/[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/gu, "_").replace(/^[.\s]+|[.\s]+$/gu, "");
    if (/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(value)) value = "_" + value;
    return value || "文档";
  }
  var warnings = {
    missing_image: "缺少本地图片",
    invalid_image: "图片无法解码",
    remote_image: "外部图片已保留为文字说明",
    missing_attachment: "缺少附件",
    unsupported_link: "已移除无法安全打开的链接",
    unsupported_block: "内容块未完整转换",
    missing_block: "可能缺少文档块",
    missing_code: "缺少代码块内容",
    code_unreadable: "未能读取代码块",
    code_lines_missing: "缺少代码行",
    image_unreadable: "未能读取图片",
    image_download_failed: "未能保存图片",
    duplicate_image: "图片路径重复",
    code_tail_unconfirmed: "未能确认代码末行",
    capture_step_limit: "未能确认文末",
    table_cell_unconfirmed: "未能确认表格单元格内容",
    table_structure_unconfirmed: "未能确认表格结构",
    capture_content_changed: "采集期间内容发生变化，请重新保存核对",
    pdf_conversion_note: "PDF 转换提示"
  };
  function warningLabel(code) {
    return warnings[code] || "内容已简化";
  }

  // src/table-style.js
  var horizontal = /* @__PURE__ */ new Set(["left", "center", "right", "justify"]);
  var vertical = /* @__PURE__ */ new Set(["top", "middle", "bottom"]);
  function normalizeAlign(value) {
    const text = typeof value === "string" ? value.trim().toLowerCase() : "";
    return horizontal.has(text) ? text : void 0;
  }
  function normalizeValign(value) {
    const text = typeof value === "string" ? value.trim().toLowerCase() : "";
    return vertical.has(text) ? text : void 0;
  }
  function normalizeColor(value) {
    if (typeof value !== "string" || value.length > 64) return;
    const text = value.trim().toLowerCase();
    if (/^#[\da-f]{6}$/u.test(text)) return text;
    if (/^#[\da-f]{3}$/u.test(text)) return "#" + [...text.slice(1)].map((char) => char + char).join("");
    const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/u.exec(text) || /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*1(?:\.0+)?\s*\)$/u.exec(text);
    if (rgb && rgb.slice(1).every((channel) => Number(channel) <= 255)) {
      return "#" + rgb.slice(1).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("");
    }
  }
  function normalizeCellStyle(fields = {}) {
    const result = {};
    for (const field of ["background", "color"]) {
      const value = normalizeColor(fields?.[field]);
      if (value) result[field] = value;
    }
    const align = normalizeAlign(fields?.align), valign = normalizeValign(fields?.valign);
    if (align) result.align = align;
    if (valign) result.valign = valign;
    return result;
  }
  function declarations(style, validators) {
    const result = /* @__PURE__ */ new Map();
    if (typeof style !== "string") return result;
    for (const declaration of style.split(";")) {
      const colon = declaration.indexOf(":");
      if (colon < 0) continue;
      const name = declaration.slice(0, colon).trim().toLowerCase();
      let value = declaration.slice(colon + 1).trim();
      if (validators) {
        if (!Object.hasOwn(validators, name)) continue;
        value = validators[name](value);
        if (value === void 0) continue;
      }
      result.set(name, value);
    }
    return result;
  }
  function readCellStyle(style, legacy = {}) {
    const values = declarations(style, {
      "background-color": normalizeColor,
      color: normalizeColor,
      "text-align": normalizeAlign,
      "vertical-align": normalizeValign
    });
    return normalizeCellStyle({
      background: values.get("background-color") ?? legacy.bgcolor,
      color: values.get("color"),
      align: values.get("text-align") ?? legacy.align,
      valign: values.get("vertical-align") ?? legacy.valign
    });
  }
  function cellStyleText(fields) {
    const style = normalizeCellStyle(fields);
    return [["background", "background-color"], ["color", "color"], ["align", "text-align"], ["valign", "vertical-align"]].flatMap(([field, property]) => style[field] ? [property + ":" + style[field]] : []).join(";");
  }
  function normalizeColumnWidths(values) {
    if (!Array.isArray(values) || !values.length || values.length > 64 || !values.every((value) => typeof value === "number" && Number.isFinite(value) && value > 0)) return;
    if (values.every(Number.isInteger) && values.reduce((sum, value) => sum + value, 0) === 1e4) return values.slice();
    const maximum = Math.max(...values);
    const weights = values.map((value) => value / maximum);
    const total = weights.reduce((sum, value) => sum + value, 0);
    const exact = weights.map((value) => value * 1e4 / total);
    const widths = exact.map((value) => Math.max(1, Math.floor(value)));
    let remaining = 1e4 - widths.reduce((sum, value) => sum + value, 0);
    const order = exact.map((value, index) => index).sort((a, b) => remaining >= 0 ? exact[b] % 1 - exact[a] % 1 || a - b : widths[b] - widths[a] || a - b);
    for (const index of order) {
      if (remaining > 0) {
        widths[index]++;
        remaining--;
      } else if (remaining < 0) {
        const removed = Math.min(-remaining, widths[index] - 1);
        widths[index] -= removed;
        remaining += removed;
      }
    }
    return widths;
  }
  function attr(node, name) {
    if (typeof node?.getAttribute === "function") return node.getAttribute(name) ?? "";
    return node?.attrs?.find((item) => item.name === name && !item.namespace)?.value ?? "";
  }
  function isAuxiliaryTable(node) {
    if (!node) return false;
    if (typeof node?.classList?.contains === "function") return node.classList.contains("sticky-row-wrapper");
    return attr(node, "class").split(/\s+/u).includes("sticky-row-wrapper");
  }
  var tagName = (node) => (node?.localName || node?.tagName || "").toLowerCase();
  var elementChildren = (node) => node?.children ? [...node.children] : (node?.childNodes ?? []).filter((child) => tagName(child));
  function directTableRows(table) {
    const rows = [];
    for (const group of elementChildren(table)) {
      const section = tagName(group);
      if (section === "tr") rows.push({ row: group, section: "tbody", group: table, auxiliary: false });
      else if (["thead", "tbody", "tfoot"].includes(section)) {
        for (const row of elementChildren(group)) if (tagName(row) === "tr") rows.push({ row, section, group, auxiliary: false });
      }
    }
    if (!rows.length && table?.rows) {
      for (const row of table.rows) {
        const group = row.parentElement || table, section = tagName(group);
        rows.push({ row, section: ["thead", "tfoot"].includes(section) ? section : "tbody", group, auxiliary: false });
      }
    }
    return rows;
  }
  function cellText(node) {
    if (tagName(node) === "table") return "";
    if (node.nodeName === "#text") return node.value ?? node.nodeValue ?? "";
    if (node.childNodes?.length) return [...node.childNodes].map(cellText).join("");
    return typeof node.textContent === "string" ? node.textContent : "";
  }
  function sameTableRow(first, second) {
    const cells = (row) => row.cells ? [...row.cells] : elementChildren(row).filter((cell) => ["td", "th"].includes(tagName(cell)));
    const left = cells(first), right = cells(second);
    return left.length > 0 && left.length === right.length && left.every((cell, index) => {
      const other = right[index];
      if (["colspan", "rowspan"].some((span2) => (Number(attr(cell, span2)) || 1) !== (Number(attr(other, span2)) || 1))) return false;
      const id = attr(cell, "data-block-id"), otherId = attr(other, "data-block-id");
      if (id && otherId) return id === otherId;
      const text = (value) => cellText(value).replace(/[\u200b\ufeff\u2060]/gu, "").replace(/\s+/gu, " ").trim();
      return text(cell) === text(other);
    });
  }
  function logicalTableRows(block, main) {
    if (!main) return [];
    const rows = directTableRows(main);
    if (elementChildren(main).some((group) => tagName(group) === "thead") || rows.some((row) => row.section === "thead")) return rows;
    const headerTables = [];
    function visit(node) {
      if (node === main) return;
      if (tagName(node) === "table") {
        if (isAuxiliaryTable(node)) {
          const entries = directTableRows(node);
          if (!headerTables.some((previous) => previous.length === entries.length && previous.every((entry, index) => sameTableRow(entry.row, entries[index].row)))) headerTables.push(entries);
        }
        return;
      }
      for (const child of elementChildren(node)) visit(child);
    }
    visit(block);
    const headers = headerTables.flatMap((entries) => entries.map((entry) => ({ ...entry, section: "thead", auxiliary: true })));
    let duplicate = 0;
    while (duplicate < headers.length && duplicate < rows.length && sameTableRow(headers[duplicate].row, rows[duplicate].row)) duplicate++;
    return [...rows.slice(0, duplicate).map((entry) => ({ ...entry, section: "thead" })), ...headers.slice(duplicate), ...rows.slice(duplicate)];
  }
  function parseWidth(value) {
    const match = /^(\d+(?:\.\d+)?|\.\d+)\s*(px|%)?$/iu.exec(value.trim());
    if (match && Number(match[1]) > 0 && Number.isFinite(Number(match[1]))) {
      return { value: Number(match[1]), unit: match[2]?.toLowerCase() || "px" };
    }
  }
  function columnWidth(node) {
    return declarations(attr(node, "style"), { width: parseWidth }).get("width") || parseWidth(attr(node, "width"));
  }
  function readTableColumnWidths(table) {
    const values = [];
    let unit;
    for (const group of table.childNodes ?? []) {
      if (group.tagName !== "colgroup") continue;
      const columns = (group.childNodes ?? []).filter((node) => node.tagName === "col");
      for (const column of columns.length ? columns : [group]) {
        const width = columnWidth(column) || (column !== group ? columnWidth(group) : void 0);
        const rawSpan = attr(column, "span");
        const span2 = rawSpan === "" ? 1 : /^\d{1,2}$/u.test(rawSpan) ? Number(rawSpan) : 0;
        if (!width || span2 < 1 || span2 > 64 || values.length + span2 > 64 || unit && width.unit !== unit) return;
        unit = width.unit;
        values.push(...Array(span2).fill(width.value));
      }
    }
    return normalizeColumnWidths(values);
  }
  function columnGroupHtml(values) {
    const widths = normalizeColumnWidths(values);
    return widths ? "<colgroup>" + widths.map((width) => '<col style="width:' + width / 100 + '%">').join("") + "</colgroup>" : "";
  }

  // src/feishu.js
  var ZERO_WIDTH = /[\u200b\ufeff\u2060]/gu;
  var MIME_EXTENSIONS = Object.freeze({
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp"
  });
  var RASTER_EXTENSIONS = /* @__PURE__ */ new Set(["png", "jpg", "gif", "webp"]);
  var HEADING_TYPE = /^heading([1-6])$/u;
  var ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  var CELL_BLOCK_TYPES = /* @__PURE__ */ new Set([
    "text",
    "bullet",
    "ordered",
    "code",
    "image",
    "whiteboard",
    "diagram",
    "quote",
    "callout",
    "quote_container",
    "synced_reference",
    "view",
    "grid",
    "grid_column",
    "divider",
    "todo",
    "heading1",
    "heading2",
    "heading3",
    "heading4",
    "heading5",
    "heading6",
    "file"
  ]);
  var LANGUAGE_ALIASES = Object.freeze({
    "plain text": "text",
    plaintext: "text",
    纯文本: "text",
    "c++": "cpp",
    "c#": "csharp",
    "f#": "fsharp",
    "objective-c": "objectivec",
    proto: "protobuf",
    golang: "go",
    py: "python",
    js: "javascript",
    ts: "typescript",
    yml: "yaml",
    md: "markdown",
    shell: "bash",
    shellscript: "bash"
  });
  function escapeText2(value) {
    return String(value).replace(/[&<>"']/gu, (character) => ESCAPES[character]);
  }
  function cleanText(value) {
    return String(value ?? "").replace(ZERO_WIDTH, "");
  }
  function nodeAttr(node, name) {
    return node.attrs?.find((item) => item.name === name && !item.namespace)?.value ?? "";
  }
  function hasClass(node, name) {
    return nodeAttr(node, "class").split(/\s+/u).includes(name);
  }
  function isHidden(node) {
    return node.attrs?.some(({ name, value }) => name === "hidden" || name === "aria-hidden" && value === "true") || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:\s*!important)?\s*(?:;|$)/iu.test(nodeAttr(node, "style")) || ["doc-cover-toolbar", "docx-popup-container", "layer-popup"].some((name) => hasClass(node, name));
  }
  function hasFinalDisplayNone(style) {
    if (/\\|\/\*/u.test(style)) return false;
    let display = "", important = false, start = 0, depth = 0, quote = "";
    for (let index = 0; index <= style.length; index++) {
      const char = style[index];
      if (quote) {
        if (char === quote) quote = "";
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char && "([{".includes(char)) depth++;
      if (char && ")]}".includes(char) && --depth < 0) return false;
      if (index !== style.length && (char !== ";" || depth)) continue;
      const match = /^\s*display\s*:\s*(.*?)\s*$/iu.exec(style.slice(start, index));
      start = index + 1;
      if (!match) continue;
      const priority = /!\s*important\s*$/iu.test(match[1]);
      if (important && !priority) continue;
      display = match[1].replace(/!\s*important\s*$/iu, "").trim().toLowerCase();
      important = priority;
    }
    return !quote && !depth && display === "none";
  }
  function isHiddenOrControl(node) {
    return ["button", "input", "textarea", "select", "svg", "script", "style", "template"].includes(node.tagName) || isHidden(node) || hasClass(node, "fold-handler-wrapper") || hasClass(node, "fold-handler");
  }
  function normalizeRichContent(root, blockId, addWarning) {
    let position = 0;
    function accessibleText(node) {
      const explicit = ["data-latex", "data-tex", "data-formula", "aria-label", "alt"].map((name) => nodeAttr(node, name)).find((value) => value.trim());
      const annotation = findFirstElement(node, (child) => child.tagName === "annotation" && /^(?:application\/x-tex|text\/x-tex)$/iu.test(nodeAttr(child, "encoding")));
      const title = findFirstElement(node, (child) => child.tagName === "title");
      return cleanText(explicit || (annotation ? textContent(annotation) : "") || (title ? textContent(title) : "") || (node.tagName === "math" ? textContent(node) : "")).replace(/\s+/gu, " ").trim().slice(0, 2048);
    }
    function visit(node) {
      if (["whiteboard", "diagram", "file"].includes(nodeAttr(node, "data-block-type"))) return;
      for (let index = 0; index < (node.childNodes || []).length; index++) {
        const child = node.childNodes[index];
        if (!child.tagName || isHidden(child)) continue;
        if (["button", "toolbar", "menu", "menuitem"].includes(nodeAttr(child, "role"))) continue;
        if (child.tagName !== "svg" && isHiddenOrControl(child)) continue;
        const formula = child.tagName === "math" || nodeAttr(child, "role") === "math" || ["data-latex", "data-tex", "data-formula"].some((name) => nodeAttr(child, name).trim());
        const graphic = child.tagName === "svg";
        if (graphic && !formula && (nodeAttr(child, "role") === "presentation" || nodeAttr(child, "data-icon") || /(?:^|\s)(?:[\w-]*-)?icon(?:-[\w-]+)?(?:\s|$)/iu.test(nodeAttr(child, "class")))) continue;
        if (formula || graphic) {
          const label = accessibleText(child);
          const kind = formula ? "公式" : "行内图形";
          addWarning("unsupported_block", "块 " + blockId + " 中的第 " + ++position + " 处" + kind + (label ? "已转为文字说明，请核对" : "未能转换"));
          child.parentNode = null;
          node.childNodes[index] = { nodeName: "#text", value: label ? "[" + kind + "文字说明：" + label + "]" : "[未转换的" + kind + "]", parentNode: node };
        } else visit(child);
      }
    }
    visit(root);
  }
  function childElements(node) {
    return (node.childNodes ?? []).filter((child) => typeof child.tagName === "string");
  }
  function findFirstElement(node, predicate) {
    for (const child of childElements(node)) {
      if (predicate(child)) return child;
      const found = findFirstElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  function collectElements(node, predicate) {
    const result = [];
    const walk = (current) => {
      for (const child of childElements(current)) {
        if (predicate(child)) result.push(child);
        walk(child);
      }
    };
    walk(node);
    return result;
  }
  function textContent(node) {
    if (node.nodeName === "#text") return cleanText(node.value ?? "");
    return (node.childNodes ?? []).map(textContent).join("");
  }
  function collectAceLines(node) {
    return collectElements(node, (element) => hasClass(element, "ace-line"));
  }
  function parseBlock(html) {
    if (typeof html !== "string" || !html.trim()) return null;
    const fragment = parseFragment(html, { scriptingEnabled: false });
    return fragment.childNodes.find((node) => typeof node.tagName === "string") ?? null;
  }
  function styleWrappers(style, suppressBold) {
    if (!style) return [];
    const declarations2 = /* @__PURE__ */ new Map();
    for (const part of style.split(";")) {
      const separator = part.indexOf(":");
      if (separator < 0) continue;
      const name = part.slice(0, separator).trim().toLowerCase();
      const value = part.slice(separator + 1).trim().toLowerCase();
      if (name && value) declarations2.set(name, value);
    }
    const wrappers = [];
    const weight = declarations2.get("font-weight") ?? "";
    if (!suppressBold && /^(?:bold|bolder|[6-9]\d\d)$/u.test(weight)) wrappers.push("strong");
    const fontStyle = declarations2.get("font-style") ?? "";
    if (/^(?:italic|oblique)$/u.test(fontStyle)) wrappers.push("em");
    const decoration = (declarations2.get("text-decoration") ?? "") + " " + (declarations2.get("text-decoration-line") ?? "");
    if (/\bunderline\b/u.test(decoration)) wrappers.push("u");
    if (/\bline-through\b/u.test(decoration)) wrappers.push("s");
    return wrappers;
  }
  function safeHref(raw) {
    const value = String(raw ?? "").trim();
    if (!/^(?:https?:\/\/|mailto:)/iu.test(value)) return "";
    if (/[\u0000-\u001f\u007f\\]/u.test(value)) return "";
    try {
      const url = new URL(value);
      return url.username || url.password ? "" : url.href;
    } catch {
      return "";
    }
  }
  function normalizeLanguage(raw) {
    const name = cleanText(raw ?? "").trim().toLowerCase();
    if (!name) return "";
    if (LANGUAGE_ALIASES[name]) return LANGUAGE_ALIASES[name];
    const slug = name.replace(/\+/gu, "p").replace(/#/gu, "sharp").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
    return /^[a-z][a-z0-9-]*$/u.test(slug) ? slug : "";
  }
  function renderInline(nodes, suppressBold) {
    let html = "";
    for (const node of nodes ?? []) html += renderInlineNode(node, suppressBold);
    return html.replaceAll("</s><s>", "");
  }
  function renderInlineNode(node, suppressBold) {
    if (node.nodeName === "#text") {
      const text = cleanText(node.value ?? "");
      return text ? escapeText2(text) : "";
    }
    const tag = typeof node.tagName === "string" ? node.tagName : "";
    if (!tag) return renderInline(node.childNodes, suppressBold);
    if (isHiddenOrControl(node)) return "";
    if (tag === "br") return "<br>";
    if (tag === "img") {
      const alt = cleanText(nodeAttr(node, "alt")).trim();
      return alt ? escapeText2(alt) : "";
    }
    const content = renderInline(node.childNodes, suppressBold);
    if (tag === "a") {
      const href = safeHref(nodeAttr(node, "href"));
      return href ? '<a href="' + escapeText2(href) + '">' + content + "</a>" : content;
    }
    let wrapped = content;
    const wrappers = styleWrappers(nodeAttr(node, "style"), suppressBold);
    for (let index = wrappers.length - 1; index >= 0; index--) {
      wrapped = "<" + wrappers[index] + ">" + wrapped + "</" + wrappers[index] + ">";
    }
    return wrapped;
  }
  function renderLines(element, { suppressBold = false, join = "<br>" } = {}) {
    const lines = [];
    for (const line of collectAceLines(element)) {
      const html = renderInline(line.childNodes, suppressBold);
      if (html.replace(/<[^>]*>/gu, "").trim()) lines.push(html);
    }
    return lines.join(join);
  }
  function hasVisibleContent(html) {
    return html.replace(/<[^>]*>/gu, "").trim() !== "";
  }
  function collectCellBlocks(cell, addWarning) {
    const infos = [];
    const walk = (node) => {
      for (const child of childElements(node)) {
        if (isHiddenOrControl(child)) continue;
        const type = nodeAttr(child, "data-block-type");
        if (type === "table") {
          addWarning("unsupported_block", "表格内嵌套表格未转换");
          continue;
        }
        if (CELL_BLOCK_TYPES.has(type)) {
          infos.push({ id: nodeAttr(child, "data-block-id"), type, element: child });
          continue;
        }
        walk(child);
      }
    };
    walk(cell);
    return infos;
  }
  function isBlockFragment(html) {
    return /^<(?:p|pre|ul|ol|table|blockquote|h[1-6]|hr|figure|div|section|article)(?:[\s>])/u.test(html);
  }
  function joinCellFragments(fragments) {
    let result = "";
    let previousBlock = null;
    for (const fragment of fragments) {
      const block = isBlockFragment(fragment);
      if (result && previousBlock === false && block === false) result += "<br>";
      result += fragment;
      previousBlock = block;
    }
    return result;
  }
  function detectChecked(element) {
    const checkedClass = /^(?:is-|todo-|checkbox-)*(?:checked|done|completed)$/u;
    const checkNode = (node) => {
      for (const { name, value } of node.attrs ?? []) {
        if (name === "checked") return true;
        if (["aria-checked", "data-checked", "data-done"].includes(name) && /^(?:true|1|checked|done)$/iu.test(value.trim())) return true;
        if (name === "class") {
          for (const token of value.split(/\s+/u)) {
            if (checkedClass.test(token.toLowerCase().replace(/--+/gu, "-"))) return true;
          }
        }
      }
      if (node.tagName === "input" && nodeAttr(node, "type").toLowerCase() === "checkbox" && node.attrs?.some(({ name }) => name === "checked")) return true;
      return childElements(node).some(checkNode);
    };
    return checkNode(element);
  }
  function normalizeWarnings(warnings2) {
    if (!Array.isArray(warnings2)) return [];
    const result = [];
    for (const item of warnings2) {
      if (!item || typeof item !== "object") continue;
      const code = typeof item.code === "string" ? item.code.trim() : "";
      if (!code) continue;
      const label = typeof item.label === "string" ? item.label.trim() : "";
      result.push(label ? { code, label } : { code });
    }
    return result;
  }
  function dedupeWarnings(warnings2) {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const item of warnings2) {
      const label = typeof item.label === "string" ? item.label : "";
      const key = item.code + "\0" + label;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(label ? { code: item.code, label } : { code: item.code });
    }
    return result;
  }
  function imageHtmlPath(image) {
    const blockId = String(image?.blockId ?? "").replace(/[^0-9A-Za-z_-]+/gu, "") || "image";
    const mime = String(image?.mime ?? "").split(";", 1)[0].trim().toLowerCase();
    let extension = MIME_EXTENSIONS[mime];
    if (!extension) {
      const match = /\.([A-Za-z0-9]+)$/u.exec(String(image?.file ?? ""));
      const candidate = match ? match[1].toLowerCase() : "";
      extension = RASTER_EXTENSIONS.has(candidate) ? candidate : "png";
    }
    return "images/" + blockId + "." + extension;
  }
  function convertCapture(capture) {
    if (!capture || typeof capture !== "object") throw new TypeError("capture 必须是对象。");
    if (!Array.isArray(capture.blocks)) throw new TypeError("capture.blocks 必须是数组。");
    const warnings2 = [];
    const checkedCodeLines = /* @__PURE__ */ new Map();
    const unsupportedTypes = /* @__PURE__ */ new Set();
    const convertedContainers = /* @__PURE__ */ new Set();
    const addWarning = (code, label) => {
      if (label) warnings2.push({ code, label });
      else warnings2.push({ code });
    };
    const codeMap = capture.code && typeof capture.code === "object" ? capture.code : {};
    const imageByBlock = /* @__PURE__ */ new Map();
    for (const image of Array.isArray(capture.images) ? capture.images : []) {
      if (image && image.blockId != null) imageByBlock.set(String(image.blockId), image);
    }
    function listNumber(info) {
      function findOrder(node) {
        for (const child of childElements(node)) {
          if (isHiddenOrControl(child)) continue;
          const type = nodeAttr(child, "data-block-type");
          if (type && type !== "page") continue;
          if (hasClass(child, "order")) return child;
          const found = findOrder(child);
          if (found) return found;
        }
        return null;
      }
      const order = findOrder(info.element);
      const number = order ? Number.parseInt(textContent(order).trim(), 10) : Number.NaN;
      return Number.isSafeInteger(number) ? number : null;
    }
    function renderSequence(infos2, cell = false) {
      const fragments = [];
      for (let index = 0; index < infos2.length; ) {
        const { type } = infos2[index];
        if (type === "bullet" || type === "ordered") {
          const items = [];
          let next = listNumber(infos2[index]) ?? 1;
          while (index < infos2.length && infos2[index].type === type) {
            const number = type === "ordered" ? listNumber(infos2[index]) : null;
            if (items.length && number !== null && number !== next) break;
            items.push(infos2[index++]);
            next++;
          }
          const list = renderList(type, items, cell);
          if (list) fragments.push(list);
          continue;
        }
        const html2 = cell ? renderCellBlock(infos2[index]) : renderBlock(infos2[index]);
        if (html2) fragments.push(html2);
        index++;
      }
      return fragments;
    }
    function contentParts(element) {
      const parts = [];
      function visit(node) {
        for (const child of childElements(node)) {
          if (isHiddenOrControl(child)) continue;
          const type = nodeAttr(child, "data-block-type");
          if (type && type !== "page") parts.push({ id: nodeAttr(child, "data-block-id"), type, element: child });
          else if (hasClass(child, "ace-line")) parts.push({ line: child });
          else visit(child);
        }
      }
      visit(element);
      return parts;
    }
    function renderContent(parts, cell = false, inline = false) {
      const fragments = [];
      for (let index = 0; index < parts.length; ) {
        if (parts[index].line) {
          const lines = [];
          while (index < parts.length && parts[index].line) {
            const html2 = renderInline(parts[index++].line.childNodes, false);
            if (hasVisibleContent(html2)) lines.push(html2);
          }
          if (lines.length) fragments.push(inline ? lines.join("<br>") : "<p>" + lines.join("<br>") + "</p>");
        } else {
          const children = [];
          while (index < parts.length && !parts[index].line) children.push(parts[index++]);
          fragments.push(...renderSequence(children, cell));
        }
      }
      return joinCellFragments(fragments);
    }
    function renderList(kind, infos2, cell = false) {
      const tag = kind === "ordered" ? "ol" : "ul";
      const start = kind === "ordered" ? listNumber(infos2[0]) : null;
      const items = [];
      for (const info of infos2) {
        const content = renderContent(contentParts(info.element), cell, true);
        if (content) items.push("<li>" + content + "</li>");
      }
      if (!items.length) return null;
      return "<" + tag + (start === null || start === 1 ? "" : ' start="' + start + '"') + ">" + items.join("") + "</" + tag + ">";
    }
    function renderHeading(info, level) {
      const order = findFirstElement(info.element, (element) => hasClass(element, "heading-order"));
      const orderText = order ? cleanText(textContent(order)).replace(/\s+/gu, " ").trim() : "";
      const content = renderLines(info.element, { suppressBold: true, join: " " });
      const parts = [];
      if (orderText) parts.push(escapeText2(orderText));
      if (content) parts.push(content);
      const heading = parts.join(" ");
      return heading ? "<h" + level + ">" + heading + "</h" + level + ">" : null;
    }
    function renderText(info) {
      const content = renderLines(info.element);
      return content ? "<p>" + content + "</p>" : null;
    }
    function renderQuote(info, cell = false) {
      const content = renderContent(contentParts(info.element), cell);
      return content ? "<blockquote>" + content + "</blockquote>" : null;
    }
    function renderContainer(info, cell = false) {
      convertedContainers.add(info.type);
      const previousWarnings = warnings2.length;
      const content = renderContent(contentParts(info.element), cell);
      if (!content && warnings2.length === previousWarnings) {
        const label = info.type === "quote_container" ? "引用容器 " : info.type === "view" ? "视图容器 " : ["grid", "grid_column"].includes(info.type) ? "分栏容器 " : "同步块 ";
        addWarning("unsupported_block", label + info.id + " 尚未读取到已渲染正文");
        return null;
      }
      return info.type === "quote_container" ? "<blockquote>" + content + "</blockquote>" : content || null;
    }
    function renderTodo(info) {
      const content = renderLines(info.element);
      if (!content) return null;
      return "<p>" + (detectChecked(info.element) ? "☑ " : "☐ ") + content + "</p>";
    }
    function renderCode(info) {
      const record = codeMap[info.id];
      const lines = Array.isArray(record?.lines) ? record.lines : [];
      if (!lines.length) {
        const label = "代码块 " + info.id + " 缺少内容";
        addWarning("missing_code", label);
        return "<p>[" + escapeText2(label) + "]</p>";
      }
      const ordered = lines.map((line, index) => {
        const num = Number(line?.num);
        return {
          num: Number.isSafeInteger(num) && num >= 1 ? num : index + 1,
          index,
          text: cleanText(line?.text ?? "")
        };
      }).sort((first, second) => first.num - second.num || first.index - second.index);
      const button = findFirstElement(info.element, (element) => hasClass(element, "code-block-header-btn"));
      const language = normalizeLanguage(button ? textContent(button) : "");
      const classAttribute = language ? ' class="language-' + language + '"' : "";
      const pieces = [];
      let run = [];
      function flush() {
        if (run.length) pieces.push("<pre><code" + classAttribute + ">" + run.join("\n") + "</code></pre>");
        run = [];
      }
      function missing(first, last2) {
        flush();
        const range = first === last2 ? String(first) : first + "–" + last2;
        const label = "代码块 " + info.id + " 缺少第 " + range + " 行";
        addWarning("code_lines_missing", label);
        pieces.push("<p>[" + escapeText2(label) + "]</p>");
      }
      let next = 1;
      for (const line of ordered) {
        if (line.num > next) missing(next, line.num - 1);
        run.push(escapeText2(line.text));
        next = line.num + 1;
      }
      const last = Number.isSafeInteger(record.totalLines) ? Math.max(record.totalLines, next - 1) : next - 1;
      if (next <= last) missing(next, last);
      checkedCodeLines.set(info.id, last);
      flush();
      return pieces.join("");
    }
    function sanitizeImageAlt(value) {
      const alt = cleanText(value ?? "").replace(/\s+/gu, " ").trim();
      if (!alt) return "";
      if (/^feishu docs\s*[-–—]\s*image(?:\s*\d+)?$/iu.test(alt)) return "";
      if (alt === "图片" || alt === "Image") return "";
      return alt;
    }
    function renderImage(info) {
      const image = imageByBlock.get(info.id);
      const label = info.type === "whiteboard" ? "白板块 " : info.type === "diagram" ? "图表块 " : "图片块 ";
      if (!image) {
        addWarning("missing_image", label + info.id + " 缺少素材");
        return null;
      }
      const mime = String(image.mime ?? "").split(";", 1)[0].trim().toLowerCase();
      if (mime && !MIME_EXTENSIONS[mime]) {
        addWarning("invalid_image", label + info.id + " 的 MIME 类型不受支持：" + mime);
      }
      let alt = sanitizeImageAlt(image.alt);
      if (!alt && info.type === "whiteboard") alt = "白板静态预览（当前画面）";
      if (!alt && info.type === "diagram") alt = "图表";
      if (!alt) {
        const element = findFirstElement(info.element, (node) => node.tagName === "img");
        alt = sanitizeImageAlt(element ? nodeAttr(element, "alt") : "");
      }
      return '<img src="' + escapeText2(imageHtmlPath(image)) + '" alt="' + escapeText2(alt) + '">';
    }
    function renderFile2(info) {
      convertedContainers.add("file");
      function visibleText(node) {
        if (node.nodeName === "#text") return cleanText(node.value || "");
        if (isHiddenOrControl(node) || ["button", "toolbar", "menu", "menuitem"].includes(nodeAttr(node, "role"))) return "";
        return (node.childNodes || []).map(visibleText).join("");
      }
      const links = [];
      function visit(node) {
        if (isHiddenOrControl(node) || ["button", "toolbar", "menu", "menuitem"].includes(nodeAttr(node, "role"))) return;
        if (node.tagName === "a") {
          const href = safeHref(nodeAttr(node, "href"));
          if (/^https?:\/\//iu.test(href)) {
            const name2 = visibleText(node).replace(/\s+/gu, " ").trim().slice(0, 2048) || "附件链接";
            links.push('<a href="' + escapeText2(href) + '">' + escapeText2(name2) + "</a>");
            return;
          }
        }
        for (const child of childElements(node)) visit(child);
      }
      visit(info.element);
      const name = visibleText(info.element).replace(/\s+/gu, " ").trim().slice(0, 2048) || "附件";
      addWarning("missing_attachment", "附件块 " + info.id + " 原件未采集，仅保留文件名和可用链接");
      return "<p>" + (links.length ? links.join("、") : escapeText2(name)) + " [原件未采集]</p>";
    }
    function renderCellBlock(info) {
      switch (info.type) {
        case "text":
          return renderLines(info.element) || null;
        case "bullet":
        case "ordered":
          return renderList(info.type, [info], true);
        case "code":
          return renderCode(info);
        case "image":
        case "diagram":
        case "whiteboard":
          return renderImage(info);
        case "file":
          return renderFile2(info);
        case "quote":
        case "callout":
          return renderQuote(info, true);
        case "quote_container":
        case "synced_reference":
        case "view":
          return renderContainer(info);
        case "grid":
        case "grid_column":
          return renderContainer(info, true);
        case "table":
          addWarning("unsupported_block", "表格内嵌套表格未转换");
          return null;
        case "divider":
          return "<hr>";
        case "todo":
          return renderTodo(info);
        default: {
          const heading = HEADING_TYPE.exec(info.type);
          if (heading) {
            const content = renderLines(info.element, { suppressBold: true, join: " " });
            return content ? "<strong>" + content + "</strong>" : null;
          }
          addWarning("unsupported_block", "未适配的单元格块类型：" + (info.type || "(空)"));
          return null;
        }
      }
    }
    function renderCellSequence(infos2) {
      return renderSequence(infos2, true);
    }
    function renderTableCell(cell) {
      const tag = cell.tagName === "th" ? "th" : "td";
      let attributes = "";
      for (const span2 of ["colspan", "rowspan"]) {
        const value = Number.parseInt(nodeAttr(cell, span2), 10);
        if (Number.isInteger(value) && value >= 2) attributes += " " + span2 + '="' + value + '"';
      }
      const style = cellStyleText(readCellStyle(nodeAttr(cell, "style"), {
        align: nodeAttr(cell, "align"),
        valign: nodeAttr(cell, "valign"),
        bgcolor: nodeAttr(cell, "bgcolor")
      }));
      if (style) attributes += ' style="' + style + '"';
      const blocks = collectCellBlocks(cell, addWarning);
      let content;
      if (blocks.length) content = joinCellFragments(renderCellSequence(blocks));
      else content = renderLines(cell) || renderInline(cell.childNodes, false);
      return "<" + tag + attributes + ">" + content + "</" + tag + ">";
    }
    function renderTable(info) {
      function findTable(node) {
        if (node.tagName === "table") return isAuxiliaryTable(node) ? null : node;
        for (const child of childElements(node)) {
          const found = findTable(child);
          if (found) return found;
        }
        return null;
      }
      const table = findTable(info.element);
      if (!table) {
        addWarning("unsupported_block", "表格块 " + info.id + " 无法解析");
        return null;
      }
      function renderRow(row) {
        const cells = childElements(row).filter((cell) => (cell.tagName === "td" || cell.tagName === "th") && !cell.attrs?.some(({ name, value }) => name === "hidden" || name === "aria-hidden" && value === "true") && !hasFinalDisplayNone(nodeAttr(cell, "style")));
        return cells.length ? "<tr>" + cells.map(renderTableCell).join("") + "</tr>" : "";
      }
      const parts = [];
      for (const child of childElements(table)) {
        if (child.tagName === "caption") {
          const content2 = renderLines(child) || renderInline(child.childNodes, false);
          parts.push("<caption>" + content2 + "</caption>");
        }
      }
      let group, section, rowParts = [];
      function flushRows() {
        if (rowParts.length) parts.push("<" + section + ">" + rowParts.join("") + "</" + section + ">");
        rowParts = [];
      }
      for (const entry of logicalTableRows(info.element, table)) {
        if (group !== entry.group || section !== entry.section) flushRows();
        group = entry.group;
        section = entry.section;
        const rendered = renderRow(entry.row);
        if (rendered) rowParts.push(rendered);
      }
      flushRows();
      const content = parts.join("");
      const columns = columnGroupHtml(readTableColumnWidths(table));
      return content ? "<table" + (columns ? ' style="table-layout:fixed;width:100%;overflow-wrap:anywhere"' : "") + ">" + columns + content + "</table>" : null;
    }
    function renderBlock(info) {
      const heading = HEADING_TYPE.exec(info.type);
      if (heading) return renderHeading(info, Number(heading[1]));
      switch (info.type) {
        case "text":
          return renderText(info);
        case "code":
          return renderCode(info);
        case "image":
        case "diagram":
        case "whiteboard":
          return renderImage(info);
        case "file":
          return renderFile2(info);
        case "table":
          return renderTable(info);
        case "quote":
        case "callout":
          return renderQuote(info);
        case "quote_container":
        case "synced_reference":
        case "view":
        case "grid":
        case "grid_column":
          return renderContainer(info);
        case "divider":
          return "<hr>";
        case "todo":
          return renderTodo(info);
        default:
          unsupportedTypes.add(info.type);
          addWarning("unsupported_block", "块 " + (info.id || "(无 id)") + " 未转换（" + (info.type || "(空)") + "）");
          return null;
      }
    }
    const infos = [];
    for (const block of capture.blocks) {
      if (!block || typeof block !== "object") {
        addWarning("unsupported_block", "存在无法识别的块");
        continue;
      }
      const type = typeof block.type === "string" ? block.type : "";
      const id = String(block.id ?? "");
      const element = parseBlock(block.html);
      if (!element) {
        addWarning("unsupported_block", "块 " + (id || "(无 id)") + " 无法解析");
        continue;
      }
      if (!["whiteboard", "diagram", "file"].includes(type)) normalizeRichContent(element, id, addWarning);
      infos.push({ id, type, element });
    }
    const rawTitle = cleanText(capture.source?.title ?? "").replace(/\s+/gu, " ").trim();
    const title = rawTitle || "文档";
    const body = renderSequence(infos).join("");
    const captureWarnings = normalizeWarnings(capture.warnings).filter(({ code, label = "" }) => {
      if (code === "unsupported_block" && label.startsWith("未适配的块类型：")) {
        const type = label.slice("未适配的块类型：".length);
        return !unsupportedTypes.has(type) && !convertedContainers.has(type);
      }
      if (code === "code_lines_missing") {
        const summary = /^代码块 (\S+) 缺少行 ([0-9,、– -]+)$/u.exec(label);
        if (summary && checkedCodeLines.has(summary[1])) {
          const checked = checkedCodeLines.get(summary[1]);
          return summary[2].match(/\d+/gu)?.some((value) => Number(value) > checked);
        }
      }
      return true;
    });
    const allWarnings = dedupeWarnings([...captureWarnings, ...warnings2]);
    const metadata = allWarnings.length ? '<meta name="' + warningMarker + '" content="' + escapeText2(JSON.stringify(allWarnings)) + '">' : "";
    const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>' + escapeText2(title) + "</title>" + metadata + "</head><body><h1>" + escapeText2(title) + "</h1>" + body + "</body></html>";
    return { title, html, warnings: allWarnings };
  }

  // src/importer.js
  var MiB = 1024 * 1024;
  var limits = { html: 8 * MiB, entry: 24 * MiB, expanded: 48 * MiB, entries: 384 };
  var utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  var htmlNamespace = "http://www.w3.org/1999/xhtml";
  var visibleTags = new Set("article section div p span h1 h2 h3 h4 h5 h6 b strong i em u s del strike blockquote ul ol li pre code br hr a img figure figcaption table caption thead tbody tfoot tr th td sup sub small dl dt dd".split(" "));
  var omittedTags = new Set("script style template noscript title link meta base source track param area".split(" "));
  var unsupportedTags = new Set("iframe frame frameset object embed video audio canvas input button select textarea form".split(" "));
  var rasterExtensions = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
  var crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n >>> 1 ^ (n & 1 ? 3988292384 : 0);
    return n;
  });
  function crc32(bytes) {
    let crc2 = 4294967295;
    for (const byte of bytes) crc2 = crc2 >>> 8 ^ crcTable[(crc2 ^ byte) & 255];
    return (crc2 ^ 4294967295) >>> 0;
  }
  function inputError(code, message) {
    return Object.assign(new Error(message), { code });
  }
  function invalidInput() {
    return inputError("invalid_input", "采集内容或素材路径无效。");
  }
  function inputLimit() {
    return inputError("input_limit", "采集内容超过处理限制（384 个条目、单项 24 MiB、合计 48 MiB；正文最多 8 MiB）。");
  }
  function htmlLimit() {
    return inputError("html_limit", "HTML 元素数量或嵌套超过限制。");
  }
  function boundedHtml(html) {
    let nodes = 0;
    let depth = 0;
    function count() {
      if (++nodes > 6e4) throw htmlLimit();
    }
    const treeAdapter = { ...defaultTreeAdapter };
    for (const name of ["createElement", "createCommentNode", "createDocumentFragment"]) {
      treeAdapter[name] = (...args) => {
        count();
        return defaultTreeAdapter[name](...args);
      };
    }
    treeAdapter.insertText = (parent, text) => {
      if (parent.childNodes.at(-1)?.nodeName !== "#text") count();
      defaultTreeAdapter.insertText(parent, text);
    };
    treeAdapter.insertTextBefore = (parent, text, reference) => {
      if (parent.childNodes[parent.childNodes.indexOf(reference) - 1]?.nodeName !== "#text") count();
      defaultTreeAdapter.insertTextBefore(parent, text, reference);
    };
    treeAdapter.onItemPush = () => {
      if (++depth > 98) throw htmlLimit();
    };
    treeAdapter.onItemPop = () => {
      depth--;
    };
    return parse(html, { scriptingEnabled: true, treeAdapter });
  }
  function safeSegment(segment) {
    return Boolean(segment && segment !== "." && segment !== ".." && !/[\u0000-\u001f\u007f-\u009f\u2028-\u202e\u2066-\u2069<>:"/\\|?*]/u.test(segment) && !/[. ]$/u.test(segment) && !/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(segment));
  }
  function safeParts(parts) {
    return parts.every((part) => part.length <= 160 && safeSegment(part));
  }
  function assetPath(raw) {
    const path = raw.normalize("NFC");
    if (path.length > 512 || !safeParts(path.split("/"))) {
      throw invalidInput();
    }
    if (!/^(?:images|attachments)\/.+$/u.test(path)) {
      throw invalidInput();
    }
    return path;
  }
  function validatePaths(entries) {
    const paths = /* @__PURE__ */ new Map();
    for (const { path } of entries) {
      const parts = path.split("/");
      let prefix2 = "";
      for (let i = 1; i <= parts.length; i++) {
        prefix2 += (i === 1 ? "" : "/") + parts[i - 1];
        const key = prefix2.toLowerCase();
        const last = i === parts.length;
        const previous = paths.get(key);
        if (previous && (previous.prefix !== prefix2 || !previous.directory || last)) {
          throw invalidInput();
        }
        if (last || !previous) paths.set(key, { prefix: prefix2, directory: !last });
      }
    }
  }
  function imageDimensions(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
    const be16 = (offset) => view.getUint16(offset);
    const le16 = (offset) => view.getUint16(offset, true);
    const be32 = (offset) => view.getUint32(offset);
    const le24 = (offset) => le16(offset) | bytes[offset + 2] << 16;
    if (bytes.length >= 33 && be32(0) === 2303741511 && be32(4) === 218765834 && be32(8) === 13 && ascii(12, 16) === "IHDR") {
      let imageData = false;
      for (let offset = 8, chunks = 0; offset + 12 <= bytes.length && chunks < 16384; chunks++) {
        const length = be32(offset);
        const end = offset + 8 + length;
        if (end + 4 > bytes.length || crc32(bytes.subarray(offset + 4, end)) !== be32(end)) break;
        const tag = ascii(offset + 4, offset + 8);
        if (tag === "IDAT" && length) imageData = true;
        if (tag === "IEND" && imageData && length === 0 && end + 4 === bytes.length) {
          return ["image/png", be32(16), be32(20)];
        }
        offset = end + 4;
      }
      return [];
    }
    if (bytes.length >= 14 && /^GIF8[79]a$/u.test(ascii(0, 6))) {
      return ["image/gif", le16(6), le16(8)];
    }
    if (bytes.length >= 25 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" && view.getUint32(4, true) + 8 === bytes.length) {
      switch (ascii(12, 16)) {
        case "VP8X":
          if (bytes.length >= 30) return ["image/webp", le24(24) + 1, le24(27) + 1];
          break;
        case "VP8L":
          if (bytes[20] === 47) {
            return ["image/webp", (le16(21) & 16383) + 1, (view.getUint32(21, true) >>> 14 & 16383) + 1];
          }
          break;
        case "VP8 ":
          if (bytes.length >= 30 && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
            return ["image/webp", le16(26) & 16383, le16(28) & 16383];
          }
          break;
      }
    }
    if (bytes.length >= 12 && be16(0) === 65496) {
      for (let offset = 2; offset + 8 < bytes.length; ) {
        if (bytes[offset++] !== 255) break;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (offset + 7 > bytes.length || marker === 218 || marker === 217) break;
        const length = be16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        if (length >= 8 && [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
          return ["image/jpeg", be16(offset + 5), be16(offset + 3)];
        }
        offset += length;
      }
    }
    return [];
  }
  async function rasterType(bytes) {
    const [type, width, height] = imageDimensions(bytes);
    if (!type || !width || !height || width > 8192 || height > 8192 || width * height > 16e6) return "";
    if (typeof createImageBitmap !== "function") return type;
    try {
      const bitmap = await createImageBitmap(new Blob([bytes], { type }));
      const valid = bitmap.width <= 8192 && bitmap.height <= 8192 && bitmap.width * bitmap.height <= 16e6;
      bitmap.close();
      return valid ? type : "";
    } catch {
      return "";
    }
  }
  function localPath(raw) {
    try {
      const parts = raw.replace(/^(?:\.\/)+/u, "").split(/[?#]/u, 1)[0].split("/").map(decodeURIComponent);
      const path = parts.join("/").normalize("NFC");
      if (path.length > 512 || !["images", "attachments"].includes(parts[0]) || parts.length < 2 || !safeParts(parts) || !safeParts(path.split("/"))) return "";
      return path;
    } catch {
      return "";
    }
  }
  function webLink(raw) {
    if (/[\u0000-\u001f\u007f\\]/u.test(raw) || !/^(?:https?:\/\/|mailto:)/iu.test(raw)) return "";
    try {
      const url = new URL(raw);
      return url.username || url.password ? "" : url.href;
    } catch {
      return "";
    }
  }
  function attr2(node, name) {
    return node.attrs?.find((item) => item.name === name && !item.namespace)?.value ?? "";
  }
  function joinText(items) {
    const result = [];
    for (const item of items) {
      if (typeof item === "string" && typeof result.at(-1) === "string") result[result.length - 1] += item;
      else result.push(item);
    }
    return result;
  }
  function nodeText(node) {
    if (typeof node === "string") return node;
    return node.children?.map(nodeText).join("") ?? "";
  }
  function preservedWarnings(serialized) {
    try {
      const warnings2 = JSON.parse(serialized);
      if (!Array.isArray(warnings2) || warnings2.length > 6e4) return [];
      return warnings2.flatMap((item) => {
        if (!item || typeof item.code !== "string" || !Object.hasOwn(warnings, item.code)) return [];
        const { code, label } = item;
        return typeof label === "string" && label.trim() ? [{ code, label }] : [{ code }];
      });
    } catch {
      return [];
    }
  }
  async function documentModel(html, files, fallback) {
    const document2 = boundedHtml(html);
    const root = document2.childNodes.find(({ tagName: tagName2 }) => tagName2 === "html");
    const head = root.childNodes.find(({ tagName: tagName2 }) => tagName2 === "head");
    const body = root.childNodes.find(({ tagName: tagName2 }) => tagName2 === "body");
    if (!body) throw inputError("invalid_html", "HTML 未包含可导入的正文。");
    const assets = /* @__PURE__ */ new Map();
    const warnings2 = [];
    const cacheWarnings = head.childNodes.find(
      (node) => node.tagName === "meta" && attr2(node, "name") === warningMarker
    );
    const cachedWarnings = cacheWarnings ? preservedWarnings(attr2(cacheWarnings, "content")) : [];
    const importedWarningLocations = new Set(cachedWarnings.filter((item) => item.label).map(({ code, label }) => code + "\0" + label));
    const occupiedPaths = /* @__PURE__ */ new Set();
    let embedded = 0;
    let firstHeading = "";
    let nodes = 0;
    let totalBytes = files.get("document.html")?.length ?? 0;
    for (const [path, bytes] of files) {
      if (path === "document.html") continue;
      const role = path.startsWith("images/") ? "image" : "attachment";
      const type = role === "image" ? await rasterType(bytes) : "";
      totalBytes += bytes.length;
      assets.set(path, { path, type: type || "application/octet-stream", bytes, role });
      let occupied = path.toLowerCase();
      while (!occupiedPaths.has(occupied)) {
        occupiedPaths.add(occupied);
        const separator = occupied.lastIndexOf("/");
        if (separator < 0) break;
        occupied = occupied.slice(0, separator);
      }
    }
    function note(code, description, children, path) {
      if (!path || !importedWarningLocations.has(code + "\0" + path)) {
        warnings2.push(path ? { code, label: path } : { code });
      }
      const text = "[" + description + "]";
      return { tag: "span", children: children?.length ? joinText([...children, " " + text]) : [text] };
    }
    async function readImage(node) {
      const raw = attr2(node, "src").trim();
      const alt = attr2(node, "alt").slice(0, 2048);
      const label = alt ? "图片：" + alt : "图片";
      if (/^data:/iu.test(raw)) {
        const data = /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z0-9+/]+={0,2})$/iu.exec(raw);
        if (!data) return note("invalid_image", "无效" + label);
        const encoded = data[2];
        if (encoded.length > limits.entry * 4 / 3 || totalBytes + encoded.length * 3 / 4 > limits.expanded || assets.size + 1 >= limits.entries) return note("invalid_image", "无效" + label);
        try {
          const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
          const type = await rasterType(bytes);
          if (!type || data[1].toLowerCase() !== type) return note("invalid_image", "无效" + label);
          let path2;
          do {
            path2 = "images/embedded-" + ++embedded + "." + rasterExtensions[type];
          } while (occupiedPaths.has(path2));
          occupiedPaths.add(path2);
          assets.set(path2, { path: path2, type, bytes, role: "image" });
          totalBytes += bytes.length;
          return { tag: "img", path: path2, alt };
        } catch {
          return note("invalid_image", "无效" + label);
        }
      }
      if (/^(?:\/\/|[a-z][a-z\d+.-]*:)/iu.test(raw)) return note("remote_image", "未加载外部" + label);
      const path = localPath(raw);
      const asset = assets.get(path);
      if (asset?.role === "image" && asset.type.startsWith("image/")) return { tag: "img", path, alt };
      if (asset?.role === "image") return note("invalid_image", "无效" + label, null, path);
      return note("missing_image", "缺少" + label, null, path);
    }
    async function readNodes(list, depth) {
      if (depth > 96) throw htmlLimit();
      const result = [];
      for (const node of list) {
        if (++nodes > 6e4) throw htmlLimit();
        if (node.nodeName === "#text") {
          if (node.value) result.push(node.value);
          continue;
        }
        const tag = node.tagName;
        if (!tag || omittedTags.has(tag)) continue;
        if (tag === "nav" && attr2(node, "data-feishu-export-navigation") === "1") continue;
        if (node.namespaceURI !== htmlNamespace || unsupportedTags.has(tag) || tag.includes("-")) {
          result.push(note("unsupported_block", "未转换的内容块"));
          continue;
        }
        if (tag === "img") {
          result.push(await readImage(node));
          continue;
        }
        const children = await readNodes(node.childNodes ?? [], depth + 1);
        if (!visibleTags.has(tag)) {
          result.push(...children);
          continue;
        }
        if (tag === "a") {
          const raw = attr2(node, "href").trim();
          const path = localPath(raw);
          const href = webLink(raw);
          if (path && assets.has(path)) result.push({ tag, path, children });
          else if (path?.startsWith("attachments/") || node.attrs?.some(({ name }) => name === "download")) {
            result.push(note("missing_attachment", "缺少附件", children, path));
          } else if (href) result.push({ tag, href, children });
          else if (raw && !raw.startsWith("#")) result.push(note("unsupported_link", "未保留的链接", children));
          else result.push(...children);
          continue;
        }
        const item = { tag };
        if (!["br", "hr"].includes(tag)) item.children = children;
        if (tag === "h1" && !firstHeading) firstHeading = nodeText(item).trim();
        if (tag === "td" || tag === "th") {
          Object.assign(item, readCellStyle(attr2(node, "style"), {
            align: attr2(node, "align"),
            valign: attr2(node, "valign"),
            bgcolor: attr2(node, "bgcolor")
          }));
          for (const span2 of ["colspan", "rowspan"]) {
            const value = Number(attr2(node, span2));
            if (Number.isInteger(value) && value >= 2 && value <= 64) item[span2] = value;
          }
        } else if (tag === "table") {
          const widths = readTableColumnWidths(node);
          if (widths) item.columnWidths = widths;
        } else if (tag === "ol") {
          const value = attr2(node, "start");
          if (/^-?\d{1,6}$/u.test(value) && Number(value) !== 1) item.start = Number(value);
        } else if (tag === "code") {
          const language = /(?:^|\s)language-([a-z0-9][a-z0-9-]{0,31})(?:\s|$)/iu.exec(attr2(node, "class"))?.[1];
          if (language) item.language = language.toLowerCase();
        }
        result.push(item);
      }
      return joinText(result);
    }
    const blocks = await readNodes(body.childNodes, 0);
    if (!blocks.some((item) => typeof item !== "string" || item.trim())) {
      throw inputError("invalid_html", "HTML 未包含可导入的正文。");
    }
    const htmlTitle = head.childNodes.find(({ tagName: tagName2 }) => tagName2 === "title")?.childNodes.map((node) => node.value ?? "").join("");
    const fullTitle = (firstHeading || htmlTitle?.trim() || fallback).replace(/\s+/gu, " ").trim();
    const title = fullTitle.match(/^.{1,160}/u)?.[0] || "文档";
    return {
      version: 1,
      title,
      blocks,
      assets: [...assets.values()].sort((first, second) => first.path < second.path ? -1 : Number(first.path > second.path)),
      warnings: [...cachedWarnings, ...warnings2]
    };
  }
  function decodeHtml(bytes) {
    try {
      return utf8.decode(bytes).replace(/^\uFEFF/u, "");
    } catch {
      throw inputError("invalid_encoding", "文档正文必须使用 UTF-8 编码。");
    }
  }
  async function readDocumentParts({ html, assets = [], name = "文档" } = {}) {
    if (!(typeof html === "string" || html instanceof Uint8Array) || !Array.isArray(assets)) {
      throw inputError("invalid_input", "采集正文和素材数据无效。");
    }
    if (html.length > limits.html || assets.length + 1 > limits.entries) throw inputLimit();
    const body = typeof html === "string" ? new TextEncoder().encode(html) : html;
    if (body.length > limits.html) throw inputLimit();
    const entries = [{ path: "document.html", bytes: body }];
    let expanded = body.length;
    for (const asset of assets) {
      if (!asset || typeof asset.path !== "string" || !(asset.bytes instanceof Uint8Array)) {
        throw inputError("invalid_input", "素材路径或字节数据无效。");
      }
      const path = assetPath(asset.path);
      expanded += asset.bytes.length;
      if (asset.bytes.length > limits.entry || expanded > limits.expanded) throw inputLimit();
      entries.push({ path, bytes: asset.bytes });
    }
    validatePaths(entries);
    const files = /* @__PURE__ */ new Map();
    for (const { path, bytes } of entries) {
      const owned = path === "document.html" && typeof html === "string";
      files.set(path, owned ? bytes : new Uint8Array(bytes));
    }
    return documentModel(decodeHtml(files.get("document.html")), files, typeof name === "string" ? name : "文档");
  }

  // node_modules/fflate/esm/browser.js
  /* eslint-disable curly, no-redeclare, no-return-assign, no-sequences -- @preserve Upstream fflate conventions only. */
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a2 = freb(fleb, 2);
  var fl = _a2.b;
  var revfl = _a2.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a3 = hTree(lf, 15), dlt = _a3.t, mlb = _a3.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (val instanceof u8)
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a3 = r[fn], file = _a3[0], p = _a3[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }
  /* eslint-enable curly, no-redeclare, no-return-assign, no-sequences -- @preserve End upstream fflate. */

  // src/formats.js
  var zipOptions = { level: 1, mtime: new Date(2e3, 0, 1) };
  var rasterTypes = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
  var maxOutputSize = 80 * 1024 * 1024;
  var maxMarkdownSize = 24 * 1024 * 1024;
  var htmlStyle = "body{font:16px/1.65 system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 20px;color:#202020}img{max-width:100%;height:auto}.table-scroll{max-width:100%;overflow-x:auto;margin:1em 0}table{border-collapse:collapse}th,td{border:1px solid #999;padding:5px 10px;vertical-align:top}pre{white-space:pre;overflow:auto;max-width:100%;tab-size:4;background:#f2f2f2;padding:12px}a{overflow-wrap:anywhere}figure{margin:1em 0}.export-toc{margin:1em 0 1.5em;color:#4e5969}.export-toc summary{cursor:pointer;width:fit-content}.export-toc ul{list-style:none;padding:0;margin:.6em 0}.export-toc li{margin:.3em 0}.export-toc .toc-level-3{padding-left:1em}.export-toc .toc-level-4{padding-left:2em}.export-toc .toc-level-5{padding-left:3em}.export-toc .toc-level-6{padding-left:4em}@media(max-width:600px){body{margin:20px auto;padding:0 16px}}@media print{body{max-width:none;margin:0;padding:0}.export-toc{display:none}.table-scroll{overflow:visible}pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:visible}table{width:100%}th,td{overflow-wrap:anywhere}}";
  var csp = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
  var blockTags = new Set("article section div p h1 h2 h3 h4 h5 h6 blockquote ul ol li pre hr figure figcaption table dl dt dd".split(" "));
  var markdownBlocksInCells = /* @__PURE__ */ new Set(["blockquote", "ul", "ol", "pre", "hr", "figure", "table", "dl"]);
  function outputLimit() {
    return Object.assign(new Error("导出结果超过本机处理上限。"), { code: "render_limit" });
  }
  function escapeHtml(text) {
    return String(text).replace(/[&<>"'\r]/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "\r": "&#13;" })[character]);
  }
  function utf8Size(text) {
    let size = text.length;
    if (!/[\u0080-\uFFFF]/.test(text)) return size;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code <= 127) continue;
      if (code < 2048) size++;
      else if (code >= 55296 && code <= 56319 && text.charCodeAt(i + 1) >= 56320 && text.charCodeAt(i + 1) <= 57343) {
        size += 2;
        i++;
      } else size += 2;
    }
    return size;
  }
  function relativeUrl(path) {
    return path.split("/").map((part) => encodeURIComponent(part).replace(
      /[!'()*]/gu,
      (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase()
    )).join("/");
  }
  function dataUrl(bytes, type) {
    if (typeof bytes.toBase64 === "function") return "data:" + type + ";base64," + bytes.toBase64();
    const encoded = [];
    for (let start = 0; start < bytes.length; start += 12288) {
      encoded.push(btoa(String.fromCharCode(...bytes.subarray(start, start + 12288))));
    }
    return "data:" + type + ";base64," + encoded.join("");
  }
  function textContent2(node) {
    if (typeof node === "string") return node;
    return (node.children ?? []).map(textContent2).join("");
  }
  function visitedAssets(nodes, paths = /* @__PURE__ */ new Set()) {
    for (const node of nodes) {
      if (typeof node !== "object") continue;
      if (node.path) paths.add(node.path);
      if (node.children) visitedAssets(node.children, paths);
    }
    return paths;
  }
  function htmlNodes(nodes, lookup, embedded, account = (markup) => markup, presentation, cellColor) {
    return nodes.map((node) => {
      if (typeof node === "string") return account(escapeHtml(node));
      const { tag, children = [] } = node;
      if (!visibleTags.has(tag)) return htmlNodes(children, lookup, embedded, account, presentation, cellColor);
      const childCellColor = tag === "td" || tag === "th" ? normalizeColor(node.color) || cellColor : cellColor;
      const asset = lookup.get(node.path);
      if (tag === "img") {
        if (!rasterTypes.has(asset?.type) || asset.role !== "image") return account("[缺少图片]");
        const src = embedded ? embedded(asset, true) : relativeUrl(asset.path);
        return account('<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(node.alt ?? "") + '">');
      }
      if (tag === "br" || tag === "hr") return account("<" + tag + ">");
      let attrs = "";
      if (tag === "a") {
        if (asset) {
          const href = embedded ? embedded(asset, false) : relativeUrl(asset.path);
          attrs = ' href="' + escapeHtml(href) + '"';
          if (embedded || asset.role === "attachment") attrs += ' download="' + escapeHtml(asset.path.split("/").at(-1)) + '"';
        } else if (node.href && webLink(node.href)) {
          attrs = ' href="' + escapeHtml(webLink(node.href)) + '" rel="noopener noreferrer"';
        } else {
          return htmlNodes(children, lookup, embedded, account, presentation, cellColor);
        }
        if (cellColor) attrs += ' style="color:inherit"';
      }
      if (tag === "td" || tag === "th") {
        for (const name of ["colspan", "rowspan"]) {
          const value = node[name];
          if (Number.isInteger(value) && value >= 2 && value <= 64) attrs += " " + name + '="' + value + '"';
        }
        const style = cellStyleText(node);
        if (style) attrs += ' style="' + style + '"';
      }
      const columns = tag === "table" ? columnGroupHtml(node.columnWidths) : "";
      if (columns) attrs += ' style="table-layout:fixed;width:100%;overflow-wrap:anywhere"';
      if (tag === "ol" && Number.isInteger(node.start)) attrs = ' start="' + node.start + '"';
      if (tag === "code" && /^[a-z0-9][a-z0-9-]{0,31}$/u.test(node.language ?? "")) {
        attrs = ' class="language-' + node.language + '"';
      }
      if (tag === "pre" && cellColor) attrs += ' style="color:inherit;background:transparent"';
      if (presentation?.headings.has(node)) attrs += ' id="' + presentation.headings.get(node) + '"';
      const opening = account((tag === "table" && presentation ? '<div class="table-scroll">' : "") + "<" + tag + attrs + ">");
      let contents = (columns ? account(columns) : "") + htmlNodes(children, lookup, embedded, account, presentation, childCellColor);
      if (tag === "pre" && typeof children[0] === "string" && children[0].startsWith("\n")) {
        contents = account("\n") + contents;
      }
      return opening + contents + account("</" + tag + ">" + (tag === "table" && presentation ? "</div>" : ""));
    }).join("");
  }
  function htmlNavigation(blocks, title) {
    const headings = /* @__PURE__ */ new WeakMap(), entries = [];
    let count = 0, skippedTitle = false;
    function visit(nodes) {
      for (const node of nodes) {
        if (typeof node !== "object") continue;
        if (/^h[1-6]$/u.test(node.tag)) {
          const id = "fle-section-" + ++count;
          const label = textContent2(node).replace(/\s+/gu, " ").trim();
          headings.set(node, id);
          if (!skippedTitle && node.tag === "h1" && label === title.trim()) skippedTitle = true;
          else if (label) entries.push({ id, label: Array.from(label).slice(0, 160).join(""), level: node.tag[1] });
        }
        visit(node.children || []);
      }
    }
    visit(blocks);
    const longDocument = textContent2({ children: blocks }).replace(/\s/gu, "").length >= 1e3;
    const markup = entries.length >= 3 && longDocument ? '<nav class="export-toc" data-feishu-export-navigation="1" aria-label="文档目录"><details><summary>目录</summary><ul>' + entries.map(({ id, label, level }) => '<li class="toc-level-' + level + '"><a href="#' + id + '">' + escapeHtml(label) + "</a></li>").join("") + "</ul></details></nav>" : "";
    return { headings, markup };
  }
  function exportBlocks({ blocks, warnings: warnings2 }) {
    if (!warnings2.length) return blocks;
    return [...blocks, { tag: "h2", children: ["导出提示"] }, {
      tag: "ul",
      children: warnings2.map(({ code, label }) => ({
        tag: "li",
        children: [label ? warningLabel(code) + " · " + label : warningLabel(code)]
      }))
    }];
  }
  function standaloneHtml(snapshot, limit) {
    const { title, blocks, assets } = snapshot;
    const lookup = new Map(assets.map((asset) => [asset.path, asset]));
    let size = 0;
    function account(markup) {
      size += utf8Size(markup);
      if (size > limit) throw outputLimit();
      return markup;
    }
    const embedded = (asset, image) => {
      if (size + Math.ceil(asset.bytes.length / 3) * 4 > limit) throw outputLimit();
      return dataUrl(asset.bytes, image ? asset.type : "application/octet-stream");
    };
    const navigation = htmlNavigation(blocks, title);
    const body = account(navigation.markup) + htmlNodes(exportBlocks(snapshot), lookup, embedded, account, navigation);
    let supplemental = "";
    const referenced = visitedAssets(blocks);
    const unreferenced = assets.filter((asset) => !referenced.has(asset.path));
    if (unreferenced.length) {
      const contents = unreferenced.map((asset) => account(
        '<li><a href="' + embedded(asset, false) + '" download="' + escapeHtml(asset.path.split("/").at(-1)) + '">' + escapeHtml(asset.path) + "</a></li>"
      )).join("");
      supplemental = account("<section><h2>随包文件</h2><ul>") + contents + account("</ul></section>");
    }
    const metadata = '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="' + csp + '"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1">';
    const head = account('<!doctype html><html lang="zh-CN"><head>' + metadata + "<title>" + escapeHtml(title) + "</title><style>" + htmlStyle + "</style></head><body>");
    return head + body + supplemental + account("</body></html>");
  }
  function markdownHtml(nodes, lookup) {
    let size = 0;
    return htmlNodes(nodes, lookup, null, (markup) => {
      const encoded = markup.replace(/[\n\u0085\u2028\u2029!\[\]]/gu, (character) => "&#" + character.charCodeAt(0) + ";");
      size += utf8Size(encoded);
      if (size > maxMarkdownSize) throw outputLimit();
      return encoded;
    });
  }
  function joinMarkdown(parts, separator) {
    let size = utf8Size(separator) * Math.max(0, parts.length - 1);
    for (const part of parts) {
      size += utf8Size(part);
      if (size > maxMarkdownSize) throw outputLimit();
    }
    return parts.join(separator);
  }
  function indentMarkdown(text, prefix2, blankPrefix = "") {
    let size = utf8Size(text) + prefix2.length;
    if (size > maxMarkdownSize) throw outputLimit();
    let lines = 1;
    for (let offset = text.indexOf("\n"); offset >= 0; offset = text.indexOf("\n", offset + 1)) {
      if (++lines > 2e5) throw outputLimit();
      size += prefix2.length;
      if (size > maxMarkdownSize) throw outputLimit();
    }
    return text.replace(/(^|\n)(?=[^\n])/gu, "$1" + prefix2).replace(/(^|\n)(?=\n|$)/gu, "$1" + blankPrefix);
  }
  function escapeMarkdown(text) {
    return text.replace(/[\t\r\n\f ]+/gu, " ").replace(/[\\`*_{}\[\]<>()#+~!$]/gu, "\\$&").replace(/&(?=[a-z#])/giu, "&amp;");
  }
  function longestBackticks(text) {
    return (text.match(/`+/gu) ?? []).reduce((longest, run) => Math.max(longest, run.length), 0);
  }
  function markdownInline(nodes, lookup, table = false) {
    return joinMarkdown(nodes.map((node) => {
      if (typeof node === "string") {
        const escaped = escapeMarkdown(node);
        return table ? escaped.replaceAll("|", "\\|") : escaped;
      }
      const { tag, children = [] } = node;
      const asset = lookup.get(node.path);
      if (tag === "img") {
        if (!asset || asset.role !== "image" || !rasterTypes.has(asset.type)) return "\\[缺少图片\\]";
        const alt = escapeMarkdown(node.alt ?? "");
        return "![" + (table ? alt.replaceAll("|", "\\|") : alt) + "](" + relativeUrl(asset.path) + ")";
      }
      if (tag === "br") return table ? "<br>" : "  \n";
      if (tag === "code") {
        let text = textContent2(node).replace(/\r?\n/gu, " ");
        if (!text) return "<code></code>";
        if (table) text = text.replaceAll("|", "\\|");
        const fence = "`".repeat(longestBackticks(text) + 1);
        const pad = text.startsWith("`") || text.endsWith("`") || text.trim() && text.startsWith(" ") && text.endsWith(" ") ? " " : "";
        return fence + pad + text + pad + fence;
      }
      const inner = markdownInline(children, lookup, table);
      if (tag === "a") {
        const href = asset ? relativeUrl(asset.path) : webLink(node.href ?? "").replace(
          /[<>()\s|\\]/gu,
          (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")
        );
        return href ? "[" + (inner.trim() || "链接") + "](" + href + ")" : inner;
      }
      const delimiter = { b: "**", strong: "**", i: "*", em: "*", s: "~~", del: "~~", strike: "~~" }[tag];
      if (delimiter && inner.trim()) return inner.replace(/(\S(?:[\s\S]*\S)?)/u, delimiter + "$1" + delimiter);
      if (["u", "sup", "sub", "small"].includes(tag)) return "<" + tag + ">" + inner + "</" + tag + ">";
      return inner;
    }), "");
  }
  function onlyElements(node) {
    return (node.children ?? []).filter((child) => typeof child !== "string");
  }
  function complexCell(node) {
    return (node.children ?? []).some((child) => typeof child === "object" && (markdownBlocksInCells.has(child.tag) || complexCell(child)));
  }
  function markdownTable(table, lookup) {
    const sections = onlyElements(table);
    const rows = sections.flatMap((node) => node.tag === "tr" ? [node] : onlyElements(node));
    const cells = rows.map(onlyElements);
    if (normalizeColumnWidths(table.columnWidths) || cells.some((row) => row.some((cell) => cellStyleText(cell))) || sections.some((node) => !["tr", "thead", "tbody", "tfoot"].includes(node.tag)) || rows.some((node) => node.tag !== "tr") || !cells[0]?.length || cells[0].some(({ tag }) => tag !== "th") || cells.slice(1).some((row) => row.some(({ tag }) => tag !== "td")) || cells.some((row) => row.length !== cells[0].length || row.some((cell) => cell.colspan || cell.rowspan || complexCell(cell)))) {
      return markdownHtml([table], lookup);
    }
    const lines = cells.map((row) => "| " + row.map((cell) => {
      const parts = [];
      let inline = [];
      for (const child of cell.children ?? []) {
        if (typeof child === "object" && blockTags.has(child.tag)) {
          if (inline.length) parts.push(markdownInline(inline, lookup, true).trim());
          parts.push(markdownInline(child.children ?? [], lookup, true).trim());
          inline = [];
        } else {
          inline.push(child);
        }
      }
      if (inline.length) parts.push(markdownInline(inline, lookup, true).trim());
      return joinMarkdown(parts.filter(Boolean), "<br>");
    }).join(" | ") + " |");
    lines.splice(1, 0, "| " + cells[0].map(() => "---").join(" | ") + " |");
    return joinMarkdown(lines, "\n");
  }
  function markdownList(node, lookup) {
    let index = node.start ?? 1;
    if (index < 0) return markdownHtml([node], lookup);
    return joinMarkdown(onlyElements(node).map((item) => {
      const prefix2 = node.tag === "ol" ? index++ + ". " : "- ";
      let text = "";
      let pending = [];
      for (const child of item.children ?? []) {
        if (typeof child === "object" && (child.tag === "ul" || child.tag === "ol")) {
          const paragraph2 = markdownFlow(pending, lookup);
          text += (text && paragraph2 ? "\n\n" : "") + paragraph2;
          const sublist = markdownList(child, lookup);
          text += (text ? "\n" : "") + sublist;
          pending = [];
        } else {
          pending.push(child);
        }
      }
      const paragraph = markdownFlow(pending, lookup);
      text += (text && paragraph ? "\n\n" : "") + paragraph;
      return prefix2 + indentMarkdown(text, " ".repeat(prefix2.length)).slice(text ? prefix2.length : 0);
    }), "\n");
  }
  function markdownBlock(node, lookup) {
    const { tag, children = [] } = node;
    if (/^h[1-6]$/u.test(tag)) return "#".repeat(Number(tag[1])) + " " + markdownInline(children, lookup).trim();
    if (tag === "pre") {
      const code = textContent2(node);
      const fence = "`".repeat(Math.max(3, longestBackticks(code) + 1));
      const codeNode = onlyElements(node).find((child) => child.tag === "code");
      const language = codeNode && typeof codeNode.language === "string" ? codeNode.language : "";
      return fence + language + "\n" + code + (code.endsWith("\n") ? "" : "\n") + fence;
    }
    if (tag === "blockquote") {
      const content = markdownFlow(children, lookup);
      return content ? indentMarkdown(content, "> ", ">") : ">";
    }
    if (tag === "ul" || tag === "ol") return markdownList(node, lookup);
    if (tag === "table") return markdownTable(node, lookup);
    if (tag === "hr") return "---";
    if (tag === "dl") return markdownHtml([node], lookup);
    if (tag === "figcaption") return "*" + markdownInline(children, lookup).trim() + "*";
    return markdownFlow(children, lookup);
  }
  function markdownFlow(nodes, lookup) {
    const chunks = [];
    let inline = [];
    function flush() {
      const text = markdownInline(inline, lookup).trim();
      if (text) {
        chunks.push(text.replace(/(^|\n)([0-9]{1,9})([.)])(?= )/gu, "$1$2\\$3").replace(
          /(^|\n)([-+>])(?= )|(^|\n)([-=])(?=[-=]*(?:\n|$))/gu,
          (_, beforeList, marker, beforeRule, rule) => (beforeList ?? beforeRule) + "\\" + (marker ?? rule)
        ));
      }
      inline = [];
    }
    for (const node of nodes) {
      if (typeof node === "object" && blockTags.has(node.tag)) {
        flush();
        chunks.push(markdownBlock(node, lookup));
      } else {
        inline.push(node);
      }
    }
    flush();
    return joinMarkdown(chunks.filter(Boolean), "\n\n");
  }
  function zipFiles(files) {
    const bytes = zipSync(files, zipOptions);
    return new Blob([bytes], { type: "application/zip" });
  }
  function attachmentManifest(snapshot) {
    const referenced = visitedAssets(snapshot.blocks);
    const included = snapshot.assets.filter((asset) => referenced.has(asset.path)).map(({ path }) => path);
    const unreferenced = snapshot.assets.filter((asset) => !referenced.has(asset.path)).map(({ path }) => path);
    const diagnostics = /* @__PURE__ */ new Map();
    const missing = /* @__PURE__ */ new Set();
    for (const { code, label } of snapshot.warnings) {
      diagnostics.set(code, (diagnostics.get(code) ?? 0) + 1);
      if (label) missing.add(code + ": " + label);
    }
    return strToU8([
      "已打包且在正文中引用",
      ...included,
      ...included.length ? [] : ["（无）"],
      "",
      "已打包但正文未引用",
      ...unreferenced,
      ...unreferenced.length ? [] : ["（无）"],
      "",
      "缺失、无效或未转换的项目",
      ...[...diagnostics].map(([code, count]) => code + ": " + count),
      ...missing,
      ...diagnostics.size ? [] : ["（无）"],
      ""
    ].join("\n"));
  }
  async function renderFile(kind, snapshot) {
    const file = safeStem(snapshot.title);
    if (kind === "html") {
      return {
        filename: file + ".html",
        blob: new Blob([standaloneHtml(snapshot, maxOutputSize)], { type: "text/html;charset=utf-8" })
      };
    }
    if (kind === "markdown" || kind === "attachments") return renderBundle([kind], snapshot);
    throw new Error("不支持此导出格式。");
  }
  function renderBundle(kinds, snapshot, extraFiles = []) {
    const selected = new Set(kinds);
    if (!Array.isArray(extraFiles)) throw new Error("附加文件需要安全的根目录文件名和字节数据。");
    for (const extra of extraFiles) {
      const name = extra?.name;
      if (typeof name !== "string" || !name || name !== name.normalize("NFC") || Array.from(name).length > 160 || /[\\/:*?"<>|\x00-\x1f\x7f-\x9f\u2028-\u202e\u2066-\u2069]/u.test(name) || /^[.\s]+$|[. ]$/u.test(name) || /^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/iu.test(name) || !(extra.bytes instanceof Uint8Array)) {
        throw new Error("附加文件需要安全的根目录文件名和字节数据。");
      }
    }
    if (!selected.size && !extraFiles.length || [...selected].some((kind) => !["markdown", "html", "attachments"].includes(kind))) {
      throw new Error("不支持此导出格式。");
    }
    const file = safeStem(snapshot.title);
    const files = /* @__PURE__ */ Object.create(null);
    const paths = /* @__PURE__ */ new Map();
    let totalBytes = 0;
    function addFile(name, bytes) {
      const parts = name.split("/");
      let prefix2 = "";
      for (let index = 0; index < parts.length; index++) {
        prefix2 += (index ? "/" : "") + parts[index];
        const key = prefix2.normalize("NFC").toLowerCase();
        const directory = index < parts.length - 1;
        const previous = paths.get(key);
        if (previous && (previous.name !== prefix2 || !previous.directory || !directory)) {
          throw new Error("归档中的文件名重复或与目录冲突。");
        }
        if (!previous) paths.set(key, { name: prefix2, directory });
      }
      totalBytes += bytes.length;
      if (totalBytes > maxOutputSize) throw outputLimit();
      files[name] = bytes;
    }
    let referenced;
    if (selected.has("markdown")) {
      const lookup = new Map(snapshot.assets.map((asset) => [asset.path, asset]));
      referenced = visitedAssets(snapshot.blocks);
      addFile(file + ".md", strToU8(markdownFlow(exportBlocks(snapshot), lookup) + "\n"));
    }
    if (selected.has("html")) addFile(file + ".html", strToU8(standaloneHtml(snapshot, maxOutputSize)));
    if (selected.has("attachments")) addFile("manifest.txt", attachmentManifest(snapshot));
    for (const asset of snapshot.assets) {
      if (selected.has("attachments") || referenced?.has(asset.path)) addFile(asset.path, asset.bytes);
    }
    for (const extra of extraFiles) addFile(extra.name, extra.bytes);
    const suffix = selected.size === 1 && !extraFiles.length ? { markdown: "Markdown", attachments: "素材包", html: "HTML" }[kinds[0]] : "导出";
    const blob = zipFiles(files);
    if (blob.size > maxOutputSize) throw outputLimit();
    return {
      filename: file + "-" + suffix + ".zip",
      blob,
      entries: Object.entries(files).map(([name, bytes]) => ({ name, bytes: bytes.length }))
    };
  }

  // src/userscript/source.js
  var TEXT_KINDS = /* @__PURE__ */ new Set(["docx", "docs", "wiki"]);
  var OTHER_LABELS = {
    sheets: "电子表格",
    base: "多维表格",
    bitable: "多维表格",
    slides: "幻灯片",
    mindnotes: "思维笔记",
    file: "文件预览"
  };
  var RESERVED_WIKI_PATHS = /* @__PURE__ */ new Set(["settings", "home", "space", "spaces", "search"]);
  var ZERO_WIDTH2 = /[\u200b\u200c\u200d\u2060\ufeff]/gu;
  function cleanText2(value) {
    return String(value || "").replace(ZERO_WIDTH2, " ").replace(/\s+/gu, " ").trim();
  }
  function readDocumentRoute(location2 = globalThis.location) {
    const href = typeof location2 === "string" ? location2 : location2?.href || "";
    const empty = { href, key: "", kind: "", token: "" };
    let url;
    try {
      url = new URL(href);
    } catch {
      return empty;
    }
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (url.protocol !== "https:" || hostname !== "feishu.cn" && !hostname.endsWith(".feishu.cn")) return empty;
    const pathname = typeof location2?.pathname === "string" ? location2.pathname : url.pathname;
    const match = pathname.match(/^\/(docx|docs|wiki|sheets|base|bitable|slides|mindnotes|file)\/([A-Za-z0-9]+)\/?$/u);
    if (!match || match[1] === "wiki" && RESERVED_WIKI_PATHS.has(match[2])) return empty;
    return { href, key: match[1] + ":" + match[2], kind: match[1], token: match[2] };
  }
  function isVisible(element, view) {
    if (!element || element.isConnected === false || element.hidden || element.getAttribute?.("aria-hidden") === "true") return false;
    const style = view.getComputedStyle?.(element);
    return style?.display !== "none" && style?.visibility !== "hidden";
  }
  function embeddedKind(document2, href) {
    for (const frame of document2?.querySelectorAll?.("iframe[src]") || []) {
      const src = frame.getAttribute("src");
      let embedded;
      try {
        embedded = readDocumentRoute(new URL(src, href));
      } catch {
        continue;
      }
      if (Object.hasOwn(OTHER_LABELS, embedded.kind)) return embedded.kind;
    }
    return "";
  }
  function readDocumentSource(view = globalThis) {
    const { document: document2 } = view;
    const route = readDocumentRoute(view.location);
    const pageBlock = document2?.querySelector('[data-block-type="page"]') || document2?.querySelector(".page-block");
    const titleEl = document2?.querySelector(".page-block-content");
    const title = cleanText2(titleEl?.textContent || (document2?.title || "").replace(/\s*-\s*(?:Feishu Docs|飞书云文档)$/iu, ""));
    const docToken = pageBlock?.getAttribute("data-record-id") || "";
    const source = {
      href: route.href,
      key: route.key,
      kind: route.kind,
      wikiToken: route.kind === "wiki" ? route.token : "",
      docToken,
      title,
      ready: false,
      unsupported: false,
      reason: ""
    };
    if (!route.key) {
      source.reason = "请打开一篇飞书文档后保存。";
      return source;
    }
    const otherKind = !TEXT_KINDS.has(route.kind) ? route.kind : route.kind === "wiki" && !pageBlock ? embeddedKind(document2, route.href) : "";
    if (otherKind) {
      source.unsupported = true;
      source.reason = "当前页面是" + OTHER_LABELS[otherKind] + "，暂不支持保存这一类型。";
      return source;
    }
    const scroller = document2?.querySelector(".bear-web-x-container");
    if (!isVisible(pageBlock, view) || !isVisible(scroller, view) || !docToken || !title) {
      source.reason = "正在等待文档正文加载。";
      return source;
    }
    if (route.kind !== "wiki" && docToken !== route.token) {
      source.reason = "正在等待当前文档，页面仍显示前一篇正文。";
      return source;
    }
    source.ready = true;
    return source;
  }

  // src/userscript/whiteboard-native.js
  var boundsKeys = ["minX", "maxX", "minY", "maxY"];
  function sceneBounds(manager) {
    const source = manager.getNodesBounds();
    if (!source || !boundsKeys.every((key) => Number.isFinite(source[key]))) return null;
    const bounds = Object.fromEntries(boundsKeys.map((key) => [key, source[key]]));
    const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
    return width > 0 && height > 0 && Number.isFinite(width * height) ? bounds : null;
  }
  function findBoard(root, id, recordId) {
    const pending = [root], seen = /* @__PURE__ */ new Set();
    while (pending.length && seen.size < 2e4) {
      const model = pending.pop();
      if (!model || typeof model !== "object" || seen.has(model)) continue;
      seen.add(model);
      if (String(model.id) === id && model.type === "whiteboard" && model.record?.id === recordId) return model;
      if (Array.isArray(model.children)) pending.push(...model.children);
      const children = model.innerBlockManager?.rootBlockModel?.children;
      if (Array.isArray(children)) pending.push(...children);
    }
    return null;
  }
  async function renderNativeWhiteboard(id, { document: document2, pageView, checkStop = () => {
  }, waitForReady, background } = {}) {
    let canvas, owned = false;
    try {
      checkStop();
      const key = String(id);
      if (!/^[\w-]{1,160}$/u.test(key)) return null;
      const page = document2?.querySelector('[data-block-type="page"]');
      const block = document2?.querySelector('[data-block-id="' + key + '"]');
      const pageId = page?.getAttribute("data-record-id"), recordId = block?.getAttribute("data-record-id");
      const root = pageView?.PageMain?.blockManager?.rootBlockModel;
      if (!pageId || !recordId || !root || root.record?.id !== pageId || block.isConnected === false || block.getAttribute("data-block-type") !== "whiteboard" || !page.contains(block)) return null;
      const model = findBoard(root, key, recordId);
      const app = model?.whiteboardBlock?.abilityKit?.getRatioApp?.()?.app;
      const manager = app?.application?.nodeManager, renderer = app?.renderManager;
      if (typeof manager?.getNodesBounds !== "function" || typeof renderer?.getImageOffscreenCanvas !== "function") return null;
      const belongsToPage = () => pageView?.PageMain?.blockManager?.rootBlockModel === root && root.record?.id === pageId && document2.querySelector('[data-block-type="page"]') === page && page.getAttribute("data-record-id") === pageId && document2.querySelector('[data-block-id="' + key + '"]') === block && block.isConnected !== false && block.getAttribute("data-record-id") === recordId && page.contains(block) && findBoard(root, key, recordId) === model && model.whiteboardBlock?.abilityKit?.getRatioApp?.()?.app === app;
      if (waitForReady && !await waitForReady()) return null;
      checkStop();
      if (!belongsToPage()) return null;
      const source = sceneBounds(manager);
      if (!source) return null;
      const bounds = { minX: source.minX - 24, maxX: source.maxX + 24, minY: source.minY - 24, maxY: source.maxY + 24 };
      const width = bounds.maxX - bounds.minX, height = bounds.maxY - bounds.minY;
      const scale = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(159e5 / (width * height)));
      if (!Number.isFinite(scale) || scale <= 0 || width * scale < 1 || height * scale < 1) return null;
      checkStop();
      canvas = renderer.getImageOffscreenCanvas(bounds, scale, normalizeColor(background) || "#ffffff");
      if (!canvas || typeof canvas.then === "function" || canvas.isConnected !== false || typeof canvas.toDataURL !== "function" || document2.contains?.(canvas)) return null;
      owned = true;
      checkStop();
      const outputWidth = canvas.width, outputHeight = canvas.height;
      if (!Number.isSafeInteger(outputWidth) || !Number.isSafeInteger(outputHeight) || outputWidth < 1 || outputHeight < 1 || outputWidth > 8192 || outputHeight > 8192 || outputWidth * outputHeight > 16e6) return null;
      const dataUrl2 = canvas.toDataURL("image/png");
      if (typeof dataUrl2 !== "string" || dataUrl2.length > 32 * 1024 * 1024 + 64 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl2)) return null;
      checkStop();
      const currentBounds = sceneBounds(manager);
      if (!belongsToPage() || !currentBounds || !boundsKeys.every((name) => currentBounds[name] === source[name])) return null;
      return {
        blockId: id,
        mime: "image/png",
        width: outputWidth,
        height: outputHeight,
        alt: "白板静态图（原始场景渲染）",
        dataUrl: dataUrl2
      };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return null;
    } finally {
      if (owned) {
        try {
          canvas.width = 0;
          canvas.height = 0;
        } catch {
        }
      }
    }
  }

  // src/userscript/whiteboard.js
  var CONTENT_CANVAS = ".whiteboad-x-content-canvas canvas.whiteboad-x-normal-canvas";
  var BLOCK_VIEW = ".whiteboard-view-container.is-block";
  var STABLE_MS = 240;
  function styleOf(node) {
    return node.ownerDocument?.defaultView?.getComputedStyle(node) || {};
  }
  function isVisibleInBlock(node, block) {
    if (node.isConnected === false || node.closest("[data-block-type]") !== block) return false;
    for (let current = node; current; current = current.parentElement) {
      const style = styleOf(current);
      const role = current.getAttribute("role");
      if (current.hidden || current.getAttribute("aria-hidden") === "true" || ["BUTTON", "INPUT", "SELECT"].includes(current.tagName) || ["button", "toolbar", "menu", "menuitem"].includes(role) || /(?:^|[-_\s])(?:mini[-_]?map|toolbar|auxiliary)(?:$|[-_\s])/iu.test(String(current.className || "")) || style.display === "none" || ["hidden", "collapse"].includes(style.visibility) || style.opacity === "0") return false;
      if (current === block) return true;
    }
    return false;
  }
  function findWhiteboardCanvas(block) {
    if (!block) return null;
    const candidates = [...block.querySelectorAll(CONTENT_CANVAS)].filter((canvas) => {
      if (!isVisibleInBlock(canvas, block)) return false;
      const stage = canvas.closest(".whiteboad-x-canvas-container");
      const box = canvas.getBoundingClientRect();
      if (!stage || !block.contains(stage) || !canvas.width || !canvas.height || !box.width || !box.height) return false;
      return true;
    });
    return candidates.length === 1 ? candidates[0] : null;
  }
  function backgroundOf(canvas, block) {
    for (let node = canvas; node; node = node.parentElement) {
      const color2 = styleOf(node).backgroundColor || "";
      const rgb = /^rgba?\(([^)]+)\)$/iu.exec(color2);
      const channels = rgb?.[1].trim().split(/[\s,/]+/u).map(Number);
      if (channels?.every(Number.isFinite) && (channels.length === 3 || channels.length === 4 && channels[3] === 1)) return color2;
      if (node === block) break;
    }
    return "#ffffff";
  }
  function readPixels(canvas, block, fingerprint = true) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("白板内容画布无法读取");
    const background = /^rgba?\(([^)]+)\)$/iu.exec(backgroundOf(canvas, block));
    const rgb = background ? background[1].trim().split(/[\s,/]+/u).slice(0, 3).map(Number) : [255, 255, 255];
    let drawn = false, hash = 2166136261;
    const rows = Math.max(1, Math.floor(65536 / canvas.width));
    for (let top = 0; top < canvas.height; top += rows) {
      const pixels = context.getImageData(0, top, canvas.width, Math.min(rows, canvas.height - top)).data;
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2], alpha = pixels[index + 3];
        if (alpha && (red !== rgb[0] || green !== rgb[1] || blue !== rgb[2])) {
          drawn = true;
          if (!fingerprint) return { drawn };
        }
        if (fingerprint) hash = Math.imul(hash ^ (red << 24 | green << 16 | blue << 8 | alpha), 16777619) >>> 0;
      }
    }
    return { drawn, hash };
  }
  function withinImageLimits(canvas) {
    return canvas.width <= 8192 && canvas.height <= 8192 && canvas.width * canvas.height <= 16e6;
  }
  function isWhiteboardReady(block) {
    const canvas = findWhiteboardCanvas(block);
    if (!canvas || !withinImageLimits(canvas)) return false;
    try {
      return readPixels(canvas, block, false).drawn;
    } catch {
      return false;
    }
  }
  async function waitForStableCanvas(id, document2, wait2, checkStop, { view, width = 0, height = 0 } = {}) {
    const started = Date.now();
    let previous, signature = "", stableSince = started;
    while (Date.now() - started <= 2500) {
      checkStop();
      const block = document2.querySelector('[data-block-id="' + id + '"]');
      const source = findWhiteboardCanvas(block);
      if (source && (!view || view.isConnected !== false && block.contains(view) && view.contains(source))) {
        if (!withinImageLimits(source)) {
          if (view) return null;
          throw new Error("白板预览尺寸超过图片限制");
        }
        if (source.width < width || source.height < height) {
          previous = null;
          signature = "";
          await wait2(120);
          continue;
        }
        const pixels = readPixels(source, block);
        const next = source.width + ":" + source.height + ":" + pixels.hash;
        if (!pixels.drawn || source !== previous || next !== signature) {
          previous = source;
          signature = next;
          stableSince = Date.now();
        }
        if (pixels.drawn && Date.now() - stableSince >= STABLE_MS) return { source, block };
      } else {
        previous = null;
        signature = "";
      }
      await wait2(120);
    }
    checkStop();
    return null;
  }
  function redrawPlan(block, source) {
    const views = [...block.querySelectorAll(BLOCK_VIEW)].filter((view2) => isVisibleInBlock(view2, block));
    if (views.length !== 1 || !views[0].contains(source)) return null;
    const view = views[0], box = view.getBoundingClientRect(), canvasBox = source.getBoundingClientRect();
    if (![box.width, box.height, canvasBox.width, canvasBox.height].every((value) => Number.isFinite(value) && value > 0)) return null;
    const density = Math.min(source.width / canvasBox.width, source.height / canvasBox.height);
    if (density >= 2) return null;
    let scale = Math.min(
      2,
      2 / density,
      8192 / source.width,
      8192 / source.height,
      Math.sqrt(16e6 / (source.width * source.height))
    );
    if (!withinImageLimits({ width: Math.ceil(source.width * scale), height: Math.ceil(source.height * scale) })) {
      scale = Math.max(1, scale - 1 / Math.min(source.width, source.height));
    }
    return {
      view,
      scale,
      cssWidth: box.width * scale,
      cssHeight: box.height * scale,
      width: Math.floor(canvasBox.width * density * scale),
      height: Math.floor(canvasBox.height * density * scale),
      originalWidth: source.width,
      originalHeight: source.height,
      limited: density * scale < 2
    };
  }
  async function restoreView(plan, style, id, document2, wait2) {
    if (style === null) plan.view.removeAttribute("style");
    else plan.view.setAttribute("style", style);
    const started = Date.now();
    while (Date.now() - started <= 900 && plan.view.isConnected !== false) {
      const block = document2.querySelector('[data-block-id="' + id + '"]');
      const source = findWhiteboardCanvas(block);
      if (!block?.contains(plan.view) || source && plan.view.contains(source) && source.width === plan.originalWidth && source.height === plan.originalHeight) return;
      try {
        await wait2(60);
      } catch {
        return;
      }
    }
  }
  function copyPreview(id, { source, block }, document2, checkStop, limited) {
    checkStop();
    const { width, height } = source;
    const canvas = document2.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("白板预览画布无法创建");
    context.fillStyle = backgroundOf(source, block);
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0);
    const dataUrl2 = canvas.toDataURL("image/png");
    if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl2)) throw new Error("白板预览未生成有效PNG");
    return {
      blockId: id,
      mime: "image/png",
      width,
      height,
      alt: limited ? "白板静态预览（当前画面，清晰度受页面限制）" : "白板静态预览（当前画面）",
      dataUrl: dataUrl2
    };
  }
  async function captureWhiteboardPreview(id, {
    document: document2 = globalThis.document,
    wait: wait2,
    checkStop,
    pageView = typeof unsafeWindow === "undefined" ? globalThis : unsafeWindow
  } = {}) {
    checkStop();
    let block = document2.querySelector('[data-block-id="' + id + '"]');
    let source = findWhiteboardCanvas(block);
    if (!source) {
      const initial = await waitForStableCanvas(id, document2, wait2, checkStop);
      if (!initial) throw new Error("白板内容画面尚未绘制，或未确认唯一且可见的内容画布");
      ({ block, source } = initial);
    }
    if (source && !withinImageLimits(source)) throw new Error("白板预览尺寸超过图片限制");
    const native = await renderNativeWhiteboard(id, {
      document: document2,
      pageView,
      checkStop,
      background: backgroundOf(source, block),
      waitForReady: async () => Boolean(await waitForStableCanvas(id, document2, wait2, checkStop))
    });
    if (native) return native;
    const plan = source && redrawPlan(block, source);
    const box = source.getBoundingClientRect();
    const limited = Boolean(plan) || Math.min(source.width / box.width, source.height / box.height) < 2;
    if (plan && plan.scale > 1) {
      const style = plan.view.getAttribute("style");
      let image;
      try {
        plan.view.style.setProperty("width", plan.cssWidth + "px", "important");
        plan.view.style.setProperty("height", plan.cssHeight + "px", "important");
        plan.view.style.setProperty("max-width", "none", "important");
        const highResolution = await waitForStableCanvas(id, document2, wait2, checkStop, plan);
        if (highResolution) image = copyPreview(id, highResolution, document2, checkStop, plan.limited);
      } finally {
        await restoreView(plan, style, id, document2, wait2);
      }
      checkStop();
      if (image) return image;
    }
    const preview = await waitForStableCanvas(id, document2, wait2, checkStop);
    if (!preview) throw new Error("白板内容画面尚未绘制，或未确认唯一且可见的内容画布");
    return copyPreview(id, preview, document2, checkStop, limited);
  }

  // src/userscript/image.js
  function visibleImage(node, block) {
    if (node.isConnected === false || node.closest("[data-block-id]") !== block) return false;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return false;
    for (let current = node; current; current = current.parentElement) {
      const style = current.ownerDocument?.defaultView?.getComputedStyle(current) || {};
      if (current.hidden || current.getAttribute("aria-hidden") === "true" || style.display === "none" || ["hidden", "collapse"].includes(style.visibility) || style.opacity === "0") return false;
      if (current === block) break;
    }
    return true;
  }
  function readImageState(block) {
    if (!block) return null;
    const candidates = [...block.querySelectorAll("img")].filter((node2) => visibleImage(node2, block));
    if (candidates.length !== 1) return null;
    const node = candidates[0];
    return {
      node,
      source: node.currentSrc || node.getAttribute("src") || "",
      width: node.naturalWidth,
      height: node.naturalHeight,
      complete: node.complete
    };
  }
  function sameImageState(a, b) {
    return a === b || Boolean(a && b && a.node === b.node && a.source === b.source && a.width === b.width && a.height === b.height && a.complete === b.complete);
  }
  function checkDimensions(width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 16e6) throw new Error("图片位图尺寸超过限制或无效");
  }
  async function captureLoadedImage(id, { document: document2 = globalThis.document, wait: wait2, checkStop, saved } = {}) {
    const started = Date.now();
    let previous = null, stableSince = started;
    const current = () => readImageState(document2.querySelector('[data-block-id="' + id + '"]'));
    while (Date.now() - started <= 2500) {
      checkStop();
      const state = current();
      if (!sameImageState(state, previous)) {
        previous = state;
        stableSince = Date.now();
      }
      if (state?.complete && state.width && state.height && Date.now() - stableSince >= 120) {
        checkDimensions(state.width, state.height);
        let bitmap;
        try {
          if (typeof globalThis.createImageBitmap === "function") bitmap = await globalThis.createImageBitmap(state.node);
          checkStop();
          if (!sameImageState(state, current())) continue;
          const width = bitmap?.width ?? state.width, height = bitmap?.height ?? state.height;
          checkDimensions(width, height);
          if (saved && sameImageState(saved.state, state) && saved.image.width === width && saved.image.height === height) {
            return { state, image: saved.image };
          }
          const canvas = document2.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("图片画布无法创建");
          context.drawImage(bitmap || state.node, 0, 0, width, height);
          const dataUrl2 = canvas.toDataURL("image/png");
          if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl2)) throw new Error("图片未生成有效PNG");
          if (!sameImageState(state, current())) continue;
          return { state, image: { blockId: id, alt: state.node.getAttribute("alt") || "", mime: "image/png", width, height, dataUrl: dataUrl2 } };
        } finally {
          bitmap?.close();
        }
      }
      await wait2(60);
    }
    checkStop();
    throw new Error("未读到唯一、可见且加载稳定的图片");
  }

  // src/userscript/diagram.js
  var SVG = "http://www.w3.org/2000/svg";
  var XHTML = "http://www.w3.org/1999/xhtml";
  var svgTags = /* @__PURE__ */ new Set([
    "svg",
    "g",
    "defs",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "text",
    "tspan",
    "title",
    "desc",
    "clipPath",
    "linearGradient",
    "radialGradient",
    "stop",
    "foreignObject"
  ]);
  var htmlTags = /* @__PURE__ */ new Set(["div", "span", "strong", "b", "br", "i", "em", "p"]);
  function findDiagram(root, id, recordId) {
    const pending = [root], seen = /* @__PURE__ */ new Set();
    while (pending.length && seen.size < 2e4) {
      const model = pending.pop();
      if (!model || typeof model !== "object" || seen.has(model)) continue;
      seen.add(model);
      if (String(model.id) === id && model.type === "diagram" && model.record?.id === recordId) return model;
      if (Array.isArray(model.children)) pending.push(...model.children);
      const children = model.innerBlockManager?.rootBlockModel?.children;
      if (Array.isArray(children)) pending.push(...children);
    }
    return null;
  }
  function dimensions(svg) {
    if (svg?.namespaceURI !== SVG || svg.localName !== "svg") return null;
    const size = (name) => {
      const value = svg.getAttribute(name);
      return typeof value === "string" && /^\d+(?:\.\d+)?(?:px)?$/u.test(value) ? Number.parseFloat(value) : NaN;
    };
    const width = size("width"), height = size("height");
    const box = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/u).map(Number);
    if (!Number.isFinite(width * height) || width < 1 || height < 1 || !box || box.length !== 4 || !box.every(Number.isFinite) || box[2] <= 0 || box[3] <= 0) return null;
    return { width, height };
  }
  function staticSource(svg, serializer) {
    const pending = [{ node: svg, html: false, depth: 0 }];
    let count = 0;
    while (pending.length) {
      const { node, html, depth } = pending.pop();
      if (++count > 2e4 || depth > 128) return null;
      if (node.nodeType === 3 || node.nodeType === 4 || node.nodeType === 8) continue;
      if (node.nodeType !== 1 || node.namespaceURI !== (html ? XHTML : SVG) || !(html ? htmlTags : svgTags).has(node.localName)) return null;
      for (const attribute of node.attributes) {
        const name = attribute.name.toLowerCase(), value = attribute.value;
        if (name === "xmlns" || name.startsWith("xmlns:")) {
          if (![SVG, XHTML, "http://www.w3.org/1999/xlink"].includes(value)) return null;
        } else if (attribute.namespaceURI && attribute.namespaceURI !== "http://www.w3.org/XML/1998/namespace") return null;
        if (name.startsWith("on") || /(?:^|:)(?:href|src)$/u.test(name) || /[\\\u0000-\u001f]|(?:url|image(?:-set)?|cross-fade|element|paint)\s*\(|@import|expression\s*\(|javascript\s*:|(?:animation|transition|behavior|binding)\s*:/iu.test(value)) return null;
      }
      for (const child of node.childNodes) pending.push({ node: child, html: html || node.localName === "foreignObject", depth: depth + 1 });
    }
    const source = serializer.serializeToString(svg);
    return typeof source === "string" && source.length <= 2 * 1024 * 1024 ? source : null;
  }
  async function decode(image, checkStop) {
    let timer;
    try {
      const deadline = Date.now() + 8e3;
      await Promise.race([image.decode(), new Promise((resolve, reject) => {
        const tick = () => {
          try {
            checkStop();
            if (Date.now() >= deadline) throw new Error("流程图解码超时");
            timer = setTimeout(tick, 100);
          } catch (error) {
            reject(error);
          }
        };
        timer = setTimeout(tick, 100);
      })]);
    } finally {
      clearTimeout(timer);
    }
  }
  async function captureDiagram(document2, id, { pageView = typeof unsafeWindow === "undefined" ? globalThis : unsafeWindow, checkStop = () => {
  } } = {}) {
    let canvas, image;
    try {
      checkStop();
      const key = String(id);
      if (!/^[\w-]{1,160}$/u.test(key)) return null;
      const page = document2?.querySelector('[data-block-type="page"]');
      const block = document2?.querySelector('[data-block-id="' + key + '"]');
      const pageId = page?.getAttribute("data-record-id"), recordId = block?.getAttribute("data-record-id");
      const root = pageView?.PageMain?.blockManager?.rootBlockModel;
      if (!pageId || !recordId || !root || root.record?.id !== pageId || block.isConnected === false || block.getAttribute("data-block-type") !== "diagram" || !page.contains(block)) return null;
      const model = findDiagram(root, key, recordId);
      const view = model?.blockManager?.getBlockViewByBlockId?.(model.id);
      if (typeof view?.getSvg !== "function") return null;
      const belongsToPage = () => pageView?.PageMain?.blockManager?.rootBlockModel === root && root.record?.id === pageId && document2.querySelector('[data-block-type="page"]') === page && page.getAttribute("data-record-id") === pageId && document2.querySelector('[data-block-id="' + key + '"]') === block && block.isConnected !== false && block.getAttribute("data-record-id") === recordId && page.contains(block) && findDiagram(root, key, recordId) === model && model.blockManager?.getBlockViewByBlockId?.(model.id) === view;
      const browser = document2.defaultView || globalThis, serializer = new browser.XMLSerializer();
      const base = view.getSvg(), size = dimensions(base), original = staticSource(base, serializer);
      if (!size || !original || !belongsToPage()) return null;
      const scale = Math.min(4, 8192 / size.width, 8192 / size.height, Math.sqrt(159e5 / (size.width * size.height)));
      if (!Number.isFinite(scale) || scale <= 0) return null;
      const svg = view.getSvg(scale), output = dimensions(svg), source = staticSource(svg, serializer);
      if (!output || !source) return null;
      const width = Math.ceil(output.width), height = Math.ceil(output.height);
      if (width > 8192 || height > 8192 || width * height > 16e6) return null;
      checkStop();
      image = new browser.Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      await decode(image, checkStop);
      checkStop();
      if (!belongsToPage() || staticSource(view.getSvg(), serializer) !== original) return null;
      canvas = document2.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      checkStop();
      const dataUrl2 = canvas.toDataURL("image/png");
      if (typeof dataUrl2 !== "string" || dataUrl2.length > 32 * 1024 * 1024 + 64 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/u.test(dataUrl2) || !belongsToPage() || staticSource(view.getSvg(), serializer) !== original) return null;
      return { blockId: id, mime: "image/png", width, height, alt: "流程图", dataUrl: dataUrl2 };
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      return null;
    } finally {
      try {
        image?.removeAttribute("src");
      } catch {
      }
      if (canvas) {
        try {
          canvas.width = 0;
        } catch {
        }
        try {
          canvas.height = 0;
        } catch {
        }
      }
    }
  }

  // src/userscript/table.js
  function rgba(value) {
    const opaque2 = normalizeColor(value);
    if (opaque2) return [...[1, 3, 5].map((index) => parseInt(opaque2.slice(index, index + 2), 16)), 1];
    const match = /^rgba?\(([^)]+)\)$/iu.exec(value || "");
    if (!match) return [0, 0, 0, 0];
    const parts = match[1].trim().split(/\s*[,/]\s*|\s+/u);
    if (parts.length !== 3 && parts.length !== 4) return [0, 0, 0, 0];
    const numbers = parts.map((part, index) => Number(part.replace(/%$/u, "")) * (part.endsWith("%") ? index < 3 ? 2.55 : 0.01 : 1));
    if (!numbers.every((value2, index) => Number.isFinite(value2) && value2 >= 0 && value2 <= (index < 3 ? 255 : 1))) return [0, 0, 0, 0];
    return [...numbers.slice(0, 3), numbers[3] ?? 1];
  }
  var hex = (channels) => "#" + channels.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("");
  var blend = (front, back) => front.slice(0, 3).map((channel, index) => channel * front[3] + back[index] * (1 - front[3]));
  function alignment(style) {
    const value = style.textAlign?.toLowerCase();
    return normalizeAlign(value === "start" ? style.direction === "rtl" ? "right" : "left" : value === "end" ? style.direction === "rtl" ? "left" : "right" : value);
  }
  function span(node, name, maximum = 64) {
    const raw = node.getAttribute(name);
    return raw == null || raw === "" ? 1 : /^\d{1,5}$/u.test(raw) && Number(raw) >= 1 && Number(raw) <= maximum ? Number(raw) : 0;
  }
  function tableGrid(table, isHiddenCell) {
    let occupied = [], columns = 0, section;
    const complete = [];
    for (const row of table.rows) {
      if (row.parentElement !== section) occupied = [];
      section = row.parentElement;
      let cursor = 0, plain = !occupied.some(Boolean);
      const next = occupied.map((value) => Math.max(0, value - 1));
      const cells = [...row.cells].filter((cell) => !isHiddenCell(cell));
      for (const cell of cells) {
        const across = span(cell, "colspan");
        const down = cell.getAttribute("rowspan") === "0" ? table.rows.length : span(cell, "rowspan", 65534);
        if (!across || !down) return;
        plain &&= across === 1 && down === 1;
        while (occupied[cursor]) cursor++;
        if (occupied.slice(cursor, cursor + across).some(Boolean)) return;
        for (let index = cursor; index < cursor + across; index++) next[index] = Math.max(next[index] || 0, down - 1);
        cursor += across;
        if (cursor > 64) return;
      }
      columns = Math.max(columns, cursor, occupied.length);
      if (plain && cells.length) complete.push(cells);
      occupied = next;
    }
    return { columns, complete };
  }
  function measuredWidths(table, isHiddenCell) {
    const grid = tableGrid(table, isHiddenCell);
    if (!grid?.columns) return;
    const widths = [];
    let valid = true;
    for (const child of table.children || []) {
      if (child.localName !== "colgroup" && child.localName !== "col") continue;
      const cols = child.localName === "col" ? [child] : [...child.children].filter((node) => node.localName === "col");
      for (const col of cols.length ? cols : [child]) {
        const count = span(col, "span"), width = col.getBoundingClientRect().width;
        if (!count || !Number.isFinite(width) || width <= 0 || widths.length + count > 64) {
          valid = false;
          break;
        }
        widths.push(...Array(count).fill(width / count));
      }
      if (!valid) break;
    }
    if (valid && widths.length === grid.columns) return normalizeColumnWidths(widths);
    for (const cells of grid.complete) {
      if (cells.length !== grid.columns) continue;
      const result = normalizeColumnWidths(cells.map((cell) => cell.getBoundingClientRect().width));
      if (result) return result;
    }
  }
  function styledHtml(html, style) {
    if (!style) return html;
    const table = parseFragment("<table><tbody><tr>" + html + "</tr></tbody></table>").childNodes[0];
    const cell = table?.childNodes[0]?.childNodes[0]?.childNodes.find((node) => node.tagName === "td" || node.tagName === "th");
    if (!cell) return html;
    const existing = cell.attrs.find((attr3) => attr3.name === "style");
    if (existing) existing.value = existing.value.replace(/;?\s*$/u, "") + ";" + style;
    else cell.attrs.push({ name: "style", value: style });
    return serializeOuter(cell);
  }
  function createTableStyleCapture() {
    let styles = /* @__PURE__ */ new WeakMap(), backgrounds = /* @__PURE__ */ new WeakMap(), cells = /* @__PURE__ */ new WeakMap(), tables = /* @__PURE__ */ new WeakMap();
    const canRead = (node) => node?.nodeType === 1 && typeof node.ownerDocument?.defaultView?.getComputedStyle === "function";
    function readStyle(node) {
      if (styles.has(node)) return styles.get(node);
      if (!canRead(node)) return {};
      const computed = node.ownerDocument.defaultView.getComputedStyle(node);
      const snapshot = Object.fromEntries(["backgroundColor", "color", "textAlign", "verticalAlign", "direction", "display"].map((key) => [key, computed[key]]));
      styles.set(node, snapshot);
      return snapshot;
    }
    function cellState(cell, html = cell.outerHTML) {
      let cached = cells.get(cell);
      if (cached?.html !== html) {
        styles.delete(cell);
        backgrounds.delete(cell);
        cached = { html };
        cells.set(cell, cached);
      }
      return cached;
    }
    function isHiddenCell(cell) {
      if (cell.hidden || cell.getAttribute?.("hidden") != null || cell.getAttribute?.("aria-hidden") === "true") return true;
      if (!canRead(cell)) return false;
      const cached = cellState(cell);
      if (cached.hidden === void 0) cached.hidden = readStyle(cell).display === "none";
      return cached.hidden;
    }
    function background(node) {
      const layers = [];
      let result;
      while (node) {
        if (backgrounds.has(node)) {
          result = backgrounds.get(node);
          break;
        }
        const layer = rgba(readStyle(node).backgroundColor);
        layers.push({ node, layer });
        if (layer[3] === 1) {
          result = { channels: layer.slice(0, 3), captured: true };
          break;
        }
        node = node.parentElement;
      }
      result ||= { channels: [255, 255, 255], captured: false };
      for (const { node: node2, layer } of layers.reverse()) {
        result = { channels: blend(layer, result.channels), captured: result.captured || layer[3] > 0 };
        backgrounds.set(node2, result);
      }
      return result;
    }
    return {
      isHiddenCell,
      cellHtml(cell, html = cell.outerHTML) {
        if (!canRead(cell)) return html;
        const cached = cellState(cell, html);
        if (cached.styled !== void 0) return cached.styled;
        const style = readStyle(cell), fill = background(cell);
        const lines = [...cell.querySelectorAll(".ace-line")].filter((line) => line.closest("td,th") === cell);
        const lineStyles = lines.map((line) => {
          styles.delete(line);
          return readStyle(line);
        });
        const alignments = new Set(lineStyles.map(alignment));
        const foreground = (value2) => {
          const color2 = rgba(value2);
          return color2[3] > 0 ? hex(blend(color2, fill.channels)) : void 0;
        };
        const colors = new Set(lineStyles.map((line) => foreground(line.color)));
        const value = cellStyleText({
          background: fill.captured ? hex(fill.channels) : void 0,
          color: fill.captured ? colors.size === 1 && !colors.has(void 0) ? [...colors][0] : foreground(style.color) : void 0,
          align: alignments.size === 1 && !alignments.has(void 0) ? [...alignments][0] : alignment(style),
          valign: normalizeValign(style.verticalAlign)
        });
        const visibility = cell.style?.display === "none" && style.display && style.display !== "none" && !isHiddenCell(cell) ? ";display:table-cell!important" : "";
        const styled = styledHtml(html, value + visibility);
        cached.styled = styled;
        return styled;
      },
      columnWidths(table) {
        if (!canRead(table)) return;
        const html = table.outerHTML, cached = tables.get(table);
        if (cached?.html === html) return cached.widths;
        const widths = measuredWidths(table, isHiddenCell);
        tables.set(table, { html, widths });
        return widths;
      },
      beginFinalReview() {
        styles = /* @__PURE__ */ new WeakMap();
        backgrounds = /* @__PURE__ */ new WeakMap();
        cells = /* @__PURE__ */ new WeakMap();
        tables = /* @__PURE__ */ new WeakMap();
      }
    };
  }

  // src/userscript/capture.js
  var ZERO_WIDTH3 = /[\u200b\u200c\u200d\u2060\ufeff]/gu;
  var CODE_ROW = ".code-line-wrapper[data-line-num]";
  var wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  var CONTAINER_TYPES = /* @__PURE__ */ new Set(["page", "table", "code", "grid", "grid_column", "callout", "quote", "quote_container", "synced_reference", "view"]);
  function semanticContent(html, cell = false) {
    const fragment = parseFragment(html);
    const tokens = [], texts = [];
    let nested = false;
    const appendText = (text, formatting) => {
      if (!text) return;
      texts.push(text);
      const key = JSON.stringify([
        Boolean(formatting.bold),
        Boolean(formatting.italic),
        Boolean(formatting.strike),
        Boolean(formatting.underline),
        formatting.href || "",
        Boolean(formatting.code),
        formatting.script || ""
      ]);
      const last = tokens.at(-1);
      if (last?.format === key) last.text += text;
      else tokens.push({ format: key, text });
    };
    const visit = (node, formatting = {}, depth = 0) => {
      if (node.nodeName === "#text") {
        const text = String(node.value || "").replace(ZERO_WIDTH3, "");
        appendText(text, formatting);
        return;
      }
      const attrs = new Map((node.attrs || []).map(({ name, value }) => [name, value]));
      if (["button", "input", "textarea", "select", "svg", "script", "style", "template"].includes(node.tagName) || attrs.has("hidden") || attrs.get("aria-hidden") === "true" || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/iu.test(attrs.get("style") || "")) return;
      if (depth > 1 && attrs.has("data-block-id") && (!cell || CONTAINER_TYPES.has(attrs.get("data-block-type")))) nested = true;
      const tag = node.tagName;
      const style = new Map((attrs.get("style") || "").split(";").flatMap((part) => {
        const separator = part.indexOf(":");
        return separator < 0 ? [] : [[part.slice(0, separator).trim().toLowerCase(), part.slice(separator + 1).trim().toLowerCase()]];
      }));
      const next = { ...formatting };
      if (["strong", "b"].includes(tag) || /^(?:bold|bolder|[6-9]\d\d)$/u.test(style.get("font-weight") || "")) next.bold = true;
      if (["em", "i"].includes(tag) || /^(?:italic|oblique)$/u.test(style.get("font-style") || "")) next.italic = true;
      const decoration = (style.get("text-decoration") || "") + " " + (style.get("text-decoration-line") || "");
      if (["s", "del", "strike"].includes(tag) || /\bline-through\b/u.test(decoration)) next.strike = true;
      if (tag === "u" || /\bunderline\b/u.test(decoration)) next.underline = true;
      if (tag === "a" && attrs.get("href")) next.href = attrs.get("href");
      if (tag === "code") next.code = true;
      if (tag === "sup" || tag === "sub") next.script = tag;
      if (tag === "br") appendText("\n", next);
      const shape = ["rowspan", "colspan", "start"].flatMap((key) => attrs.has(key) ? [[key, attrs.get(key)]] : []);
      if (shape.length) tokens.push({ shape });
      for (const child of node.childNodes || []) visit(child, next, depth + 1);
    };
    visit(fragment);
    return { fingerprint: JSON.stringify(tokens), text: texts.join(""), nested };
  }
  function abortError() {
    return Object.assign(new Error("已取消"), { name: "AbortError" });
  }
  function cleanText3(value) {
    return String(value || "").replace(ZERO_WIDTH3, " ").replace(/\s+/gu, " ").trim();
  }
  function hasNumericId(block) {
    const num = Number(block.id);
    return Number.isSafeInteger(num) && String(num) === block.id;
  }
  function missingRanges(lines) {
    const ranges = [];
    let next = 1;
    for (const num of [...lines.keys()].sort((a, b) => a - b)) {
      if (num > next) ranges.push([next, num - 1]);
      next = num + 1;
    }
    return ranges;
  }
  function formatRange(start, end) {
    return start === end ? String(start) : start + "–" + end;
  }
  function collectStep(scroller, ratio2, sampleCode, sampleTable, sampleBlock) {
    const fresh = [];
    const improved = [];
    const positions = [];
    const scrollerRect = scroller.getBoundingClientRect();
    const height = Math.max(1, scroller.scrollHeight);
    for (const el of document.querySelectorAll("[data-block-id]")) {
      const id = el.getAttribute("data-block-id");
      if (el.getAttribute("data-block-type") === "table") sampleTable(el);
      const top = scroller.scrollTop + el.getBoundingClientRect().top - scrollerRect.top;
      const position = Math.max(0, Math.min(1, top / height));
      positions.push([id, position]);
      const sampled = sampleBlock(el);
      if (sampled?.fresh) fresh.push({ ...sampled.block, position });
      else if (sampled) improved.push(sampled.block);
    }
    let addedLines = 0;
    for (const el of document.querySelectorAll(".docx-code-block[data-block-id]")) {
      addedLines += sampleCode(el);
    }
    const scrollTop = scroller.scrollTop;
    const atBottom = scrollTop + scroller.clientHeight >= scroller.scrollHeight - 3;
    scroller.scrollTop = Math.min(scrollTop + Math.round(scroller.clientHeight * ratio2), scroller.scrollHeight);
    return {
      fresh,
      improved,
      positions,
      addedLines,
      scrollTop,
      sh: scroller.scrollHeight,
      ch: scroller.clientHeight,
      atBottom
    };
  }
  async function capturePage({ stepRatio = 0.6, dwellMs, maxSteps = 400, onProgress, shouldStop } = {}) {
    const report = (payload) => {
      if (typeof onProgress !== "function") return;
      try {
        onProgress(payload);
      } catch {
      }
    };
    const checkStop = () => {
      if (shouldStop && shouldStop()) throw abortError();
    };
    const source = readDocumentSource();
    if (!source.ready) throw new Error(source.reason);
    const scroller = document.querySelector(".bear-web-x-container");
    report({ stage: "prepare", message: "准备采集：" + source.title });
    const originalPath = location.pathname;
    const originalScroll = scroller.scrollTop;
    const style = document.createElement("style");
    style.id = "feishu-local-export-style";
    style.textContent = ".code-block-content{max-height:none!important;height:auto!important;overflow:visible!important}";
    document.head.append(style);
    const warnings2 = [];
    const started = Date.now();
    const changed = /* @__PURE__ */ new Set();
    let adaptiveWaitMs = 0;
    let referenceSteps = 0, referenceRegions = 0;
    function contentChanged(id, type) {
      const key = type + ":" + id;
      if (changed.has(key)) return;
      changed.add(key);
      warnings2.push({ code: "capture_content_changed", label: type + " " + id + " 在采集期间发生变化，结果可能包含不同时刻的内容，请重新保存核对。" });
    }
    try {
      let domSignature = function() {
        const viewport = scroller.getBoundingClientRect();
        const top = viewport.top, bottom = top + scroller.clientHeight;
        const parts = [scroller.scrollHeight];
        let ready = true, visible = 0;
        for (const el of document.querySelectorAll("[data-block-id]")) {
          const type = el.getAttribute("data-block-type") || "";
          if (CONTAINER_TYPES.has(type) && type !== "code" && type !== "table") continue;
          const box = el.getBoundingClientRect();
          if (box.bottom <= top || box.top >= bottom || !box.height) continue;
          visible++;
          const id = el.getAttribute("data-block-id");
          if (type === "code") {
            const rows = [...el.querySelectorAll(CODE_ROW)].map((row) => ({ row, box: row.getBoundingClientRect() })).filter(({ box: box2 }) => box2.bottom > top && box2.top < bottom);
            parts.push(id, rows.map(({ row }) => [row.getAttribute("data-line-num"), row.textContent]));
            const first = rows[0]?.box, last = rows.at(-1)?.box;
            if (!first || first.top > Math.max(top, box.top) + first.height || last.bottom < Math.min(bottom, box.bottom) - last.height) ready = false;
          } else {
            const text = cleanText3(el.textContent);
            parts.push(id, type, text);
            if (type === "image") {
              const img = el.querySelector("img");
              if (!img?.complete || !img.naturalWidth) ready = false;
            } else if (type === "whiteboard") {
              const canvas = findWhiteboardCanvas(el);
              parts.push(canvas ? [canvas.width, canvas.height] : null);
              if (!isWhiteboardReady(el)) ready = false;
            } else if (type === "diagram") {
              parts.push(el.outerHTML);
            } else if (!text && type !== "divider" && !/\bisEmpty\b/u.test(el.outerHTML)) ready = false;
          }
        }
        return { signature: JSON.stringify(parts), ready, visible };
      }, sampleTable = function(el) {
        let table = el.querySelector("table");
        if (isAuxiliaryTable(table)) {
          table = [...el.querySelectorAll("table")].find((candidate) => {
            if (isAuxiliaryTable(candidate)) return false;
            for (let parent = candidate.parentElement; parent && parent !== el; parent = parent.parentElement) {
              if (isAuxiliaryTable(parent)) return false;
            }
            return true;
          });
        }
        if (!table) return;
        const rows = logicalTableRows(el, table);
        if (!rows.length) return;
        const id = el.getAttribute("data-block-id");
        if (!tables.has(id)) tables.set(id, { rows: /* @__PURE__ */ new Map(), cells: /* @__PURE__ */ new Map() });
        const state = tables.get(id);
        state.columnWidths = tableStyles.columnWidths(table) || state.columnWidths;
        const offset = scroller.scrollTop - scroller.getBoundingClientRect().top;
        const auxiliaryCount = rows.filter((entry) => entry.auxiliary).length;
        const headerCount = rows.filter((entry) => entry.section === "thead").length;
        let index = 0, headerIndex = -headerCount;
        for (const { row, section, auxiliary } of rows) {
          const indexAttr = row.getAttribute("data-index");
          const rowNum = section === "thead" ? headerIndex++ : indexAttr && /^\d+$/u.test(indexAttr) && Number.isSafeInteger(Number(indexAttr)) ? Number(indexAttr) : index;
          if (!auxiliary) index++;
          const keys = [];
          for (const cell of row.cells) {
            if (tableStyles.isHiddenCell(cell)) continue;
            const col = keys.length;
            const key = cell.getAttribute("data-block-id") || cell.getAttribute("data-record-id") || rowNum + ":" + col;
            keys.push(key);
            const previous = state.cells.get(key);
            const length = cleanText3(cell.textContent).length;
            const parts = [...cell.querySelectorAll("[data-block-type]")];
            const ready = parts.length ? parts.every((part) => {
              const type = part.getAttribute("data-block-type");
              if (type === "image") return Boolean(part.querySelector("img"));
              if (type === "whiteboard") return isWhiteboardReady(part);
              if (type === "diagram") return images.some((image) => image.blockId === part.getAttribute("data-block-id"));
              if (type === "code") return Boolean(part.querySelector(CODE_ROW));
              if (type === "divider") return true;
              if (type === "text" || type === "bullet" || type === "ordered" || type === "todo" || type.startsWith("heading")) {
                if (!part.querySelector(".ace-line")) return false;
              }
              if (cleanText3(part.textContent)) return true;
              return part.classList.contains("isEmpty") && Boolean(part.querySelector(".ace-line [data-string]"));
            }) : cell.getAttribute("data-block-type") !== "table_cell" && length > 0;
            const rect = cell.getBoundingClientRect();
            const center = rect.height > 0 ? offset + rect.top + rect.height / 2 : previous?.center;
            if (previous?.ready && !ready) continue;
            const html = tableStyles.cellHtml(cell);
            if (previous?.html === html && previous.ready === ready) continue;
            const semantic = ready ? semanticContent(html, true) : null;
            if (previous?.ready && ready && previous.semantic && semantic && semantic.text.trim() && semantic.fingerprint !== previous.semantic.fingerprint && length <= previous.length && !semantic.nested && !previous.semantic.nested) {
              if (length === previous.length) contentChanged(key, "表格单元格");
              else continue;
            }
            if (!previous || !previous.ready && ready || previous.ready === ready && length >= previous.length) {
              state.cells.set(key, { rowNum: rowNum + (section === "thead" ? headerCount : auxiliaryCount), col, ready, length, center, html, semantic });
            }
          }
          const existing = state.rows.get(rowNum);
          if (!existing || existing.section !== section || keys.length >= existing.keys.length && keys.some((key, i) => existing.keys[i] !== key)) {
            const shell = row.cloneNode(false).outerHTML;
            state.rows.set(rowNum, { keys, shell, section });
          }
        }
      }, writeTable = function(block, state) {
        const fragment = parseFragment(block.html);
        function findTable(node) {
          if (isAuxiliaryTable(node)) return;
          if (node.tagName === "table") return node;
          for (const child of node.childNodes || []) {
            const result = findTable(child);
            if (result) return result;
          }
        }
        let table = findTable(fragment);
        if (!table) {
          table = parseFragment("<table></table>").childNodes[0];
          const root = fragment.childNodes.find((node) => node.tagName);
          if (!root) return;
          root.childNodes.push(table);
          table.parentNode = root;
        }
        const groups = /* @__PURE__ */ new Map();
        const placed = /* @__PURE__ */ new Set();
        for (const [, row] of [...state.rows].sort((a, b) => a[0] - b[0])) {
          const cells = row.keys.map((key) => {
            placed.add(key);
            return state.cells.get(key).html;
          }).join("");
          const markup = row.shell.replace(/<\/tr>$/iu, () => cells + "</tr>");
          if (!groups.has(row.section)) groups.set(row.section, []);
          groups.get(row.section).push(markup);
        }
        if (placed.size !== state.cells.size) warnings2.push({ code: "table_structure_unconfirmed", label: "表格块 " + block.id + " 的列结构在采集期间变化，部分单元格位置未能确认。" });
        const sections = [...groups].map(([tag, rows]) => "<" + tag + ">" + rows.join("") + "</" + tag + ">").join("");
        const rebuilt = parseFragment("<table>" + sections + "</table>").childNodes[0];
        for (const child of rebuilt.childNodes) child.parentNode = table;
        const columns = state.columnWidths ? parseFragment("<table>" + columnGroupHtml(state.columnWidths) + "</table>").childNodes[0].childNodes : null;
        if (columns) for (const column of columns) column.parentNode = table;
        table.childNodes = [...table.childNodes.filter((child) => child.tagName === "caption" || !columns && child.tagName === "colgroup"), ...columns || [], ...rebuilt.childNodes];
        block.html = serialize(fragment);
      }, sampleBlock = function(el) {
        const id = el.getAttribute("data-block-id");
        const type = el.getAttribute("data-block-type") || "";
        if (type === "image") {
          const state = readImageState(el);
          if (!observedImages.has(id) || !sameImageState(observedImages.get(id), state)) pendingImages.add(id);
          observedImages.set(id, state);
        }
        const stored = blocks.get(id), html = el.outerHTML;
        if (type === "diagram" && stored?.observedHtml !== html) pendingImages.add(id);
        if (stored?.observedHtml === html) return null;
        if (stored) stored.observedHtml = html;
        const score = scoreOf(el);
        const semantic = !CONTAINER_TYPES.has(type) ? semanticContent(html) : null;
        const parent = el.parentElement?.closest("[data-block-id]");
        const block = { id, type, parentId: parent && parent !== el ? parent.getAttribute("data-block-id") : "", html, observedHtml: html, score, semantic };
        if (!stored) return { fresh: true, block };
        const previous = stored.semantic;
        const equalContentSize = semantic && previous && semantic.text.trim() && previous.text.trim() && semantic.text.length === previous.text.length && !semantic.nested && !previous.nested;
        if (equalContentSize && semantic.fingerprint !== previous.fingerprint) {
          contentChanged(id, "正文块");
          return { block };
        }
        return score > stored.score ? { block } : null;
      }, mergeSamples = function(snap) {
        for (const entry of snap.positions) positions.set(entry[0], entry[1]);
        for (const block of snap.fresh) blocks.set(block.id, block);
        for (const block of snap.improved) Object.assign(blocks.get(block.id), block);
      }, codeData = function(id) {
        if (!codeBlocks.has(id)) codeBlocks.set(id, { lines: /* @__PURE__ */ new Map(), lastSeen: 0 });
        return codeBlocks.get(id);
      }, sampleCode = function(el) {
        const id = el.getAttribute("data-block-id");
        const data = codeData(id);
        const before = data.lines.size;
        const zone = el.querySelector(".code-block-zone-container");
        const content = zone || el.querySelector(".code-block-content");
        const offset = scroller.scrollTop - scroller.getBoundingClientRect().top;
        if (content) {
          const rect = content.getBoundingClientRect();
          if (rect.height > 0) {
            data.top = offset + rect.top;
            data.bottom = offset + rect.bottom;
          }
        }
        let last;
        for (const row of el.querySelectorAll(CODE_ROW)) {
          const num = Number(row.getAttribute("data-line-num"));
          if (!Number.isSafeInteger(num) || num < 1) continue;
          const text = row.textContent.replace(ZERO_WIDTH3, "");
          const previous = data.lines.get(num);
          if (text && previous && previous !== text) contentChanged(id, "代码块");
          if (text || !data.lines.has(num)) data.lines.set(num, text);
          data.lastSeen = Math.max(data.lastSeen, num);
          last = { row, num };
        }
        if (last) {
          const rect = last.row.getBoundingClientRect();
          if (rect.height > 0) {
            data.anchor = { num: last.num, y: offset + rect.top, height: rect.height };
            if (Number.isFinite(data.bottom)) {
              data.estimatedEnd = last.num + Math.max(0, Math.round((data.bottom - offset - rect.bottom) / rect.height));
            }
          }
          if (zone?.lastElementChild?.contains(last.row)) data.confirmedEnd = last.num;
        }
        return data.lines.size - before;
      }, refreshRoots = function() {
        roots.length = 0;
        for (const block of blocks.values()) if (block.parentId === pageId) roots.push(block);
        if (roots.every(hasNumericId)) roots.sort((a, b) => Number(a.id) - Number(b.id));
      }, insideReference = function(block, id) {
        if (block.id === id) return false;
        let parent = block.parentId;
        const visited = /* @__PURE__ */ new Set();
        while (parent && parent !== id && !visited.has(parent)) {
          visited.add(parent);
          parent = blocks.get(parent)?.parentId;
        }
        return parent === id;
      }, referenceState = function(id) {
        const descendants = [];
        let ready = false;
        for (const block of blocks.values()) {
          if (!insideReference(block, id)) continue;
          let content = block.semantic?.fingerprint || "";
          if (block.type === "code") {
            const lines = codeBlocks.get(block.id)?.lines;
            content = lines ? JSON.stringify([...lines]) : "";
            if (lines?.size) ready = true;
          } else if (block.type === "table") {
            const cells = tables.get(block.id)?.cells;
            content = cells ? JSON.stringify([...cells].map(([key, cell]) => [key, cell.ready, cell.semantic?.fingerprint])) : "";
            if (cells?.size) ready = true;
          } else if (!CONTAINER_TYPES.has(block.type) && block.semantic?.text.trim() || ["image", "whiteboard", "diagram"].includes(block.type) && images.some((image) => image.blockId === block.id) || block.type === "whiteboard" && isWhiteboardReady(document.querySelector('[data-block-id="' + block.id + '"]')) || /\bisEmpty\b/u.test(block.html)) ready = true;
          descendants.push([block.id, block.parentId, block.type, content]);
        }
        return { signature: JSON.stringify(descendants), ready };
      }, rebuildChildren = function(block, visiting = /* @__PURE__ */ new Set()) {
        if (rebuiltChildren.has(block.id) || visiting.has(block.id)) return;
        const children = childrenByParent.get(block.id) || [];
        const slotClass = childSlots[block.type];
        if (!children.length || !slotClass) return;
        visiting.add(block.id);
        for (const child of children) rebuildChildren(child, visiting);
        visiting.delete(block.id);
        const fragment = parseFragment(block.html);
        function findChildren(node) {
          const attrs = node.attrs || [];
          const id = attrs.find((attr3) => attr3.name === "data-block-id")?.value;
          if (id && id !== block.id) return null;
          const classes = attrs.find((attr3) => attr3.name === "class")?.value.split(/\s+/u) || [];
          if (classes.includes(slotClass)) return node;
          for (const child of node.childNodes || []) {
            const found = findChildren(child);
            if (found) return found;
          }
          return null;
        }
        const slot = findChildren(fragment);
        if (!slot) {
          warnings2.push({ code: "missing_block", label: childLabel(block) + block.id + " 未找到嵌套内容容器，未能确认子项位置。" });
          return;
        }
        function hasOwnLine(node) {
          const attrs = node.attrs || [];
          if (attrs.some((attr3) => attr3.name === "data-block-id" && attr3.value !== block.id)) return false;
          if (attrs.some((attr3) => attr3.name === "class" && attr3.value.split(/\s+/u).includes("ace-line"))) return true;
          return (node.childNodes || []).some(hasOwnLine);
        }
        if (hasOwnLine(slot)) {
          warnings2.push({ code: "missing_block", label: childLabel(block) + block.id + " 的自身文字与子项容器混合，未能确认子项位置。" });
          return;
        }
        let ordered = [...children];
        if (block.type === "grid") {
          let columnOrder = function(markup) {
            const ids = [];
            function visit(node) {
              for (const child of node.childNodes || []) {
                const id = child.attrs?.find((attr3) => attr3.name === "data-block-id")?.value;
                if (id) ids.push(id);
                else visit(child);
              }
            }
            const region = findChildren(parseFragment(markup));
            if (!region) return null;
            visit(region);
            return ids.length === byId.size && new Set(ids).size === ids.length && ids.every((id) => byId.has(id)) ? ids.map((id) => byId.get(id)) : null;
          };
          const byId = new Map(children.map((child) => [child.id, child]));
          const columns = columnOrder(block.html) || columnOrder(block.observedHtml);
          if (!columns) {
            warnings2.push({ code: "missing_block", label: "分栏块 " + block.id + " 未能确认完整栏序，请核对各栏内容。" });
            return;
          }
          ordered = columns;
        } else if (ordered.every(hasNumericId)) ordered.sort((a, b) => Number(a.id) - Number(b.id));
        else ordered.sort((a, b) => (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
        slot.childNodes = parseFragment(ordered.map((child) => child.html).join("")).childNodes;
        for (const child of slot.childNodes) child.parentNode = slot;
        block.html = serialize(fragment);
        rebuiltChildren.add(block.id);
      };
      scroller.scrollTop = 0;
      await wait(150);
      await settleDom(900);
      async function settleDom(timeout = 600) {
        const started2 = Date.now();
        let previous = "";
        let stableSince = started2;
        while (Date.now() - started2 < timeout) {
          checkStop();
          const state = domSignature();
          if (state.signature !== previous) {
            previous = state.signature;
            stableSince = Date.now();
          }
          const elapsed = Date.now() - started2;
          if (elapsed >= (state.visible ? 140 : 280) && Date.now() - stableSince >= 80 && (state.ready || !state.visible)) break;
          await wait(35);
        }
        adaptiveWaitMs += Date.now() - started2;
      }
      const scoreOf = (el) => (el.textContent ? el.textContent.length : 0) * 1e3 + el.querySelectorAll("*").length;
      const tables = /* @__PURE__ */ new Map();
      const tableStyles = createTableStyleCapture();
      async function captureImage(id) {
        if (blocks.get(id)?.type === "diagram") {
          try {
            const image = await captureDiagram(document, id, {
              pageView: typeof unsafeWindow === "undefined" ? globalThis : unsafeWindow,
              checkStop
            });
            if (!image) throw new Error("未能读取完整图表，请等待图表加载完成后重试");
            const index = images.findIndex((saved) => saved.blockId === id);
            if (index < 0) images.push(image);
            else images[index] = image;
            diagramErrors.delete(id);
            return true;
          } catch (error) {
            if (error.name === "AbortError") throw error;
            diagramErrors.set(id, String(error.message || error).slice(0, 120));
            return false;
          }
        }
        if (blocks.get(id)?.type === "whiteboard") {
          try {
            images.push(await captureWhiteboardPreview(id, { wait, checkStop }));
            whiteboardErrors.delete(id);
            return true;
          } catch (error) {
            if (error.name === "AbortError") throw error;
            whiteboardErrors.set(id, String(error.message || error).slice(0, 120));
            return false;
          }
        }
        try {
          const index = images.findIndex((image2) => image2.blockId === id);
          const saved = index < 0 ? void 0 : { image: images[index], state: imageStates.get(id) };
          const { image, state } = await captureLoadedImage(id, { wait, checkStop, saved });
          if (index < 0) images.push(image);
          else images[index] = image;
          imageStates.set(id, state);
          observedImages.set(id, state);
          imageErrors.delete(id);
          return true;
        } catch (error) {
          if (error.name === "AbortError") throw error;
          imageErrors.set(id, String(error.message || error).slice(0, 120));
          return false;
        }
      }
      const blocks = /* @__PURE__ */ new Map();
      const positions = /* @__PURE__ */ new Map();
      const codeBlocks = /* @__PURE__ */ new Map();
      const images = [];
      const failedImages = /* @__PURE__ */ new Set();
      const whiteboardErrors = /* @__PURE__ */ new Map();
      const diagramErrors = /* @__PURE__ */ new Map();
      const imageStates = /* @__PURE__ */ new Map(), observedImages = /* @__PURE__ */ new Map(), pendingImages = /* @__PURE__ */ new Set(), imageErrors = /* @__PURE__ */ new Map();
      async function collectImages(snap) {
        for (const block of snap.fresh) {
          if (block.type === "whiteboard" && !images.some((image) => image.blockId === block.id)) {
            if (!await captureImage(block.id)) failedImages.add(block.id);
          }
        }
        for (const id of [...pendingImages]) {
          pendingImages.delete(id);
          if (await captureImage(id)) failedImages.delete(id);
          else failedImages.add(id);
        }
      }
      let noProgress = 0;
      let steps = 0;
      for (; steps < maxSteps; steps++) {
        checkStop();
        const snap = collectStep(scroller, stepRatio, sampleCode, sampleTable, sampleBlock);
        let added = snap.addedLines;
        mergeSamples(snap);
        added += snap.fresh.length;
        await collectImages(snap);
        const percent = Math.max(0, Math.min(95, Math.round(
          snap.scrollTop / Math.max(1, snap.sh - snap.ch) * 95
        )));
        report({ stage: "scroll", message: "滚动采集：" + percent + "% · 块 " + blocks.size + " · 代码块 " + codeBlocks.size, percent, blocks: blocks.size, codeBlocks: codeBlocks.size });
        if (snap.atBottom) {
          noProgress = added === 0 ? noProgress + 1 : 0;
          await wait(650);
          const grown = scroller.scrollHeight > snap.sh + 8;
          if (grown) {
            noProgress = 0;
          } else {
            await settleDom(800);
          }
          if (!grown && noProgress >= 2) break;
        } else {
          noProgress = 0;
          if (Number.isFinite(dwellMs)) await wait(Math.max(0, dwellMs));
          else await settleDom();
        }
      }
      if (steps >= maxSteps) {
        warnings2.push({ code: "capture_step_limit", label: "已达到 " + maxSteps + " 步滚动上限，未确认文末，导出可能缺少后续内容。" });
      }
      const pageBlock = [...blocks.values()].find((block) => block.type === "page");
      const pageId = pageBlock ? pageBlock.id : "1";
      const roots = [...blocks.values()].filter((block) => block.parentId === pageId);
      if (!roots.length) throw new Error("没有采集到文档内容，请刷新页面后重试");
      const tryAt = async (id, scrollTop) => {
        checkStop();
        const maxTop = scroller.scrollHeight - scroller.clientHeight;
        scroller.scrollTop = Math.max(0, Math.min(scrollTop, maxTop));
        await wait(70);
        checkStop();
        let el = document.querySelector('[data-block-id="' + id + '"]');
        if (!el) return false;
        el.scrollIntoView({ block: "center" });
        await wait(60);
        el = document.querySelector('[data-block-id="' + id + '"]');
        return Boolean(el);
      };
      const revealBlock = async (id, position) => {
        const sh = scroller.scrollHeight;
        const ch = scroller.clientHeight;
        const estimate = Math.round((Number.isFinite(position) ? position : 0) * sh);
        if (await tryAt(id, estimate - ch / 2)) return true;
        const step = Math.max(180, Math.round(ch * 0.6));
        for (let delta = step; delta <= sh; delta += step) {
          if (estimate - ch / 2 + delta <= sh && await tryAt(id, estimate - ch / 2 + delta)) return true;
          if (estimate - ch / 2 - delta >= 0 && await tryAt(id, estimate - ch / 2 - delta)) return true;
        }
        return false;
      };
      const rootList = [...blocks.values()].filter((block) => block.parentId === pageId);
      const rootIds = rootList.every(hasNumericId) ? rootList.map((block) => Number(block.id)).sort((a, b) => a - b) : [];
      const missingIds = [];
      if (rootIds.length > 4 && rootIds[rootIds.length - 1] - rootIds[0] + 1 <= rootIds.length * 1.5 + 8) {
        const present = new Set(rootIds);
        for (let id = rootIds[0]; id <= rootIds[rootIds.length - 1]; id += 1) if (!present.has(id)) missingIds.push(id);
      }
      async function collectAtCurrentPosition() {
        checkStop();
        const snap = collectStep(scroller, 0, sampleCode, sampleTable, sampleBlock);
        mergeSamples(snap);
        await collectImages(snap);
      }
      const hasBlock = (id) => blocks.has(String(id));
      async function sampleMissingBlock(id) {
        for (const delay of [70, 150, 240]) {
          await wait(delay);
          await collectAtCurrentPosition();
          if (!hasBlock(id) && document.querySelector('[data-block-id="' + id + '"]')) await collectAtCurrentPosition();
          if (hasBlock(id)) return true;
        }
        return false;
      }
      const scanAround = async (anchorId, missingId, direction) => {
        if (!await revealBlock(anchorId, positions.get(anchorId))) return false;
        if (await sampleMissingBlock(missingId)) return true;
        const startScroll = scroller.scrollTop;
        const stepSize = Math.max(120, Math.round(scroller.clientHeight * 0.22));
        const maxDelta = scroller.clientHeight * 2.2;
        for (let delta = stepSize; delta <= maxDelta; delta += stepSize) {
          checkStop();
          const maxTop = scroller.scrollHeight - scroller.clientHeight;
          scroller.scrollTop = direction === "up" ? Math.max(0, startScroll - delta) : Math.min(maxTop, startScroll + delta);
          if (await sampleMissingBlock(missingId)) return true;
        }
        return false;
      };
      if (missingIds.length) {
        report({ stage: "structure", message: "补采漏掉的块…", missing: missingIds.length });
        for (const missingId of missingIds) {
          checkStop();
          if (hasBlock(missingId)) continue;
          const nextId = rootIds.find((id) => id > missingId);
          const prevId = [...rootIds].reverse().find((id) => id < missingId);
          let found = false;
          if (nextId !== void 0) found = await scanAround(nextId, missingId, "up");
          if (!found && prevId !== void 0) found = await scanAround(prevId, missingId, "down");
          if (!found) warnings2.push({ code: "missing_block", label: "疑似漏掉的块 " + missingId });
        }
      }
      refreshRoots();
      report({ stage: "audit", message: "核对表格、图片与代码完整性…" });
      await collectAtCurrentPosition();
      for (const id of failedImages) {
        if (blocks.get(id)?.type !== "diagram") continue;
        if (await revealBlock(id, positions.get(id)) && await captureImage(id)) failedImages.delete(id);
      }
      async function auditReference(reference) {
        checkStop();
        referenceRegions++;
        report({ stage: "audit", message: "复核引用区域 " + referenceRegions + "…" });
        const viewHeight = scroller.clientHeight;
        const maxTop = () => Math.max(0, scroller.scrollHeight - viewHeight);
        const readBounds = () => {
          const el = document.querySelector('[data-block-id="' + reference.id + '"]');
          if (!el) return null;
          const box = el.getBoundingClientRect();
          if (!(box.height > 0)) return null;
          const top = scroller.scrollTop + box.top - scroller.getBoundingClientRect().top;
          return { top: Math.max(0, top), bottom: top + box.height };
        };
        const warn = () => warnings2.push({ code: "missing_block", label: "引用块 " + reference.id + " 的正文加载或跨视口复核尚未确认完整，请重新保存核对。" });
        function currentWindow(bounds2) {
          const top = scroller.getBoundingClientRect().top, bottom = top + viewHeight;
          const parts = [];
          for (const el of document.querySelectorAll("[data-block-id]")) {
            const block = blocks.get(el.getAttribute("data-block-id"));
            if (!block || !insideReference(block, reference.id)) continue;
            if (CONTAINER_TYPES.has(block.type) && block.type !== "table" && block.type !== "code") continue;
            const content = ["bullet", "ordered"].includes(block.type) ? el.querySelector?.(".list") || el : el;
            const box = content.getBoundingClientRect();
            if (!box.height || box.top + box.height <= top || box.top >= bottom) continue;
            if (block.type === "code") {
              for (const row of el.querySelectorAll(CODE_ROW)) {
                const line = row.getBoundingClientRect();
                if (line.top + line.height <= top || line.top >= bottom) continue;
                parts.push([block.id, row.getAttribute("data-line-num"), row.textContent]);
              }
            } else {
              if (block.type === "image") {
                const image = el.querySelector("img");
                if (!image?.complete || !image.naturalWidth) continue;
              } else if (block.type === "whiteboard") {
                if (!isWhiteboardReady(el)) continue;
              } else if (block.type === "diagram") {
                if (!images.some((image) => image.blockId === block.id)) continue;
              } else if (!cleanText3(content.textContent) && !/\bisEmpty\b/u.test(content.outerHTML)) continue;
              parts.push([block.id, content.textContent]);
            }
          }
          return { signature: JSON.stringify(parts), ready: parts.length > 0 };
        }
        async function waitWindow(bounds2) {
          const began = Date.now();
          let quietSince2 = began, previous2 = currentWindow(bounds2).signature;
          while (Date.now() - began < 1800) {
            checkStop();
            await wait(70);
            await collectAtCurrentPosition();
            bounds2 = readBounds() || bounds2;
            const window2 = currentWindow(bounds2);
            if (window2.signature !== previous2) {
              previous2 = window2.signature;
              quietSince2 = Date.now();
            }
            if (window2.ready && Date.now() - began >= 980 && Date.now() - quietSince2 >= 140) return true;
          }
          return false;
        }
        scroller.scrollTop = Math.max(0, Math.min(maxTop(), (positions.get(reference.id) || 0) * scroller.scrollHeight));
        await settleDom(800);
        let bounds = readBounds();
        if (!bounds) {
          if (!await revealBlock(reference.id, positions.get(reference.id))) {
            warn();
            return;
          }
          bounds = readBounds();
        }
        if (!bounds) {
          warn();
          return;
        }
        scroller.scrollTop = Math.max(0, Math.min(maxTop(), bounds.top));
        const warmStarted = Date.now();
        let quietSince = warmStarted, previous = referenceState(reference.id).signature;
        while (Date.now() - warmStarted < 1800) {
          await wait(70);
          await collectAtCurrentPosition();
          const state = referenceState(reference.id);
          if (state.signature !== previous) {
            previous = state.signature;
            quietSince = Date.now();
          }
          bounds = readBounds() || bounds;
          if (state.ready && Date.now() - warmStarted >= 980 && Date.now() - quietSince >= 280) break;
        }
        let confirmed = false;
        const step = Math.max(80, Math.round(viewHeight * 0.6));
        for (let pass = 0; pass < 3; pass++) {
          bounds = readBounds() || bounds;
          let target = Math.max(0, Math.min(maxTop(), bounds.top));
          let atBottom = false, windowsReady = true, coveredBottom = target;
          const budget = Math.max(4, Math.min(maxSteps, 120));
          for (let index = 0; index < budget; index++) {
            checkStop();
            scroller.scrollTop = target;
            if (!await waitWindow(bounds)) windowsReady = false;
            referenceSteps++;
            coveredBottom = Math.max(coveredBottom, scroller.scrollTop + viewHeight);
            const current = readBounds();
            if (!current) break;
            bounds = current;
            const end = Math.max(bounds.top, bounds.bottom - viewHeight);
            if (scroller.scrollTop >= end - 3) {
              atBottom = true;
              break;
            }
            const next = Math.min(maxTop(), end, Math.max(target, scroller.scrollTop) + step);
            if (next <= scroller.scrollTop + 1) break;
            target = next;
          }
          await wait(350);
          await collectAtCurrentPosition();
          const finalBounds = readBounds();
          if (!finalBounds || finalBounds.bottom > coveredBottom + 3) atBottom = false;
          if (finalBounds) bounds = finalBounds;
          const state = referenceState(reference.id);
          if (pass > 0 && atBottom && windowsReady && state.ready && state.signature === previous) {
            confirmed = true;
            break;
          }
          previous = state.signature;
        }
        if (!confirmed) warn();
      }
      for (const reference of blocks.values()) {
        if (reference.type === "synced_reference") await auditReference(reference);
      }
      refreshRoots();
      tableStyles.beginFinalReview();
      const tableBlocks = new Map([...blocks].filter(([, block]) => block.type === "table"));
      for (const block of tableBlocks.values()) {
        checkStop();
        const currentTable = document.querySelector('[data-block-id="' + block.id + '"]');
        if (currentTable) sampleTable(currentTable);
        async function sampleAt(y, done) {
          const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.scrollTop = Math.max(0, Math.min(maxTop, y - scroller.clientHeight / 2));
          for (const delay of [80, 160, 280]) {
            await wait(delay);
            checkStop();
            const el = document.querySelector('[data-block-id="' + block.id + '"]');
            if (el) sampleTable(el);
            if (done()) break;
          }
        }
        const top = (positions.get(block.id) || 0) * scroller.scrollHeight;
        if (!tables.has(block.id)) await sampleAt(top, () => tables.has(block.id));
        const saved = tables.get(block.id);
        if (!saved?.cells.size) {
          warnings2.push({ code: "table_structure_unconfirmed", label: "表格块 " + block.id + " 未读到单元格结构。" });
          continue;
        }
        const tried = [];
        for (const entry of saved.cells.values()) {
          if (entry.ready) continue;
          const center = entry.center ?? top;
          if (tried.some((y) => Math.abs(y - center) < scroller.clientHeight / 4)) continue;
          tried.push(center);
          await sampleAt(center, () => [...saved.cells.values()].every((cell) => cell.ready || Math.abs((cell.center ?? top) - center) >= scroller.clientHeight / 4));
        }
        for (const cell of saved.cells.values()) {
          if (!cell.ready) warnings2.push({ code: "table_cell_unconfirmed", label: "表格块 " + block.id + " 第 " + (cell.rowNum + 1) + " 行第 " + (cell.col + 1) + " 列未确认已渲染。" });
        }
        writeTable(block, saved);
      }
      for (const id of /* @__PURE__ */ new Set([...failedImages, ...imageStates.keys()])) {
        checkStop();
        if (!await revealBlock(id, positions.get(id))) {
          if (blocks.get(id)?.type === "image") imageErrors.set(id, "未能定位图片以复核已加载位图");
          continue;
        }
        if (await captureImage(id)) failedImages.delete(id);
      }
      for (const [id, reason] of imageErrors) warnings2.push({ code: "image_unreadable", label: "图片块 " + id + "：" + reason });
      for (const [id, reason] of whiteboardErrors) {
        warnings2.push({ code: "image_unreadable", label: "白板块 " + id + "：" + reason });
      }
      for (const [id, reason] of diagramErrors) {
        warnings2.push({ code: "image_unreadable", label: "图表块 " + id + "：" + reason });
      }
      async function sampleWindow(id, y, reached) {
        checkStop();
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
        scroller.scrollTop = Math.max(0, Math.min(maxTop, y - scroller.clientHeight / 2));
        for (const delay of [70, 150, 240]) {
          await wait(delay);
          checkStop();
          const el = document.querySelector('[data-block-id="' + id + '"]');
          if (el) sampleCode(el);
          if (reached()) return;
        }
      }
      for (const block of blocks.values()) {
        if (block.type !== "code") continue;
        const { id } = block;
        const data = codeData(id);
        const blockY = (positions.get(id) || 0) * scroller.scrollHeight;
        if (!data.confirmedEnd || missingRanges(data.lines).length) {
          if (await revealBlock(id, positions.get(id))) {
            const el = document.querySelector('[data-block-id="' + id + '"]');
            if (el) sampleCode(el);
          }
        }
        if (!data.confirmedEnd) {
          await sampleWindow(id, data.bottom ?? blockY, () => Boolean(data.confirmedEnd));
        }
        if (!data.lines.size) await sampleWindow(id, data.top ?? blockY, () => data.lines.size > 0);
        const regionHeight = Math.max(0, (data.bottom ?? blockY) - (data.top ?? blockY));
        let windows = 4 + Math.ceil(3 * regionHeight / Math.max(1, scroller.clientHeight));
        for (const [start, end] of missingRanges(data.lines)) {
          let num = start;
          while (num <= end && windows > 0) {
            if (data.lines.has(num)) {
              num += 1;
              continue;
            }
            const anchor = data.anchor;
            if (!anchor) break;
            windows -= 1;
            let targetY = anchor.y + (num - anchor.num) * anchor.height;
            const missingLine = num;
            for (let pass = 0; pass < 2; pass += 1) {
              targetY = Math.max(data.top ?? -Infinity, Math.min(data.bottom ?? Infinity, targetY));
              await sampleWindow(id, targetY, () => data.lines.has(missingLine));
              if (data.lines.has(num)) break;
              const current = data.anchor;
              const adjustedY = current.y + (num - current.num) * current.height;
              if (Math.abs(adjustedY - targetY) < current.height) break;
              targetY = adjustedY;
            }
            num += data.lines.has(num) ? 1 : Math.max(1, Math.floor(scroller.clientHeight / (2 * anchor.height)));
          }
        }
        const ranges = missingRanges(data.lines);
        if (!data.lines.size) {
          warnings2.push({ code: "code_unreadable", label: "代码块 " + id + " 没有读到内容" });
          continue;
        }
        if (ranges.length) {
          warnings2.push({ code: "code_lines_missing", label: "代码块 " + id + " 缺少行 " + ranges.map(([start, end]) => formatRange(start, end)).join("、") });
        }
        if (!data.confirmedEnd) {
          const estimate = data.estimatedEnd > data.lastSeen ? "，按渲染高度估计待核对行 " + formatRange(data.lastSeen + 1, data.estimatedEnd) : "";
          warnings2.push({ code: "code_tail_unconfirmed", label: "代码块 " + id + " 已读到第 " + data.lastSeen + " 行，未确认块尾" + estimate });
        }
      }
      report({ stage: "recheck", message: "补采未完整渲染的块…" });
      const suspicious = roots.filter((block) => {
        if (["text", "quote", "callout"].includes(block.type)) return block.html.length < 400;
        if (block.type.startsWith("heading")) return !block.html.includes("data-string");
        if (block.type === "image") return !block.html.includes("<img");
        if (block.type === "bullet" || block.type === "ordered") return !block.html.includes("data-string") && !block.html.includes("list-content");
        return false;
      });
      for (const block of suspicious) {
        if (!await revealBlock(block.id, positions.get(block.id))) continue;
        const el = document.querySelector('[data-block-id="' + block.id + '"]');
        if (!el) continue;
        const refreshed = sampleBlock(el);
        if (refreshed) Object.assign(blocks.get(block.id), refreshed.block);
      }
      const childrenByParent = /* @__PURE__ */ new Map();
      for (const block of blocks.values()) {
        if (!childrenByParent.has(block.parentId)) childrenByParent.set(block.parentId, []);
        childrenByParent.get(block.parentId).push(block);
      }
      const childSlots = {
        bullet: "list-children",
        ordered: "list-children",
        callout: "callout-block-children",
        grid: "grid-block",
        grid_column: "grid-column-block"
      };
      const childLabels = { callout: "提示块 ", grid: "分栏块 ", grid_column: "分栏列 " };
      const childLabel = (block) => childLabels[block.type] || "列表块 ";
      const rebuiltChildren = /* @__PURE__ */ new Set();
      for (const block of blocks.values()) rebuildChildren(block);
      const embeddedPages = new Map([...blocks].filter(([, block]) => block.type === "page" && block.id !== pageId));
      for (const page of embeddedPages.values()) {
        let findPageChildren = function(node) {
          const attrs = node.attrs || [];
          const type = attrs.find((attr3) => attr3.name === "data-block-type")?.value;
          const id = attrs.find((attr3) => attr3.name === "data-block-id")?.value;
          if (type === "page" && id !== page.id) return null;
          const classes = (attrs.find((attr3) => attr3.name === "class")?.value || "").split(/\s+/u);
          if (classes.includes("page-block-children") || classes.includes("reference-page-block-childen")) return node;
          for (const child of node.childNodes || []) {
            const found = findPageChildren(child);
            if (found) return found;
          }
          return null;
        };
        const children = childrenByParent.get(page.id) || [];
        if (!children.length) continue;
        const fragment = parseFragment(page.html);
        const body = findPageChildren(fragment);
        if (!body) {
          warnings2.push({ code: "missing_block", label: "内嵌页面 " + page.id + " 未找到正文容器，未能合并已采集的内容。" });
          continue;
        }
        if (children.every(hasNumericId)) children.sort((a, b) => Number(a.id) - Number(b.id));
        const rebuilt = parseFragment(children.map((child) => child.html).join(""));
        body.childNodes = rebuilt.childNodes;
        for (const child of body.childNodes) child.parentNode = body;
        page.html = serialize(fragment);
      }
      const nestedByRoot = /* @__PURE__ */ new Map();
      const rebuiltBlocks = new Map([...tableBlocks, ...embeddedPages, ...[...rebuiltChildren].map((id) => [id, blocks.get(id)])]);
      for (const block of rebuiltBlocks.values()) {
        if (block.parentId === pageId) continue;
        let owner = blocks.get(block.parentId);
        while (owner && owner.parentId !== pageId) owner = blocks.get(owner.parentId);
        if (!owner) continue;
        if (!nestedByRoot.has(owner.id)) nestedByRoot.set(owner.id, /* @__PURE__ */ new Map());
        nestedByRoot.get(owner.id).set(block.id, block);
      }
      for (const root of roots) {
        let restoreNested = function(node) {
          for (let index = 0; index < (node.childNodes || []).length; index++) {
            let child = node.childNodes[index];
            const id = child.attrs?.find((attr3) => attr3.name === "data-block-id")?.value;
            const block = nested.get(id);
            if (block) {
              const replacement = parseFragment(block.html).childNodes.find((item) => item.tagName);
              if (replacement) {
                replacement.parentNode = node;
                node.childNodes[index] = replacement;
                child = replacement;
                restored.add(id);
              }
            }
            restoreNested(child);
          }
        };
        const nested = nestedByRoot.get(root.id);
        if (!nested) continue;
        const fragment = parseFragment(root.html);
        const restored = /* @__PURE__ */ new Set();
        restoreNested(fragment);
        root.html = serialize(fragment);
        for (const id of nested.keys()) {
          if (!restored.has(id)) {
            const type = nested.get(id).type;
            const table = type === "table";
            warnings2.push({
              code: table ? "table_structure_unconfirmed" : "missing_block",
              label: (type === "page" ? "内嵌页面 " : table ? "表格块 " : childLabel(nested.get(id))) + id + " 未能确认在容器中的位置。"
            });
          }
        }
      }
      const knownRootTypes = /* @__PURE__ */ new Set([
        "heading1",
        "heading2",
        "heading3",
        "heading4",
        "heading5",
        "heading6",
        "text",
        "bullet",
        "ordered",
        "code",
        "table",
        "image",
        "whiteboard",
        "diagram",
        "quote",
        "quote_container",
        "synced_reference",
        "view",
        "callout",
        "divider",
        "todo",
        "grid",
        "grid_column",
        "file"
      ]);
      for (const type of new Set(roots.map((block) => block.type))) {
        if (!knownRootTypes.has(type)) warnings2.push({ code: "unsupported_block", label: "未适配的块类型：" + type });
      }
      report({
        stage: "done",
        message: "采集完成：块 " + roots.length + " · 代码块 " + codeBlocks.size + " · 图片 " + images.length,
        metrics: { elapsedMs: Date.now() - started, scrollSteps: Math.min(steps + 1, maxSteps), adaptiveWaitMs, referenceSteps, referenceRegions, waitMode: Number.isFinite(dwellMs) ? "fixed" : "adaptive" }
      });
      return {
        version: 1,
        generator: "feishu-local-exporter 油猴页面采集",
        source: { ...source, capturedAt: (/* @__PURE__ */ new Date()).toISOString() },
        pageBlockId: pageId,
        blocks: roots.map(({ id, type, html }) => ({ id, type, html })),
        code: Object.fromEntries([...codeBlocks].map(([id, data]) => {
          const lines = [...data.lines].sort((a, b) => a[0] - b[0]).map(([num, text]) => ({ num, text }));
          return [id, data.confirmedEnd ? { lines, totalLines: data.confirmedEnd } : { lines }];
        })),
        images,
        warnings: warnings2
      };
    } finally {
      style.remove();
      if (location.pathname === originalPath && document.querySelector(".bear-web-x-container") === scroller && readDocumentSource().docToken === source.docToken) {
        scroller.scrollTop = originalScroll;
      }
    }
  }

  // src/userscript/entry-style.js
  var css = `
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

  // src/userscript/theme.js
  var palettes = {
    light: { surface: "#ffffff", text: "#23302b", muted: "#66756d", accent: "#28634b", warning: "#91600d" },
    dark: { surface: "#262c29", text: "#e4eae6", muted: "#b0bdb5", accent: "#abd6bb", warning: "#e6bd75" }
  };
  function color(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    const hex3 = /^#([\da-f]{3,8})$/iu.exec(text)?.[1];
    if (hex3) {
      const expanded = hex3.length <= 4 ? [...hex3].map((part) => part + part).join("") : hex3;
      if (![6, 8].includes(expanded.length)) return null;
      const rgb2 = [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16));
      return { rgb: rgb2, alpha: expanded.length === 8 ? parseInt(expanded.slice(6), 16) / 255 : 1 };
    }
    const rgb = /^rgba?\(([^)]+)\)$/iu.exec(text);
    if (!rgb) return null;
    const parts = rgb[1].trim().split(/[\s,/]+/u);
    if (parts.length < 3 || parts.length > 4) return null;
    if (parts.some((part) => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/iu.test(part))) return null;
    const channels = parts.slice(0, 3).map((part) => parseFloat(part) * (part.endsWith("%") ? 2.55 : 1));
    const alpha = parts[3] === void 0 ? 1 : parseFloat(parts[3]) / (parts[3].endsWith("%") ? 100 : 1);
    if (!channels.every(Number.isFinite) || !Number.isFinite(alpha)) return null;
    return { rgb: channels.map((channel) => Math.min(255, Math.max(0, channel))), alpha: Math.min(1, Math.max(0, alpha)) };
  }
  function opaque(value) {
    const parsed = color(value);
    return parsed?.alpha >= 0.95 ? parsed.rgb.map(Math.round) : null;
  }
  function hex2(rgb) {
    return "#" + rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("");
  }
  function luminance(rgb) {
    return rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  }
  function ratio(a, b) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
  }
  function mix(a, b, amount) {
    return a.map((channel, index) => channel + (b[index] - channel) * amount);
  }
  function readable(candidate, surface, minimum, additional = []) {
    const backgrounds = [surface, ...additional];
    const contrast = (foreground) => Math.min(...backgrounds.map((background) => ratio(foreground, background)));
    if (contrast(candidate) >= minimum) return candidate;
    const target = contrast([0, 0, 0]) > contrast([255, 255, 255]) ? [0, 0, 0] : [255, 255, 255];
    for (let amount = 0.025; amount < 1; amount += 0.025) {
      const adjusted = mix(candidate, target, amount).map(Math.round);
      if (contrast(adjusted) >= minimum) return adjusted;
    }
    return target;
  }
  function buttonColors(candidate, surface) {
    const white = [255, 255, 255];
    for (let step = 0; step <= 40; step++) {
      const background2 = mix(candidate, [0, 0, 0], step / 40).map(Math.round);
      if (ratio(white, background2) >= 4.5 && ratio(background2, surface) >= 3) {
        return { background: background2, text: "#ffffff" };
      }
    }
    const background = readable(candidate, surface, 3);
    const text = ratio([0, 0, 0], background) > ratio(white, background) ? "#000000" : "#ffffff";
    return { background, text };
  }
  function deriveTheme(input = {}) {
    const supplied = opaque(input.surface);
    const mode = supplied ? luminance(supplied) < 0.35 ? "dark" : "light" : input.dark ? "dark" : "light";
    const defaults = palettes[mode];
    const surface = supplied || opaque(defaults.surface);
    const baseText = readable(opaque(input.text) || opaque(defaults.text), surface, 4.5);
    let softAmount = mode === "dark" ? 0.075 : 0.045;
    let soft = mix(surface, baseText, softAmount).map(Math.round);
    while (ratio(baseText, soft) < 4.5) {
      softAmount /= 2;
      soft = mix(surface, baseText, softAmount).map(Math.round);
    }
    const text = readable(baseText, surface, 4.5, [soft]);
    const muted = readable(opaque(input.muted) || opaque(defaults.muted), surface, 4.5, [soft]);
    const pageAccent = opaque(input.accent) || opaque(defaults.accent);
    const accent = readable(pageAccent, surface, 4.5, [soft]);
    const accentText = ratio([0, 0, 0], accent) > ratio([255, 255, 255], accent) ? "#000000" : "#ffffff";
    const button = buttonColors(pageAccent, surface);
    const warning = readable(opaque(input.warning) || opaque(defaults.warning), surface, 4.5);
    return {
      mode,
      surface: hex2(surface),
      text: hex2(text),
      muted: hex2(muted),
      accent: hex2(accent),
      "accent-text": accentText,
      button: hex2(button.background),
      "button-text": button.text,
      warning: hex2(warning),
      border: hex2(mix(surface, text, mode === "dark" ? 0.25 : 0.16)),
      soft: hex2(soft),
      shadow: mode === "dark" ? "0 8px 28px rgb(0 0 0 / .38)" : "0 8px 28px rgb(15 30 23 / .16)"
    };
  }
  function installTheme(view, host) {
    const { document: document2 } = view;
    const media = view.matchMedia?.("(prefers-color-scheme: dark)");
    const resolved = /* @__PURE__ */ new Map();
    let context;
    let previous = "";
    function resolve(value) {
      if (!value || typeof value !== "string") return null;
      if (opaque(value)) return value;
      if (color(value)) return null;
      if (resolved.has(value)) return resolved.get(value);
      let result = null;
      try {
        if (view.CSS?.supports?.("color", value)) {
          context ||= document2.createElement("canvas").getContext("2d", { willReadFrequently: true });
          if (context) {
            context.clearRect(0, 0, 1, 1);
            context.fillStyle = value;
            context.fillRect(0, 0, 1, 1);
            const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
            if (a >= 242) result = hex2([r, g, b]);
          }
        }
      } catch {
      }
      resolved.set(value, result);
      return result;
    }
    function refresh() {
      let input = { dark: Boolean(media?.matches) };
      if (typeof view.getComputedStyle === "function") {
        const root = document2.documentElement;
        const body = document2.body;
        const content = document2.querySelector?.('[data-block-type="page"], .page-block, .docx-root') || body || root;
        const styles = [content, body, root].filter(Boolean).map((node) => view.getComputedStyle(node));
        const semantic = (...names) => {
          for (const name of names) {
            for (const style of styles) {
              const value = resolve(style.getPropertyValue?.(name)?.trim());
              if (value) return value;
            }
          }
          return null;
        };
        let pageBackground;
        for (let node = content; node; node = node.parentElement) {
          pageBackground = resolve(view.getComputedStyle(node).backgroundColor);
          if (pageBackground) break;
        }
        const surface = semantic("--bg-float", "--bg-dialog", "--bg-body", "--bg-base") || pageBackground;
        const bodyBackground = semantic("--bg-body", "--bg-base");
        const mismatched = surface && pageBackground && luminance(opaque(surface)) < 0.35 !== luminance(opaque(pageBackground)) < 0.35;
        const repainted = bodyBackground && pageBackground && opaque(bodyBackground).some((channel, index) => Math.abs(channel - opaque(pageBackground)[index]) > 24);
        input = {
          ...input,
          surface: mismatched || repainted ? pageBackground : surface,
          text: semantic("--text-title", "--text-normal", "--text-body") || resolve(styles[0]?.color),
          muted: semantic("--text-caption", "--text-placeholder"),
          accent: semantic("--primary-pri-500", "--primary-pri-600", "--primary-color", "--color-primary"),
          warning: semantic("--function-warning-700", "--function-warning-600")
        };
      }
      const theme = deriveTheme(input);
      const serialized = JSON.stringify(theme);
      if (previous === serialized) return;
      previous = serialized;
      host.setAttribute?.("data-theme", theme.mode);
      if (host.style) {
        host.style.colorScheme = theme.mode;
        for (const [key, value] of Object.entries(theme)) {
          if (key !== "mode") host.style.setProperty?.("--fle-" + key, value);
        }
      }
    }
    media?.addEventListener?.("change", refresh);
    if (view.MutationObserver) {
      const observer = new view.MutationObserver(refresh);
      const options = {
        attributes: true,
        subtree: false,
        attributeFilter: ["class", "style", "data-theme", "data-color-mode", "data-theme-mode", "data-color-scheme"]
      };
      for (const node of [document2.documentElement, document2.body].filter(Boolean)) observer.observe(node, options);
    }
    refresh();
    return { refresh };
  }

  // src/userscript/entry.js
  var prefix = "feishu-local-export-";
  var formatKey = prefix + "formats";
  var choices = [["markdown", "Markdown"], ["html", "HTML"], ["pdf", "PDF"], ["attachments", "素材包"]];
  var descriptions = ["便于编辑 · 含图片", "浏览器直接打开", "阅读与打印", "已采集图片与清单"];
  async function defaultPdf(snapshot, options) {
    const { renderPdf: renderPdf2 } = await Promise.resolve().then(() => ((init_pdf(), pdf_exports)));
    return renderPdf2(snapshot, options);
  }
  function installPageExporter(view, {
    capture = capturePage,
    readSource = () => readDocumentSource(view),
    registerMenu = typeof GM_registerMenuCommand === "function" ? GM_registerMenuCommand : view.GM_registerMenuCommand,
    renderPdf: renderPdf2 = defaultPdf
  } = {}) {
    const { document: document2, location: location2 } = view;
    if (document2.getElementById(prefix + "panel")) return;
    let pageKey = "", documentToken = "", currentRoot = null;
    let previousToken = "", previousRoot = null, waitStarted = 0, waitingTimer = null;
    let source, ready = false, chooserOpen = false, cardOpen = false;
    let task = null, snapshot = null, snapshotOwner = null, result = null, pdfNotes = [];
    let lastRun = null, failed = false, noticeId = 0, mode = "fresh";
    let snapshotAt = "", outcome = "idle", unreadNotice = false, pointerInside = false;
    let keyboardMode = false, visible = false, visibilityAnimation = null, screen = "";
    let launcherState = "", drag = null, suppressClick = false, position = 0.62;
    try {
      const stored = Number(view.localStorage.getItem(prefix + "position"));
      if (stored > 0 && stored < 1) position = stored;
    } catch {
    }
    function element(tag, key, text) {
      const el = document2.createElement(tag);
      if (key) el.id = prefix + key;
      if (text) el.textContent = text;
      return el;
    }
    function button(key, text, action) {
      const el = element("button", key, text);
      el.type = "button";
      el.addEventListener("click", action);
      return el;
    }
    function icon(kind) {
      if (!document2.createElementNS) return element("span", "", kind === "check" ? "✓" : kind === "close" ? "×" : "↓");
      const svg = document2.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const path = document2.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", kind === "check" ? "m5 12 4 4L19 6" : kind === "close" ? "m6 6 12 12M6 18 18 6" : kind === "busy" ? "M20 12a8 8 0 1 1-5-7.4" : "M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4");
      svg.append(path);
      return svg;
    }
    function selected() {
      return inputs.filter((input) => input.checked).map((input) => input.value);
    }
    function storedFormats() {
      try {
        const stored = JSON.parse(view.localStorage.getItem(formatKey));
        if (Array.isArray(stored) && choices.some(([kind]) => stored.includes(kind))) return stored;
      } catch {
      }
      return ["markdown"];
    }
    const style = element("style");
    style.textContent = css;
    document2.head.append(style);
    const panel = element("div", "panel");
    const launcher = button("launcher", "", (event) => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (event.detail === 0) inputMode(true);
      if (chooserOpen || cardOpen) closeChooser();
      else openChooser();
    });
    launcher.setAttribute("aria-label", "保存到本地");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", prefix + "popover");
    launcher.setAttribute("aria-haspopup", "dialog");
    const glyph = element("span");
    glyph.className = "glyph";
    const tooltip = element("span", "", "保存到本地");
    tooltip.className = "tooltip";
    tooltip.setAttribute("aria-hidden", "true");
    launcher.append(glyph, tooltip);
    const popover = element("section", "popover");
    popover.hidden = true;
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "文档保存");
    const chooser = element("section", "chooser");
    const chooserHeader = element("header");
    const close = button("close", "", closeChooser);
    close.append(icon("close"));
    close.className = "quiet";
    close.setAttribute("aria-label", "收起面板");
    const title = element("div", "title");
    chooserHeader.append(title, close);
    const options = element("div", "formats");
    const saved = storedFormats();
    const inputs = choices.map(([kind, name], index) => {
      const label = element("label");
      const input = element("input");
      input.type = "checkbox";
      input.value = kind;
      input.checked = saved.includes(kind);
      input.addEventListener("change", () => {
        try {
          view.localStorage.setItem(formatKey, JSON.stringify(selected()));
        } catch {
        }
        controls();
      });
      const copy = element("span", "", name);
      copy.className = "format-copy";
      copy.append(element("small", "", descriptions[index]));
      label.append(input, copy);
      options.append(label);
      return input;
    });
    const plan = element("div", "plan");
    const availability = element("div", "availability");
    availability.setAttribute("role", "status");
    const reload = button("reload", "重新载入页面", () => location2.reload());
    const snapshotNote = element("div", "snapshot-note");
    const submit = button("button", "保存到本地", () => run(mode === "reuse"));
    const supplement = button("supplement", "补存其他格式", () => {
      syncPage();
      if (!snapshot || task || !belongsToPage(snapshotOwner)) return;
      mode = "reuse";
      chooserOpen = true;
      cardOpen = false;
      history.open = false;
      noticeId++;
      controls();
      focusFormats();
    });
    supplement.className = "quiet";
    const fresh = button("fresh", "返回", () => {
      mode = "fresh";
      controls();
      focusFormats();
    });
    fresh.className = "quiet";
    const captureNote = element("div", "capture-note", "采集时页面会自动滚动，结束后回到原位置");
    const notice = element("div", "notice");
    const noticeText = element("span");
    const noticeDetails = button("notice-details", "查看详情", () => {
      chooserOpen = false;
      cardOpen = true;
      history.open = true;
      controls();
    });
    noticeDetails.className = "quiet";
    notice.append(noticeText, noticeDetails);
    chooser.append(snapshotNote, options, plan, availability, reload, submit, fresh, captureNote, notice);
    const card = element("section", "card");
    card.setAttribute("aria-label", "本地保存状态");
    const cardHeader = element("header");
    const heading = element("strong", "job-heading", "正在保存");
    const dismiss = button("dismiss", "收起进度", closeChooser);
    dismiss.className = "quiet";
    cardHeader.append(heading);
    const bar = element("progress", "progress");
    bar.max = 100;
    const status = element("output", "status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const resultBox = element("div", "results");
    const warnings2 = element("details", "warnings");
    const actions = element("div", "actions");
    const cancel = button("cancel", "取消保存", () => {
      if (task) {
        task.cancelled = true;
        cancel.disabled = true;
        status.textContent = "正在取消…";
      }
    });
    const retry = button("retry", "重试", () => run(lastRun?.reuse || false, lastRun?.kinds));
    const redownload = button("redownload", "重新下载此文件", () => {
      syncPage();
      if (result && !task && belongsToPage(snapshotOwner)) download(result.blob, result.filename);
    });
    redownload.className = "quiet";
    cancel.className = "quiet";
    actions.append(dismiss, cancel, retry);
    card.append(cardHeader, bar, status, actions);
    const history = element("details", "history");
    const historySummary = element("summary");
    const historyTime = element("span", "history-time");
    historySummary.append(historyTime);
    const fileActions = element("div", "file-actions");
    fileActions.append(redownload, supplement);
    history.append(historySummary, resultBox, warnings2, fileActions);
    popover.append(chooserHeader, chooser, card, history);
    panel.append(launcher, popover);
    document2.body.append(panel);
    const theme = installTheme(view, panel);
    function openChooser() {
      noticeId++;
      if (task) {
        cardOpen = true;
        controls();
        return;
      }
      chooserOpen = true;
      cardOpen = false;
      mode = "fresh";
      history.open = false;
      if (outcome === "success") outcome = "idle";
      syncPage();
      focusFormats();
    }
    function focusFormats() {
      (inputs.find((input) => input.checked && !input.disabled) || inputs.find((input) => !input.disabled) || close).focus?.();
    }
    function inputMode(keyboard) {
      keyboardMode = keyboard;
      panel.setAttribute("data-input", keyboard ? "keyboard" : "pointer");
    }
    function closeChooser(restoreFocus = true) {
      if (!chooserOpen && !cardOpen) return;
      if (cardOpen && !task) unreadNotice = false;
      if (outcome === "success") outcome = "idle";
      chooserOpen = false;
      cardOpen = false;
      noticeId++;
      controls();
      if (restoreFocus !== false) launcher.focus?.();
    }
    popover.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeChooser();
        return;
      }
    });
    popover.addEventListener("pointerenter", () => {
      pointerInside = true;
    });
    popover.addEventListener("pointerleave", () => {
      pointerInside = false;
    });
    document2.addEventListener("pointerdown", (event) => {
      inputMode(false);
      if (!popover.contains(event.target) && !launcher.contains(event.target)) closeChooser(false);
    });
    document2.addEventListener("keydown", (event) => {
      if (event.key === "Tab" || popover.contains(event.target) || launcher.contains(event.target)) inputMode(true);
    });
    function place() {
      const width = view.innerWidth || 1024, height = view.innerHeight || 768;
      const minimum = height >= 340 ? 96 : 12;
      const maximum = Math.max(minimum, height - (height >= 340 ? 160 : 52));
      const top = Math.max(minimum, Math.min(maximum, height * position - 20));
      launcher.style.top = top + "px";
      const panelWidth = Math.min(320, width - 24);
      const panelHeight = Math.min(popover.offsetHeight || 370, height - 24);
      popover.style.left = Math.max(12, width - 20 - 40 - 10 - panelWidth) + "px";
      popover.style.top = Math.max(12, Math.min(height - panelHeight - 12, top + 40 - panelHeight + 30)) + "px";
    }
    launcher.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      suppressClick = false;
      drag = { id: event.pointerId, y: event.clientY, top: parseFloat(launcher.style.top), moved: false };
      launcher.setPointerCapture?.(event.pointerId);
    });
    launcher.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const delta = event.clientY - drag.y;
      if (!drag.moved && Math.abs(delta) < 6) return;
      drag.moved = true;
      event.preventDefault();
      position = Math.max(0.01, Math.min(0.99, (drag.top + delta + 20) / (view.innerHeight || 768)));
      place();
    });
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      suppressClick = drag.moved && event.type !== "pointercancel";
      if (drag.moved) {
        position = (parseFloat(launcher.style.top) + 20) / (view.innerHeight || 768);
        try {
          view.localStorage.setItem(prefix + "position", String(position));
        } catch {
        }
      }
      drag = null;
    }
    launcher.addEventListener("pointerup", endDrag);
    launcher.addEventListener("pointercancel", endDrag);
    view.addEventListener("resize", place);
    function motionAllowed() {
      return !keyboardMode && !view.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    }
    function setVisible(open) {
      if (visible === open) return;
      visible = open;
      visibilityAnimation?.cancel();
      popover.removeAttribute("inert");
      if (open) popover.hidden = false;
      if (!popover.animate || !motionAllowed()) {
        popover.hidden = !open;
        return;
      }
      if (!open) popover.setAttribute("inert", "");
      const frames = [{ opacity: 0, transform: "translateY(4px) scale(.985)" }, { opacity: 1, transform: "translateY(0) scale(1)" }];
      visibilityAnimation = popover.animate(open ? frames : [...frames].reverse(), { duration: open ? 180 : 130, easing: "cubic-bezier(.2,.8,.2,1)" });
      visibilityAnimation.finished.then(() => {
        if (!visible) popover.hidden = true;
      }).catch(() => {
      });
    }
    function controls() {
      const open = chooserOpen || cardOpen;
      if (open || popover.hidden) {
        chooser.hidden = !chooserOpen;
        card.hidden = !cardOpen;
      }
      const nextScreen = chooserOpen ? "choose:" + mode : task ? "task" : outcome;
      if (open && visible && screen !== nextScreen && motionAllowed()) {
        (chooserOpen ? chooser : card).animate?.([{ opacity: 0.35, transform: "translateY(3px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 140, easing: "ease-out" });
      }
      screen = nextScreen;
      setVisible(open);
      launcher.setAttribute("aria-expanded", String(open));
      const state = task ? "busy" : unreadNotice ? "notice" : outcome === "success" ? "check" : "idle";
      if (state !== launcherState) {
        launcherState = state;
        launcher.setAttribute("data-state", state);
        glyph.replaceChildren(icon(state === "notice" || state === "idle" ? "download" : state));
        const label = task ? "正在保存，点击查看进度" : unreadNotice ? "保存有提示，点击查看" : "保存到本地";
        launcher.setAttribute("aria-label", label);
        tooltip.textContent = label;
      }
      for (const input of inputs) input.disabled = Boolean(task);
      submit.disabled = !ready || !selected().length || Boolean(task);
      submit.textContent = mode === "reuse" ? "补存所选格式" : "保存到本地";
      supplement.hidden = !snapshot || !belongsToPage(snapshotOwner);
      supplement.disabled = !ready || Boolean(task);
      snapshotNote.hidden = mode !== "reuse";
      fresh.hidden = mode !== "reuse";
      captureNote.hidden = mode === "reuse";
      snapshotNote.textContent = "使用 " + snapshotAt + " 读取的内容";
      const kinds = selected();
      plan.textContent = kinds.length > 1 ? "将保存为一个 ZIP，包含所选格式和素材。" : kinds[0] === "markdown" ? "将保存 Markdown 和图片包（ZIP）。" : kinds[0] === "attachments" ? "将保存已采集素材与清单（ZIP）。" : kinds[0] ? "将保存一个 " + kinds[0].toUpperCase() + " 文件。" : "请选择至少一种格式。";
      reload.hidden = ready || source?.unsupported || !waitStarted || Date.now() - waitStarted < 4e3;
      cancel.hidden = !task;
      cancel.disabled = Boolean(task?.cancelled);
      dismiss.hidden = !task;
      bar.hidden = !task;
      retry.hidden = !failed || Boolean(task) || !ready;
      redownload.hidden = !result || Boolean(task) || !belongsToPage(snapshotOwner);
      resultBox.hidden = !result || Boolean(task);
      history.hidden = !snapshot || Boolean(task) || !belongsToPage(snapshotOwner);
      historyTime.textContent = (result ? "上次文件" : "已读取的内容") + " · " + snapshotAt;
      notice.hidden = !["partial", "failed"].includes(outcome);
      noticeText.textContent = failed ? "上次保存失败，可重试。" : "上次保存有内容提示，请核对。";
      place();
    }
    function belongsToPage(owner) {
      if (!owner?.key) return false;
      const current = readSource();
      return owner.key === current.key && owner.token === (current.docToken || "");
    }
    function clearResult() {
      snapshot = null;
      snapshotOwner = null;
      snapshotAt = "";
      result = null;
      pdfNotes = [];
      lastRun = null;
      failed = false;
      outcome = "idle";
      unreadNotice = false;
      mode = "fresh";
      resultBox.replaceChildren();
      warnings2.replaceChildren();
      warnings2.hidden = true;
      status.textContent = "";
    }
    function syncPage() {
      theme.refresh();
      source = readSource();
      const key = source.key || "";
      const root = document2.querySelector?.('[data-block-type="page"], .page-block');
      const token = source.docToken || "";
      if (key !== pageKey) {
        if (task) task.cancelled = true;
        previousToken = documentToken;
        previousRoot = currentRoot;
        waitStarted = Date.now();
        pageKey = key;
        documentToken = "";
        currentRoot = null;
        cardOpen = false;
        noticeId++;
        clearResult();
      }
      if (snapshotOwner && snapshotOwner.token !== token || task?.key === key && task.token !== token) {
        if (task) task.cancelled = true;
        noticeId++;
        clearResult();
        cardOpen = false;
      }
      const rootReplaced = Boolean(previousRoot && root && previousRoot !== root);
      const waitingForPrevious = Boolean(previousToken && (!token || token === previousToken) && !rootReplaced);
      ready = Boolean(key) && source.ready !== false && !source.unsupported && !waitingForPrevious;
      if (ready) {
        previousToken = "";
        previousRoot = null;
        waitStarted = 0;
        documentToken = token;
        currentRoot = root || currentRoot;
      } else if (!waitStarted) waitStarted = Date.now();
      title.textContent = ready ? source.title : "";
      title.setAttribute("title", title.textContent);
      availability.textContent = ready ? "" : source.unsupported ? source.reason : waitingForPrevious ? "正在等待当前文档，页面仍显示前一篇正文。" : source.reason || "正在等待文档正文加载。";
      availability.hidden = ready;
      if (chooserOpen && !ready && !source.unsupported && waitingTimer === null) {
        waitingTimer = view.setTimeout(() => {
          waitingTimer = null;
          syncPage();
        }, 400);
      }
      controls();
    }
    function check(op) {
      if (task !== op || op.cancelled || !belongsToPage(op)) throw new DOMException("保存已取消", "AbortError");
    }
    async function yieldForCancel(op) {
      await new Promise((resolve) => view.setTimeout(resolve, 0));
      check(op);
    }
    function download(blob, filename) {
      const url = view.URL.createObjectURL(blob);
      const link = element("a");
      link.href = url;
      link.download = filename;
      document2.body.append(link);
      link.click();
      link.remove();
      view.setTimeout(() => view.URL.revokeObjectURL(url), 6e4);
    }
    function warningLines() {
      return [...(snapshot?.warnings || []).map(({ code, label }) => warningLabel(code) + (label ? " · " + label : "")), ...pdfNotes];
    }
    function showWarnings() {
      warnings2.replaceChildren();
      const lines = warningLines();
      warnings2.hidden = !lines.length;
      if (!lines.length) return;
      const list = element("ul");
      for (const line of lines.slice(0, 40)) list.append(element("li", "", line));
      warnings2.append(
        element("summary", "", "内容提示（" + lines.length + " 条）"),
        list,
        button("report", "下载完整提示", () => {
          syncPage();
          if (snapshot && !task && belongsToPage(snapshotOwner)) {
            download(new Blob([warningLines().join("\n") + "\n"], { type: "text/plain;charset=utf-8" }), safeStem(snapshot.title) + "-保存提示.txt");
          }
        })
      );
    }
    function showResult(file) {
      resultBox.replaceChildren();
      if (!file) return;
      resultBox.append(element("strong", "", file.filename));
      if (file.entries) {
        const details = element("details");
        const list = element("ul");
        for (const entry of file.entries) list.append(element("li", "", entry.name));
        details.append(element("summary", "", "包内文件（" + file.entries.length + " 项）"), list);
        resultBox.append(details);
      }
    }
    async function takeSnapshot(op) {
      status.textContent = "正在采集文档，页面会自动滚动…";
      bar.removeAttribute("value");
      const raw = await capture({
        shouldStop: () => task !== op || op.cancelled || !belongsToPage(op),
        onProgress: (progress) => {
          if (task !== op || op.cancelled || !belongsToPage(op)) return;
          if (["structure", "audit", "recheck", "done"].includes(progress.stage)) {
            status.textContent = "正在核对内容…";
            bar.removeAttribute("value");
          } else if (typeof progress.percent === "number") bar.value = progress.percent;
        }
      });
      check(op);
      status.textContent = "正在整理正文和素材…";
      bar.removeAttribute("value");
      await yieldForCancel(op);
      const converted = convertCapture(raw);
      const assets = [];
      for (const image of raw.images) {
        const data = /^data:image\/png;base64,(.+)$/u.exec(image.dataUrl || "");
        if (!data) continue;
        const binary = atob(data[1]);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
        assets.push({ path: imageHtmlPath(image), bytes });
      }
      const next = await readDocumentParts({ html: converted.html, assets, name: "capture" });
      check(op);
      return next;
    }
    async function run(reuse, requestedKinds) {
      syncPage();
      const kinds = requestedKinds || selected();
      if (task || !ready || !kinds.length) return;
      if (reuse && (!snapshot || !belongsToPage(snapshotOwner))) return;
      const op = { key: pageKey, token: documentToken, cancelled: false };
      task = op;
      lastRun = { reuse, kinds: [...kinds] };
      failed = false;
      outcome = "idle";
      unreadNotice = false;
      noticeId++;
      chooserOpen = false;
      cardOpen = true;
      heading.textContent = "正在保存";
      warnings2.hidden = true;
      controls();
      try {
        const working = reuse ? snapshot : await takeSnapshot(op);
        check(op);
        const readAt = reuse ? snapshotAt : (/* @__PURE__ */ new Date()).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        if (!snapshot) {
          snapshot = working;
          snapshotOwner = op;
          snapshotAt = readAt;
        }
        status.textContent = "正在生成文件…";
        bar.removeAttribute("value");
        await yieldForCancel(op);
        let pdf = null;
        if (kinds.includes("pdf")) {
          pdf = await renderPdf2(working, {
            shouldStop: () => task !== op || op.cancelled || !belongsToPage(op),
            onProgress: (message) => {
              if (task === op && !op.cancelled) status.textContent = message || "正在生成 PDF…";
            }
          });
          check(op);
        }
        const outputSnapshot = pdf?.notes?.length ? {
          ...working,
          warnings: [...working.warnings, ...pdf.notes.map((label) => ({ code: "pdf_conversion_note", label }))]
        } : working;
        const downloadKinds = kinds.filter((kind) => kind !== "pdf");
        let next;
        if (kinds.length === 1 && pdf) next = pdf;
        else if (kinds.length === 1 && downloadKinds[0] === "html") next = await renderFile("html", outputSnapshot);
        else {
          const extraFiles = pdf ? [{ name: pdf.filename, bytes: new Uint8Array(await pdf.blob.arrayBuffer()) }] : [];
          check(op);
          next = renderBundle(downloadKinds, outputSnapshot, extraFiles);
        }
        await yieldForCancel(op);
        snapshot = working;
        snapshotOwner = op;
        snapshotAt = readAt;
        result = next;
        pdfNotes = (pdf?.notes || []).map((note) => warningLabel("pdf_conversion_note") + " · " + note);
        showResult(next);
        showWarnings();
        download(next.blob, next.filename);
        const partial = warningLines().length > 0;
        outcome = partial ? "partial" : "success";
        unreadNotice = partial;
        history.open = true;
        heading.textContent = partial ? "部分保存，请核对" : "文件已生成";
        status.textContent = partial ? "部分保存。已交给浏览器保存，请查看内容提示。" : "已交给浏览器保存。";
        if (!partial) {
          const current = ++noticeId;
          const collapse = () => {
            if (noticeId !== current || task) return;
            if (cardOpen && (pointerInside || keyboardMode && popover.contains(document2.activeElement))) {
              view.setTimeout(collapse, 4e3);
              return;
            }
            cardOpen = false;
            outcome = "idle";
            controls();
          };
          view.setTimeout(collapse, 4e3);
        }
      } catch (error) {
        if (belongsToPage(op)) {
          failed = error.name !== "AbortError";
          outcome = failed ? "failed" : "cancelled";
          unreadNotice = failed;
          history.open = true;
          heading.textContent = failed ? "保存失败" : "已取消";
          status.textContent = failed ? "保存失败：" + error.message : "保存已取消。";
          if (result) status.textContent += "上次保存的文件仍可下载。";
          showWarnings();
        }
      } finally {
        if (task === op) task = null;
        syncPage();
      }
    }
    if (typeof registerMenu === "function") registerMenu("保存到本地…", openChooser);
    view.navigation?.addEventListener("currententrychange", syncPage);
    view.addEventListener("popstate", syncPage);
    view.addEventListener("pageshow", syncPage);
    view.setInterval?.(syncPage, 750);
    if (view.MutationObserver) {
      const observer = new view.MutationObserver(syncPage);
      observer.observe(document2.head, { childList: true, subtree: true, characterData: true });
    }
    syncPage();
  }
  if (typeof window !== "undefined" && window.document) installPageExporter(window);
})();
