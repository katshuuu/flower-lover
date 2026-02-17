const state = {
    currentStep: 'recipientChoice',
    recipientType: null,
    currentQuestion: 0,
    answers: {
        forWhom: null,
        age: null,
        colors: null,
        note: null,
        occasion: null,
        noteText: null
    },
    isGenerating: false,
    isWaitingForNoteText: false,
    currentImageUrl: null,
    orderId: null,
    generationRequestId: null
};

// Вопросы для опроса
const questions = [
    {
        id: 'forWhom',
        text: 'Для кого букет?',
        options: [
            { text: 'Для жены/мужа', icon: 'fas fa-heart', value: 'супруг(а)' },
            { text: 'Для мамы/папы', icon: 'fas fa-home', value: 'родитель' },
            { text: 'Для девушки/парня', icon: 'fas fa-user-friends', value: 'возлюбленный(ая)' },
            { text: 'Коллеге на день рождения', icon: 'fas fa-briefcase', value: 'коллега' },
            { text: 'Подруге/другу', icon: 'fas fa-user', value: 'друг' },
            { text: 'Себе в офис/домой', icon: 'fas fa-building', value: 'себе' }
        ]
    },
    {
        id: 'occasion',
        text: 'Какой повод для букета? 💐',
        options: [
            { text: '8 марта', icon: 'fas fa-female', value: '8 марта' },
            { text: 'Свадьба', icon: 'fas fa-ring', value: 'свадьба' },
            { text: 'День рождения', icon: 'fas fa-birthday-cake', value: 'день рождения' },
            { text: 'Годовщина отношений', icon: 'fas fa-heart', value: 'годовщина' },
            { text: 'Просто так/без повода', icon: 'fas fa-surprise', value: 'без повода' },
            { text: 'Извинение', icon: 'fas fa-dove', value: 'извинение' }
        ]
    },
    {
        id: 'age',
        text: 'Какой возраст получателя?',
        options: [
            { text: 'Ребенок (до 12 лет)', icon: 'fas fa-child', value: 'ребенок' },
            { text: 'Подросток (13-19 лет)', icon: 'fas fa-user-graduate', value: 'подросток' },
            { text: 'Молодой (20-35 лет)', icon: 'fas fa-user', value: 'молодой' },
            { text: 'Взрослый (36-55 лет)', icon: 'fas fa-user-tie', value: 'взрослый' },
            { text: 'Пожилой (55+)', icon: 'fas fa-user-friends', value: 'пожилой' },
            { text: 'Не важно', icon: 'fas fa-times', value: 'не важно' }
        ]
    },
    {
        id: 'colors',
        text: 'Какие цвета предпочтительны?',
        options: [
            { text: 'Нежные пастельные', icon: 'fas fa-pastafarianism', value: 'пастельные' },
            { text: 'Яркие и сочные', icon: 'fas fa-fire', value: 'яркие' },
            { text: 'Бело-зеленые', icon: 'fas fa-leaf', value: 'бело-зеленые' },
            { text: 'Красные/бордовые', icon: 'fas fa-heart', value: 'красные' },
            { text: 'Розовые', icon: 'fas fa-heart', value: 'розовые' },
            { text: 'Синие/фиолетовые', icon: 'fas fa-moon', value: 'синие' }
        ]
    },
    {
        id: 'note',
        text: 'Нужна ли записка к букету?',
        options: [
            { text: 'Да, с текстом "С днем рождения!"', icon: 'fas fa-birthday-cake', value: 'с днем рождения' },
            { text: 'Да, с романтичным текстом', icon: 'fas fa-heart', value: 'романтичная' },
            { text: 'Да, со своим текстом', icon: 'fas fa-pen', value: 'своя' },
            { text: 'Да, стандартная открытка', icon: 'fas fa-envelope', value: 'стандартная' },
            { text: 'Нет, записка не нужна', icon: 'fas fa-times', value: 'нет' },
            { text: 'Пока не знаю', icon: 'fas fa-question', value: 'не знаю' }
        ]
    }
];

// Элементы DOM
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const closeBtn = document.getElementById('closeBtn');
const chatInputContainer = document.getElementById('chatInputContainer');
const creationProgress = document.getElementById('creationProgress');
const progressFill = document.getElementById('progressFill');
const progressStep = document.getElementById('progressStep');
const root = document.documentElement;

// API URL
const API_URL = window.location.origin;

// Функция для обновления прогресс-бара
function updateProgressBar() {
    const progress = ((state.currentQuestion) / 5) * 100;
    root.style.setProperty('--progress', `${progress}%`);
    progressFill.style.width = `${progress}%`;
    progressStep.textContent = state.currentQuestion === 6 ? 'Генерация букета...' : `Вопрос ${state.currentQuestion + 1} из 5`;
}

// Функция для показа индикатора набора
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingDiv;
}

// Функция для удаления индикатора набора
function removeTypingIndicator(typingElement) {
    if (typingElement && typingElement.parentNode) {
        typingElement.remove();
    }
}

// Функция для добавления сообщения в чат
function addMessage(text, isUser = false, options = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    let messageHTML = `
        <div class="message-header">
            <i class="fas ${isUser ? 'fa-user' : 'fa-spa'}"></i>
            <span>${isUser ? 'Вы' : 'FloraAI'}</span>
        </div>
        <p>${text}</p>
    `;

    if (options && !isUser) {
        messageHTML += `
            <div class="options-container">
                <div class="options-title">Выберите подходящий вариант:</div>
                <div class="options-grid" id="optionsGrid">
        `;

        options.forEach((option, index) => {
            messageHTML += `
                <button class="option-btn" data-index="${index}" data-value="${option.value}">
                    <div class="option-icon">
                        <i class="${option.icon}"></i>
                    </div>
                    ${option.text}
                </button>
            `;
        });

        messageHTML += `
                </div>
            </div>
        `;
    }

    messageDiv.innerHTML = messageHTML;
    chatMessages.appendChild(messageDiv);

    if (options && !isUser) {
        setTimeout(() => {
            const optionButtons = messageDiv.querySelectorAll('.option-btn');
            optionButtons.forEach(button => {
                button.addEventListener('click', function () {
                    const index = parseInt(this.getAttribute('data-index'));
                    const value = this.getAttribute('data-value');

                    optionButtons.forEach(btn => btn.classList.remove('selected'));
                    this.classList.add('selected');

                    handleOptionSelect(value);
                });
            });
        }, 100);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageDiv;
}

// Функция для создания кнопок выбора
function createChoiceButtons(buttons) {
    const container = document.createElement('div');
    container.className = 'options-container';
    
    const grid = document.createElement('div');
    grid.className = 'options-grid';
    
    buttons.forEach(button => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `
            <div class="option-icon">
                <i class="${button.icon}"></i>
            </div>
            ${button.text}
        `;
        btn.addEventListener('click', () => button.action());
        grid.appendChild(btn);
    });
    
    container.appendChild(grid);
    return container;
}

// Функция для проверки статуса генерации
async function checkGenerationStatus(requestId) {
    try {
        const response = await fetch(`${API_URL}/api/status/${requestId}`);
        const data = await response.json();
        
        return data;
    } catch (error) {
        console.error('Error checking status:', error);
        return null;
    }
}

// Функция для ожидания генерации
async function waitForGeneration(requestId) {
    const maxAttempts = 60; // 60 секунд максимум
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const status = await checkGenerationStatus(requestId);
        
        if (status && status.status === 'completed') {
            return status;
        } else if (status && status.status === 'failed') {
            throw new Error('Генерация не удалась');
        }
        
        // Ждем 1 секунду
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    throw new Error('Превышено время ожидания генерации');
}

// Функция для генерации промпта
function generatePrompt() {
    const forWhom = state.answers.forWhom || 'близкий человек';
    const occasion = state.answers.occasion || 'особый случай';
    const age = state.answers.age || 'взрослый';
    const colors = state.answers.colors || 'пастельные';
    
    // Словарь для перевода на русский (YandexART хорошо понимает русский)
    const colorMap = {
        'пастельные': 'нежные пастельные тона, розовый, лаванда, мята',
        'яркие': 'яркие сочные цвета, оранжевый, розовый, желтый',
        'бело-зеленые': 'белый и зеленый, белые розы, эвкалипт',
        'красные': 'красный и бордовый, красные розы',
        'розовые': 'розовый, пионы, розовые розы',
        'синие': 'синий и фиолетовый, гортензии, ирисы'
    };
    
    const occasionMap = {
        '8 марта': 'международный женский день, весенний букет',
        'свадьба': 'свадебный букет',
        'день рождения': 'праздничный букет на день рождения',
        'годовщина': 'романтический букет на годовщину',
        'без повода': 'букет просто так, сюрприз',
        'извинение': 'букет для извинения'
    };
    
    const forWhomMap = {
        'супруг(а)': 'для любимого супруга',
        'родитель': 'для любимого родителя',
        'возлюбленный(ая)': 'для любимого человека',
        'коллега': 'для коллеги',
        'друг': 'для лучшего друга',
        'себе': 'для себя, для дома'
    };
    
    const ageMap = {
        'ребенок': 'детский, яркий',
        'подросток': 'молодежный, современный',
        'молодой': 'молодежный',
        'взрослый': 'элегантный',
        'пожилой': 'классический',
        'не важно': 'универсальный'
    };
    
    // Составляем промпт на русском
    let prompt = `Красивый букет цветов, ${colorMap[colors]}, `;
    prompt += `${occasionMap[occasion]}, `;
    prompt += `${forWhomMap[forWhom]}, `;
    prompt += `${ageMap[age]}, `;
    prompt += `фотореалистичный, профессиональная фотосъемка, мягкий свет, белый фон, студийное фото, высокое качество, 8k, свежие цветы, капли росы`;
    
    // Добавляем записку
    if (state.answers.note && state.answers.note !== 'нет' && state.answers.note !== 'не знаю') {
        if (state.answers.note === 'своя' && state.answers.noteText) {
            prompt += `, с открыткой с текстом "${state.answers.noteText}"`;
        } else if (state.answers.note === 'с днем рождения') {
            prompt += `, с открыткой "С днем рождения!"`;
        } else if (state.answers.note === 'романтичная') {
            prompt += `, с романтической открыткой`;
        }
    }
    
    console.log('Generated prompt:', prompt);
    return prompt;
}

// Функция для показа выбора получателя
function showRecipientChoice() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        // Приветственное сообщение
        const welcomeMessage = document.getElementById('initialMessage');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'block';
        }
        
        // Вопрос о получателе
        const messageDiv = addMessage('Заказываете цветы для себя или другого получателя?', false);
        
        const choiceButtons = createChoiceButtons([
            {
                text: 'Для себя',
                icon: 'fas fa-user',
                action: () => {
                    addMessage('Для себя', true);
                    state.recipientType = 'self';
                    startQuestionnaire();
                }
            },
            {
                text: 'Для другого человека',
                icon: 'fas fa-users',
                action: () => {
                    addMessage('Для другого человека', true);
                    state.recipientType = 'other';
                    startQuestionnaire();
                }
            }
        ]);
        
        messageDiv.appendChild(choiceButtons);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 2000);
}

// Функция для начала опроса
function startQuestionnaire() {
    const typingIndicator = showTypingIndicator();
    
    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        
        addMessage('Хорошо, давайте подберем идеальный букет! Я задам несколько вопросов.', false);
        
        // Показываем прогресс-бар
        creationProgress.style.display = 'flex';
        state.currentStep = 'questions';
        
        // Начинаем опрос
        setTimeout(() => {
            askNextQuestion();
        }, 1500);
    }, 800);
}

// Функция для задания следующего вопроса
function askNextQuestion() {
    const typingIndicator = showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator(typingIndicator);
        const question = questions[state.currentQuestion];
        addMessage(question.text, false, question.options);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1000);
}

// Функция обработки выбора опции
function handleOptionSelect(value) {
    const currentQuestion = questions[state.currentQuestion];
    state.answers[currentQuestion.id] = value;

    const selectedOption = currentQuestion.options.find(opt => opt.value === value);
    addMessage(selectedOption.text, true);

    if (currentQuestion.id === 'note' && value === 'своя') {
        state.isWaitingForNoteText = true;
        addMessage('Напишите текст записки ✍️', false);
        
        setTimeout(() => {
            chatInputContainer.style.display = 'flex';
            userInput.focus();
        }, 400);
        
        return;
    }

    setTimeout(() => {
        state.currentQuestion++;
        updateProgressBar();

        if (state.currentQuestion < questions.length) {
            askNextQuestion();
        } else {
            startBouquetGeneration();
        }
    }, 800);
}

// Функция для начала генерации букета
async function startBouquetGeneration() {
    state.isGenerating = true;

    creationProgress.style.display = 'none';

    const typingIndicator = showTypingIndicator();

    setTimeout(async () => {
        removeTypingIndicator(typingIndicator);
        
        // Генерируем промпт
        const prompt = generatePrompt();
        
        // Создаем orderId
        state.orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Показываем сообщение о начале генерации
        addMessage('🌸 Отлично! Я получила все ваши ответы. Сейчас нейросеть YandexART создаст уникальный букет специально для вас...', false);
        
        try {
            // Отправляем запрос на генерацию
            const response = await fetch(`${API_URL}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    orderId: state.orderId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                state.generationRequestId = data.requestId;
                
                // Показываем индикатор ожидания
                showWaitingIndicator();
                
                // Ждем завершения генерации
                const result = await waitForGeneration(data.requestId);
                
                // Убираем индикатор
                const waitingIndicator = document.getElementById('waitingIndicator');
                if (waitingIndicator) {
                    waitingIndicator.remove();
                }
                
                // Показываем результат
                showGeneratedBouquet(result.imageUrl);
                
            } else {
                throw new Error(data.error || 'Ошибка генерации');
            }
            
        } catch (error) {
            console.error('Generation error:', error);
            
            const waitingIndicator = document.getElementById('waitingIndicator');
            if (waitingIndicator) {
                waitingIndicator.remove();
            }
            
            addMessage(`❌ К сожалению, произошла ошибка при генерации: ${error.message}. Пожалуйста, попробуйте еще раз или свяжитесь с флористом.`, false);
            
            // Показываем кнопки действий
            showActionButtons();
        }
    }, 1500);
}

// Функция для показа индикатора ожидания
function showWaitingIndicator() {
    const waitingDiv = document.createElement('div');
    waitingDiv.className = 'waiting-indicator';
    waitingDiv.id = 'waitingIndicator';
    waitingDiv.innerHTML = `
        <div class="waiting-content">
            <div class="waiting-spinner">
                <i class="fas fa-spinner fa-spin"></i>
            </div>
            <div class="waiting-text">
                <h3>Нейросеть YandexART создает ваш букет</h3>
                <p>Статус: <span class="waiting-status">генерация</span></p>
                <p class="waiting-subtext">Это может занять до 30 секунд</p>
                <p class="waiting-order-id">ID заказа: ${state.orderId}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(waitingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Функция для показа сгенерированного букета
function showGeneratedBouquet(imageUrl) {
    const description = generateBouquetDescription();
    
    const resultHTML = `
        <div class="bouquet-result">
            <div class="result-header">
                <div class="result-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <div class="result-title">Ваш уникальный букет готов!</div>
                <div class="result-subtitle">Создан нейросетью YandexART</div>
            </div>
            
            <div class="bouquet-image-container">
                <img class="bouquet-image" src="${imageUrl}" alt="Ваш уникальный букет">
            </div>
            
            <div class="bouquet-description">
                ${description}
            </div>
            
            <div class="bouquet-details">
                <div class="detail-card">
                    <div class="detail-card-title">Для кого</div>
                    <div class="detail-card-value">${getOptionText('forWhom')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Возраст</div>
                    <div class="detail-card-value">${getOptionText('age')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Цвета</div>
                    <div class="detail-card-value">${getOptionText('colors')}</div>
                </div>
                <div class="detail-card">
                    <div class="detail-card-title">Повод</div>
                    <div class="detail-card-value">${getOptionText('occasion')}</div>
                </div>
            </div>
            
            <div class="action-buttons" id="actionButtons">
                <button class="action-btn order-btn" id="orderBtn">
                    <i class="fab fa-telegram"></i> Связаться с флористом 🌸
                </button>
                <button class="action-btn restart-btn" id="restartBtn">
                    <i class="fas fa-redo"></i> Создать новый букет
                </button>
            </div>
        </div>
    `;

    const resultDiv = document.createElement('div');
    resultDiv.innerHTML = resultHTML;
    
    chatMessages.appendChild(resultDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    state.currentImageUrl = imageUrl;

    // Добавляем обработчики кнопок
    setTimeout(() => {
        const orderBtn = document.getElementById('orderBtn');
        const restartBtn = document.getElementById('restartBtn');
        
        if (orderBtn) orderBtn.addEventListener('click', connectToFlorist);
        if (restartBtn) restartBtn.addEventListener('click', restartQuestionnaire);
    }, 100);
}

// Функция для показа кнопок действий
function showActionButtons() {
    const buttonsHTML = `
        <div class="action-buttons" style="margin: 20px 0;">
            <button class="action-btn restart-btn" onclick="restartQuestionnaire()">
                <i class="fas fa-redo"></i> Начать заново
            </button>
            <button class="action-btn order-btn" onclick="connectToFlorist()">
                <i class="fab fa-telegram"></i> Связаться с флористом
            </button>
        </div>
    `;
    
    const buttonsDiv = document.createElement('div');
    buttonsDiv.innerHTML = buttonsHTML;
    chatMessages.appendChild(buttonsDiv);
}

// Функция для получения текста опции
function getOptionText(questionId) {
    const question = questions.find(q => q.id === questionId);
    if (!question || !state.answers[questionId]) return 'Не указано';
    
    const option = question.options.find(opt => opt.value === state.answers[questionId]);
    return option ? option.text : 'Не указано';
}

// Функция для генерации описания букета
function generateBouquetDescription() {
    const descriptions = {
        'супруг(а)': 'Этот букет создан специально для вашей второй половинки. Каждый цветок в нём символизирует разные грани ваших отношений: страсть, нежность, верность и вечную любовь.',
        'родитель': 'Композиция, наполненная теплотой и благодарностью. Цветы подобраны так, чтобы выразить всю глубину ваших чувств к самому близкому человеку.',
        'возлюбленный(ая)': 'Романтичный букет, который говорит без слов. Нежные оттенки и изящные формы создают атмосферу зарождающихся чувств и особенной связи.',
        'коллега': 'Элегантная и сдержанная композиция, идеально подходящая для деловой среды. Выражает уважение и признательность, сохраняя профессиональный тон.',
        'друг': 'Жизнерадостный и непринуждённый букет, который станет прекрасным способом сказать "я ценю нашу дружбу".',
        'себе': 'Букет для тех, кто ценит красоту вокруг себя. Композиция, которая будет радовать вас каждый день и создавать особое настроение.'
    };

    const baseDescription = descriptions[state.answers.forWhom] || 'Уникальная композиция, созданная специально для вашего случая.';

    let colorDescription = '';
    if (state.answers.colors === 'пастельные') {
        colorDescription = 'Нежные пастельные оттенки создают ощущение лёгкости и чистоты, как утренний туман над цветущим лугом.';
    } else if (state.answers.colors === 'яркие') {
        colorDescription = 'Яркие, сочные цвета наполняют композицию энергией и жизнерадостностью, притягивая взгляды и поднимая настроение.';
    } else if (state.answers.colors === 'бело-зеленые') {
        colorDescription = 'Гармония белого и зелёного создаёт ощущение свежести и чистоты, напоминая о весеннем пробуждении природы.';
    }

    let occasionDescription = '';
    if (state.answers.occasion === 'день рождения') {
        occasionDescription = 'Идеально подобран для дня рождения — каждый цветок несёт пожелание счастья, здоровья и радости на весь следующий год.';
    } else if (state.answers.occasion === '8 марта') {
        occasionDescription = 'Весенняя композиция, созданная специально для Международного женского дня, символизирует пробуждение, красоту и нежность.';
    } else if (state.answers.occasion === 'годовщина') {
        occasionDescription = 'Этот букет рассказывает историю ваших отношений — от первых нежных чувств до глубокой привязанности, которая с годами только крепнет.';
    }

    return `${baseDescription} ${colorDescription} ${occasionDescription} Я тщательно подобрала каждый элемент, чтобы создать гармоничную композицию, которая будет радовать получателя и точно передаст ваши чувства.`;
}

// Функция для связи с флористом
function connectToFlorist() {
    let orderDetails = `Новый заказ от FloraAI:

📋 Детали букета:
• Для кого: ${getOptionText('forWhom')}
• Возраст: ${getOptionText('age')}
• Цвета: ${getOptionText('colors')}
• Записка: ${state.answers.noteText || getOptionText('note')}
• Повод: ${getOptionText('occasion')}`;

    if (state.currentImageUrl) {
        orderDetails += `\n\n🔗 Ссылка на изображение букета: ${state.currentImageUrl}`;
    }

    orderDetails += `\n\nИзображение букета сгенерировано нейросетью YandexART. Флорист может воссоздать эту композицию с живыми цветами.`;

    addMessage("Отлично! Сейчас я перенаправлю вас в наш Telegram-чат с флористом, где вы сможете уточнить детали заказа и указать адрес доставки. 🌸", false);

    const telegramBotUrl = "https://t.me/FloraAI_Florist_Bot";

    setTimeout(() => {
        window.open(telegramBotUrl, '_blank');
        addMessage(`Если переход не произошел автоматически, перейдите по ссылке: <a href="${telegramBotUrl}" target="_blank">${telegramBotUrl}</a><br><br>В чате с флористом отправьте сообщение: "Хочу заказать букет, сгенерированный FloraAI"`, false);
    }, 1500);
}

// Функция для перезапуска
function restartQuestionnaire() {
    state.currentStep = 'recipientChoice';
    state.recipientType = null;
    state.currentQuestion = 0;
    state.answers = {
        forWhom: null,
        age: null,
        colors: null,
        note: null,
        occasion: null,
        noteText: null
    };
    state.isGenerating = false;
    state.currentImageUrl = null;
    state.orderId = null;
    state.generationRequestId = null;

    chatMessages.innerHTML = '';
    
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message ai-message';
    welcomeDiv.id = 'initialMessage';
    welcomeDiv.innerHTML = `
        <div class="message-header">
            <i class="fas fa-spa"></i>
            <span>FloraAI</span>
        </div>
        <p>Здравствуйте! 🌷 
            <br> Я ваш персональный флорист с искусственным интеллектом. Помогу создать уникальную цветочную композицию, которая идеально передаст ваши чувства.</p>
        <p>Я задам вам несколько вопросов, чтобы понять ваши предпочтения, а затем создам индивидуальный букет специально для вашего случая!</p>
    `;
    chatMessages.appendChild(welcomeDiv);
    
    creationProgress.style.display = 'none';
    
    setTimeout(() => {
        showRecipientChoice();
    }, 1000);
}

// Обработчики событий
sendButton.addEventListener('click', () => {
    const message = userInput.value.trim();
    if (!message) return;

    addMessage(message, true);
    userInput.value = '';
    userInput.style.height = 'auto';

    if (state.isWaitingForNoteText) {
        state.answers.noteText = message;
        state.answers.note = 'своя';
        state.isWaitingForNoteText = false;
        chatInputContainer.style.display = 'none';

        state.currentQuestion++;
        updateProgressBar();

        setTimeout(() => {
            if (state.currentQuestion < questions.length) {
                askNextQuestion();
            } else {
                startBouquetGeneration();
            }
        }, 600);
    }
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

closeBtn.addEventListener('click', () => {
    if (window.opener) {
        window.close();
    } else {
        addMessage("Спасибо за использование FloraAI! Если решите создать букет позже, мы всегда готовы помочь. 🌸", false);
    }
});

// Добавляем стили для новых элементов
const style = document.createElement('style');
style.textContent = `
    .waiting-indicator {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 15px;
        padding: 20px;
        margin: 20px 0;
        animation: pulse 2s infinite;
        color: white;
    }
    
    .waiting-content {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-wrap: wrap;
    }
    
    .waiting-spinner {
        font-size: 40px;
    }
    
    .waiting-text {
        flex: 1;
    }
    
    .waiting-text h3 {
        margin: 0 0 10px 0;
    }
    
    .waiting-status {
        font-weight: 600;
        text-transform: uppercase;
        background: rgba(255,255,255,0.2);
        padding: 3px 10px;
        border-radius: 20px;
    }
    
    .waiting-subtext {
        margin-top: 5px;
        font-size: 14px;
        opacity: 0.9;
    }
    
    .waiting-order-id {
        margin-top: 10px;
        font-size: 12px;
        opacity: 0.8;
        font-family: monospace;
    }
    
    .bouquet-result {
        background: white;
        border-radius: 20px;
        padding: 20px;
        margin: 20px 0;
        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    }
    
    .result-header {
        text-align: center;
        margin-bottom: 20px;
    }
    
    .result-icon {
        font-size: 48px;
        color: #667eea;
        margin-bottom: 10px;
    }
    
    .result-title {
        font-size: 24px;
        font-weight: 600;
        color: #333;
        margin-bottom: 5px;
    }
    
    .result-subtitle {
        font-size: 14px;
        color: #667eea;
        opacity: 0.8;
    }
    
    .bouquet-image-container {
        margin: 20px 0;
        border-radius: 15px;
        overflow: hidden;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    }
    
    .bouquet-image {
        width: 100%;
        display: block;
        transition: transform 0.3s ease;
    }
    
    .bouquet-image:hover {
        transform: scale(1.02);
    }
    
    .bouquet-description {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 20px;
        border-radius: 15px;
        margin: 20px 0;
        line-height: 1.6;
        color: #333;
    }
    
    .bouquet-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 10px;
        margin: 20px 0;
    }
    
    .detail-card {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    
    .detail-card-title {
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
        text-transform: uppercase;
    }
    
    .detail-card-value {
        font-size: 16px;
        font-weight: 600;
        color: #333;
    }
    
    .action-buttons {
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
        flex-wrap: wrap;
    }
    
    .action-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 30px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .action-btn i {
        font-size: 18px;
    }
    
    .order-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }
    
    .order-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
    
    .restart-btn {
        background: #f8f9fa;
        color: #333;
        border: 1px solid #ddd;
    }
    
    .restart-btn:hover {
        background: #e9ecef;
    }
    
    @keyframes pulse {
        0% {
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        50% {
            box-shadow: 0 4px 25px rgba(102, 126, 234, 0.5);
        }
        100% {
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
    }
`;

document.head.appendChild(style);

// Запуск
window.addEventListener('load', () => {
    setTimeout(() => {
        showRecipientChoice();
    }, 1000);
});