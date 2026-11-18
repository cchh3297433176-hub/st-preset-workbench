const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('global snapshots read every enabled book and preserve all switches across rollback and apply', async () => {
    const books = new Map([
        ['A', { entries: { 1: { uid: 1 }, 2: { uid: 2, disable: true } }, extensions: { keep: true } }],
        ['B', { entries: { 1: { uid: 1 } } }],
        ['C', { entries: {} }],
    ]);
    const writes = [];
    let unavailable;
    let rejectWrite;
    const vmContext = vm.createContext({
        document: { getElementById: () => null },
        structuredClone,
        fetch: async (_, request) => {
            const { name } = JSON.parse(request.body);
            writes.push(name);
            return { ok: name !== rejectWrite, status: 503 };
        },
    });
    const world = new vm.SyntheticModule([
        'world_names', 'selected_world_info', 'loadWorldInfo', 'reloadEditor',
        'worldInfoCache', 'setWIOriginalDataValue', 'updateWorldInfoSettings',
    ], function () {
        this.setExport('world_names', [...books.keys()]);
        this.setExport('selected_world_info', ['B', 'A']);
        this.setExport('loadWorldInfo', async name => name === unavailable ? null : structuredClone(books.get(name)));
        this.setExport('reloadEditor', () => {});
        this.setExport('worldInfoCache', books);
        this.setExport('setWIOriginalDataValue', () => {});
        this.setExport('updateWorldInfoSettings', (_, names) => this.setExport('selected_world_info', names));
    }, { context: vmContext });
    const popup = new vm.SyntheticModule(['POPUP_RESULT', 'POPUP_TYPE'], function () {
        this.setExport('POPUP_RESULT', {});
        this.setExport('POPUP_TYPE', {});
    }, { context: vmContext });
    const source = fs.readFileSync(path.join(__dirname, '../worldbook-snapshots.js'), 'utf8');
    const snapshots = new vm.SourceTextModule(source, { context: vmContext });
    await snapshots.link(specifier => specifier.endsWith('/popup.js') ? popup : world);
    await snapshots.evaluate();
    const { captureWorldbooks, planWorldbooks, applyWorldbookEdits } = snapshots.namespace;
    const context = { getRequestHeaders: () => ({}), eventTypes: {}, eventSource: { emit: async () => {} } };
    const record = await captureWorldbooks();
    const summary = JSON.parse(JSON.stringify(record)).map(book => [
        book.name, book.enabled, book.states?.map(([id, enabled]) => [id, enabled]),
    ]);
    assert.deepEqual(summary, [['B', true, [['1', true]]], ['A', true, [['1', true], ['2', false]]], ['C', false, undefined]]);
    unavailable = 'A';
    await assert.rejects(captureWorldbooks(), /无法读取世界书「A」/);
    unavailable = undefined;
    world.setExport('selected_world_info', ['C']);
    books.get('A').entries[1].disable = true;
    books.get('A').entries[2].disable = false;
    books.get('B').entries[1].disable = true;
    const plan = await planWorldbooks(record);
    rejectWrite = 'A';
    await assert.rejects(applyWorldbookEdits(context, plan.edits, plan), /HTTP 503/);
    assert.deepEqual(writes, ['B', 'A', 'B']);
    assert.equal(books.get('B').entries[1].disable, true);
    assert.deepEqual(world.namespace.selected_world_info, ['C']);
    rejectWrite = undefined;
    await applyWorldbookEdits(context, plan.edits, plan);
    assert.deepEqual([...world.namespace.selected_world_info], ['B', 'A']);
    assert.equal(books.get('A').entries[1].disable, false);
    assert.equal(books.get('A').entries[2].disable, true);
    assert.equal(books.get('A').extensions.keep, true);
    assert.deepEqual(books.get('C'), { entries: {} });
});
