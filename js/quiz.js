import { START_QUIZ, GRADES } from './data.js';
import { createInitialState } from './storage.js';
import { escapeHtml } from './utils.js';


let isStartCalibration = false;
let qIdx = 0;
let correctAnswers = 0;
let earnedScore = 0;
let earnedHours = 0;
let maxPossibleScore = 0;
let onFinishCallback = null;
let activeQuestions = [];
let missedTopics = [];

function shuffle(array) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = copy.at(i);
        copy[i] = copy.at(j);
        copy[j] = temp;
    }
    return copy;
}

export function startQuizModal(isCalibration, currentGradeIdx, onComplete) {
    isStartCalibration = isCalibration;
    qIdx = 0;
    correctAnswers = 0;
    earnedScore = 0;
    earnedHours = 0;
    maxPossibleScore = 0;
    missedTopics = [];
    onFinishCallback = onComplete;

    document.getElementById('main-screen').classList.add('hidden');
    document.getElementById('quiz-screen').classList.remove('hidden');

    const titleEl = document.getElementById('quiz-title');
    const subEl = document.getElementById('quiz-sub');
    const cancelBtn = document.getElementById('cancel-quiz-btn');
    cancelBtn.classList.remove('hidden');

    if (isCalibration) {
        const juniorBlock = shuffle(START_QUIZ.slice(0, 5));
        const juniorPlusBlock = shuffle(START_QUIZ.slice(5, 10));
        const middleBlock = shuffle(START_QUIZ.slice(10, 15));
        const seniorBlock = shuffle(START_QUIZ.slice(15, 20));
        const techQuestions = juniorBlock
            .concat(juniorPlusBlock)
            .concat(middleBlock)
            .concat(seniorBlock);
        const lastQuestion = START_QUIZ.at(-1);
        activeQuestions = techQuestions.concat([lastQuestion]);

        techQuestions.forEach(function(item) {
            maxPossibleScore += (item.weight || 1);
        });

        titleEl.textContent = '🎯 Определение стартового грейда';
        subEl.textContent = '20 вопросов разной сложности + учет коммерческого опыта. Незнакомые темы можно пропускать.';
        cancelBtn.textContent = 'Пропустить и начать с нуля (Trainee)';
    } else {
        activeQuestions = shuffle(GRADES.at(currentGradeIdx).questions);
        const passNeeded = Math.ceil(activeQuestions.length * 0.8);

        const nextGrade = GRADES.at(currentGradeIdx).grade;
        titleEl.textContent = '🎓 Экзамен на ' + nextGrade;
        subEl.textContent = 'Для сдачи нужно набрать минимум ' + passNeeded + ' из ' + activeQuestions.length + ' правильных ответов (80%).';
        cancelBtn.textContent = '← Вернуться в трекер';
    }

    renderQuestion(currentGradeIdx);
}

function renderQuestion(currentGradeIdx) {
    const item = activeQuestions.at(qIdx);

    document.getElementById('quiz-progress').textContent = 'Вопрос ' + (qIdx + 1) + ' из ' + activeQuestions.length;
    const box = document.getElementById('quiz-options');
    box.innerHTML = '';

    if (isStartCalibration && item.isCommercialQuestion) {
        document.getElementById('quiz-question').textContent = 'Сколько коммерческих проектов вы уже закрыли?';
        box.innerHTML =
            '<div class="quiz-hint">' +
            'Учитываются <strong>только полноценные коммерческие проекты</strong>, выполненные до установки трекера: сайты-визитки, лендинги, многостраничные сайты, интернет-магазины, веб-приложения и др.<br><br>' +
            'Мелкие учебные работы, пет-проекты «в стол» и разовые правки верстки сюда не входят.' +
            '</div>' +
            '<div class="quiz-projects-form">' +
            '<div class="label no-margin">Количество закрытых коммерческих проектов</div>' +
            '<input type="number" id="past-projects-count" min="0" max="500" value="0">' +
            '<button class="btn-add btn-full" id="finish-calibration-btn">Завершить и посмотреть результат →</button>' +
            '</div>';

        document.getElementById('finish-calibration-btn').onclick = function() {
            const count = Math.max(0, Math.floor(Number(document.getElementById('past-projects-count').value) || 0));
            finishCalibration(count);
        };
        return;
    }

    document.getElementById('quiz-question').textContent = item.q;

    const mappedOptions = item.opts.map(function(text, i) {
        return { text: text, isCorrect: i === item.ans };
    });
    const shuffledOptions = shuffle(mappedOptions);

    shuffledOptions.forEach(function(optObj) {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.textContent = optObj.text;
        btn.onclick = function() {
            handleAnswer(optObj.isCorrect, currentGradeIdx);
        };
        box.appendChild(btn);
    });

    const idkBtn = document.createElement('button');
    idkBtn.className = 'quiz-opt';
    idkBtn.style.opacity = '0.7';
    idkBtn.textContent = '🤷‍♂️ Не знаю (пропустить этот вопрос)';
    idkBtn.onclick = function() { handleAnswer(false, currentGradeIdx); };
    box.appendChild(idkBtn);
}

function handleAnswer(isCorrect, currentGradeIdx) {
    const currentItem = activeQuestions.at(qIdx);

    if (isCorrect) {
        correctAnswers++;
        earnedScore += (currentItem.weight || 1);
        earnedHours += (currentItem.hours || 0);
    } else {
        missedTopics.push(currentItem.q);
    }

    qIdx++;
    if (qIdx < activeQuestions.length) {
        renderQuestion(currentGradeIdx);
    } else {
        finishExam(currentGradeIdx);
    }
}

function renderResultScreen(isSuccess, title, statsHtml, topics, onContinue) {
    document.getElementById('quiz-progress').textContent = 'Результат тестирования';
    document.getElementById('quiz-question').textContent = '';
    document.getElementById('cancel-quiz-btn').classList.add('hidden');

    let missedHtml = '';
    if (topics && topics.length > 0) {
        const items = topics.map(function(t) { return '<li>' + escapeHtml(t) + '</li>'; }).join('');
        missedHtml =
            '<div class="quiz-missed-list">' +
            '<div class="label no-margin">Темы, которые стоит повторить:</div>' +
            '<ul>' + items + '</ul>' +
            '</div>';
    }

    const box = document.getElementById('quiz-options');
    box.innerHTML =
        '<div class="quiz-result-box">' +
        '<div class="quiz-result-banner ' + (isSuccess ? 'success' : 'fail') + '">' +
        '<div class="quiz-result-title">' + title + '</div>' +
        '<div class="quiz-result-stats">' + statsHtml + '</div>' +
        '</div>' +
        missedHtml +
        '<button class="btn-add btn-full" id="quiz-continue-btn">Перейти в трекер →</button>' +
        '</div>';

    document.getElementById('quiz-continue-btn').onclick = onContinue;
}

function finishExam(currentGradeIdx) {
    const total = activeQuestions.length;
    const passNeeded = Math.ceil(total * 0.8);
    const gradeName = GRADES.at(currentGradeIdx).grade;
    const passed = correctAnswers >= passNeeded;

    if (passed) {
        renderResultScreen(
            true,
            '🎉 Экзамен на ' + gradeName + ' сдан!',
            'Правильных ответов: <strong>' + correctAnswers + ' из ' + total + '</strong>. Новый грейд успешно подтвержден.',
            missedTopics,
            function() { onFinishCallback({ passedExam: true }); }
        );
    } else {
        renderResultScreen(
            false,
            '❌ Экзамен на ' + gradeName + ' не сдан',
            'Набрано <strong>' + correctAnswers + ' из ' + total + '</strong> (для сдачи нужно минимум ' + passNeeded + '). Подтяните пробелы и попробуйте снова.',
            missedTopics,
            function() { onFinishCallback(null); }
        );
    }
}

function finishCalibration(projectsCount) {
    let startGradeIdx = 0;

    // Максимум баллов = 70
    if (earnedScore >= 58 && projectsCount >= 30) {
        startGradeIdx = 4; // Senior (5000 ч, 30 проектов)
    } else if (earnedScore >= 40 && projectsCount >= 12) {
        startGradeIdx = 3; // Middle (2400 ч, 12 проектов)
    } else if ((earnedScore >= 22 && projectsCount >= 4) || (earnedScore >= 32 && projectsCount >= 2)) {
        startGradeIdx = 2; // Junior+ (1000 ч, 4 проекта)
    } else if (earnedScore >= 8) {
        startGradeIdx = 1; // Junior (400 ч, 0 проектов)
    }

    const startOrders = [];
    for (let i = 0; i < projectsCount; i++) {
        startOrders.push({ title: 'Коммерческий проект #' + (i + 1), amount: 0, type: 'project' });
    }

    const gradeLabel = startGradeIdx === 0 ? 'Trainee' : GRADES.at(startGradeIdx - 1).grade;
    const totalTechQuestions = START_QUIZ.length - 1;
    const startHours = earnedHours;

    const statsText =
        'Правильных ответов: <strong>' + correctAnswers + ' из ' + totalTechQuestions + '</strong> (набрано <strong>' + earnedScore + ' из ' + maxPossibleScore + '</strong> баллов).<br>' +
        'Ваш стартовый грейд: <strong>' + gradeLabel + '</strong>.<br>' +
        'Зачтено: <strong>' + startHours + ' ч</strong> практики по итогам теста и <strong>' + projectsCount + ' коммерч. проектов</strong> в портфолио.';

    renderResultScreen(
        true,
        '🎯 Калибровка завершена!',
        statsText,
        missedTopics,
        function() {
            onFinishCallback(createInitialState(startGradeIdx, startHours * 3600, startOrders));
        }
    );
}

document.getElementById('quiz-screen').addEventListener('click', function(e) {
    if (e.target.closest('#cancel-quiz-btn')) {
        if (isStartCalibration) {
            onFinishCallback(createInitialState(0, 0, []));
        } else {
            onFinishCallback(null);
        }
    }
});
