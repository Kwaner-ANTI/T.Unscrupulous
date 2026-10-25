(function () {
  "use strict";

  const page = document.body.dataset.page || "";
  const rootPrefix = document.body.dataset.root || "";
  const rootUrl = new URL(rootPrefix || "./", window.location.href);

  function applyTheme(theme, persist = true) {
    const next = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    if (persist) localStorage.setItem("hifi-theme", next);
    const isDark = next === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", isDark ? "切换浅色模式" : "切换深色模式");
      button.setAttribute("aria-pressed", String(isDark));
      const label = button.querySelector("[data-theme-label]");
      if (label) label.textContent = isDark ? "浅色" : "深色";
    });
    const themeColor = document.querySelector("[data-theme-color]");
    if (themeColor) themeColor.setAttribute("content", isDark ? "#0b1112" : "#f5faf9");
  }

  function initTheme() {
    applyTheme(document.documentElement.dataset.theme || "light", false);
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
    });
  }

  function node(tag, options = {}, children = []) {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined && options.text !== null) element.textContent = String(options.text);
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") element.setAttribute(key, String(value));
      });
    }
    const list = Array.isArray(children) ? children : [children];
    list.filter(Boolean).forEach((child) => element.append(child));
    return element;
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function assetUrl(path) {
    if (!path || /^blob:|^data:/.test(path)) return path || "";
    return new URL(path.replace(/^\/+/, ""), rootUrl).href;
  }

  function formatDate(value) {
    if (!value) return "未提供";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(date);
  }

  function normalizeData(input) {
    if (!input || typeof input !== "object" || !Array.isArray(input.events)) {
      throw new Error("数据文件缺少 events 数组，未载入任何内容。");
    }
    const data = structuredClone(input);
    data.schemaVersion = data.schemaVersion || 1;
    data.site = data.site || {};
    data.site.submissions = data.site.submissions || {};
    data.events = data.events.map((event, index) => ({
      ...event,
      id: String(event.id || ""),
      status: event.status || "draft",
      order: Number.isFinite(Number(event.order)) ? Number(event.order) : (index + 1) * 10,
      accounts: Array.isArray(event.accounts) ? event.accounts : [],
      devices: Array.isArray(event.devices) ? event.devices : [],
      materials: Array.isArray(event.materials) ? event.materials : [],
      responses: Array.isArray(event.responses) ? event.responses : [],
      updates: Array.isArray(event.updates) ? event.updates : []
    }));
    return data;
  }

  async function loadSiteData(url = new URL("data/events.json", rootUrl)) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`数据读取失败（HTTP ${response.status}）`);
    return normalizeData(await response.json());
  }

  function renderSiteMeta(data) {
    document.querySelectorAll("[data-site-name]").forEach((element) => {
      element.textContent = data.site.name || "HiFi 交易事件簿";
    });
    document.querySelectorAll("[data-site-intro]").forEach((element) => {
      element.textContent = data.site.intro || "整理社区交易事件的公开陈述与可核对材料。";
    });
    document.querySelectorAll("[data-source-notice]").forEach((element) => {
      element.textContent = data.site.sourceNotice || "";
      element.hidden = !data.site.sourceNotice;
    });
    document.querySelectorAll("[data-last-updated]").forEach((element) => {
      element.textContent = formatDate(data.site.lastUpdated);
      if (data.site.lastUpdated) element.setAttribute("datetime", data.site.lastUpdated);
    });
    if (data.site.name) document.title = page === "event" ? `事件详情 · ${data.site.name}` : data.site.name;
  }

  function renderSubmissionActions(data) {
    const submissions = data.site.submissions || {};
    const entries = [
      submissions.privateMessage || { label: "私信投稿", hint: "前往主页向我发送私信。" },
      submissions.waterPost || { label: "水楼投稿", hint: "在水楼公开回复，提交事件和材料。" }
    ];
    document.querySelectorAll("[data-submit-actions]").forEach((container) => {
      container.replaceChildren();
      entries.forEach((entry) => {
        const url = safeUrl(entry.url);
        const card = node(url ? "button" : "span", {
          className: `submit-card${url ? "" : " is-disabled"}`,
          attrs: url ? { type: "button" } : { "aria-disabled": "true" }
        }, [
          node("strong", { text: entry.label || "投稿入口" }),
          node("small", { text: url ? "先填写简表，复制后前往入口" : (entry.hint || "链接待维护者配置。") })
        ]);
        if (!url) card.title = "链接尚未配置";
        else card.addEventListener("click", () => openSubmissionDialog(entry));
        container.append(card);
      });
    });
  }

  let submissionDialog = null;
  let submissionTarget = null;

  function submissionField(label, name, type = "text", attrs = {}) {
    const input = type === "textarea" ? node("textarea", { attrs: { name, rows: attrs.rows || "3", ...attrs } }) : node("input", { attrs: { name, type, ...attrs } });
    return node("label", { className: "submission-field" }, [node("span", { text: label }), input]);
  }

  function ensureSubmissionDialog() {
    if (submissionDialog) return submissionDialog;
    submissionDialog = node("dialog", { className: "submission-dialog", attrs: { "data-submission-dialog": "true" } });
    const form = node("form", { attrs: { "data-submission-form": "true" } });
    const close = node("button", { className: "submission-close", text: "关闭", attrs: { type: "button" } });
    close.addEventListener("click", () => submissionDialog.close());
    form.append(
      node("div", { className: "submission-dialog-head" }, [node("div", {}, [node("p", { className: "eyebrow", text: "投稿前整理" }), node("h2", { text: "先填写一份简表" })]), close]),
      node("p", { className: "submission-help", text: "内容会整理成一段文字，复制成功后才会跳转。没有的信息可以留空；请不要填写手机号、地址、订单号等敏感信息。" }),
      node("div", { className: "submission-grid" }, [
        submissionField("涉及账号（可填写多个）", "accounts", "text", { placeholder: "昵称、店铺名或公开账号" }),
        submissionField("平台", "platform", "text", { placeholder: "百度贴吧、闲鱼、淘宝等" }),
        submissionField("相关设备", "device", "text", { placeholder: "型号或物品名称" }),
        submissionField("事件日期", "date", "date"),
        submissionField("大致事发经过", "story", "textarea", { rows: "5", required: "" }),
        submissionField("目前结果", "result", "textarea", { rows: "3", placeholder: "退款、协商中、未解决等" }),
        submissionField("材料链接或说明", "materials", "textarea", { rows: "3", placeholder: "原帖、商品页、截图说明；没有可留空" }),
        node("fieldset", { className: "submission-mood" }, [
          node("legend", { text: "投稿者的心情（可选）" }),
          submissionField("作品名称", "moodTitle", "text"),
          submissionField("一句话心情", "moodNote", "textarea", { rows: "2" }),
          submissionField("媒体原站链接", "moodUrl", "url", { placeholder: "YouTube、哔哩哔哩或其他平台" }),
          submissionField("推荐起播秒数", "moodStart", "number", { min: "0", step: "1" })
        ])
      ]),
      node("p", { className: "submission-status", attrs: { "data-submission-status": "true", role: "status", "aria-live": "polite" } }),
      node("textarea", { className: "submission-copy-preview", attrs: { "data-submission-copy": "true", readonly: "true", rows: "6", "aria-label": "待复制的投稿内容", hidden: "hidden" } }),
      node("div", { className: "submission-actions" }, [node("button", { className: "button", text: "复制内容并前往投稿入口", attrs: { type: "submit" } })])
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const lines = [
        "【HiFi 交易事件投稿】",
        `涉及账号：${values.accounts || "未填写"}`,
        `平台：${values.platform || "未填写"}`,
        `设备：${values.device || "未填写"}`,
        `事件日期：${values.date || "未填写"}`,
        "",
        "大致事发经过：",
        values.story || "未填写",
        "",
        "目前结果：",
        values.result || "未填写",
        "",
        "材料链接或说明：",
        values.materials || "未填写"
      ];
      if (values.moodTitle || values.moodNote || values.moodUrl) {
        lines.push("", "投稿者的心情：", `作品：${values.moodTitle || "未填写"}`, `心情：${values.moodNote || "未填写"}`, `原站链接：${values.moodUrl || "未填写"}`, `推荐起播：${values.moodStart ? `${values.moodStart} 秒` : "未填写"}`);
      }
      const text = lines.join("\n");
      const preview = form.querySelector("[data-submission-copy]");
      const status = form.querySelector("[data-submission-status]");
      preview.value = text;
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (_error) {
        preview.focus();
        preview.select();
        try { copied = document.execCommand("copy"); } catch (_fallbackError) { copied = false; }
      }
      if (!copied) {
        preview.hidden = false;
        status.textContent = "自动复制失败，请手动复制下方内容后，再点击投稿入口。";
        return;
      }
      status.textContent = "已复制，正在打开投稿入口…";
      window.location.href = submissionTarget.url;
    });
    submissionDialog.append(form);
    document.body.append(submissionDialog);
    return submissionDialog;
  }

  function openSubmissionDialog(entry) {
    const dialog = ensureSubmissionDialog();
    submissionTarget = entry;
    const form = dialog.querySelector("[data-submission-form]");
    form.reset();
    form.querySelector("[data-submission-status]").textContent = `提交后将前往：${entry.label}`;
    form.querySelector("[data-submission-copy]").value = "";
    dialog.showModal();
  }

  function eventHref(event) {
    const url = new URL("event.html", rootUrl);
    url.searchParams.set("id", event.id);
    return url.href;
  }

  function renderEventCard(event, index) {
    const accountText = event.accounts.length
      ? event.accounts.map((account) => `${account.displayName || "未注明账号"} · ${account.platform || "平台未注明"}`).join("；")
      : "未提供公开账号";
    const card = node("article", { className: "event-card" });
    card.append(
      node("span", { className: "card-index", text: `REC ${String(index + 1).padStart(2, "0")} · ${event.id}` }),
      node("h3", {}, node("a", { text: event.title || "未命名事件", attrs: { href: eventHref(event), "data-event-link": event.id } })),
      node("div", { className: "card-meta" }, [
        node("span", { className: "tag", text: accountText }),
        ...(event.devices || []).slice(0, 2).map((device) => node("span", { className: "tag", text: device }))
      ]),
      node("p", { className: "summary", text: event.summary || "尚未填写摘要。" }),
      node("div", { className: "card-footer" }, [
        node("span", { text: `事件日期 ${formatDate(event.eventDate)}` }),
        node("span", { text: `现状：${event.currentStatus || "待更新"}` }),
        ...(event.mood && event.mood.url ? [node("span", { className: "mood-note", text: "♫ 附投稿者的心情" })] : [])
      ])
    );
    return card;
  }

  function labeledLink(text, url, className = "") {
    const href = safeUrl(url);
    if (!href) return null;
    return node("a", { className, text, attrs: { href, target: "_blank", rel: "noopener noreferrer" } });
  }

  function section(title, children, subtitle = "") {
    const wrapper = node("section", { className: "detail-section" });
    const heading = node("h2", { text: title });
    if (subtitle) heading.append(node("small", { text: subtitle }));
    wrapper.append(heading, ...(Array.isArray(children) ? children : [children]));
    return wrapper;
  }

  function renderAccounts(event) {
    if (!event.accounts.length) return null;
    const list = node("ul", { className: "account-list" });
    event.accounts.forEach((account) => {
      const item = node("li", { className: "account-item" });
      item.append(node("strong", { text: account.displayName || "未注明账号" }));
      item.append(node("small", { text: account.platform || "平台未注明" }));
      const link = labeledLink("查看公开主页", account.profileUrl);
      if (link) item.append(link);
      list.append(item);
    });
    return section("涉及的公开账号", list, "仅按各来源分别记录，不自动认定跨平台账号属于同一人");
  }

  function openLightbox(src, caption, options = {}) {
    if (typeof options.onImage === "function") {
      options.onImage(src, caption);
      return;
    }
    const dialog = document.querySelector("[data-lightbox]");
    if (!dialog) return;
    const image = dialog.querySelector("img");
    const figcaption = dialog.querySelector("figcaption");
    image.src = src;
    image.alt = caption || "事件材料大图";
    figcaption.textContent = caption || "事件材料";
    dialog.showModal();
  }

  function renderMaterials(event, options = {}) {
    if (!event.materials.length) return null;
    const list = node("ul", { className: "material-list" });
    event.materials.forEach((material) => {
      const item = node("li", { className: "material-item" });
      if (material.type === "image" && material.path) {
        const resolveAsset = options.resolveAsset || assetUrl;
        const src = resolveAsset(material.path);
        const button = node("button", { className: "material-thumb", attrs: { type: "button", "aria-label": `放大查看：${material.title || "图片材料"}` } },
          node("img", { attrs: { src, alt: material.description || material.title || "事件图片材料", loading: options.preview ? "eager" : "lazy" } })
        );
        button.addEventListener("click", () => openLightbox(src, material.description || material.title, options));
        item.append(button);
      }
      const copy = node("div", { className: "material-copy" });
      copy.append(node("h3", { text: material.title || "未命名材料" }));
      if (material.description) copy.append(node("p", { text: material.description }));
      const sourceLink = labeledLink("查看材料原始来源", material.sourceUrl);
      const waterLink = labeledLink("查看对应水楼楼层", material.waterPostUrl);
      if (sourceLink) copy.append(sourceLink);
      if (sourceLink && waterLink) copy.append(document.createTextNode(" · "));
      if (waterLink) copy.append(waterLink);
      if (!sourceLink && !waterLink && material.type !== "image") copy.append(node("small", { text: "原始链接尚未提供" }));
      item.append(copy);
      list.append(item);
    });
    return section("相关材料与来源", list, "材料说明不等于网站对指控作出认定");
  }

  function renderTimeline(title, items, kind) {
    if (!items || !items.length) return null;
    const list = node("ol", { className: "timeline" });
    items.forEach((item) => {
      const entry = node("li", { className: "timeline-item" });
      const headingText = kind === "response" ? (item.party || "当事人回应") : formatDate(item.date);
      entry.append(node("strong", { text: headingText }));
      if (kind === "response" && item.date) entry.append(node("time", { text: formatDate(item.date), attrs: { datetime: item.date } }));
      entry.append(node("div", { className: "prose" }, node("p", { text: item.statement || item.text || "" })));
      const link = labeledLink("查看回应来源", item.sourceUrl);
      if (link) entry.append(link);
      list.append(entry);
    });
    return section(title, list);
  }

  function parseMedia(mood) {
    if (!mood || !safeUrl(mood.url)) return { kind: "link" };
    const source = new URL(mood.url);
    const start = Math.max(0, Number.parseInt(mood.startSeconds, 10) || 0);
    if (mood.platform === "youtube" || /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(source.hostname)) {
      let id = "";
      if (source.hostname.endsWith("youtu.be")) id = source.pathname.split("/").filter(Boolean)[0] || "";
      else if (source.pathname.startsWith("/shorts/")) id = source.pathname.split("/")[2] || "";
      else if (source.pathname.startsWith("/embed/")) id = source.pathname.split("/")[2] || "";
      else id = source.searchParams.get("v") || "";
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?start=${start}` };
    }
    if (mood.platform === "bilibili" || /(^|\.)bilibili\.com$|(^|\.)b23\.tv$/.test(source.hostname)) {
      const match = source.pathname.match(/\/(BV[A-Za-z0-9]+|av\d+)/i);
      if (match) {
        const token = match[1];
        const key = token.toLowerCase().startsWith("av") ? `aid=${token.slice(2)}` : `bvid=${token}`;
        return { kind: "bilibili", src: `https://player.bilibili.com/player.html?${key}&page=1&t=${start}&high_quality=1` };
      }
    }
    return { kind: "link" };
  }

  function renderMood(event) {
    const mood = event.mood;
    if (!mood || (!mood.title && !mood.note && !mood.url)) return null;
    const panel = node("section", { className: "detail-section" });
    const inner = node("div", { className: "mood-panel" });
    inner.append(node("p", { className: "eyebrow", text: "投稿者的心情" }));
    inner.append(node("h3", { text: mood.title || "未注明作品名称" }));
    if (mood.note) inner.append(node("p", { text: mood.note }));
    if (Number(mood.startSeconds) > 0) inner.append(node("p", { text: `推荐从 ${Number(mood.startSeconds)} 秒开始` }));
    const actions = node("div", { className: "media-actions" });
    const media = parseMedia(mood);
    if (["youtube", "bilibili"].includes(media.kind)) {
      const loadButton = node("button", { className: "button", text: "加载官方播放器", attrs: { type: "button" } });
      loadButton.addEventListener("click", () => {
        const shell = node("div", { className: "embed-shell" });
        const iframe = node("iframe", { attrs: {
          src: media.src,
          title: mood.title || "外部媒体播放器",
          loading: "lazy",
          allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
          referrerpolicy: "strict-origin-when-cross-origin",
          allowfullscreen: ""
        } });
        iframe.addEventListener("error", () => shell.replaceChildren(node("p", { className: "embed-error", text: "播放器暂时不可用，请使用原站链接观看。" })));
        shell.append(iframe);
        actions.after(shell);
        loadButton.remove();
      }, { once: true });
      actions.append(loadButton);
    }
    const original = labeledLink("前往原站观看", mood.url, "button secondary");
    if (original) actions.append(original);
    const backup = labeledLink("打开备用链接", mood.backupUrl, "button secondary");
    if (backup) actions.append(backup);
    inner.append(actions);
    panel.append(inner);
    return panel;
  }

  function renderEventDetail(event, container, options = {}) {
    container.replaceChildren();
    const article = node("article", { className: "event-detail" });
    const head = node("header", { className: "detail-head" });
    const kicker = node("div", { className: "detail-kicker" }, [
      node("span", { className: "tag", text: event.id }),
      node("span", { className: "tag", text: `更新 ${formatDate(event.updatedAt)}` })
    ]);
    head.append(kicker, node("h1", { text: event.title || "未命名事件" }), node("p", { className: "detail-summary", text: event.summary || "尚未填写摘要。" }));
    const facts = node("dl", { className: "detail-facts" });
    const factPairs = [
      ["事件日期", formatDate(event.eventDate)],
      ["相关设备", event.devices && event.devices.length ? event.devices.join("、") : "未提供"],
      ["当前情况", event.currentStatus || "待更新"],
      ["公开状态", event.status === "published" ? "公开展示" : event.status === "withdrawn" ? "已撤下" : "草稿"]
    ];
    factPairs.forEach(([label, value]) => facts.append(node("div", { className: "fact" }, [node("dt", { text: label }), node("dd", { text: value })])));
    head.append(facts);
    article.append(head);

    if (event.correctionNotice) article.append(node("section", { className: "detail-section" }, node("div", { className: "correction" }, [node("strong", { text: "补充或更正说明" }), node("div", { className: "prose" }, node("p", { text: event.correctionNotice }))])));
    if (event.withdrawalNotice) article.append(node("section", { className: "detail-section" }, node("div", { className: "correction withdrawal" }, [node("strong", { text: "撤回说明" }), node("div", { className: "prose" }, node("p", { text: event.withdrawalNotice }))])));
    const accountSection = renderAccounts(event);
    if (accountSection) article.append(accountSection);

    article.append(section("投稿者陈述与经过", node("div", { className: "prose" }, node("p", { text: event.narrative || "尚未提供完整经过。" })), "本区保留投稿者的陈述口径，不与材料事实或网站推断混写"));
    article.append(section("价格信息", node("div", { className: "price-pair" }, [
      node("div", {}, [node("small", { text: "挂牌价" }), node("strong", { text: event.listingPrice || "未提供" })]),
      node("div", {}, [node("small", { text: "实际成交价" }), node("strong", { text: event.transactionPrice || "未提供" })])
    ]), "挂牌价与实际成交价分开记录"));

    const materials = renderMaterials(event, options);
    const responses = renderTimeline("当事人回应", event.responses, "response");
    const updates = renderTimeline("后续更新", event.updates, "update");
    const mood = renderMood(event);
    [materials, responses, updates, mood].filter(Boolean).forEach((part) => article.append(part));

    if (!options.preview) {
      const tools = node("div", { className: "media-actions" });
      const share = node("button", { className: "button", text: "复制此事件链接", attrs: { type: "button" } });
      share.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          toast("固定链接已复制");
        } catch (_error) {
          window.prompt("复制这个固定链接", window.location.href);
        }
      });
      tools.append(share);
      article.append(section("分享与引用", tools, "事件标识保持不变时，链接可长期使用"));
    }
    container.append(article);
  }

  function toast(message) {
    const element = document.querySelector("[data-toast]");
    if (!element) return;
    element.textContent = message;
    element.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2400);
  }

  async function initHome() {
    const list = document.querySelector("[data-event-list]");
    try {
      if ("scrollRestoration" in history) history.scrollRestoration = "manual";
      const data = await loadSiteData();
      renderSiteMeta(data);
      renderSubmissionActions(data);
      const events = data.events.filter((event) => event.status === "published").sort((a, b) => a.order - b.order || String(b.updatedAt).localeCompare(String(a.updatedAt)));
      const search = document.querySelector("[data-event-search]");
      const filter = () => {
        const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const shown = events.filter((event) => {
          const haystack = [event.title, event.summary, event.narrative, event.currentStatus,
            ...(event.accounts || []).flatMap((account) => [account.displayName, account.platform]),
            ...(event.devices || [])].filter(Boolean).join(" ").toLocaleLowerCase();
          return terms.every((term) => haystack.includes(term));
        });
        list.replaceChildren(...shown.map(renderEventCard));
        list.setAttribute("aria-busy", "false");
        document.querySelector("[data-result-count]").textContent = terms.length ? `找到 ${shown.length} 条 · 共 ${events.length} 条` : `${events.length} 条公开记录`;
        document.querySelector("[data-empty-state]").hidden = shown.length !== 0;
        document.querySelector("[data-empty-title]").textContent = terms.length ? "没有匹配的事件" : "暂时没有公开事件";
        document.querySelector("[data-empty-description]").textContent = terms.length ? "试试账号昵称、设备型号或经过中的其他词。" : "撤下或草稿记录不会出现在这里。";
        document.querySelectorAll("[data-event-link]").forEach((link) => link.addEventListener("click", () => sessionStorage.setItem("hifi-event-list-scroll", String(window.scrollY))));
      };
      const query = new URLSearchParams(window.location.search).get("q");
      if (query) search.value = query;
      search.addEventListener("input", () => {
        const url = new URL(window.location.href);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim());
        else url.searchParams.delete("q");
        history.replaceState(null, "", url);
        filter();
      });
      filter();
      document.querySelector("[data-demo-notice]").hidden = !data.isDemo;
      const savedScroll = Number(sessionStorage.getItem("hifi-event-list-scroll"));
      if (savedScroll > 0) {
        const restore = () => window.scrollTo({ top: savedScroll, behavior: "instant" });
        requestAnimationFrame(() => {
          restore();
          window.setTimeout(restore, 80);
        });
      }
    } catch (error) {
      list.setAttribute("aria-busy", "false");
      list.replaceChildren(node("div", { className: "error-card" }, [node("h2", { text: "无法读取事件数据" }), node("p", { text: error.message })]));
    }
  }

  async function initEvent() {
    const container = document.querySelector("#event-content");
    try {
      const data = await loadSiteData();
      renderSiteMeta(data);
      renderSubmissionActions(data);
      const id = new URLSearchParams(window.location.search).get("id") || "";
      const event = data.events.find((item) => item.id === id && item.status === "published");
      if (!event) throw new Error("该事件不存在、尚未公开或已经撤下。返回列表可查看当前公开记录。");
      renderEventDetail(event, container);
      container.setAttribute("aria-busy", "false");
      document.title = `${event.title} · ${data.site.name || "HiFi 交易事件簿"}`;
    } catch (error) {
      container.setAttribute("aria-busy", "false");
      container.replaceChildren(node("div", { className: "error-card" }, [node("h1", { text: "无法打开这条记录" }), node("p", { text: error.message }), node("a", { className: "button", text: "返回事件列表", attrs: { href: new URL("index.html", rootUrl).href } })]));
    }
  }

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-lightbox-close]")) event.target.closest("dialog").close();
    if (event.target.matches("dialog[data-lightbox]")) event.target.close();
  });

  window.HifiSite = { node, safeUrl, assetUrl, formatDate, normalizeData, loadSiteData, parseMedia, renderEventDetail, renderEventCard, renderSiteMeta, renderSubmissionActions };
  initTheme();
  if (page === "home") initHome();
  if (page === "event") initEvent();
})();
