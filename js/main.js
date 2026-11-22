import { GRADES, ACHS, countProjects } from './data.js';
import { loadState, saveState, clearState, exportBackup, importBackup, createInitialState } from './storage.js';
import { startQuizModal } from './quiz.js';
import { renderTasksModal, initTasksEvents } from './tasks.js';
import { renderRoadmapModal, initRoadmapEvents } from './roadmap.js';
import { escapeHtml, getLocalDateKey } from './utils.js';

let state = loadState();
let timerInterval = null;
let currentRole = 'frontend';
let moneyPeriod = 'all';

const PLAY_ICON_SVG = '<svg class="ui-icon" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const MONTH_NAMES_RU = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// ==========================================
// 1. Утилиты форматирования и уведомлений
// ==========================================

function formatTimerDisplay(totalSec) {
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return h + ':' + m + ':' + s;
}

function formatDurationRu(totalSec) {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    if (hrs === 0 && mins === 0) return totalSec + ' сек';
    return hrs + ' ч ' + mins + ' мин';
}

function formatMonthLabel(ymKey) {
    const parts = ymKey.split('-');
    const year = parts.at(0);
    const monthIdx = Number(parts.at(1)) - 1;
    return (MONTH_NAMES_RU.at(monthIdx) || ymKey) + ' ' + year;
}

function showToast(title, bodyText) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = '<div class="toast-title">' + escapeHtml(title) + '</div><div class="toast-body">' + escapeHtml(bodyText) + '</div>';
    container.appendChild(toast);
    setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
}

function showConfirmModal(title, message, onConfirm, okText) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-text').textContent = message;
    const okBtn = document.getElementById('confirm-ok-btn');
    okBtn.textContent = okText || 'Удалить';
    modal.classList.remove('hidden');

    okBtn.onclick = function() {
        modal.classList.add('hidden');
        onConfirm();
    };
}

// ==========================================
// 2. Навигация и экраны
// ==========================================

function init() {
    if (!state) {
        document.getElementById('main-screen').classList.add('hidden');
        document.getElementById('quiz-screen').classList.add('hidden');
        document.getElementById('wip-screen').classList.add('hidden');
        document.getElementById('welcome-screen').classList.remove('hidden');
    } else {
        document.getElementById('welcome-screen').classList.add('hidden');
        switchRole('frontend');
        restoreTimerOnLoad();
        render();
    }
}

function switchRole(role) {
    currentRole = role;
    document.querySelectorAll('.role-tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    const mainScreen = document.getElementById('main-screen');
    const wipScreen = document.getElementById('wip-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const quizScreen = document.getElementById('quiz-screen');
    const titleName = role === 'backend' ? 'Backend-разработка' : 'UI/UX Дизайн';

    if (!state) {
        mainScreen.classList.add('hidden');
        if (role === 'frontend') {
            wipScreen.classList.add('hidden');
            if (quizScreen.dataset.active === 'true') {
                welcomeScreen.classList.add('hidden');
                quizScreen.classList.remove('hidden');
            } else {
                quizScreen.classList.add('hidden');
                welcomeScreen.classList.remove('hidden');
            }
        } else {
            welcomeScreen.classList.add('hidden');
            quizScreen.classList.add('hidden');
            wipScreen.classList.remove('hidden');
            document.getElementById('wip-title').textContent = titleName + ' — в разработке';
        }
        return;
    }

    quizScreen.classList.add('hidden');
    welcomeScreen.classList.add('hidden');

    if (role === 'frontend') {
        wipScreen.classList.add('hidden');
        mainScreen.classList.remove('hidden');
    } else {
        mainScreen.classList.add('hidden');
        wipScreen.classList.remove('hidden');
        document.getElementById('wip-title').textContent = titleName + ' — в разработке';
    }
}
// ==========================================
// 3. Таймер и учет рабочего времени
// ==========================================

function getElapsedSeconds() {
    const t = state.activeTimer;
    if (!t) return 0;
    if (t.isRunning && t.startTime) {
        return t.accumulatedSec + Math.floor((Date.now() - t.startTime) / 1000);
    }
    return t.accumulatedSec || 0;
}

function updateTimerUI() {
    document.getElementById('timer').textContent = formatTimerDisplay(getElapsedSeconds());
}

function syncTimerModeLock() {
    const isLocked = state.activeTimer.isRunning || state.activeTimer.accumulatedSec > 0;
    document.querySelectorAll('input[name="work-mode"]').forEach(function(radio) {
        radio.disabled = isLocked;
    });
}

function startTicking() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerUI();
    timerInterval = setInterval(updateTimerUI, 1000);
}

function restoreTimerOnLoad() {
    const t = state.activeTimer;
    const modeRadio = document.querySelector('input[name="work-mode"][value="' + t.mode + '"]');
    if (modeRadio) modeRadio.checked = true;

    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const claimBtn = document.getElementById('claim-btn');

    if (t.isRunning) {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        claimBtn.disabled = false;
        startTicking();
    } else if (t.accumulatedSec > 0) {
        startBtn.disabled = false;
        startBtn.innerHTML = PLAY_ICON_SVG + ' Продолжить';
        pauseBtn.disabled = true;
        claimBtn.disabled = false;
        updateTimerUI();
    } else {
        startBtn.disabled = false;
        startBtn.innerHTML = PLAY_ICON_SVG + ' Старт';
        pauseBtn.disabled = true;
        claimBtn.disabled = true;
        updateTimerUI();
    }

    syncTimerModeLock();
}

function logWorkSession(seconds, mode, note) {
    if (seconds <= 0) return;
    const now = new Date();
    const dateKey = getLocalDateKey();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    state.workSec += seconds;
    state.timerSec += seconds;
    if (mode === 'commercial') state.commercialSec += seconds;

    const cleanNote = (note || '').trim();
    state.sessions.push({
        date: dateKey,
        time: timeStr,
        seconds: seconds,
        mode: mode,
        note: cleanNote || (mode === 'commercial' ? 'Коммерческая работа' : 'Учеба / Пет-проект')
    });
}

// ==========================================
// 4. Бизнес-логика и рендер главного экрана
// ==========================================

function getMonthlyIncomeStats(excludeCurrentMonth) {
    const map = {};
    const now = new Date();
    const currentKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    for (let i = 1; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        map[key] = 0;
    }

    state.orders.forEach(function(o) {
        if ((o.amount || 0) > 0 && o.date) {
            const ym = o.date.slice(0, 7);
            if (excludeCurrentMonth && ym === currentKey) return;
            map[ym] = (map[ym] || 0) + o.amount;
        }
    });

    return Object.keys(map)
        .sort()
        .reverse()
        .map(function(key) {
            return { key: key, label: formatMonthLabel(key), amount: map[key] };
        });
}

function updateAchievements(notifyNew) {
    if (notifyNew === undefined) notifyNew = true;
    if (!Array.isArray(state.notifiedIds)) state.notifiedIds = state.unlockedIds.slice();

    ACHS.forEach(function(a) {
        const unlocked = a.check(state);
        const exists = state.unlockedIds.includes(a.id);
        if (unlocked && !exists) {
            state.unlockedIds.push(a.id);
            if (notifyNew && !state.notifiedIds.includes(a.id)) {
                state.notifiedIds.push(a.id);
                showToast('🏆 Новое достижение!', a.title);
            }
        } else if (!unlocked && exists) {
            state.unlockedIds = state.unlockedIds.filter(function(id) { return id !== a.id; });
        }
    });

    const countText = state.unlockedIds.length + '/' + ACHS.length;
    document.getElementById('achs-count').textContent = countText;
    document.getElementById('modal-achs-count').textContent = countText;

    const recentIds = state.unlockedIds.slice(-4).reverse();
    const achListEl = document.getElementById('ach-list');

    if (recentIds.length === 0) {
        achListEl.innerHTML = '<div style="color:#9399b2; font-size:14px; text-align:center; padding:12px;">Пока нет открытых достижений. Запустите таймер или добавьте проект!</div>';
    } else {
        achListEl.innerHTML = recentIds.map(function(id) {
            const a = ACHS.find(function(item) { return item.id === id; });
            return '<div class="ach-item unlocked"><strong>' + escapeHtml(a.title) + '</strong><span>' + escapeHtml(a.desc) + '</span></div>';
        }).join('');
    }
}

function renderOrderRow(o, realIndex) {
    const priceText = o.amount > 0 ? '+' + o.amount.toLocaleString('ru-RU') + ' ₽' : 'В зачете';
    const badgeHtml = o.type === 'project'
        ? '<span class="badge-type badge-project">Проект</span>'
        : '<span class="badge-type badge-order">Заказ</span>';

    return '<div class="order-item">' +
        '<span>' + badgeHtml + escapeHtml(o.title) + '</span>' +
        '<div class="order-right">' +
        '<strong class="green">' + priceText + '</strong>' +
        '<button class="btn-del-order" data-del-order="' + realIndex + '" title="Удалить">✕</button>' +
        '</div>' +
        '</div>';
}

function renderGradeSection(exactHours) {
    const currentGradeName = state.gradeIdx === 0 ? 'Trainee' : GRADES.at(state.gradeIdx - 1).grade;
    document.getElementById('grade-name').textContent = currentGradeName;

    const examBtn = document.getElementById('open-exam-btn');
    const reqBox = document.getElementById('grade-reqs');

    if (state.gradeIdx < GRADES.length) {
        const next = GRADES.at(state.gradeIdx);
        const projectsCount = countProjects(state);
        const hoursDone = exactHours >= next.reqHours;
        const ordersDone = projectsCount >= next.reqOrders;
        const canTakeExam = hoursDone && ordersDone;

        examBtn.classList.remove('hidden');
        examBtn.disabled = !canTakeExam;
        examBtn.textContent = canTakeExam ? '🎓 Сдать на ' + next.grade : '🔒 ' + next.grade;

        reqBox.innerHTML =
            '<div class="req-header">Условия допуска к экзамену на <strong>' + escapeHtml(next.grade) + '</strong>:</div>' +
            '<div class="req-row ' + (hoursDone ? 'done' : '') + '">' +
            '<span>' + (hoursDone ? '✅' : '⏳') + ' Практика за кодом</span>' +
            '<span>' + exactHours.toFixed(1) + ' / ' + next.reqHours + ' ч</span>' +
            '</div>' +
            '<div class="req-row ' + (ordersDone ? 'done' : '') + '">' +
            '<span>' + (ordersDone ? '✅' : '⏳') + ' Коммерческие проекты</span>' +
            '<span>' + projectsCount + ' / ' + next.reqOrders + ' шт.</span>' +
            '</div>';
    } else {
        examBtn.classList.add('hidden');
        reqBox.innerHTML = '<div style="color:#a6e3a1;">👑 Максимальный грейд Senior подтвержден!</div>';
    }
}

function renderMoneySection() {
    const now = new Date();
    const currentMonthPrefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const currentYearPrefix = String(now.getFullYear());

    let displayMoney = state.money;
    if (moneyPeriod === 'month' || moneyPeriod === 'year') {
        const prefix = moneyPeriod === 'month' ? currentMonthPrefix : currentYearPrefix;
        displayMoney = state.orders
            .filter(function(o) { return (o.amount || 0) > 0 && (o.date || '').startsWith(prefix); })
            .reduce(function(sum, o) { return sum + (o.amount || 0); }, 0);
    }
    document.getElementById('money').textContent = displayMoney.toLocaleString('ru-RU') + ' ₽';

    const recent3 = getMonthlyIncomeStats(true).slice(0, 3);
    document.getElementById('recent-months-list').innerHTML = recent3.map(function(m) {
        return '<div class="month-row"><span>' + escapeHtml(m.label) + '</span><strong>' + m.amount.toLocaleString('ru-RU') + ' ₽</strong></div>';
    }).join('');
}

function render(notifyNewAchs) {
    if (notifyNewAchs === undefined) notifyNewAchs = true;
    updateAchievements(notifyNewAchs);
    saveState(state);

    const openTasks = state.tasks.filter(function(t) { return !t.done; }).length;
    document.getElementById('tasks-count').textContent = openTasks;
    document.getElementById('work-time').textContent = formatDurationRu(state.workSec);
    document.getElementById('orders-count').textContent = state.orders.length;

    const exactHours = state.workSec / 3600;
    const commHours = (state.commercialSec || 0) / 3600;
    const rate = commHours > 0 ? Math.round(state.money / commHours) : 0;
    document.getElementById('rate').textContent = rate.toLocaleString('ru-RU') + ' ₽/ч';

    renderGradeSection(exactHours);
    renderMoneySection();

    const totalOrders = state.orders.length;
    const recentOrders = state.orders.slice(-3).reverse();
    document.getElementById('order-history').innerHTML = recentOrders
        .map(function(o, idx) { return renderOrderRow(o, totalOrders - 1 - idx); })
        .join('');
}
// ==========================================
// 5. Модальные окна (Статистика, Достижения, Журнал)
// ==========================================

function renderStatsModal() {
    const totalOrders = state.orders.length;
    const projectsTotal = countProjects(state);
    const paidOrders = state.orders.filter(function(o) { return o.amount > 0; });
    const avgCheck = paidOrders.length > 0 ? Math.round(state.money / paidOrders.length) : 0;

    document.getElementById('modal-summary').innerHTML =
        '<div class="summary-box"><div class="label">Проекты / Всего</div><strong>' + projectsTotal + ' / ' + totalOrders + ' шт.</strong></div>' +
        '<div class="summary-box"><div class="label">Общий доход</div><strong class="green">' + state.money.toLocaleString('ru-RU') + ' ₽</strong></div>' +
        '<div class="summary-box"><div class="label">Средний чек</div><strong>' + avgCheck.toLocaleString('ru-RU') + ' ₽</strong></div>';

    const fullListEl = document.getElementById('full-order-history');
    if (totalOrders === 0) {
        fullListEl.innerHTML = '<div style="color:#9399b2; text-align:center; padding: 20px;">Пока нет закрытых работ</div>';
    } else {
        fullListEl.innerHTML = state.orders.slice().reverse().map(function(o, idx) {
            return renderOrderRow(o, totalOrders - 1 - idx);
        }).join('');
    }
}

function renderAchsModal() {
    const categories = [...new Set(ACHS.map(function(a) { return a.cat; }))];
    document.getElementById('full-ach-list').innerHTML = categories.map(function(catName) {
        const itemsHtml = ACHS.filter(function(a) { return a.cat === catName; }).map(function(a) {
            const unlocked = state.unlockedIds.includes(a.id);
            return '<div class="ach-item ' + (unlocked ? 'unlocked' : '') + '"><strong>' + escapeHtml(a.title) + '</strong><span>' + escapeHtml(a.desc) + '</span></div>';
        }).join('');
        return '<div class="ach-category-title">' + escapeHtml(catName) + '</div>' + itemsHtml;
    }).join('');
}

function renderSessionsModal() {
    const todayKey = getLocalDateKey();
    const todaySec = state.sessions
        .filter(function(s) { return s.date === todayKey; })
        .reduce(function(acc, s) { return acc + s.seconds; }, 0);

    document.getElementById('sessions-summary').innerHTML =
        '<div class="summary-box"><div class="label">Сегодня</div><strong>' + formatDurationRu(todaySec) + '</strong></div>' +
        '<div class="summary-box"><div class="label">Коммерция (всего)</div><strong class="green">' + formatDurationRu(state.commercialSec) + '</strong></div>' +
        '<div class="summary-box"><div class="label">Записано сессий</div><strong>' + state.sessions.length + ' шт.</strong></div>';

    const listEl = document.getElementById('sessions-history-list');
    if (state.sessions.length === 0) {
        listEl.innerHTML = '<div style="color:#9399b2; text-align:center; padding: 20px;">Пока нет записанных сессий по таймеру</div>';
        return;
    }

    const groups = {};
    state.sessions.forEach(function(s, realIndex) {
        if (!groups[s.date]) groups[s.date] = { totalSec: 0, items: [] };
        groups[s.date].totalSec += s.seconds;
        groups[s.date].items.push({ date: s.date, time: s.time, seconds: s.seconds, mode: s.mode, note: s.note, realIndex: realIndex });
    });

    const sortedDates = Object.keys(groups).sort().reverse();
    listEl.innerHTML = sortedDates.map(function(date) {
        const g = groups[date];
        const formattedDate = date.split('-').reverse().join('.');
        const rowsHtml = g.items.slice().reverse().map(function(item) {
            const badge = item.mode === 'commercial'
                ? '<span class="badge-type badge-project">Коммерция</span>'
                : '<span class="badge-type badge-order">Учеба</span>';
            return '<div class="session-row">' +
                '<div class="session-meta">' + badge + '<span>' + escapeHtml(item.note) + '</span><span class="session-time-tag">(' + escapeHtml(item.time) + ')</span></div>' +
                '<div class="order-right"><strong>' + formatDurationRu(item.seconds) + '</strong><button class="btn-del-order" data-del-session="' + item.realIndex + '" title="Удалить сессию">✕</button></div>' +
                '</div>';
        }).join('');

        return '<div class="session-day-group">' +
            '<div class="session-day-header"><span>📅 ' + escapeHtml(formattedDate) + '</span><span>Итого за день: ' + formatDurationRu(g.totalSec) + '</span></div>' +
            rowsHtml +
            '</div>';
    }).join('');
}

// ==========================================
// 6. Обработчики событий (делегирование)
// ==========================================

document.body.addEventListener('click', function(e) {
    const roleBtn = e.target.closest('[data-role]');
    if (roleBtn) {
        switchRole(roleBtn.dataset.role);
        return;
    }

    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
        document.getElementById(closeBtn.dataset.close).classList.add('hidden');
        return;
    }
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.add('hidden');
        return;
    }

    const delOrderBtn = e.target.closest('[data-del-order]');
    if (delOrderBtn) {
        const index = Number(delOrderBtn.dataset.delOrder);
        const order = state.orders.at(index);
        if (!order) return;
        showConfirmModal(
            '🗑️ Удалить запись?',
            'Запись «' + order.title + '» будет удалена из истории.',
            function() {
                state.money = Math.max(0, state.money - (order.amount || 0));
                state.orders.splice(index, 1);
                render(false);
                if (!document.getElementById('stats-modal').classList.contains('hidden')) renderStatsModal();
            }
        );
        return;
    }

    const delSessionBtn = e.target.closest('[data-del-session]');
    if (delSessionBtn) {
        const index = Number(delSessionBtn.dataset.delSession);
        const sess = state.sessions.at(index);
        if (!sess) return;
        showConfirmModal(
            '🗑️ Удалить сессию?',
            'Рабочая сессия (' + formatDurationRu(sess.seconds) + ') будет удалена из журнала.',
            function() {
                state.workSec = Math.max(0, state.workSec - sess.seconds);
                state.timerSec = Math.max(0, state.timerSec - sess.seconds);
                if (sess.mode === 'commercial') state.commercialSec = Math.max(0, state.commercialSec - sess.seconds);
                state.sessions.splice(index, 1);
                render(false);
                renderSessionsModal();
            }
        );
    }
});
// ==========================================
// 7. Кнопки навигации, таймера, форм и бэкапов
// ==========================================

document.getElementById('back-to-frontend-btn').onclick = function() { switchRole('frontend'); };

document.getElementById('open-stats-btn').onclick = function() {
    renderStatsModal();
    document.getElementById('stats-modal').classList.remove('hidden');
};

document.getElementById('open-achs-btn').onclick = function() {
    renderAchsModal();
    document.getElementById('achs-modal').classList.remove('hidden');
};

document.getElementById('open-sessions-btn').onclick = function() {
    renderSessionsModal();
    document.getElementById('sessions-modal').classList.remove('hidden');
};

document.getElementById('open-roadmap-btn').onclick = function() {
    renderRoadmapModal(state);
    document.getElementById('roadmap-modal').classList.remove('hidden');
};

document.getElementById('open-tasks-btn').onclick = function() {
    renderTasksModal(state);
    document.getElementById('tasks-modal').classList.remove('hidden');
};

document.getElementById('open-manual-time-btn').onclick = function() {
    document.getElementById('manual-time-modal').classList.remove('hidden');
};

document.getElementById('save-manual-time-btn').onclick = function() {
    const h = Number(document.getElementById('manual-hours').value) || 0;
    const m = Number(document.getElementById('manual-mins').value) || 0;
    const totalSec = h * 3600 + m * 60;
    if (totalSec <= 0) return;

    const modeEl = document.querySelector('input[name="manual-mode"]:checked');
    const mode = modeEl ? modeEl.value : 'commercial';
    const note = document.getElementById('manual-note').value;

    logWorkSession(totalSec, mode, note);
    document.getElementById('manual-note').value = '';
    document.getElementById('manual-time-modal').classList.add('hidden');
    render();
    showToast('⏱ Время добавлено', 'Записано: ' + formatDurationRu(totalSec));
};

document.querySelectorAll('input[name="work-mode"]').forEach(function(radio) {
    radio.onchange = function() {
        if (state.activeTimer.isRunning || state.activeTimer.accumulatedSec > 0) return;
        state.activeTimer.mode = this.value;
        saveState(state);
    };
});

document.getElementById('start-btn').onclick = function() {
    if (state.activeTimer.isRunning) return;
    const modeEl = document.querySelector('input[name="work-mode"]:checked');
    const mode = modeEl ? modeEl.value : 'commercial';

    state.activeTimer.isRunning = true;
    state.activeTimer.startTime = Date.now();
    state.activeTimer.mode = mode;
    saveState(state);
    syncTimerModeLock();

    this.disabled = true;
    this.innerHTML = PLAY_ICON_SVG + ' Старт';
    document.getElementById('pause-btn').disabled = false;
    document.getElementById('claim-btn').disabled = false;
    startTicking();
};

document.getElementById('pause-btn').onclick = function() {
    if (!state.activeTimer.isRunning) return;
    clearInterval(timerInterval);
    timerInterval = null;

    state.activeTimer.accumulatedSec = getElapsedSeconds();
    state.activeTimer.isRunning = false;
    state.activeTimer.startTime = null;
    saveState(state);

    this.disabled = true;
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = false;
    startBtn.innerHTML = PLAY_ICON_SVG + ' Продолжить';
};

document.getElementById('claim-btn').onclick = function() {
    clearInterval(timerInterval);
    timerInterval = null;

    const totalSec = getElapsedSeconds();
    const modeEl = document.querySelector('input[name="work-mode"]:checked');
    const mode = modeEl ? modeEl.value : state.activeTimer.mode;

    state.activeTimer = { isRunning: false, startTime: null, accumulatedSec: 0, mode: mode };
    syncTimerModeLock();
    logWorkSession(totalSec, mode);

    document.getElementById('timer').textContent = '00:00:00';
    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = false;
    startBtn.innerHTML = PLAY_ICON_SVG + ' Старт';
    document.getElementById('pause-btn').disabled = true;
    this.disabled = true;

    render();
};

document.getElementById('add-order-btn').onclick = function() {
    const title = document.getElementById('order-title').value.trim() || 'Работа';
    const typeEl = document.querySelector('input[name="order-type"]:checked');
    const type = typeEl ? typeEl.value : 'order';
    const amount = Number(document.getElementById('order-amount').value);

    if (amount > 0) {
        state.money += amount;
        state.orders.push({
            title: title,
            amount: amount,
            type: type,
            date: getLocalDateKey()
        });
        document.getElementById('order-title').value = '';
        document.getElementById('order-amount').value = '';
        render();
    }
};

document.getElementById('open-exam-btn').onclick = function() {
    startQuizModal(false, state.gradeIdx, function(res) {
        if (res && res.passedExam) {
            state.gradeIdx++;
            saveState(state);
            state = loadState();
            showToast('🗺️ Roadmap обновлен!', 'Открыты новые темы следующего грейда');
        }
        switchRole('frontend');
        render();
    });
};

document.getElementById('export-btn').onclick = function() { exportBackup(state); };
document.getElementById('import-input').onchange = function(e) {
    const file = e.target.files.item(0);
    if (!file) return;
    importBackup(
        file,
        function(loadedState) {
            state = loadedState;
            document.getElementById('welcome-screen').classList.add('hidden');
            switchRole('frontend');
            restoreTimerOnLoad();
            render(false);
            showToast('📂 Бэкап загружен', 'Все данные успешно восстановлены!');
        },
        function(errMsg) {
            showToast('❌ Ошибка импорта', errMsg);
        }
    );
    e.target.value = '';
};

document.getElementById('reset-btn').onclick = function() {
    showConfirmModal(
        '⚠️ Сбросить весь прогресс?',
        'Все часы, заказы, задачи и достижения будут удалены, и откроется стартовый экран.',
        function() {
            clearInterval(timerInterval);
            clearState();
            delete document.getElementById('quiz-screen').dataset.active;
            state = null;
            init();
        },
        'Сбросить всё'
    );
};

document.querySelectorAll('input[name="order-type"]').forEach(function(radio) {
    radio.onchange = function() {
        const hintEl = document.getElementById('order-type-hint');
        if (!hintEl) return;
        if (this.value === 'project') {
            hintEl.innerHTML = '🚀 <strong>Проект:</strong> полноценный сайт, лендинг или приложение под ключ. Идет в доход и засчитывается в прогресс грейда.';
        } else {
            hintEl.innerHTML = '🛠️ <strong>Заказ:</strong> разовые правки, доработка блока или консультация. Идет в доход и статистику, но не двигает прогресс грейда.';
        }
    };
});

document.querySelectorAll('#money-period-switch .period-btn').forEach(function(btn) {
    btn.onclick = function() {
        moneyPeriod = this.dataset.period;
        document.querySelectorAll('#money-period-switch .period-btn').forEach(function(b) {
            b.classList.toggle('active', b.dataset.period === moneyPeriod);
        });
        render(false);
    };
});

document.getElementById('open-months-btn').onclick = function() {
    const map = {};
    state.orders.forEach(function(o) {
        if ((o.amount || 0) > 0 && o.date) {
            const ym = o.date.slice(0, 7);
            map[ym] = (map[ym] || 0) + o.amount;
        }
    });

    const realMonths = Object.keys(map)
        .sort()
        .reverse()
        .map(function(key) {
            return { label: formatMonthLabel(key), amount: map[key] };
        });

    const listEl = document.getElementById('all-months-list');
    if (realMonths.length === 0) {
        listEl.innerHTML = '<div style="color:#9399b2; text-align:center; padding: 24px 12px; line-height: 1.5;">Пока нет статистики по доходам. Добавьте свой первый оплаченный заказ, проект или зарплату!</div>';
    } else {
        listEl.innerHTML = realMonths.map(function(m) {
            return '<div class="order-item"><span>' + escapeHtml(m.label) + '</span><strong class="green">' + m.amount.toLocaleString('ru-RU') + ' ₽</strong></div>';
        }).join('');
    }

    document.getElementById('months-modal').classList.remove('hidden');
};

document.getElementById('welcome-start-quiz-btn').onclick = function() {
    const quizScreen = document.getElementById('quiz-screen');
    document.getElementById('welcome-screen').classList.add('hidden');
    quizScreen.dataset.active = 'true';

    startQuizModal(true, 0, function(newState) {
        delete quizScreen.dataset.active;
        state = newState;
        switchRole('frontend');
        restoreTimerOnLoad();
        render();
    });
};

document.getElementById('welcome-start-zero-btn').onclick = function() {
    document.getElementById('welcome-screen').classList.add('hidden');
    state = createInitialState(0, 0, []);
    saveState(state);
    switchRole('frontend');
    restoreTimerOnLoad();
    render();
};

document.getElementById('footer-backup-btn').onclick = function() {
    if (state) {
        exportBackup(state);
    } else {
        showToast('ℹ️ Пока нечего сохранять', 'Сначала начните работу или пройдите стартовый квиз.');
    }
};

initTasksEvents(function() { return state; }, function() { render(false); });
initRoadmapEvents(function() { return state; }, function() { saveState(state); });
init();
