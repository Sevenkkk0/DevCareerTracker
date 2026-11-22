import { escapeHtml } from './utils.js';

let editingRmIdx = null;

export function renderRoadmapModal(state) {
    const total = state.roadmapItems.length;
    const doneCount = state.roadmapItems.filter(function(item) { return item.done; }).length;
    const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    document.getElementById('roadmap-percent').textContent = percent + '%';

    const listEl = document.getElementById('roadmap-list');
    if (total === 0) {
        listEl.innerHTML = '<div style="color:#9399b2; text-align:center; padding: 20px;">Список тем пуст. Добавьте первую тему выше!</div>';
        return;
    }

    const levelsOrder = ['Trainee', 'Junior', 'Junior+', 'Middle', 'Senior', 'Мои темы'];
    const allLevels = [...new Set(levelsOrder.concat(state.roadmapItems.map(function(i) { return i.level || 'Мои темы'; })))];

    listEl.innerHTML = allLevels.map(function(lvl) {
        const groupItems = [];
        state.roadmapItems.forEach(function(skill, idx) {
            if ((skill.level || 'Мои темы') === lvl) {
                groupItems.push({ skill: skill, idx: idx });
            }
        });

        if (groupItems.length === 0) return '';

        const groupDone = groupItems.filter(function(g) { return g.skill.done; }).length;
        const headerHtml = '<div class="ach-category-title" style="margin-bottom: 10px;">' + escapeHtml(lvl) + ' (' + groupDone + '/' + groupItems.length + ')</div>';

        const cardsHtml = groupItems.map(function(g) {
            const skill = g.skill;
            const idx = g.idx;

            if (editingRmIdx === idx) {
                return '<div class="roadmap-item">' +
                    '<div class="inline-edit-box">' +
                    '<input type="text" id="edit-rm-title-' + idx + '" value="' + escapeHtml(skill.title) + '">' +
                    '<textarea id="edit-rm-desc-' + idx + '" rows="2" placeholder="Описание темы">' + escapeHtml(skill.desc) + '</textarea>' +
                    '<div class="inline-edit-actions">' +
                    '<button class="btn-sm btn-ghost" data-rm-cancel-edit="1">Отмена</button>' +
                    '<button class="btn-add btn-sm" data-rm-save-edit="' + idx + '">Сохранить</button>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }

            return '<div class="roadmap-item ' + (skill.done ? 'checked' : '') + '">' +
                '<label class="roadmap-left">' +
                '<input type="checkbox" data-rm-toggle="' + idx + '" ' + (skill.done ? 'checked' : '') + '>' +
                '<div class="roadmap-info"><strong>' + escapeHtml(skill.title) + '</strong><span>' + escapeHtml(skill.desc) + '</span></div>' +
                '</label>' +
                '<div class="item-actions">' +
                '<button class="btn-icon-action" data-rm-edit="' + idx + '" title="Изменить">✏️</button>' +
                '<button class="btn-icon-action del" data-rm-del="' + idx + '" title="Удалить">✕</button>' +
                '</div>' +
                '</div>';
        }).join('');

        return headerHtml + cardsHtml;
    }).join('');
}

export function initRoadmapEvents(getState, onSave) {
    document.getElementById('rm-add-btn').onclick = function() {
        const state = getState();
        const titleEl = document.getElementById('rm-new-title');
        const descEl = document.getElementById('rm-new-desc');
        const title = titleEl.value.trim();
        if (!title) return;

        state.roadmapItems.push({
            id: 'custom_' + Date.now(),
            level: 'Мои темы',
            title: title,
            desc: descEl.value.trim(),
            done: false
        });
        titleEl.value = '';
        descEl.value = '';
        onSave();
        renderRoadmapModal(state);
    };

    const modalEl = document.getElementById('roadmap-modal');

    modalEl.addEventListener('click', function(e) {
        const state = getState();

        if (e.target.closest('[data-rm-edit]')) {
            editingRmIdx = Number(e.target.closest('[data-rm-edit]').dataset.rmEdit);
            renderRoadmapModal(state);
            return;
        }

        if (e.target.closest('[data-rm-cancel-edit]')) {
            editingRmIdx = null;
            renderRoadmapModal(state);
            return;
        }

        if (e.target.closest('[data-rm-save-edit]')) {
            const idx = Number(e.target.closest('[data-rm-save-edit]').dataset.rmSaveEdit);
            const skill = state.roadmapItems.at(idx);
            const newTitle = document.getElementById('edit-rm-title-' + idx).value.trim();
            const newDesc = document.getElementById('edit-rm-desc-' + idx).value.trim();
            if (skill && newTitle) {
                skill.title = newTitle;
                skill.desc = newDesc;
            }
            editingRmIdx = null;
            onSave();
            renderRoadmapModal(state);
            return;
        }

        if (e.target.closest('[data-rm-del]')) {
            const idx = Number(e.target.closest('[data-rm-del]').dataset.rmDel);
            state.roadmapItems.splice(idx, 1);
            editingRmIdx = null;
            onSave();
            renderRoadmapModal(state);
        }
    });

    modalEl.addEventListener('change', function(e) {
        if (e.target.dataset.rmToggle !== undefined) {
            const state = getState();
            const idx = Number(e.target.dataset.rmToggle);
            const skill = state.roadmapItems.at(idx);
            if (skill) skill.done = e.target.checked;
            onSave();
            renderRoadmapModal(state);
        }
    });
}
