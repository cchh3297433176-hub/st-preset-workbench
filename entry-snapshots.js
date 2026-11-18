import { promptManager } from '/scripts/openai.js';

const storageKey = 'presetWorkbenchEntrySnapshots';

function activePreset() {
    const context = window.SillyTavern?.getContext?.();
    if (context?.mainApi !== 'openai' || !promptManager?.activeCharacter) {
        throw new Error('请先在酒馆中选用聊天补全预设');
    }
    const manager = context.getPresetManager('openai');
    const name = manager.getSelectedPresetName();
    if (!name) throw new Error('请先选中要保存开关的预设');
    const order = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter);
    const entries = order.filter(({ identifier }) => {
        const prompt = promptManager.getPromptById(identifier);
        return prompt && promptManager.isPromptToggleAllowed(prompt);
    });
    return { context, name, entries };
}

function savedSnapshots(context) {
    const records = context.extensionSettings[storageKey];
    return Array.isArray(records) ? records : [];
}

function storeSnapshots(context, records) {
    context.extensionSettings[storageKey] = records;
    context.saveSettingsDebounced();
}

function makeButton(label, click) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button';
    button.textContent = label;
    button.addEventListener('click', click);
    return button;
}

function buildSnapshotPanel() {
    const panel = document.createElement('details');
    panel.id = 'preset-workbench-snapshots';
    panel.innerHTML = `
        <summary>预设快照</summary>
        <div class="snapshot-body">
            <p class="snapshot-preset"></p>
            <form class="snapshot-form">
                <input type="text" class="text_pole" aria-label="快照名称" placeholder="例如：角色甲" maxlength="60" required>
                <button class="menu_button" type="submit">保存当前开关</button>
            </form>
            <p class="snapshot-feedback" role="status"></p>
            <div class="snapshot-list"></div>
        </div>
    `;
    const summary = panel.querySelector('.snapshot-preset');
    const form = panel.querySelector('.snapshot-form');
    const input = form.querySelector('input');
    const feedback = panel.querySelector('.snapshot-feedback');
    const list = panel.querySelector('.snapshot-list');

    let openedPreset;
    function current() {
        const live = activePreset();
        if (openedPreset && live.name !== openedPreset) {
            throw new Error('酒馆已切换预设，请收起后重新展开预设快照');
        }
        return live;
    }
    function reportError(error) {
        feedback.textContent = error.message;
    }
    function draw() {
        const { context, name, entries } = current();
        openedPreset = name;
        form.hidden = false;
        summary.textContent = name + ' · 当前开启 ' + entries.filter(entry => entry.enabled).length + ' 项';
        list.replaceChildren();
        const records = savedSnapshots(context).filter(record => record?.preset === name);
        if (!records.length) list.textContent = '该预设还没有条目快照。';
        for (const record of records) {
            const saved = new Map(record.states);
            const matches = entries.filter(entry => saved.has(entry.identifier));
            const active = matches.length > 0 && matches.every(entry => Boolean(entry.enabled) === saved.get(entry.identifier));
            const row = document.createElement('div');
            row.className = 'snapshot-row';
            const apply = makeButton(record.name + (active ? ' · 当前' : ''), () => {
                try {
                    const { context, entries } = current();
                    const matches = entries.filter(entry => saved.has(entry.identifier));
                    if (!matches.length) throw new Error('当前预设里已找不到这个快照的条目');
                    const counts = promptManager.tokenHandler.getCounts();
                    for (const entry of matches) {
                        const enabled = saved.get(entry.identifier);
                        if (Boolean(entry.enabled) === enabled) continue;
                        entry.enabled = enabled;
                        counts[entry.identifier] = null;
                    }
                    context.saveSettingsDebounced();
                    promptManager.render(false);
                    draw();
                    feedback.textContent = '已切换到「' + record.name + '」。';
                } catch (error) {
                    reportError(error);
                }
            });
            apply.classList.add('snapshot-apply');
            apply.setAttribute('aria-pressed', String(active));
            apply.setAttribute('aria-label', '应用 ' + record.name);
            const remove = makeButton('删除', () => {
                if (!window.confirm('删除快照「' + record.name + '」？')) return;
                try {
                    const { context, name } = current();
                    storeSnapshots(context, savedSnapshots(context).filter(item => item?.preset !== name || item.name !== record.name));
                    draw();
                    feedback.textContent = '已删除快照。';
                } catch (error) {
                    reportError(error);
                }
            });
            remove.setAttribute('aria-label', '删除 ' + record.name);
            row.append(apply, remove);
            list.append(row);
        }
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        try {
            const { context, name, entries } = current();
            const snapshotName = input.value.trim();
            if (!snapshotName) throw new Error('请输入快照名称');
            if (!entries.length) throw new Error('该预设没有可切换的条目');
            const records = savedSnapshots(context);
            if (records.some(record => record?.preset === name && record.name === snapshotName)) {
                throw new Error('这个名字已经存在，请换一个快照名称');
            }
            const record = { preset: name, name: snapshotName, states: entries.map(entry => [entry.identifier, Boolean(entry.enabled)]) };
            storeSnapshots(context, [...records, record]);
            input.value = '';
            draw();
            feedback.textContent = '已保存「' + snapshotName + '」。';
        } catch (error) {
            reportError(error);
        }
    });
    function refresh() {
        if (!panel.open) return;
        feedback.textContent = '';
        const previous = openedPreset;
        openedPreset = undefined;
        try {
            draw();
            if (previous !== openedPreset) input.value = '';
        } catch (error) {
            form.hidden = true;
            summary.textContent = '';
            list.replaceChildren();
            reportError(error);
        }
    }
    panel.addEventListener('toggle', refresh);
    return { panel, refresh };
}

function presetSettingsAnchor(root) {
    const headers = root.querySelectorAll('summary, .inline-drawer-header, .inline-drawer-toggle, [aria-expanded]');
    for (const header of headers) {
        const label = header.textContent.replace(/\s/g, '');
        if (!/^(?:预设设置|預設設定|PresetSettings)$/i.test(label)) continue;
        const drawer = header.closest('details, .inline-drawer');
        if (drawer) return drawer;
        const controls = header.getAttribute('aria-controls');
        const content = controls && document.getElementById(controls);
        if (content?.parentElement === header.parentElement) return content;
        if (header.parentElement && header.parentElement !== root && root.contains(header.parentElement)) return header.parentElement;
    }
    return root.querySelector('#openai_api-presets');
}

export function mountEntrySnapshots() {
    const root = document.getElementById('ai-config-button');
    if (!root || document.getElementById('preset-workbench-snapshots')) return;
    const { panel, refresh } = buildSnapshotPanel();
    function place() {
        const anchor = presetSettingsAnchor(root);
        if (anchor && anchor.nextElementSibling !== panel) anchor.after(panel);
        const api = window.SillyTavern?.getContext?.()?.mainApi;
        panel.hidden = Boolean(api && api !== 'openai');
    }
    place();
    new MutationObserver(place).observe(root, { childList: true, subtree: true });
    const context = window.SillyTavern?.getContext?.();
    if (context?.eventTypes?.OAI_PRESET_CHANGED_AFTER) {
        context.eventSource.on(context.eventTypes.OAI_PRESET_CHANGED_AFTER, refresh);
    }
    root.addEventListener('change', event => {
        if (event.target.id === 'settings_preset_openai' || event.target.id === 'main_api') {
            requestAnimationFrame(() => {
                place();
                refresh();
            });
        }
    });
    root.addEventListener('click', event => {
        if (event.target.closest('[data-pm-identifier]')) queueMicrotask(refresh);
    });
}
