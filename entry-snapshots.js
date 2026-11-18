import { promptManager } from '/scripts/openai.js';
import { applyWorldbookEdits, captureWorldbooks, confirmChanges, makeButton, planWorldbooks } from './worldbook-snapshots.js';

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
    let busy = false;
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
    async function run(action) {
        if (busy) return;
        busy = true;
        panel.setAttribute('aria-busy', 'true');
        try {
            await action();
        } catch (error) {
            reportError(error);
        } finally {
            busy = false;
            panel.removeAttribute('aria-busy');
            if (openedPreset) {
                try {
                    if (activePreset().name !== openedPreset) refresh();
                } catch {
                    refresh();
                }
            }
        }
    }
    async function preview(record) {
        const { context, name, entries } = current();
        if (name !== record.preset) throw new Error('酒馆已切换预设，请重新选择快照');
        const saved = new Map(record.states);
        const matches = entries.filter(entry => saved.has(entry.identifier));
        if (!matches.length && !record.books) throw new Error('当前预设里已找不到这个快照的条目');
        const changes = matches.filter(entry => Boolean(entry.enabled) !== saved.get(entry.identifier));
        const enabling = changes.filter(entry => saved.get(entry.identifier)).length;
        const lines = ['预设条目：开启 ' + enabling + ' 项，关闭 ' + (changes.length - enabling) + ' 项。'];
        if (matches.length < saved.size) lines.push('有 ' + (saved.size - matches.length) + ' 个原预设条目已找不到，应用时会跳过。');
        const world = record.books && await planWorldbooks(record.books);
        if (world) lines.push(...world.lines);
        return { context, saved, changes, world, lines };
    }
    async function apply(record, justSaved = false) {
        const before = await preview(record);
        const title = justSaved ? '已保存「' + record.name + '」。要现在使用吗？' : '应用快照「' + record.name + '」？';
        if (!await confirmChanges(before.context, title, before.lines, justSaved ? '仅保存' : '取消')) return;
        const plan = await preview(record);
        const ids = value => value.changes.map(entry => entry.identifier);
        if (JSON.stringify([ids(before), before.world]) !== JSON.stringify([ids(plan), plan.world])) {
            throw new Error('预设或世界书开关有变化，请重新确认');
        }
        if (plan.world) await applyWorldbookEdits(plan.context, plan.world.edits, plan.world, () => {
            if (activePreset().name !== record.preset) throw new Error('酒馆已切换预设，请重新选择快照');
        });
        const counts = promptManager.tokenHandler.getCounts();
        for (const entry of plan.changes) {
            entry.enabled = plan.saved.get(entry.identifier);
            counts[entry.identifier] = null;
        }
        plan.context.saveSettingsDebounced();
        if (plan.changes.length) promptManager.render(false);
        draw();
        feedback.textContent = '已应用「' + record.name + '」。';
    }
    function draw() {
        const { context, name, entries } = current();
        openedPreset = name;
        form.hidden = false;
        summary.textContent = name + ' · 当前开启 ' + entries.filter(entry => entry.enabled).length + ' 项';
        list.replaceChildren();
        const records = savedSnapshots(context).filter(record => record?.preset === name);
        if (!records.length) list.textContent = '该预设还没有快照。';
        for (const record of records) {
            const row = document.createElement('div');
            row.className = 'snapshot-row';
            const label = record.books ? ' · ' + record.books.filter(book => book.enabled).length + ' 本全局开启' : '';
            const saved = new Map(record.states);
            const matches = entries.filter(entry => saved.has(entry.identifier));
            const active = !record.books && matches.length > 0 && matches.every(entry => Boolean(entry.enabled) === saved.get(entry.identifier));
            const button = makeButton(record.name + label + (active ? ' · 当前' : ''), () => run(() => apply(record)));
            button.classList.add('snapshot-apply');
            button.setAttribute('aria-label', '应用 ' + record.name + label);
            const remove = makeButton('删除', () => run(() => {
                if (!window.confirm('删除快照「' + record.name + '」？')) return;
                const { context, name } = current();
                storeSnapshots(context, savedSnapshots(context).filter(item => item?.preset !== name || item.name !== record.name));
                draw();
                feedback.textContent = '已删除快照。';
            }));
            remove.setAttribute('aria-label', '删除 ' + record.name);
            row.append(button, remove);
            list.append(row);
        }
    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        void run(async () => {
            const { context, name, entries } = current();
            const snapshotName = input.value.trim();
            if (!snapshotName) throw new Error('请输入快照名称');
            if (savedSnapshots(context).some(record => record?.preset === name && record.name === snapshotName)) {
                throw new Error('这个名字已经存在，请换一个快照名称');
            }
            const states = entries.map(entry => [entry.identifier, Boolean(entry.enabled)]);
            feedback.textContent = '正在读取全部全局启用的世界书…';
            const books = await captureWorldbooks();
            const latest = activePreset();
            if (latest.name !== name || JSON.stringify(latest.entries.map(entry => [entry.identifier, Boolean(entry.enabled)])) !== JSON.stringify(states)) {
                throw new Error('读取时预设开关发生了变化，请重新保存');
            }
            const record = { preset: name, name: snapshotName, states, books };
            storeSnapshots(context, [...savedSnapshots(context), record]);
            input.value = '';
            draw();
            const enabled = books.filter(book => book.enabled);
            const total = enabled.reduce((sum, book) => sum + book.states.length, 0);
            feedback.textContent = '已保存「' + snapshotName + '」，全局开启 ' + enabled.length + ' 本，已记录 ' + total + ' 个条目。';
            await apply(record, true);
        });
    });
    function refresh() {
        if (!panel.open || busy) return;
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
