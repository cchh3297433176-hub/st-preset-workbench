import { POPUP_RESULT, POPUP_TYPE } from '/scripts/popup.js';
import {
    loadWorldInfo, reloadEditor, selected_world_info, worldInfoCache,
    setWIOriginalDataValue, updateWorldInfoSettings, world_names,
} from '/scripts/world-info.js';

export function makeButton(label, click) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu_button';
    button.textContent = label;
    button.addEventListener('click', click);
    return button;
}

export async function confirmChanges(context, title, lines, cancelButton = '取消') {
    const content = document.createElement('div');
    const heading = document.createElement('h3');
    heading.textContent = title;
    content.append(heading);
    const list = document.createElement('ul');
    list.className = 'workbench-change-list';
    for (const line of lines) {
        const item = document.createElement('li');
        item.textContent = line;
        list.append(item);
    }
    content.append(list);
    const result = await context.callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
        okButton: '应用',
        cancelButton,
        defaultResult: POPUP_RESULT.NEGATIVE,
    });
    return result === POPUP_RESULT.AFFIRMATIVE;
}

export function worldEntries(data) {
    return Object.entries(data.entries);
}

export async function readWorldbook(name) {
    try {
        const data = await loadWorldInfo(name);
        if (!data?.entries || typeof data.entries !== 'object') throw new Error();
        if (!worldEntries(data).every(([, entry]) => entry && typeof entry === 'object')) throw new Error();
        return data;
    } catch {
        throw new Error('无法读取世界书「' + name + '」，请检查后重试');
    }
}

function entryIdentity(entry) {
    return JSON.stringify([entry.comment ?? '', entry.key ?? [], entry.keysecondary ?? [], entry.comment ? '' : entry.content ?? '']);
}

export async function captureWorldbooks() {
    if (!Array.isArray(world_names)) throw new Error('酒馆正在载入世界书，请稍后重试');
    const active = [...new Set(selected_world_info)];
    const library = [...new Set(world_names)];
    const books = [];
    // Preserve global selection order, which can affect entry ordering in Tavern.
    for (const name of active) {
        const data = await readWorldbook(name);
        books.push({ name, enabled: true, states: worldEntries(data).map(([id, entry]) => [id, !entry.disable, entryIdentity(entry)]) });
    }
    if (!sameSelection(active, selected_world_info) || !sameSelection(library, world_names)) {
        throw new Error('读取时世界书列表发生了变化，请重新保存');
    }
    return [...books, ...library.filter(name => !active.includes(name)).map(name => ({ name, enabled: false }))];
}

function sameSelection(left, right) {
    return left.length === right.length && left.every((name, index) => name === right[index]);
}

export function planWorldbookEntries(data, states) {
    const changes = [];
    let missing = 0;
    for (const [id, enabled, identity] of states) {
        const entry = Object.hasOwn(data.entries, id) ? data.entries[id] : undefined;
        if (!entry || (identity !== undefined && identity !== entryIdentity(entry))) {
            missing++;
        } else if (Boolean(entry.disable) === enabled) {
            changes.push([id, enabled, identity]);
        }
    }
    return { changes, missing };
}

export async function planWorldbooks(books) {
    if (!Array.isArray(world_names)) throw new Error('酒馆正在载入世界书，请稍后重试');
    const library = [...world_names];
    const available = new Set(library);
    const active = [...selected_world_info];
    const target = [];
    const edits = [];
    const lines = [];
    const missingBooks = books.filter(book => !available.has(book.name));
    for (const book of books.filter(book => book.enabled && available.has(book.name))) {
        target.push(book.name);
        const data = await readWorldbook(book.name);
        const { changes, missing } = planWorldbookEntries(data, book.states);
        if (changes.length) {
            edits.push({ name: book.name, changes });
            const enabling = changes.filter(([, enabled]) => enabled).length;
            lines.push('「' + book.name + '」条目：开启 ' + enabling + ' 项，关闭 ' + (changes.length - enabling) + ' 项。');
        }
        if (missing) lines.push('「' + book.name + '」有 ' + missing + ' 个原条目已找不到，应用时会跳过。');
    }
    if (!sameSelection(active, selected_world_info) || !sameSelection(library, world_names)) {
        throw new Error('读取时世界书列表发生了变化，请重新确认');
    }
    const added = target.filter(name => !active.includes(name));
    const removed = active.filter(name => !target.includes(name));
    if (added.length) lines.unshift('全局开启：' + added.join('、'));
    if (removed.length) lines.unshift('全局关闭：' + removed.join('、'));
    if (!added.length && !removed.length && !sameSelection(active, target)) lines.push('恢复全局世界书的选择顺序。');
    if (missingBooks.length) lines.push('找不到的世界书：' + missingBooks.map(book => book.name).join('、'));
    if (lines.length === 0) lines.push('全局世界书和条目开关已匹配。');
    lines.push('世界书条目开关是共享设置，其他使用同一本书的聊天也会读到这些改动。');
    return { active, target, library, edits, lines };
}

function setGlobalSelection(context, names) {
    updateWorldInfoSettings({}, [...names]);
    const select = document.getElementById('world_info');
    if (select) {
        for (const option of select.options) option.selected = option.value !== '' && names.includes(option.text);
        window.jQuery?.(select).trigger('change.select2');
    }
    void context.eventSource.emit(context.eventTypes.WORLDINFO_SETTINGS_UPDATED);
}

async function writeWorldbook(context, name, data) {
    const response = await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: context.getRequestHeaders(),
        body: JSON.stringify({ name, data }),
    });
    if (!response.ok) throw new Error('无法保存世界书「' + name + '」（HTTP ' + response.status + '）');
    worldInfoCache.set(name, data);
    void context.eventSource.emit(context.eventTypes.WORLDINFO_UPDATED, name, data);
}

let applying = false;

export async function applyWorldbookEdits(context, edits, selection, beforeSelection) {
    if (applying) throw new Error('另一项世界书操作正在应用，请稍后重试');
    applying = true;
    const written = [];
    try {
        for (const { name, changes } of edits) {
            if (!world_names.includes(name)) throw new Error('找不到世界书「' + name + '」');
            const previous = await readWorldbook(name);
            const current = planWorldbookEntries(previous, changes);
            if (current.missing) throw new Error('世界书「' + name + '」的条目有变化，请重新确认');
            if (!current.changes.length) continue;
            const data = structuredClone(previous);
            for (const [id, enabled] of current.changes) {
                const entry = data.entries[id];
                entry.disable = !enabled;
                setWIOriginalDataValue(data, entry.uid, 'enabled', enabled);
            }
            await writeWorldbook(context, name, data);
            written.push({ name, previous, data });
        }
        beforeSelection?.();
        if (selection && (!sameSelection(selection.active, selected_world_info) || !sameSelection(selection.library, world_names))) {
            throw new Error('应用过程中全局世界书有变化，请重新确认');
        }
        if (selection && !sameSelection(selection.target, selected_world_info)) setGlobalSelection(context, selection.target);
    } catch (error) {
        const failed = [];
        for (const { name, previous, data } of written.reverse()) {
            try {
                if (JSON.stringify(await readWorldbook(name)) !== JSON.stringify(data)) throw new Error();
                await writeWorldbook(context, name, previous);
            } catch {
                failed.push(name);
            }
        }
        if (failed.length) throw new Error(error.message + '。这些世界书未能恢复，请检查：' + failed.join('、'));
        throw error;
    } finally {
        applying = false;
        for (const { name } of written) reloadEditor(name);
    }
}
