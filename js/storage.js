import { ACHS, ROADMAP_TEMPLATE, GRADES } from './data.js';
import { getLocalDateKey } from './utils.js';

const STORAGE_KEY = 'devCareerApp';

export function syncRoadmapForGrade(state) {
    if (!Array.isArray(state.roadmapItems)) state.roadmapItems = [];
    const existingIds = new Set(state.roadmapItems.map(function(item) { return item.id; }));

    ROADMAP_TEMPLATE.forEach(function(skill) {
        if (state.gradeIdx >= skill.minGradeIdx && !existingIds.has(skill.id)) {
            state.roadmapItems.push({
                id: skill.id,
                level: skill.level,
                title: skill.title,
                desc: skill.desc,
                done: false
            });
            existingIds.add(skill.id);
        }
    });
}

export function createInitialState(gradeIdx, workSec, orders) {
    const state = {
        gradeIdx: gradeIdx || 0,
        workSec: workSec || 0,
        commercialSec: 0,
        timerSec: 0,
        money: 0,
        orders: orders || [],
        sessions: [],
        roadmapItems: [],
        tasks: [],
        unlockedIds: [],
        notifiedIds: [],
        activeTimer: {
            isRunning: false,
            startTime: null,
            accumulatedSec: 0,
            mode: 'commercial'
        }
    };
    syncRoadmapForGrade(state);
    return state;
}

function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (typeof raw.gradeIdx !== 'number' || !Number.isInteger(raw.gradeIdx)) return null;
    if (raw.gradeIdx < 0 || raw.gradeIdx > GRADES.length) return null;

    raw.workSec = Math.max(0, Number(raw.workSec) || 0);
    raw.commercialSec = Math.max(0, Number(raw.commercialSec) || 0);
    raw.timerSec = Math.max(0, Number(raw.timerSec) || 0);
    raw.money = Math.max(0, Number(raw.money) || 0);

    if (!Array.isArray(raw.orders)) raw.orders = [];
    if (!Array.isArray(raw.sessions)) raw.sessions = [];
    if (!Array.isArray(raw.tasks)) raw.tasks = [];
    if (!Array.isArray(raw.unlockedIds)) raw.unlockedIds = [];
    if (!Array.isArray(raw.notifiedIds)) raw.notifiedIds = raw.unlockedIds.slice();
    if (!Array.isArray(raw.roadmapItems)) raw.roadmapItems = [];

    if (!raw.activeTimer || typeof raw.activeTimer !== 'object') {
        raw.activeTimer = { isRunning: false, startTime: null, accumulatedSec: 0, mode: 'commercial' };
    } else {
        raw.activeTimer.isRunning = Boolean(raw.activeTimer.isRunning);
        raw.activeTimer.accumulatedSec = Math.max(0, Number(raw.activeTimer.accumulatedSec) || 0);
        raw.activeTimer.mode = raw.activeTimer.mode === 'practice' ? 'practice' : 'commercial';
    }

    const todayStr = getLocalDateKey();
    raw.orders = raw.orders
        .filter(function(o) { return o && typeof o === 'object'; })
        .map(function(o) {
            const title = String(o.title || 'Работа');
            const amount = Math.max(0, Number(o.amount) || 0);
            const type = o.type === 'project' || (!o.type && title.toLowerCase().includes('стартовый')) ? 'project' : 'order';
            const date = typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : todayStr;
            return { title: title, amount: amount, type: type, date: date };
        });

    raw.sessions = raw.sessions
        .filter(function(s) { return s && typeof s === 'object'; })
        .map(function(s) {
            return {
                date: typeof s.date === 'string' ? s.date : todayStr,
                time: typeof s.time === 'string' ? s.time : '00:00',
                seconds: Math.max(0, Number(s.seconds) || 0),
                mode: s.mode === 'practice' ? 'practice' : 'commercial',
                note: String(s.note || '')
            };
        });

    raw.roadmapItems.forEach(function(item) {
        if (!item.level) {
            const t = String(item.title || '');
            if (t.startsWith('[Junior]')) {
                item.level = 'Junior';
                item.title = t.replace('[Junior] ', '');
            } else if (t.startsWith('[Middle]')) {
                item.level = 'Middle';
                item.title = t.replace('[Middle] ', '');
            } else if (t.startsWith('[Senior]')) {
                item.level = 'Senior';
                item.title = t.replace('[Senior] ', '');
            } else {
                item.level = 'Мои темы';
            }
        }
    });

    const validIds = new Set(ACHS.map(function(a) { return a.id; }));
    raw.unlockedIds = [...new Set(raw.unlockedIds)].filter(function(id) { return validIds.has(id); });
    raw.notifiedIds = [...new Set(raw.notifiedIds)].filter(function(id) { return validIds.has(id); });

    syncRoadmapForGrade(raw);
    return raw;
}

export function loadState() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return normalizeState(raw);
    } catch (e) {
        console.error('Ошибка загрузки состояния:', e);
        return null;
    }
}

export function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}

export function exportBackup(state) {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateTag = getLocalDateKey();

    const a = document.createElement('a');
    a.href = url;
    a.download = 'career-tracker-backup-' + dateTag + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

export function importBackup(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || !Array.isArray(parsed.orders)) {
                if (onError) onError('Неверный формат файла бэкапа.');
                return;
            }
            const normalized = normalizeState(parsed);
            if (normalized) {
                saveState(normalized);
                onSuccess(normalized);
            } else if (onError) {
                onError('Поврежденные данные в файле бэкапа.');
            }
        } catch (err) {
            if (onError) onError('Не удалось прочитать JSON-файл.');
        }
    };
    reader.readAsText(file);
}
