(function () {
  "use strict";
  const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const MAX_SIZE = 20 * 1024 * 1024;

  function paragraphText(paragraph) {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_ELEMENT);
    const parts = [];
    while (walker.nextNode()) {
      const item = walker.currentNode;
      if (item.namespaceURI !== WORD_NS) continue;
      if (item.localName === "t") parts.push(item.textContent);
      if (item.localName === "tab") parts.push("\t");
      if (item.localName === "br") parts.push("\n");
    }
    return parts.join("");
  }

  async function extractText(file) {
    if (file.size > MAX_SIZE) throw new Error("文档超过 20 MB，请先拆分后导入。");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (["txt", "md"].includes(extension)) return file.text();
    if (extension !== "docx") throw new Error("首版支持 DOCX、TXT 和 Markdown（.md）；旧版 .doc 请先另存为 DOCX。");
    if (!window.JSZip) throw new Error("本地 DOCX 读取组件未加载。");
    let zip;
    try { zip = await window.JSZip.loadAsync(file); } catch (_error) { throw new Error("DOCX 无法解压，文件可能损坏或并非真正的 DOCX。"); }
    const main = zip.file("word/document.xml");
    if (!main) throw new Error("DOCX 缺少正文内容。");
    const xml = new DOMParser().parseFromString(await main.async("string"), "application/xml");
    if (xml.querySelector("parsererror")) throw new Error("DOCX 正文无法解析。");
    const body = xml.getElementsByTagNameNS(WORD_NS, "body")[0];
    if (!body) throw new Error("DOCX 没有可读取的正文。");
    return [...body.getElementsByTagNameNS(WORD_NS, "p")].map(paragraphText).join("\n");
  }

  function splitEntries(text) {
    const normalized = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").trim();
    if (!normalized) throw new Error("文档没有可读取的文字。");
    return normalized.split(/\n[\t ]*\n+/).map((raw, index) => raw.trim()).filter(Boolean).map((raw, index) => {
      const lines = raw.split("\n").map((line) => line.trim()).filter(Boolean);
      const heading = lines[0] || `条目 ${index + 1}`;
      return { raw, index: index + 1, heading, isPreface: /^名单不分先后/.test(raw) };
    });
  }

  function suggestedTitle(heading, index) {
    const cleaned = sanitizeForDraft(heading)
      .replace(/^\d+[-、.]\s*/, "")
      .replace(/\s+\d{4}[-/]\d{1,2}[-/]\d{1,2}.*$/, "")
      .trim();
    return `${cleaned.slice(0, 100) || `文档条目 ${index}`}｜待整理`;
  }

  function sanitizeForDraft(text) {
    return text
      .replace(/1\d{10}/g, "[电话号码已去除]")
      .replace(/江西省德兴市香屯村 家家乐购旁、斤灵水果楼上，?/g, "[详细地址已去除]")
      .replace(/广州市番禺区沙湾街道沙湾街大巷涌路128号103铺/g, "[详细地址已去除]")
      .replace(/\b贴吧?\s*id[:：]?\s*\d{5,}/gi, "贴吧数字账号ID[已去除]")
      .replace(/\bID[:：]?\s*\d{5,}/gi, "数字账号ID[已去除]")
      .replace(/微信：[^\s]+/g, "微信联系方式[已去除]")
      .replace(/IP\s*[：:]?\s*[^\s，。；;]+/g, "IP属地[已去除]")
      .replace(/常住地[：:]?\s*[^，。；;]+/g, "常住地[已去除]")
      .replace(/\b(Aarhus university|复旦学生|在北科上学|退休教师)\b/gi, "[个人背景信息已去除]");
  }

  window.HifiDocumentImport = { extractText, splitEntries, suggestedTitle, sanitizeForDraft };
})();
