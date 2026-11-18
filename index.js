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
    menu.append(link);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountWorkbench, { once: true });
} else {
    mountWorkbench();
}
