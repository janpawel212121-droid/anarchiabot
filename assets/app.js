const config = window.HEARTFARM_CONFIG || {};

const state = {
    supabase: null,
    user: null,
    session: null,
    bases: {},
    editingBaseId: null,
    currentBaseId: null,
    currentBaseType: null,
    baseLogs: {},
    refreshTimer: null,
    subscriptions: [],
};

const ui = {
    authScreen: document.getElementById("auth-screen"),
    authForm: document.getElementById("auth-form"),
    authEmail: document.getElementById("auth-email"),
    authPass: document.getElementById("auth-pass"),
    authError: document.getElementById("auth-error"),
    authNote: document.getElementById("auth-note"),
    setupPanel: document.getElementById("setup-panel"),
    app: document.getElementById("app"),
    sessionUser: document.getElementById("session-user"),
    statusBanner: document.getElementById("status-banner"),
    overviewTotalBases: document.getElementById("overview-total-bases"),
    overviewTotalVictims: document.getElementById("overview-total-victims"),
    overviewTotalKillers: document.getElementById("overview-total-killers"),
    dashboardView: document.getElementById("dashboard-view"),
    panelView: document.getElementById("panel-view"),
    victimsContainer: document.getElementById("victims-container"),
    killersContainer: document.getElementById("killers-container"),
    emptyDashboard: document.getElementById("empty-dashboard"),
    baseTitle: document.getElementById("base-title"),
    controlsArea: document.getElementById("controls-area"),
    logBox: document.getElementById("log-box"),
    closeBaseLink: document.getElementById("close-base-link"),
    openConsoleBtn: document.getElementById("open-console-btn"),
    closeConsoleBtn: document.getElementById("close-console-btn"),
    refreshLogsBtn: document.getElementById("refresh-logs-btn"),
    consoleModal: document.getElementById("console-modal"),
    sysLogTab: document.getElementById("sys-log-tab"),
    webLogTab: document.getElementById("web-log-tab"),
    editModal: document.getElementById("edit-modal"),
    editName: document.getElementById("edit-name"),
    editOwner: document.getElementById("edit-owner"),
    editProxy: document.getElementById("edit-proxy"),
    editProxy2: document.getElementById("edit-proxy2"),
    proxy2Container: document.getElementById("proxy2-container"),
    saveEditBtn: document.getElementById("save-edit-btn"),
    cancelEditBtn: document.getElementById("cancel-edit-btn"),
    addKillerModal: document.getElementById("add-killer-modal"),
    newBot: document.getElementById("new_bot"),
    newBotOwner: document.getElementById("new_bot_owner"),
    newBotVictim: document.getElementById("new_bot_victim"),
    saveBotBtn: document.getElementById("save-bot-btn"),
    cancelBotBtn: document.getElementById("cancel-bot-btn"),
    logoutBtn: document.getElementById("logout-btn"),
};

bootstrap().catch((error) => {
    console.error(error);
    setStatus(`Blad startu aplikacji: ${error.message}`, true);
});

async function bootstrap() {
    bindGlobalEvents();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
        ui.authNote.textContent = "Brak konfiguracji Supabase. Uzupelnij plik supabase-config.js i odswiez strone.";
        ui.setupPanel.classList.remove("hidden");
        return;
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    });

    const { data: authData } = await state.supabase.auth.getSession();
    await handleSession(authData.session);

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
        await handleSession(session);
    });
}

function bindGlobalEvents() {
    ui.authForm.addEventListener("submit", onLoginSubmit);
    ui.closeBaseLink.addEventListener("click", (event) => {
        event.preventDefault();
        closeBase();
    });
    ui.openConsoleBtn.addEventListener("click", openConsoleModal);
    ui.closeConsoleBtn.addEventListener("click", closeConsoleModal);
    ui.refreshLogsBtn.addEventListener("click", loadLogs);
    ui.saveEditBtn.addEventListener("click", saveEdit);
    ui.cancelEditBtn.addEventListener("click", closeEditModal);
    ui.saveBotBtn.addEventListener("click", addBot);
    ui.cancelBotBtn.addEventListener("click", closeAddKillerModal);
    ui.logoutBtn.addEventListener("click", logout);

    document.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => showTab(button.dataset.tab));
    });

    window.openBase = openBase;
    window.openEditModal = (_event, id) => openEditModal(id);
    window.toggleBaseRotation = toggleBaseRotation;
    window.setTpaDelay = setTpaDelay;
    window.unpauseBase = () => queueCommand("unpause_base");
    window.startVictims = startVictims;
    window.startMassVictims = startMassVictims;
    window.sendMassTPA = sendMassTPA;
    window.stopVictims = () => queueCommand("stop_victims");
    window.openAddKillerModal = openAddKillerModal;
    window.closeAddKillerModal = closeAddKillerModal;
    window.cmd = cmd;
    window.deleteAllBots = deleteAllBots;
}

async function onLoginSubmit(event) {
    event.preventDefault();
    ui.authError.textContent = "";

    if (!state.supabase) {
        ui.authError.textContent = "Supabase nie jest jeszcze gotowy.";
        return;
    }

    const email = ui.authEmail.value.trim();
    const password = ui.authPass.value;

    const { error } = await state.supabase.auth.signInWithPassword({ email, password });
    if (error) {
        ui.authError.textContent = error.message;
    }
}

async function logout() {
    if (!state.supabase) return;
    await state.supabase.auth.signOut();
}

async function handleSession(session) {
    state.session = session;
    state.user = session?.user || null;

    if (!session) {
        teardownLiveData();
        ui.app.classList.add("hidden");
        ui.authScreen.classList.remove("hidden");
        ui.sessionUser.textContent = "";
        return;
    }

    ui.authScreen.classList.add("hidden");
    ui.app.classList.remove("hidden");
    ui.sessionUser.textContent = session.user.email || "Zalogowany uzytkownik";

    await loadAllData();
    await loadLogs();
    setupLiveData();

    const initialBaseId = getRequestedBaseId();
    if (initialBaseId && state.bases[initialBaseId]) {
        openBase(initialBaseId);
    }
}

function setupLiveData() {
    teardownLiveData();

    if (!state.supabase) return;

    const channel = state.supabase
        .channel("heartfarm-panel")
        .on("postgres_changes", { event: "*", schema: "public", table: "bases" }, onDatabaseChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "victim_stats" }, onDatabaseChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "victim_hearts" }, onDatabaseChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "killer_bots" }, onDatabaseChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "system_logs" }, () => loadLogs())
        .on("postgres_changes", { event: "*", schema: "public", table: "web_logs" }, () => loadLogs())
        .subscribe();

    state.subscriptions.push(channel);

    const pollMs = Number(config.pollMs || 15000);
    state.refreshTimer = window.setInterval(() => {
        loadAllData().catch((error) => console.error("Refresh error", error));
        loadLogs().catch((error) => console.error("Log refresh error", error));
    }, pollMs);
}

function teardownLiveData() {
    if (state.refreshTimer) {
        window.clearInterval(state.refreshTimer);
        state.refreshTimer = null;
    }

    if (state.supabase && state.subscriptions.length) {
        state.subscriptions.forEach((channel) => state.supabase.removeChannel(channel));
    }
    state.subscriptions = [];
}

async function onDatabaseChange() {
    await loadAllData();
}

async function loadAllData() {
    if (!state.supabase) return;

    const [basesRes, victimStatsRes, victimHeartsRes, killerBotsRes] = await Promise.all([
        state.supabase.from("bases").select("*").order("id"),
        state.supabase.from("victim_stats").select("*"),
        state.supabase.from("victim_hearts").select("*").order("nick"),
        state.supabase.from("killer_bots").select("*").order("username"),
    ]);

    throwIfError(basesRes.error, "Nie udalo sie pobrac baz");
    throwIfError(victimStatsRes.error, "Nie udalo sie pobrac statystyk ofiar");
    throwIfError(victimHeartsRes.error, "Nie udalo sie pobrac historii serc");
    throwIfError(killerBotsRes.error, "Nie udalo sie pobrac listy botow");

    const victimStatsMap = Object.fromEntries((victimStatsRes.data || []).map((row) => [row.base_id, row]));
    const heartsMap = {};
    for (const row of victimHeartsRes.data || []) {
        if (!heartsMap[row.base_id]) heartsMap[row.base_id] = {};
        heartsMap[row.base_id][row.nick] = row.hearts;
    }

    const killerBotsMap = {};
    for (const row of killerBotsRes.data || []) {
        if (!killerBotsMap[row.base_id]) killerBotsMap[row.base_id] = [];
        killerBotsMap[row.base_id].push(row);
    }

    const nextBases = {};
    for (const base of basesRes.data || []) {
        if (base.type === "victim") {
            const stats = victimStatsMap[base.id] || {};
            nextBases[base.id] = {
                id: base.id,
                type: base.type,
                name: base.name,
                owner: base.owner || "",
                proxy: base.proxy || "",
                proxy2: base.proxy2 || "",
                rotationEnabled: base.rotation_enabled !== false,
                tpaDelay: base.tpa_delay ?? 16,
                extraInfo: base.extra_info || "",
                vStats: {
                    joined: stats.joined ?? 0,
                    killed: stats.killed ?? 0,
                    banned: stats.banned ?? 0,
                    queue: stats.queue ?? 0,
                    activeBot: stats.active_bot ?? null,
                    activeHearts: stats.active_hearts ?? 0,
                    targetDisplay: stats.target_display ?? "",
                    note: stats.note ?? "",
                    heartsList: heartsMap[base.id] || {},
                },
            };
        } else {
            const bots = killerBotsMap[base.id] || [];
            nextBases[base.id] = {
                id: base.id,
                type: base.type,
                name: base.name,
                owner: base.owner || "",
                proxy: base.proxy || "",
                rotationEnabled: base.rotation_enabled !== false,
                tpaDelay: base.tpa_delay ?? 16,
                panel1: base.panel1 || "",
                panel2: base.panel2 || "",
                panel3: base.panel3 || "",
                onlineBots: bots.filter((bot) => bot.status === "Online").length,
                totalBots: bots.length,
                bots,
            };
        }
    }

    state.bases = nextBases;
    renderDashboard();

    if (state.currentBaseId && state.bases[state.currentBaseId]) {
        openBase(state.currentBaseId, { preserveScroll: true });
    }
}

async function loadLogs() {
    if (!state.supabase || !state.user) return;

    const [sysRes, webRes, commandRes] = await Promise.all([
        state.supabase.from("system_logs").select("*").order("created_at", { ascending: false }).limit(200),
        state.supabase.from("web_logs").select("*").order("created_at", { ascending: false }).limit(200),
        state.supabase.from("command_queue").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    throwIfError(sysRes.error, "Nie udalo sie pobrac logow systemowych");
    throwIfError(webRes.error, "Nie udalo sie pobrac logow strony");
    throwIfError(commandRes.error, "Nie udalo sie pobrac kolejki komend");

    const sysLogs = (sysRes.data || []).slice().reverse().map(formatLogLine);
    const webLogs = (webRes.data || []).slice().reverse().map(formatLogLine);

    ui.sysLogTab.innerHTML = sysLogs.length ? sysLogs.map((line) => `<div>${escapeHtml(line)}</div>`).join("") : "<div>Brak logow systemowych.</div>";
    ui.webLogTab.innerHTML = webLogs.length ? webLogs.map((line) => `<div>${escapeHtml(line)}</div>`).join("") : "<div>Brak logow strony.</div>";

    const groupedCommands = {};
    for (const row of commandRes.data || []) {
        if (!groupedCommands[row.base_id]) groupedCommands[row.base_id] = [];
        groupedCommands[row.base_id].push(formatCommandLine(row));
    }
    state.baseLogs = groupedCommands;

    if (state.currentBaseId) {
        renderBaseLogs(state.currentBaseId);
    }
}

function formatLogLine(row) {
    const stamp = formatDateTime(row.created_at);
    return `[${stamp}] ${row.message}`;
}

function formatCommandLine(row) {
    const stamp = formatDateTime(row.created_at);
    const who = row.username ? `${row.username} / ` : "";
    return `[${stamp}] ${who}${row.command} [${row.status}]`;
}

function renderDashboard() {
    const entries = Object.values(state.bases);
    const victims = entries.filter((base) => base.type === "victim");
    const killers = entries.filter((base) => base.type === "killer");

    renderOverview(entries, victims, killers);
    ui.victimsContainer.innerHTML = victims.map(renderVictimCard).join("");
    ui.killersContainer.innerHTML = killers.map(renderKillerCard).join("");
    ui.emptyDashboard.classList.toggle("hidden", entries.length > 0);
}

function renderOverview(entries, victims, killers) {
    ui.overviewTotalBases.textContent = String(entries.length);
    ui.overviewTotalVictims.textContent = String(victims.length);
    ui.overviewTotalKillers.textContent = String(killers.length);
}

function renderVictimCard(base) {
    const stripColor = base.id === "v1" ? "#3b82f6" : base.id === "v2" ? "#f59e0b" : base.id === "v3" ? "#22c55e" : "#a855f7";
    return `
        <article class="card" style="border-top: 4px solid ${stripColor};">
            <div class="card-hotline">
                <div onclick="openBase('${escapeAttr(base.id)}')">
                    <div class="card-title">${escapeHtml(base.name)}</div>
                    <div class="card-owner">${escapeHtml(base.owner || "Brak wlasciciela")}</div>
                </div>
                <button class="card-edit" type="button" onclick="openEditModal(event, '${escapeAttr(base.id)}')">Edytuj</button>
            </div>
            <div class="stats">
                <div class="stat-item"><div class="stat-val">${base.vStats.joined}</div><div class="stat-lbl">Weszlo</div></div>
                <div class="stat-item"><div class="stat-val">${base.vStats.killed}</div><div class="stat-lbl">Zabite</div></div>
                <div class="stat-item"><div class="stat-val">${base.vStats.banned}</div><div class="stat-lbl">Bany</div></div>
                <div class="stat-item"><div class="stat-val">${base.vStats.queue}</div><div class="stat-lbl">Kolejka</div></div>
            </div>
        </article>
    `;
}

function renderKillerCard(base) {
    return `
        <article class="card" style="border-top: 4px solid #ef4444;">
            <div class="card-hotline">
                <div onclick="openBase('${escapeAttr(base.id)}')">
                    <div class="card-title">${escapeHtml(base.name)}</div>
                    <div class="card-owner">${escapeHtml(base.owner || "Brak wlasciciela")}</div>
                </div>
                <button class="card-edit" type="button" onclick="openEditModal(event, '${escapeAttr(base.id)}')">Edytuj</button>
            </div>
            <div class="stats">
                <div class="stat-item"><div class="stat-val">${base.onlineBots}</div><div class="stat-lbl">Online</div></div>
                <div class="stat-item"><div class="stat-val">${base.totalBots}</div><div class="stat-lbl">Wszystkie</div></div>
            </div>
        </article>
    `;
}

function openBase(id, options = {}) {
    const base = state.bases[id];
    if (!base) return;

    state.currentBaseId = id;
    state.currentBaseType = base.type;
    ui.dashboardView.classList.add("hidden");
    ui.panelView.classList.remove("hidden");
    ui.baseTitle.textContent = base.name;

    const basePath = getBaseUrlPath();
    history.replaceState({}, "", `${basePath}/baza/${id}`);

    if (base.type === "victim") {
        renderVictimPanel(base);
    } else {
        renderKillerPanel(base);
    }
    renderBaseLogs(id);

    if (!options.preserveScroll) {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

function closeBase() {
    state.currentBaseId = null;
    state.currentBaseType = null;
    ui.panelView.classList.add("hidden");
    ui.dashboardView.classList.remove("hidden");
    history.replaceState({}, "", `${getBaseUrlPath()}/baza/k1.html`);
}

function renderVictimPanel(base) {
    const heartsRows = Object.entries(base.vStats.heartsList || {})
        .map(([nick, hearts]) => `<div class="heart-row"><span>${escapeHtml(nick)}</span><strong>${hearts}</strong></div>`)
        .join("") || "<div class=\"muted\">Brak zapisanej historii serc.</div>";

    ui.controlsArea.innerHTML = `
        <button class="${base.rotationEnabled ? "btn-primary" : "btn-danger"}" type="button" onclick="toggleBaseRotation()">
            ${base.rotationEnabled ? "Rotacja mordercow: wlaczona" : "Rotacja mordercow: wylaczona"}
        </button>
        <div class="info-stack">
            <div class="info-card">
                <div class="eyebrow">Aktywny zabojca</div>
                <div>${escapeHtml(base.vStats.targetDisplay || "Brak")}</div>
            </div>
            <div class="info-card">
                <div class="eyebrow">Aktywna ofiara</div>
                <div>${escapeHtml(base.vStats.activeBot || "Brak")}</div>
            </div>
            <div class="info-card">
                <div class="eyebrow">Historia serc</div>
                <div>${heartsRows}</div>
            </div>
            <div class="info-card">
                <div class="eyebrow">Dodatkowe info</div>
                <div>${escapeHtml(base.extraInfo || base.vStats.note || "Brak dodatkowych danych.")}</div>
            </div>
        </div>

        <label for="tpa_delay_input">Opoznienie TPA po zalogowaniu (sekundy)</label>
        <div class="modal-actions">
            <input type="number" id="tpa_delay_input" min="1" max="120" value="${escapeAttr(base.tpaDelay)}">
            <button class="btn-sec btn-small" type="button" onclick="setTpaDelay()">Zapisz</button>
        </div>

        <button class="btn-mass" type="button" onclick="unpauseBase()">Odmroz kolejke recznie</button>

        <div class="section-title">Standardowa kolejka</div>
        <p class="control-note">Te akcje wpisuja komendy do tabeli <code>command_queue</code>. Twoj worker botow powinien je odbierac i wykonywac.</p>
        <label for="tpa_rotation">Docelowa rotacja / reczny cel TPA</label>
        <select id="tpa_rotation">
            <option value="v1" ${base.id === "v1" ? "selected" : ""}>Kolejka ofiar #1</option>
            <option value="v2" ${base.id === "v2" ? "selected" : ""}>Kolejka ofiar #2</option>
            <option value="v3" ${base.id === "v3" ? "selected" : ""}>Kolejka ofiar #3</option>
            <option value="custom">Reczny cel TPA</option>
        </select>
        <label for="standard_tpa_target">Nick gracza dla stalego TPA</label>
        <input type="text" id="standard_tpa_target" placeholder="Nick gracza">
        <label for="victim_nicks">Nicky ofiar (format nick1:nick2:nick3)</label>
        <textarea id="victim_nicks" placeholder="Bot1:Bot2:Bot3"></textarea>
        <button class="btn-primary" type="button" onclick="startVictims()">Uruchom zwykla kolejke</button>

        <div class="section-title">Masowy atak</div>
        <button class="btn-mass" type="button" onclick="startMassVictims()">1. Wpusc boty</button>
        <label for="mass_tpa_target">Docelowy nick dla masowego TPA</label>
        <div class="modal-actions">
            <input type="text" id="mass_tpa_target" placeholder="Nick gracza">
            <button class="btn-mass btn-small" type="button" onclick="sendMassTPA()">2. Wyslij TPA</button>
        </div>

        <button class="btn-danger" type="button" onclick="stopVictims()">Zatrzymaj kolejke</button>
    `;
}

function renderKillerPanel(base) {
    const botList = (base.bots || []).map((bot) => {
        const statusClass = bot.status === "Online" ? "online" : "offline";
        return `
            <div class="list-item">
                <div style="flex:1; min-width:200px; border-left:3px solid ${escapeAttr(bot.color || getFallbackColor(bot.username))}; padding-left:10px;">
                    <strong>${escapeHtml(bot.username)}</strong>
                    <div class="muted" style="margin-top:6px;">
                        <span class="pill">${escapeHtml(bot.assigned_victim || "Brak rotacji")}</span>
                        <span>${escapeHtml(bot.owner || "Brak wlasciciela")}</span>
                    </div>
                    <div class="${statusClass}" style="margin-top:8px; font-weight:800;">Status: ${escapeHtml(bot.status || "Offline")}</div>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                    <button class="btn-primary btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'reconnect')">Polacz</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'tpa_custom')">TPA</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'bij')">Bij</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'toggleReconnect')">Rec</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'spawn')">/spawn</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'tpaccept')">/tpaccept</button>
                    <button class="btn-sec btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'drop_hearts')">Drop serc</button>
                    <button class="btn-danger btn-small" type="button" onclick="cmd('${escapeAttr(bot.username)}', 'delete')">Usun</button>
                </div>
            </div>
        `;
    }).join("") || "<div class=\"muted\">Brak mordercow w tej bazie.</div>";

    ui.controlsArea.innerHTML = `
        <div class="info-stack">
            <div class="info-card"><div class="eyebrow">Panel A</div><div>${escapeHtml(base.panel1 || "Brak danych.")}</div></div>
            <div class="info-card"><div class="eyebrow">Panel B</div><div>${escapeHtml(base.panel2 || "Brak danych.")}</div></div>
            <div class="info-card"><div class="eyebrow">Panel C</div><div>${escapeHtml(base.panel3 || "Brak danych.")}</div></div>
        </div>

        <label for="killer_tpa_target">Cel do recznego TPA</label>
        <input type="text" id="killer_tpa_target" placeholder="Nick gracza">

        <div class="modal-actions">
            <button class="btn-primary" type="button" onclick="openAddKillerModal()">Dodaj nowego morderce</button>
            <button class="btn-danger" type="button" onclick="deleteAllBots()">Usun wszystkich stad</button>
        </div>

        <div class="section-title">Lista botow</div>
        <div id="bot-list">${botList}</div>
    `;
}

function renderBaseLogs(baseId) {
    const lines = state.baseLogs[baseId] || [];
    ui.logBox.innerHTML = lines.length ? lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("") : "<div>Brak logow dla tej bazy.</div>";
    ui.logBox.scrollTop = ui.logBox.scrollHeight;
}

function openEditModal(id) {
    const base = state.bases[id];
    if (!base) return;

    state.editingBaseId = id;
    ui.editName.value = base.name || "";
    ui.editOwner.value = base.owner || "";
    ui.editProxy.value = base.proxy || "";
    ui.editProxy2.value = base.proxy2 || "";
    ui.proxy2Container.classList.toggle("hidden", base.type !== "victim");
    ui.editModal.style.display = "flex";
}

function closeEditModal() {
    state.editingBaseId = null;
    ui.editModal.style.display = "none";
}

async function saveEdit() {
    const id = state.editingBaseId;
    if (!id || !state.supabase) return;
    const current = state.bases[id];

    const payload = {
        name: ui.editName.value.trim(),
        owner: ui.editOwner.value.trim() || null,
        proxy: ui.editProxy.value.trim() || null,
        proxy2: current.type === "victim" ? (ui.editProxy2.value.trim() || null) : null,
    };

    const res = await state.supabase.from("bases").update(payload).eq("id", id);
    throwIfError(res.error, "Nie udalo sie zapisac bazy");

    await appendSystemLog(`Zapisano baze ${id}.`);
    closeEditModal();
    await loadAllData();
}

function openAddKillerModal() {
    ui.newBot.value = "";
    ui.newBotOwner.value = "";
    ui.newBotVictim.value = "";
    ui.addKillerModal.style.display = "flex";
}

function closeAddKillerModal() {
    ui.addKillerModal.style.display = "none";
}

async function addBot() {
    if (!state.currentBaseId || !state.supabase) return;
    const username = ui.newBot.value.trim();
    if (!username) return;

    const payload = {
        base_id: state.currentBaseId,
        username,
        owner: ui.newBotOwner.value.trim() || null,
        assigned_victim: ui.newBotVictim.value || null,
        status: "Offline",
        is_hitting: false,
        auto_reconnect: false,
        color: getFallbackColor(username),
    };

    const res = await state.supabase.from("killer_bots").insert(payload);
    throwIfError(res.error, "Nie udalo sie dodac bota");

    await queueCommand("add_bot", { username, owner: payload.owner, assignedVictim: payload.assigned_victim }, false);
    closeAddKillerModal();
    await loadAllData();
}

async function toggleBaseRotation() {
    const base = state.bases[state.currentBaseId];
    if (!base || !state.supabase) return;
    const nextValue = !base.rotationEnabled;

    const res = await state.supabase.from("bases").update({ rotation_enabled: nextValue }).eq("id", base.id);
    throwIfError(res.error, "Nie udalo sie przelaczyc rotacji");

    await appendSystemLog(`Rotacja dla ${base.id}: ${nextValue ? "wlaczona" : "wylaczona"}.`);
    await loadAllData();
}

async function setTpaDelay() {
    if (!state.currentBaseId || !state.supabase) return;
    const input = document.getElementById("tpa_delay_input");
    const delay = Number(input?.value || 16);

    const res = await state.supabase.from("bases").update({ tpa_delay: delay }).eq("id", state.currentBaseId);
    throwIfError(res.error, "Nie udalo sie zapisac opoznienia TPA");

    await appendSystemLog(`Ustawiono opoznienie TPA dla ${state.currentBaseId} na ${delay}s.`);
    setStatus(`Zapisano opoznienie TPA: ${delay}s`);
    await loadAllData();
}

async function startVictims() {
    const nicks = collectNickList(document.getElementById("victim_nicks")?.value || "");
    if (!nicks.length) {
        setStatus("Podaj przynajmniej jeden nick ofiary.", true);
        return;
    }

    const rotationValue = document.getElementById("tpa_rotation")?.value || "";
    const tpaTarget = document.getElementById("standard_tpa_target")?.value.trim() || null;

    await queueCommand("start_victims", {
        nicks,
        targetRotation: rotationValue === "custom" ? null : rotationValue,
        tpaTarget: rotationValue === "custom" ? tpaTarget : null,
    });
}

async function startMassVictims() {
    const nicks = collectNickList(document.getElementById("victim_nicks")?.value || "");
    if (!nicks.length) {
        setStatus("Podaj przynajmniej jeden nick ofiary.", true);
        return;
    }

    await queueCommand("start_mass_victims", { nicks });
}

async function sendMassTPA() {
    const target = document.getElementById("mass_tpa_target")?.value.trim();
    if (!target) {
        setStatus("Podaj docelowy nick dla masowego TPA.", true);
        return;
    }

    await queueCommand("send_mass_tpa", { target });
}

async function cmd(username, command) {
    if (!state.currentBaseId) return;

    if (command === "delete") {
        const res = await state.supabase.from("killer_bots").delete().eq("base_id", state.currentBaseId).eq("username", username);
        throwIfError(res.error, "Nie udalo sie usunac bota");
        await queueCommand("delete_bot", { username });
        await loadAllData();
        return;
    }

    const payload = { username };
    if (command === "tpa_custom") {
        payload.target = document.getElementById("killer_tpa_target")?.value.trim() || null;
    }

    await queueCommand(command, payload);
}

async function deleteAllBots() {
    if (!state.currentBaseId) return;
    const res = await state.supabase.from("killer_bots").delete().eq("base_id", state.currentBaseId);
    throwIfError(res.error, "Nie udalo sie usunac wszystkich botow");
    await queueCommand("delete_all_bots", {}, false);
    await appendSystemLog(`Usunieto wszystkie boty z bazy ${state.currentBaseId}.`);
    await loadAllData();
}

async function queueCommand(command, payload = {}, log = true) {
    if (!state.currentBaseId || !state.supabase) return;

    const commandPayload = {
        base_id: state.currentBaseId,
        username: payload.username || null,
        command,
        payload,
        status: "pending",
        created_by: state.user?.id || null,
    };

    const res = await state.supabase.from("command_queue").insert(commandPayload);
    throwIfError(res.error, "Nie udalo sie zapisac komendy");

    if (log) {
        await appendSystemLog(`Dodano komende ${command} dla bazy ${state.currentBaseId}.`);
    }

    setStatus(`Dodano komende: ${command}`);
    await loadLogs();
}

async function appendSystemLog(message) {
    if (!state.supabase) return;
    const res = await state.supabase.from("system_logs").insert({ message, created_by: state.user?.id || null });
    throwIfError(res.error, "Nie udalo sie zapisac logu systemowego");
}

function openConsoleModal() {
    ui.consoleModal.style.display = "flex";
    showTab("sys-log-tab");
}

function closeConsoleModal() {
    ui.consoleModal.style.display = "none";
}

function showTab(tabId) {
    ui.sysLogTab.classList.toggle("hidden", tabId !== "sys-log-tab");
    ui.webLogTab.classList.toggle("hidden", tabId !== "web-log-tab");
}

function collectNickList(raw) {
    return raw.split(":").map((value) => value.trim()).filter(Boolean);
}

function getFallbackColor(seed) {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = seed.charCodeAt(index) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 70%, 62%)`;
}

function getBaseUrlPath() {
    return window.location.pathname.replace(/\/baza\/[^/]+$/, "").replace(/\/index\.html$/, "").replace(/\/$/, "");
}

function getRequestedBaseId() {
    const pathMatch = window.location.pathname.match(/\/baza\/([^/]+)/);
    if (pathMatch && pathMatch[1] && pathMatch[1] !== "k1.html" && pathMatch[1] !== "k1") {
        return pathMatch[1];
    }

    const params = new URLSearchParams(window.location.search);
    return params.get("base");
}

function setStatus(message, isError = false) {
    ui.statusBanner.textContent = message;
    ui.statusBanner.classList.remove("hidden");
    ui.statusBanner.style.borderColor = isError ? "rgba(239,68,68,0.35)" : "rgba(59,130,246,0.24)";
    ui.statusBanner.style.background = isError ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)";
    ui.statusBanner.style.color = isError ? "#fecaca" : "#dbeafe";
}

function throwIfError(error, fallbackMessage) {
    if (!error) return;
    throw new Error(`${fallbackMessage}: ${error.message}`);
}

function formatDateTime(value) {
    if (!value) return "--:--:--";
    return new Date(value).toLocaleString("pl-PL");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
}
