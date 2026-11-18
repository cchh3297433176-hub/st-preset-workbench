import { openEntrySnapshots } from './entry-snapshots.js';

function mountWorkbench() {
    const menu = document.querySelector('#options .options-content');
    if (!menu || document.getElementById('preset-workbench-launch')) return;

    const link = document.createElement('a');
    link.id = 'preset-workbench-launch';
    link.href = new URL('./dist/index.html#work', import.meta.url).href;
    link.target = 'preset-workbench-local';
    link.rel = 'opener';

    const icon = document.createElement('i');
    icon.className = 'fa-lg fa-solid fa-layer-group';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = '预设工作台';
    link.append(icon, label);
    const snapshots = document.createElement('a');
    snapshots.href = '#';
    const snapshotIcon = icon.cloneNode();
    snapshotIcon.className = 'fa-lg fa-solid fa-bookmark';
    const snapshotLabel = document.createElement('span');
    snapshotLabel.textContent = '条目快照';
    snapshots.append(snapshotIcon, snapshotLabel);
    snapshots.addEventListener('click', event => {
        event.preventDefault();
        openEntrySnapshots();
    });
    menu.append(link, snapshots);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountWorkbench, { once: true });
} else {
    mountWorkbench();
}
