require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Конфигурация Yandex Cloud
const YANDEX_FOLDER_ID = process.env.YANDEX_FOLDER_ID;
const YANDEX_API_KEY = process.env.YANDEX_API_KEY;
const PORT = process.env.PORT || 3000;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Проверка конфигурации
if (!YANDEX_FOLDER_ID || !YANDEX_API_KEY) {
    console.error('❌ Yandex Cloud credentials not found in .env file');
    console.error('Получите их в https://console.cloud.yandex.ru');
    process.exit(1);
}

// Создаем папку для загрузок
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(path.join(__dirname, 'public', 'generated'));

// URL для YandexART API
const YANDEX_ART_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync';

// Хранилище для запросов и результатов
const generationRequests = new Map();
const orderStatuses = new Map();

async function waitForImage(operationId) {
    console.log(`⏳ Ожидание генерации, ID операции: ${operationId}`);
    
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await axios.get(
                `https://operation.api.cloud.yandex.net/operations/${operationId}`,
                {
                    headers: {
                        'Authorization': `Api-Key ${YANDEX_API_KEY}`
                    }
                }
            );

            console.log(`📊 Статус операции (попытка ${i + 1}/${maxAttempts}):`, 
                response.data.done ? 'завершена' : 'в процессе');

            if (response.data.done) {
                console.log('✅ Операция завершена!');
                
                if (response.data.error) {
                    throw new Error(`Ошибка генерации: ${response.data.error.message}`);
                }
                
                if (response.data.response && response.data.response.image) {
                    return response.data.response.image;
                } else {
                    console.log('⚠️ Ответ не содержит изображение:', JSON.stringify(response.data, null, 2));
                    throw new Error('Ответ не содержит изображение');
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('❌ Ошибка при проверке статуса:', error.message);
            throw error;
        }
    }
    
    throw new Error('Превышено время ожидания генерации (60 секунд)');
}
/**
 * Генерация изображения через YandexART
 */
async function generateWithYandexART(prompt) {
    try {
        console.log('🎨 Начинаем генерацию изображения...');
        console.log('📝 Промпт:', prompt);
        console.log('📁 Folder ID:', YANDEX_FOLDER_ID);

        // Правильный формат запроса для YandexART
        const requestBody = {
            modelUri: `art://${YANDEX_FOLDER_ID}/yandex-art/latest`,
            messages: [
                {
                    text: prompt,
                    weight: 1
                }
            ],
            generationOptions: {
                seed: Math.floor(Math.random() * 1000000),
                format: "JPEG",
                aspectRatio: {
                    widthRatio: 1,
                    heightRatio: 1
                }
            }
        };

        console.log('📤 URL запроса:', YANDEX_ART_URL);
        console.log('📤 Тело запроса:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(YANDEX_ART_URL, requestBody, {
            headers: {
                'Authorization': `Api-Key ${YANDEX_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ Ответ получен, статус:', response.status);
        console.log('📦 Данные ответа:', JSON.stringify(response.data, null, 2));

        // Проверяем формат ответа
        if (response.data.id) {
            console.log('🔄 Операция создана, ID:', response.data.id);
            return await waitForImage(response.data.id);
        } else if (response.data.image) {
            // Некоторые версии API возвращают сразу изображение
            return response.data.image;
        } else {
            console.log('⚠️ Неожиданный формат ответа:', response.data);
            throw new Error('Неожиданный формат ответа от API');
        }

    } catch (error) {
        console.error('❌ Ошибка генерации:');
        if (error.response) {
            console.error('Статус ошибки:', error.response.status);
            console.error('Данные ошибки:', JSON.stringify(error.response.data, null, 2));
            console.error('Заголовки ответа:', error.response.headers);
            
            // Специальная обработка ошибки 405
            if (error.response.status === 405) {
                console.error('❌ Ошибка 405: Неверный метод запроса. Возможно API ожидает другой формат.');
                console.error('Проверьте документацию Yandex Foundation Models');
            }
        } else if (error.request) {
            console.error('Запрос был отправлен, но ответ не получен');
            console.error(error.request);
        } else {
            console.error('Ошибка:', error.message);
        }
        throw error;
    }
}

// Функция для ожидания завершения асинхронной операции
async function waitForOperation(operationId) {
    const maxAttempts = 60; // 60 секунд
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(
                `https://operation.api.cloud.yandex.net/operations/${operationId}`,
                {
                    headers: {
                        'Authorization': `Api-Key ${YANDEX_API_KEY}`
                    }
                }
            );
            
            if (response.data.done) {
                console.log('✅ Операция завершена');
                return response.data.response;
            }
            
            console.log(`⏳ Ожидание завершения... (${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
            
        } catch (error) {
            console.error('❌ Ошибка при проверке операции:', error.message);
            throw error;
        }
    }
    
    throw new Error('Превышено время ожидания генерации');
}

/**
 * Сохранение изображения на диск
 */
async function saveImageToDisk(base64Image, requestId) {
    try {
        // Убираем префикс data:image/jpeg;base64, если есть
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        
        // Создаем уникальное имя файла
        const filename = `${requestId}_${Date.now()}.jpg`;
        const filepath = path.join(__dirname, 'public', 'generated', filename);
        
        // Сохраняем файл
        await fs.writeFile(filepath, imageBuffer);
        
        // Возвращаем URL для доступа
        return `${SITE_URL}/generated/${filename}`;
        
    } catch (error) {
        console.error('❌ Ошибка сохранения изображения:', error);
        throw error;
    }
}

/**
 * Эндпоинт для генерации одного изображения
 */
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt, orderId } = req.body;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Промпт обязателен' });
        }

        console.log('🎨 Начало генерации для заказа:', orderId || 'новый заказ');

        // Генерируем уникальный ID запроса
        const requestId = uuidv4();
        
        // Сохраняем запрос
        generationRequests.set(requestId, {
            prompt,
            orderId,
            status: 'processing',
            timestamp: Date.now()
        });

        // Генерируем изображение
        const imageBase64 = await generateWithYandexART(prompt);
        
        // Сохраняем на диск
        const imageUrl = await saveImageToDisk(imageBase64, requestId);
        
        console.log('✅ Изображение сохранено:', imageUrl);

        // Обновляем статус
        generationRequests.set(requestId, {
            ...generationRequests.get(requestId),
            status: 'completed',
            imageUrl: imageUrl,
            completedAt: Date.now()
        });

        // Если есть orderId, обновляем статус заказа
        if (orderId) {
            orderStatuses.set(orderId, {
                ...orderStatuses.get(orderId),
                status: 'completed',
                imageUrl: imageUrl,
                completedAt: Date.now()
            });
        }

        res.json({
            success: true,
            requestId: requestId,
            imageUrl: imageUrl,
            orderId: orderId
        });

    } catch (error) {
        console.error('❌ Ошибка генерации:', error);
        
        res.status(500).json({ 
            error: 'Ошибка генерации изображения',
            details: error.message
        });
    }
});

/**
 * Эндпоинт для пакетной генерации
 */
app.post('/api/batch-generate', async (req, res) => {
    try {
        const { prompts, orderIds } = req.body;
        
        if (!prompts || !Array.isArray(prompts)) {
            return res.status(400).json({ error: 'Массив промптов обязателен' });
        }

        console.log(`🎨 Пакетная генерация ${prompts.length} изображений`);

        const batchId = uuidv4();
        const results = [];

        // Генерируем последовательно (YandexART имеет лимиты)
        for (let i = 0; i < prompts.length; i++) {
            try {
                console.log(`🎨 Генерация ${i + 1}/${prompts.length}`);
                
                const imageBase64 = await generateWithYandexART(prompts[i]);
                const imageUrl = await saveImageToDisk(imageBase64, `${batchId}_${i}`);
                
                results.push({
                    prompt: prompts[i],
                    imageUrl: imageUrl,
                    success: true,
                    orderId: orderIds?.[i]
                });

                // Ждем 2 секунды между запросами (чтобы не превысить лимиты)
                if (i < prompts.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                results.push({
                    prompt: prompts[i],
                    error: error.message,
                    success: false
                });
            }
        }

        res.json({
            success: true,
            batchId: batchId,
            results: results,
            summary: {
                total: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });

    } catch (error) {
        console.error('❌ Ошибка пакетной генерации:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Эндпоинт для проверки статуса
 */
app.get('/api/status/:requestId', (req, res) => {
    const { requestId } = req.params;
    
    const request = generationRequests.get(requestId);
    
    if (!request) {
        return res.status(404).json({ error: 'Запрос не найден' });
    }
    
    res.json({
        status: request.status,
        imageUrl: request.imageUrl,
        prompt: request.prompt,
        timestamp: request.timestamp,
        completedAt: request.completedAt
    });
});

/**
 * Эндпоинт для проверки статуса заказа
 */
app.get('/api/order/:orderId', (req, res) => {
    const { orderId } = req.params;
    
    const order = orderStatuses.get(orderId);
    
    if (!order) {
        return res.status(404).json({ error: 'Заказ не найден' });
    }
    
    res.json(order);
});

/**
 * Эндпоинт для сохранения результатов теста
 */
app.post('/api/save-test-results', (req, res) => {
    try {
        const { orderId, testResults } = req.body;
        
        if (!orderId || !testResults) {
            return res.status(400).json({ error: 'orderId и testResults обязательны' });
        }

        console.log(`📝 Сохранение результатов теста для заказа ${orderId}`);

        // Сохраняем результаты теста
        orderStatuses.set(orderId, {
            ...orderStatuses.get(orderId),
            status: 'test_completed',
            testResults: testResults,
            completedAt: Date.now()
        });

        res.json({
            success: true,
            orderId: orderId
        });

    } catch (error) {
        console.error('❌ Ошибка сохранения результатов теста:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Эндпоинт для получения информации о лимитах
 */
app.get('/api/limits', async (req, res) => {
    try {
        // Здесь можно получить реальную информацию о лимитах из Yandex Cloud
        // Пока возвращаем приблизительные значения
        res.json({
            model: 'YandexART',
            provider: 'Yandex Cloud',
            limits: {
                requestsPerMinute: 10,
                requestsPerDay: 500,
                maxPromptLength: 500,
                supportedFormats: ['JPEG', 'PNG'],
                aspectRatios: ['1:1', '2:3', '3:2', '4:5', '5:4', '9:16', '16:9']
            },
            usage: {
                totalRequests: generationRequests.size,
                pendingRequests: Array.from(generationRequests.values())
                    .filter(r => r.status === 'processing').length
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Эндпоинт для тестирования соединения с Yandex Cloud
 */
app.get('/api/test-connection', async (req, res) => {
    try {
        // Пробуем сделать простой запрос к Yandex Cloud
        const response = await axios.get('https://llm.api.cloud.yandex.net/health', {
            headers: {
                'Authorization': `Api-Key ${YANDEX_API_KEY}`
            },
            timeout: 5000
        });

        res.json({
            success: true,
            message: '✅ Соединение с Yandex Cloud установлено',
            folderId: YANDEX_FOLDER_ID,
            apiAvailable: true
        });

    } catch (error) {
        res.json({
            success: false,
            message: '❌ Ошибка соединения с Yandex Cloud',
            error: error.message,
            folderId: YANDEX_FOLDER_ID,
            apiAvailable: false
        });
    }
});

/**
 * Эндпоинт для получения тестового промпта
 */
app.get('/api/test-prompt', (req, res) => {
    const testPrompts = [
        "Букет из розовых пионов и белых роз в нежной пастельной цветовой гамме",
        "Яркий букет из красных тюльпанов и желтых подсолнухов в стиле поп-арт",
        "Элегантный букет из белых лилий и зеленых хризантем в минималистичном стиле",
        "Романтичный букет из лаванды и розовых гортензий в прованском стиле"
    ];
    
    const randomPrompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
    
    res.json({
        prompt: randomPrompt,
        note: "Это тестовый промпт для проверки генерации"
    });
});

// Очистка старых запросов (раз в час)
setInterval(() => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    // Удаляем старые запросы
    for (const [id, data] of generationRequests.entries()) {
        if (data.timestamp < oneHourAgo) {
            generationRequests.delete(id);
        }
    }
    
    // Удаляем старые заказы (через день)
    for (const [id, data] of orderStatuses.entries()) {
        if (data.timestamp < oneDayAgo) {
            orderStatuses.delete(id);
        }
    }
}, 60 * 60 * 1000);

// Корневой маршрут - отдаем index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Если index.html не найден, показываем простую страницу
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.send(`
            <html>
                <head><title>FloraAI</title></head>
                <body>
                    <h1>FloraAI сервер работает!</h1>
                    <p>✅ Сервер запущен</p>
                    <p>❌ Файл index.html не найден в папке public/</p>
                    <p>Создайте папку public/ и поместите в неё index.html</p>
                </body>
            </html>
        `);
    }
});
// Запуск сервера
app.listen(PORT, async () => {
    console.log('\n🚀 FloraAI с YandexART запущен!');
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 Сайт: ${SITE_URL}`);
    console.log(`📁 Папка загрузок: ${UPLOAD_DIR}`);
    console.log(`🆔 Yandex Folder ID: ${YANDEX_FOLDER_ID}`);
    
    // Проверяем соединение с Yandex Cloud
    try {
        const response = await axios.get('https://llm.api.cloud.yandex.net/health', {
            headers: {
                'Authorization': `Api-Key ${YANDEX_API_KEY}`
            },
            timeout: 5000
        });
        console.log('✅ Yandex Cloud API доступен');
    } catch (error) {
        console.log('⚠️  Не удалось проверить Yandex Cloud API');
    }
    
    console.log('\n📝 Тестовые эндпоинты:');
    console.log(`   ${SITE_URL}/api/test-connection - Проверка соединения`);
    console.log(`   ${SITE_URL}/api/test-prompt - Получить тестовый промпт`);
    console.log(`   ${SITE_URL}/api/limits - Информация о лимитах\n`);
});
app.get('/api/discover-endpoints', async (req, res) => {
    try {
        const possibleUrls = [
            'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGeneration',
            'https://llm.api.cloud.yandex.net/foundationModels/v1/imageGenerationAsync',
            'https://llm.api.cloud.yandex.net/llm/v1/imageGeneration',
            'https://llm.api.cloud.yandex.net/llm/v1/image',
            'https://ai.api.cloud.yandex.net/foundationModels/v1/imageGeneration'
        ];
        
        const results = [];
        
        for (const url of possibleUrls) {
            try {
                console.log(`Тестируем URL: ${url}`);
                const response = await axios.post(url, 
                    {
                        modelUri: `art://${YANDEX_FOLDER_ID}/yandex-art/latest`,
                        messages: [{ text: "test", weight: 1 }],
                        generationOptions: { format: "JPEG" }
                    },
                    {
                        headers: {
                            'Authorization': `Api-Key ${YANDEX_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 3000
                    }
                ).catch(e => e.response || e);
                
                results.push({
                    url,
                    status: response.status || 'error',
                    message: response.message || response.statusText
                });
            } catch (e) {
                results.push({
                    url,
                    status: 'error',
                    message: e.message
                });
            }
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get('/api/diagnose', async (req, res) => {
    const results = {
        folderId: YANDEX_FOLDER_ID,
        apiKeyExists: !!YANDEX_API_KEY,
        apiKeyPrefix: YANDEX_API_KEY ? YANDEX_API_KEY.substring(0, 10) + '...' : 'не указан',
        tests: []
    };
    
    // Тест 1: Проверка формата авторизации
    try {
        const response = await axios.get('https://llm.api.cloud.yandex.net/health', {
            headers: {
                'Authorization': `Api-Key ${YANDEX_API_KEY}`
            },
            validateStatus: false,
            timeout: 5000
        });
        results.tests.push({
            name: 'Health check with Api-Key',
            status: response.status,
            success: response.status === 200
        });
    } catch (error) {
        results.tests.push({
            name: 'Health check with Api-Key',
            error: error.message,
            success: false
        });
    }
    
    // Тест 2: Проверка альтернативного формата авторизации
    try {
        const response = await axios.get('https://llm.api.cloud.yandex.net/health', {
            headers: {
                'Authorization': `Bearer ${YANDEX_API_KEY}`
            },
            validateStatus: false,
            timeout: 5000
        });
        results.tests.push({
            name: 'Health check with Bearer',
            status: response.status,
            success: response.status === 200
        });
    } catch (error) {
        results.tests.push({
            name: 'Health check with Bearer',
            error: error.message,
            success: false
        });
    }
    
    // Тест 3: Проверка прав на генерацию
    try {
        const testBody = {
            modelUri: `art://${YANDEX_FOLDER_ID}/yandex-art/latest`,
            messages: [{ text: "test", weight: 1 }],
            generationOptions: { format: "JPEG" }
        };
        
        const response = await axios.post(YANDEX_ART_URL, testBody, {
            headers: {
                'Authorization': `Api-Key ${YANDEX_API_KEY}`,
                'Content-Type': 'application/json'
            },
            validateStatus: false,
            timeout: 5000
        });
        
        results.tests.push({
            name: 'Test generation',
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            success: response.status === 200
        });
    } catch (error) {
        results.tests.push({
            name: 'Test generation',
            error: error.message,
            success: false
        });
    }
    
    res.json(results);
});