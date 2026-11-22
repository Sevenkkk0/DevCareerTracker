let editingIdx = null;
let addingSubIdx = null;
let editingSubKey = null;

function normalizeTasks(state) {
    if (!Array.isArray(state.tasks)) state.tasks = [];
    state.tasks.forEach(function(t) {
        if (t.text !== undefined && t.title === undefined) {
            t.title = t.text;
            delete t.text;
        }
        if (typeof t.desc !== 'string') t.desc = '';
        if (!Array.isArray(t.subtasks)) t.subtasks = [];
    });
}

export function renderTasksModal(state) {
    normalizeTasks(state);
    const listEl = document.getElementById('tasks-list');

    if (state.tasks.length === 0) {
        listEl.innerHTML = '<div style="color:#9399b2; text-align:center; padding: 20px;">Задач пока нет. Запланируйте что-нибудь выше!</div>';
        return;
    }

    listEl.innerHTML = state.tasks.map(function(task, idx) {
        if (editingIdx === idx) {
            return '<div class="task-card">' +
                '<div class="inline-edit-box">' +
                '<input type="text" id="edit-task-title-' + idx + '" value="' + escapeHtml(task.title) + '">' +
                '<textarea id="edit-task-desc-' + idx + '" rows="2" placeholder="Описание">' + escapeHtml(task.desc) + '</textarea>' +
                '<div class="inline-edit-actions">' +
                '<button class="btn-sm btn-ghost" data-task-cancel-edit="1">Отмена</button>' +
                '<button class="btn-add btn-sm" data-task-save-edit="' + idx + '">Сохранить</button>' +
                '</div>' +
                '</div>' +
                '</div>';
        }

        const totalSubs = task.subtasks.length;
        const doneSubs = task.subtasks.filter(function(s) { return s.done; }).length;
        const badgeHtml = totalSubs > 0 ? '<span class="sub-progress-badge">' + doneSubs + '/' + totalSubs + '</span>' : '';

        let subsHtml = '';
        if (totalSubs > 0) {
            const rows = task.subtasks.map(function(sub, sIdx) {
                const key = idx + ':' + sIdx;
                if (editingSubKey === key) {
                    return '<div class="subtask-edit-box">' +
                        '<textarea id="edit-sub-input-' + idx + '-' + sIdx + '" rows="2">' + escapeHtml(sub.title) + '</textarea>' +
                        '<div class="inline-edit-actions">' +
                        '<button class="btn-sm btn-ghost" data-sub-cancel-edit="1">Отмена</button>' +
                        '<button class="btn-add btn-sm" data-sub-save-edit="' + key + '">Сохранить</button>' +
                        '</div>' +
                        '</div>';
                }

                return '<div class="subtask-row ' + (sub.done ? 'done' : '') + '">' +
                    '<label class="subtask-label">' +
                    '<input type="checkbox" data-sub-toggle="' + key + '" ' + (sub.done ? 'checked' : '') + '>' +
                    '<span>' + escapeHtml(sub.title) + '</span>' +
                    '</label>' +
                    '<div class="item-actions">' +
                    '<button class="btn-icon-action" data-sub-edit="' + key + '" title="Изменить подзадачу">✏️</button>' +
                    '<button class="btn-icon-action del" data-sub-del="' + key + '" title="Удалить подзадачу">✕</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
            subsHtml = '<div class="subtasks-box">' + rows + '</div>';
        }

        let addSubHtml = '';
        if (addingSubIdx === idx) {
            addSubHtml = '<div class="subtask-edit-box" style="padding-left: 30px; margin-top: 8px;">' +
                '<textarea id="new-sub-input-' + idx + '" rows="2" placeholder="Текст подзадачи (можно в несколько строк)"></textarea>' +
                '<div class="inline-edit-actions">' +
                '<button class="btn-sm btn-ghost" data-sub-cancel="1">Отмена</button>' +
                '<button class="btn-add btn-sm" data-sub-save="' + idx + '">Добавить</button>' +
                '</div>' +
                '</div>';
        }

        return '<div class="task-card ' + (task.done ? 'done' : '') + '">' +
            '<div class="task-main-row">' +
            '<label class="roadmap-left">' +
            '<input type="checkbox" data-task-toggle="' + idx + '" ' + (task.done ? 'checked' : '') + '>' +
            '<div class="roadmap-info">' +
            '<div class="task-title-wrap"><strong>' + escapeHtml(task.title) + '</strong>' + badgeHtml + '</div>' +
            (task.desc ? '<div class="task-note">' + escapeHtml(task.desc) + '</div>' : '') +
            '</div>' +
            '</label>' +
            '<div class="item-actions">' +
            '<button class="btn-icon-action" data-sub-open="' + idx + '" title="Добавить подзадачу">+ Подзадача</button>' +
            '<button class="btn-icon-action" data-task-edit="' + idx + '" title="Редактировать">✏️</button>' +
            '<button class="btn-icon-action del" data-task-del="' + idx + '" title="Удалить">✕</button>' +
            '</div>' +
            '</div>' +
            subsHtml +
            addSubHtml +
            '</div>';
    }).join('');
}

export function initTasksEvents(getState, onUpdate) {
    document.getElementById('task-add-btn').onclick = function() {
        const state = getState();
        normalizeTasks(state);
        const titleEl = document.getElementById('task-new-title');
        const descEl = document.getElementById('task-new-desc');
        const title = titleEl.value.trim();
        if (!title) return;

        state.tasks.push({ title: title, desc: descEl.value.trim(), done: false, subtasks: [] });
        titleEl.value = '';
        descEl.value = '';
        onUpdate();
        renderTasksModal(state);
    };

    const modalEl = document.getElementById('tasks-modal');

    modalEl.addEventListener('click', function(e) {
        const state = getState();
        normalizeTasks(state);

        if (e.target.closest('[data-task-edit]')) {
            editingIdx = Number(e.target.closest('[data-task-edit]').dataset.taskEdit);
            addingSubIdx = null;
            editingSubKey = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-task-cancel-edit]')) {
            editingIdx = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-task-save-edit]')) {
            const idx = Number(e.target.closest('[data-task-save-edit]').dataset.taskSaveEdit);
            const task = state.tasks.at(idx);
            const newTitle = document.getElementById('edit-task-title-' + idx).value.trim();
            const newDesc = document.getElementById('edit-task-desc-' + idx).value.trim();
            if (task && newTitle) {
                task.title = newTitle;
                task.desc = newDesc;
            }
            editingIdx = null;
            onUpdate();
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-task-del]')) {
            const idx = Number(e.target.closest('[data-task-del]').dataset.taskDel);
            state.tasks.splice(idx, 1);
            editingIdx = null;
            editingSubKey = null;
            onUpdate();
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-open]')) {
            addingSubIdx = Number(e.target.closest('[data-sub-open]').dataset.subOpen);
            editingIdx = null;
            editingSubKey = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-cancel]')) {
            addingSubIdx = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-save]')) {
            const idx = Number(e.target.closest('[data-sub-save]').dataset.subSave);
            const task = state.tasks.at(idx);
            const inputEl = document.getElementById('new-sub-input-' + idx);
            const subTitle = inputEl ? inputEl.value.trim() : '';
            if (task && subTitle) {
                task.subtasks.push({ title: subTitle, done: false });
                task.done = false;
            }
            addingSubIdx = null;
            onUpdate();
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-edit]')) {
            editingSubKey = e.target.closest('[data-sub-edit]').dataset.subEdit;
            editingIdx = null;
            addingSubIdx = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-cancel-edit]')) {
            editingSubKey = null;
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-save-edit]')) {
            const key = e.target.closest('[data-sub-save-edit]').dataset.subSaveEdit;
            const parts = key.split(':');
            const tIdx = Number(parts.at(0));
            const sIdx = Number(parts.at(1));
            const task = state.tasks.at(tIdx);
            const inputEl = document.getElementById('edit-sub-input-' + tIdx + '-' + sIdx);
            const newTitle = inputEl ? inputEl.value.trim() : '';
            if (task && task.subtasks.at(sIdx) && newTitle) {
                task.subtasks.at(sIdx).title = newTitle;
            }
            editingSubKey = null;
            onUpdate();
            renderTasksModal(state);
            return;
        }

        if (e.target.closest('[data-sub-del]')) {
            const parts = e.target.closest('[data-sub-del]').dataset.subDel.split(':');
            const tIdx = Number(parts.at(0));
            const sIdx = Number(parts.at(1));
            const task = state.tasks.at(tIdx);
            if (task) {
                task.subtasks.splice(sIdx, 1);
            }
            editingSubKey = null;
            onUpdate();
            renderTasksModal(state);
        }
    });

    modalEl.addEventListener('change', function(e) {
        const state = getState();
        normalizeTasks(state);

        if (e.target.dataset.taskToggle !== undefined) {
            const idx = Number(e.target.dataset.taskToggle);
            const task = state.tasks.at(idx);
            const isDone = e.target.checked;
            if (task) {
                task.done = isDone;
                task.subtasks.forEach(function(s) { s.done = isDone; });
            }
            onUpdate();
            renderTasksModal(state);
            return;
        }

        if (e.target.dataset.subToggle !== undefined) {
            const parts = e.target.dataset.subToggle.split(':');
            const tIdx = Number(parts.at(0));
            const sIdx = Number(parts.at(1));
            const task = state.tasks.at(tIdx);
            if (task && task.subtasks.at(sIdx)) {
                task.subtasks.at(sIdx).done = e.target.checked;
                task.done = task.subtasks.length > 0 && task.subtasks.every(function(s) { return s.done; });
            }
            onUpdate();
            renderTasksModal(state);
        }
    });
}
