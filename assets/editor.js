(function () {
  "use strict";

  const { node, normalizeData, loadSiteData, assetUrl, renderEventDetail } = window.HifiSite;
  const DRAFT_KEY = "hifi-trade-editor-draft-v1";
  const DB_NAME = "hifi-trade-editor-files";
  const DB_STORE = "images";
  const root = document.querySelector("[data-editor-root]");
  const alertBox = document.querySelector("[data-alert]");
  const form = document.querySelector("[data-event-form]");
  const list = document.querySelector("[data-admin-list]");
  const exportBar = document.querySelector("[data-export-bar]");
  const siteSettings = document.querySelector("[data-site-settings]");
  const pendingFiles = new Map();
  const objectUrls = new Map();
  let data = null;
  let selectedId = "";
  let lifecycle = "published";
  let unexportedChanges = false;
  let importedEntries = [];
  let importedFilename = "";

  function announce(message, kind = "") {
    alertBox.textContent = message;
    alertBox.className = `editor-alert${kind ? ` is-${kind}` : ""}`;
  }

  function getSelected() {
    return data?.events.find((event) => event.id === selectedId) || null;
  }

  function makeId() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    let id;
    do id = `event-${date}-${crypto.randomUUID().slice(0, 6)}`;
    while (data.events.some((event) => event.id === id));
    return id;
  }

  function blankEvent() {
    return {
      id: makeId(), status: "draft", order: (Math.max(0, ...data.events.map((item) => Number(item.order) || 0)) + 10),
      title: "新事件草稿", accounts: [], devices: [], eventDate: "", summary: "", narrative: "",
      listingPrice: "", transactionPrice: "", materials: [], responses: [], updates: [], currentStatus: "",
      updatedAt: new Date().toISOString().slice(0, 10), correctionNotice: "", withdrawalNotice: "", mood: null
    };
  }

  function setDeep(target, path, value) {
    const keys = path.split(".");
    let cursor = target;
    keys.forEach((key, index) => {
      if (index === keys.length - 1) cursor[key] = value;
      else {
        if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
        cursor = cursor[key];
      }
    });
  }

  function getDeep(target, path) {
    return path.split(".").reduce((cursor, key) => cursor?.[key], target);
  }

  function markChanged(message = "有尚未导出的修改。") {
    unexportedChanges = true;
    lifecycle = "draft";
    updateLifecycle();
    announce(message);
  }

  function updateLifecycle() {
    document.querySelectorAll("[data-status-step]").forEach((step) => step.classList.toggle("is-current", step.dataset.statusStep === lifecycle));
    exportBar.hidden = !data;
    const summary = document.querySelector("[data-export-summary]");
    if (lifecycle === "published") summary.textContent = "已载入网站发布数据";
    else if (lifecycle === "exported") summary.textContent = "更新文件已导出，尚未发布";
    else summary.textContent = unexportedChanges ? "有尚未导出的修改" : "浏览器本地草稿";
  }

  function statusLabel(status) {
    return status === "published" ? "公开" : status === "withdrawn" ? "已撤下" : "草稿";
  }

  function renderList() {
    const events = [...data.events].sort((a, b) => Number(a.order) - Number(b.order));
    list.replaceChildren();
    events.forEach((event, index) => {
      const item = node("div", { className: `admin-event${event.id === selectedId ? " is-selected" : ""}` });
      const main = node("button", { className: "admin-event-main", attrs: { type: "button" } }, [
        node("strong", { text: event.title || "未命名事件" }),
        node("small", {}, [node("span", { className: `status-dot ${event.status}` }), document.createTextNode(`${statusLabel(event.status)} · ${event.id}`)])
      ]);
      main.addEventListener("click", () => selectEvent(event.id));
      const order = node("div", { className: "admin-event-order" });
      const up = node("button", { text: "↑", attrs: { type: "button", "aria-label": "向上移动" } });
      const down = node("button", { text: "↓", attrs: { type: "button", "aria-label": "向下移动" } });
      const remove = node("button", { className: "admin-event-delete", text: "删除", attrs: { type: "button", "data-list-delete": event.id, "aria-label": `删除记录：${event.title}` } });
      up.disabled = index === 0;
      down.disabled = index === events.length - 1;
      up.addEventListener("click", () => moveEvent(event.id, -1));
      down.addEventListener("click", () => moveEvent(event.id, 1));
      remove.addEventListener("click", () => deleteEvent(event.id));
      order.append(up, down, remove);
      item.append(main, order);
      list.append(item);
    });
  }

  function moveEvent(id, direction) {
    const events = [...data.events].sort((a, b) => Number(a.order) - Number(b.order));
    const index = events.findIndex((event) => event.id === id);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= events.length) return;
    [events[index], events[swap]] = [events[swap], events[index]];
    events.forEach((event, position) => { event.order = (position + 1) * 10; });
    data.events = events;
    markChanged("事件顺序已调整，尚未导出。");
    renderList();
  }

  function deleteEvent(id) {
    const event = data.events.find((item) => item.id === id);
    if (!event) return;
    if (!window.confirm(`确认从更新数据中永久删除「${event.title}」？删除后该事件固定链接将失效。若只想停止公开展示，请使用“撤下记录”。`)) return;
    const index = data.events.findIndex((item) => item.id === id);
    data.events.splice(index, 1);
    if (selectedId === id) selectedId = data.events[Math.min(index, data.events.length - 1)]?.id || "";
    markChanged("记录已从当前编辑数据删除，尚未导出或发布。关联图片文件不会自动从仓库移除。");
    renderList();
    if (selectedId) fillForm(getSelected());
    else form.classList.add("is-empty");
  }

  function field(label, path, value = "", type = "text", wide = false) {
    const input = type === "textarea"
      ? node("textarea", { attrs: { rows: "3", "data-row-path": path } })
      : node("input", { attrs: { type, "data-row-path": path } });
    input.value = value ?? "";
    return node("label", { className: `field${wide ? " wide" : ""}` }, [node("span", { text: label }), input]);
  }

  function removeButton(callback) {
    const button = node("button", { className: "remove-row", text: "移除", attrs: { type: "button" } });
    button.addEventListener("click", callback);
    return button;
  }

  function bindRowInputs(row, collection, index) {
    row.querySelectorAll("[data-row-path]").forEach((input) => {
      input.addEventListener("input", () => {
        const item = getSelected()[collection][index];
        item[input.dataset.rowPath] = input.type === "number" ? Number(input.value) || 0 : input.value;
        markChanged();
      });
    });
  }

  function renderAccounts(event) {
    const container = document.querySelector('[data-repeater="accounts"]');
    container.replaceChildren();
    event.accounts.forEach((account, index) => {
      const row = node("div", { className: "repeat-row" }, [
        removeButton(() => removeRow("accounts", index)),
        field("公开账号", "displayName", account.displayName),
        field("平台", "platform", account.platform),
        field("公开主页链接", "profileUrl", account.profileUrl, "url", true)
      ]);
      bindRowInputs(row, "accounts", index);
      container.append(row);
    });
  }

  function renderDevices(event) {
    const container = document.querySelector('[data-repeater="devices"]');
    container.replaceChildren();
    event.devices.forEach((device, index) => {
      const input = node("input", { attrs: { type: "text", "aria-label": `设备 ${index + 1}` } });
      input.value = device;
      input.addEventListener("input", () => { getSelected().devices[index] = input.value; markChanged(); });
      const row = node("div", { className: "repeat-row single" }, [input, removeButton(() => removeRow("devices", index))]);
      container.append(row);
    });
  }

  function resolvePreviewPath(path) {
    if (pendingFiles.has(path)) {
      if (!objectUrls.has(path)) objectUrls.set(path, URL.createObjectURL(pendingFiles.get(path)));
      return objectUrls.get(path);
    }
    return assetUrl(path);
  }

  function renderMaterials(event) {
    const container = document.querySelector('[data-repeater="materials"]');
    container.replaceChildren();
    event.materials.forEach((material, index) => {
      const row = node("div", { className: "repeat-row" });
      row.append(removeButton(() => removeRow("materials", index)));
      const typeWrap = node("label", { className: "field" }, [node("span", { text: "材料类型" })]);
      const typeSelect = node("select", { attrs: { "data-row-path": "type" } }, [
        node("option", { text: "图片", attrs: { value: "image" } }),
        node("option", { text: "链接", attrs: { value: "link" } }),
        node("option", { text: "文档", attrs: { value: "document" } })
      ]);
      typeSelect.value = material.type || "link";
      typeWrap.append(typeSelect);
      row.append(
        typeWrap,
        field("标题", "title", material.title),
        field("说明", "description", material.description, "textarea", true),
        field("相对图片路径", "path", material.path, "text", true),
        field("原始来源链接", "sourceUrl", material.sourceUrl, "url"),
        field("水楼楼层链接", "waterPostUrl", material.waterPostUrl, "url")
      );
      if (material.type === "image" && material.path) {
        const preview = node("div", { className: "image-preview" }, [
          node("img", { attrs: { src: resolvePreviewPath(material.path), alt: material.description || material.title || "图片预览" } }),
          node("div", {}, [
            node("small", { text: pendingFiles.has(material.path) ? "待导出的新增图片" : "网站中已有的图片" }),
            node("div", { className: "image-order" })
          ])
        ]);
        const buttons = preview.querySelector(".image-order");
        const before = node("button", { text: "向前", attrs: { type: "button" } });
        const after = node("button", { text: "向后", attrs: { type: "button" } });
        before.disabled = index === 0;
        after.disabled = index === event.materials.length - 1;
        before.addEventListener("click", () => moveMaterial(index, -1));
        after.addEventListener("click", () => moveMaterial(index, 1));
        buttons.append(before, after);
        row.append(preview);
      }
      bindRowInputs(row, "materials", index);
      container.append(row);
    });
  }

  function renderResponses(event) {
    const container = document.querySelector('[data-repeater="responses"]');
    container.replaceChildren();
    event.responses.forEach((response, index) => {
      const row = node("div", { className: "repeat-row" }, [
        removeButton(() => removeRow("responses", index)),
        field("回应方", "party", response.party),
        field("回应日期", "date", response.date, "date"),
        field("回应内容", "statement", response.statement, "textarea", true),
        field("来源链接", "sourceUrl", response.sourceUrl, "url", true)
      ]);
      bindRowInputs(row, "responses", index);
      container.append(row);
    });
  }

  function renderUpdates(event) {
    const container = document.querySelector('[data-repeater="updates"]');
    container.replaceChildren();
    event.updates.forEach((update, index) => {
      const row = node("div", { className: "repeat-row" }, [
        removeButton(() => removeRow("updates", index)),
        field("更新日期", "date", update.date, "date"),
        field("来源链接", "sourceUrl", update.sourceUrl, "url"),
        field("更新内容", "text", update.text, "textarea", true)
      ]);
      bindRowInputs(row, "updates", index);
      container.append(row);
    });
  }

  function renderRepeaters(event) {
    renderAccounts(event);
    renderDevices(event);
    renderMaterials(event);
    renderResponses(event);
    renderUpdates(event);
  }

  function fillForm(event) {
    document.querySelector("[data-form-title]").textContent = event.title || "未命名事件";
    document.querySelector("[data-event-id]").textContent = event.id;
    form.querySelectorAll("[name]").forEach((input) => {
      const value = getDeep(event, input.name);
      input.value = value ?? "";
    });
    renderRepeaters(event);
    form.classList.remove("is-empty");
  }

  function selectEvent(id) {
    selectedId = id;
    renderList();
    const event = getSelected();
    if (event) fillForm(event);
  }

  function removeRow(collection, index) {
    getSelected()[collection].splice(index, 1);
    markChanged();
    renderRepeaters(getSelected());
  }

  function addRow(collection) {
    const event = getSelected();
    const templates = {
      accounts: { displayName: "", platform: "", profileUrl: "" },
      devices: "",
      materials: { type: "link", title: "", description: "", path: "", sourceUrl: "", waterPostUrl: "" },
      responses: { party: "", date: "", statement: "", sourceUrl: "" },
      updates: { date: new Date().toISOString().slice(0, 10), text: "", sourceUrl: "" }
    };
    event[collection].push(templates[collection]);
    markChanged();
    renderRepeaters(event);
  }

  function moveMaterial(index, direction) {
    const items = getSelected().materials;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    markChanged("图片或材料顺序已调整，尚未导出。");
    renderMaterials(getSelected());
  }

  function renderSiteSettings() {
    siteSettings.querySelectorAll("[name]").forEach((input) => {
      const value = getDeep(data, input.name);
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value ?? "";
    });
  }

  function installData(nextData, sourceMessage, state = "published") {
    data = normalizeData(nextData);
    selectedId = data.events[0]?.id || "";
    lifecycle = state;
    unexportedChanges = state === "draft";
    root.hidden = false;
    renderSiteSettings();
    renderList();
    if (selectedId) selectEvent(selectedId);
    else form.classList.add("is-empty");
    updateLifecycle();
    announce(sourceMessage, "success");
  }

  async function loadPublished() {
    try {
      const loaded = await loadSiteData();
      installData(loaded, "已读取当前网站数据。", "published");
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        try {
          const saved = JSON.parse(draft);
          if (saved.isDemo && !loaded.isDemo) {
            announce("已读取新的网站数据。当前浏览器仍有旧的演示草稿，需要时可点“恢复浏览器草稿”；请勿把演示草稿误当作真实名单。", "success");
          } else if (window.confirm("当前浏览器有本地草稿。确定恢复草稿？取消则查看网站最新数据，草稿仍保留，可稍后手动恢复。")) {
            installData(saved, "已恢复浏览器本地草稿；它尚未发布。", "draft");
            await hydrateDraftImages();
            if (selectedId) renderMaterials(getSelected());
          } else {
            announce("正在显示网站数据；浏览器草稿仍保留，可点“恢复浏览器草稿”。", "success");
          }
        } catch (_error) {
          announce("网站数据已载入，但本地草稿损坏，未覆盖网站数据。", "error");
        }
      }
    } catch (error) {
      announce(`载入失败：${error.message}。现有内容未被空名单覆盖；可导入本地 events.json 后继续。`, "error");
    }
  }

  function showImportedSource(text) {
    const panel = document.querySelector("[data-import-source]");
    panel.hidden = false;
    panel.querySelector("[data-import-source-text]").textContent = text || "";
  }

  function createImportedDraft(entry) {
    const event = blankEvent();
    const lines = entry.raw.split("\n").map((line) => line.trim()).filter(Boolean);
    event.title = window.HifiDocumentImport.suggestedTitle(entry.heading, entry.index);
    event.summary = lines.slice(1, 3).join(" ").slice(0, 260) || "离线导入文档条目，尚待维护者整理。";
    event.narrative = `离线导入原文（已自动去除直接身份信息，待维护者核对）：\n\n${window.HifiDocumentImport.sanitizeForDraft(entry.raw)}`;
    event.materials = [{ type: "document", title: `导入来源：${importedFilename}`, description: "原文只在当前浏览器编辑会话中展示；请核对、去敏并将必要信息整理到公开字段后再导出。", path: "", sourceUrl: "", waterPostUrl: "" }];
    data.events.push(event);
    selectedId = event.id;
    markChanged("已将文档条目生成一条本地草稿。请核对、去敏和整理后再导出。");
    renderList();
    fillForm(event);
    showImportedSource(`本机原文（不会自动导出）：\n\n${entry.raw}`);
    document.querySelector("[data-import-panel]").open = false;
  }

  function renderImportCandidates() {
    const container = document.querySelector("[data-import-candidates]");
    container.replaceChildren();
    importedEntries.filter((entry) => !entry.isPreface).forEach((entry) => {
      const button = node("button", { className: "import-candidate", text: `${entry.index}. ${entry.heading}`, attrs: { type: "button" } });
      button.addEventListener("click", () => createImportedDraft(entry));
      container.append(button);
    });
  }

  document.querySelector("[data-import-document]").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.querySelector("[data-import-status]");
    try {
      status.textContent = `正在本地读取 ${file.name}…`;
      const text = await window.HifiDocumentImport.extractText(file);
      importedEntries = window.HifiDocumentImport.splitEntries(text);
      importedFilename = file.name;
      renderImportCandidates();
      status.textContent = `已在本机读取 ${importedEntries.length} 个候选记录。每个候选记录对应一个原文分段；一段中多个账号不会自动拆分或合并。点击条目生成草稿；原文不会自动发布。`;
    } catch (error) {
      importedEntries = [];
      document.querySelector("[data-import-candidates]").replaceChildren();
      status.textContent = `导入失败：${error.message}`;
      announce(`离线文档导入失败：${error.message}。现有内容保持不变。`, "error");
    } finally {
      event.target.value = "";
    }
  });

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function dbPut(path, blob) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(blob, path);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function dbGet(path) {
    const db = await openDb();
    const result = await new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE).objectStore(DB_STORE).get(path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  }

  async function hydrateDraftImages() {
    const paths = data.events.flatMap((event) => event.materials.filter((item) => item.type === "image" && item.path).map((item) => item.path));
    await Promise.all(paths.map(async (path) => {
      const blob = await dbGet(path).catch(() => null);
      if (blob) pendingFiles.set(path, blob);
    }));
  }

  function sanitizeFilename(name) {
    const parts = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").split(".");
    const extension = parts.length > 1 ? parts.pop() : "bin";
    const stem = parts.join(".") || "image";
    return `${stem.slice(0, 50)}-${crypto.randomUUID().slice(0, 6)}.${extension.slice(0, 8)}`;
  }

  async function addImages(files) {
    const event = getSelected();
    if (!event || !files.length) return;
    for (const file of files) {
      const path = `assets/images/events/${event.id}/${sanitizeFilename(file.name)}`;
      pendingFiles.set(path, file);
      await dbPut(path, file);
      event.materials.push({ type: "image", title: file.name.replace(/\.[^.]+$/, ""), description: "", path, sourceUrl: "", waterPostUrl: "" });
    }
    markChanged(`已加入 ${files.length} 张图片。图片仍只保存在当前浏览器，导出更新包后才有可移植副本。`);
    renderMaterials(event);
  }

  function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    lifecycle = "draft";
    updateLifecycle();
    announce("浏览器本地草稿已保存。它不是唯一备份，也没有发布到网站。", "success");
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      table[i] = value >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) { return new Uint8Array([value & 255, (value >>> 8) & 255]); }
  function u32(value) { return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]); }
  function joinBytes(parts) {
    const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  async function createZip(entries) {
    const encoder = new TextEncoder();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const entry of entries) {
      const name = encoder.encode(entry.name.replaceAll("\\", "/"));
      const bytes = entry.blob ? new Uint8Array(await entry.blob.arrayBuffer()) : encoder.encode(entry.text || "");
      const crc = crc32(bytes);
      const local = joinBytes([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), name, bytes]);
      const central = joinBytes([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(crc), u32(bytes.length), u32(bytes.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]);
      locals.push(local); centrals.push(central); offset += local.length;
    }
    const centralBlock = joinBytes(centrals);
    const end = joinBytes([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBlock.length), u32(offset), u16(0)]);
    return new Blob([...locals, centralBlock, end], { type: "application/zip" });
  }

  async function exportUpdate() {
    saveDraft();
    const jsonText = `${JSON.stringify(data, null, 2)}\n`;
    const referenced = new Set(data.events.flatMap((event) => event.materials.map((item) => item.path).filter(Boolean)));
    const images = [...pendingFiles.entries()].filter(([path]) => referenced.has(path));
    if (images.length === 0) {
      download(new Blob([jsonText], { type: "application/json;charset=utf-8" }), "events.json");
      announce("已导出 events.json。请在 GitHub 中替换 data/events.json；导出不等于发布。", "success");
    } else {
      const readme = [
        "HiFi 交易事件簿更新包", "", "不要把 ZIP 文件本身上传到网站。", "请先解压，再把包内文件按原有目录结构上传到仓库根目录：", "- data/events.json", "- assets/images/events/...", "", "在 GitHub 提交后等待 Pages 部署完成，再回到编辑器点击“我已在 GitHub 提交”。"
      ].join("\r\n");
      const entries = [{ name: "data/events.json", text: jsonText }, { name: "README-UPLOAD.txt", text: readme }, ...images.map(([name, blob]) => ({ name, blob }))];
      const zip = await createZip(entries);
      download(zip, `hifi-site-update-${new Date().toISOString().slice(0, 10)}.zip`);
      announce(`已导出更新包，包含数据文件和 ${images.length} 张新增图片。请解压后上传其中的文件；不要上传 ZIP 本身。`, "success");
    }
    lifecycle = "exported";
    unexportedChanges = false;
    updateLifecycle();
  }

  function confirmPublished() {
    if (lifecycle !== "exported") {
      announce("请先导出更新文件；只有你已在 GitHub 提交并确认 Pages 部署后，才应标记为已发布。", "error");
      return;
    }
    if (!window.confirm("这个按钮不会操作 GitHub。只有在你已上传文件、提交并确认 GitHub Pages 部署完成后，才点击“确定”。")) return;
    lifecycle = "published";
    unexportedChanges = false;
    localStorage.removeItem(DRAFT_KEY);
    updateLifecycle();
    announce("已在当前浏览器记录为“已发布”。编辑器没有写入 GitHub；线上状态仍以 GitHub Pages 为准。", "success");
  }

  function showPreview() {
    const event = getSelected();
    if (!event) return;
    const dialog = document.querySelector("[data-preview-dialog]");
    const canvas = dialog.querySelector("[data-preview-canvas]");
    renderEventDetail(event, canvas, {
      preview: true,
      resolveAsset: resolvePreviewPath,
      onImage: (src, caption) => {
        const lightbox = document.querySelector("[data-editor-lightbox]");
        lightbox.querySelector("img").src = src;
        lightbox.querySelector("p").textContent = caption || "图片预览";
        lightbox.showModal();
      }
    });
    dialog.showModal();
  }

  form.addEventListener("input", (event) => {
    const input = event.target.closest("[name]");
    const selected = getSelected();
    if (!input || !selected) return;
    const value = input.type === "number" ? Number(input.value) || 0 : input.value;
    setDeep(selected, input.name, value);
    document.querySelector("[data-form-title]").textContent = selected.title || "未命名事件";
    markChanged();
    renderList();
  });

  siteSettings.addEventListener("input", (event) => {
    const input = event.target.closest("[name]");
    if (!input || !data) return;
    setDeep(data, input.name, input.type === "checkbox" ? input.checked : input.value);
    markChanged("站点设置已修改，尚未导出。");
  });

  document.querySelector("[data-new-event]").addEventListener("click", () => {
    const event = blankEvent();
    data.events.push(event);
    selectedId = event.id;
    markChanged("已新建草稿记录，稳定事件标识已自动生成。");
    renderList(); fillForm(event);
  });

  document.querySelectorAll("[data-add-row]").forEach((button) => button.addEventListener("click", () => addRow(button.dataset.addRow)));
  document.querySelector("[data-image-input]").addEventListener("change", async (event) => { await addImages([...event.target.files]); event.target.value = ""; });
  document.querySelector("[data-withdraw]").addEventListener("click", () => {
    const event = getSelected();
    if (!event) return;
    event.status = "withdrawn";
    if (!event.withdrawalNotice) event.withdrawalNotice = "该记录已由维护者撤下；请在此补充撤回原因和日期。";
    markChanged("记录已标记为撤下，尚未导出。正式网站更新后将不再出现在列表中。");
    fillForm(event); renderList();
  });
  document.querySelector("[data-delete-event]").addEventListener("click", () => {
    const event = getSelected();
    if (!event) return;
    deleteEvent(event.id);
  });
  document.querySelector("[data-preview]").addEventListener("click", showPreview);
  document.querySelector("[data-close-preview]").addEventListener("click", () => document.querySelector("[data-preview-dialog]").close());
  document.querySelector("[data-close-editor-lightbox]").addEventListener("click", () => document.querySelector("[data-editor-lightbox]").close());
  document.querySelectorAll("[data-save-draft]").forEach((button) => button.addEventListener("click", saveDraft));
  document.querySelector("[data-restore-draft]").addEventListener("click", async () => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (!draft) { announce("当前浏览器没有保存的草稿。", "error"); return; }
    if (unexportedChanges && !window.confirm("恢复草稿会替换当前未导出的编辑内容。继续吗？")) return;
    try {
      installData(JSON.parse(draft), "已恢复浏览器本地草稿；它尚未发布。", "draft");
      await hydrateDraftImages();
      if (selectedId) renderMaterials(getSelected());
    } catch (error) {
      announce(`草稿恢复失败：${error.message}。当前内容保持不变。`, "error");
    }
  });
  document.querySelector("[data-export]").addEventListener("click", exportUpdate);
  document.querySelector("[data-confirm-published]").addEventListener("click", confirmPublished);
  document.querySelector("[data-reload-published]").addEventListener("click", () => {
    if (unexportedChanges && !window.confirm("重新载入会放弃当前未导出的改动。继续吗？")) return;
    localStorage.removeItem(DRAFT_KEY);
    loadPublished();
  });
  document.querySelector("[data-import-json]").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = normalizeData(JSON.parse(await file.text()));
      installData(imported, `已导入 ${file.name}。尚未发布，请检查并导出更新文件。`, "draft");
      unexportedChanges = true;
      updateLifecycle();
    } catch (error) {
      announce(`导入失败：${error.message}。现有内容保持不变。`, "error");
    } finally { event.target.value = ""; }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!unexportedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });

  loadPublished();
})();
