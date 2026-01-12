#!/bin/bash
# Quick Start Script для UBI.136 Protection System с Dashboard

echo "🚀 UBI.136 Protection System - Quick Start"
echo "=========================================="
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

echo "✅ Docker и Docker Compose найдены"
echo ""

# Остановка существующих контейнеров (если есть)
echo "🧹 Очистка старых контейнеров..."
docker-compose down -v 2>/dev/null
echo ""

# Запуск системы
echo "🚀 Запуск UBI.136 Protection System с Dashboard..."
echo "Это может занять 60-90 секунд (включая сборку Dashboard)..."
echo ""
docker-compose up -d --build

# Ожидание запуска
echo ""
echo "⏳ Ожидание инициализации MongoDB Replica Set..."
sleep 15

# Проверка статуса
echo ""
echo "📊 Проверка статуса контейнеров..."
echo ""
docker-compose ps

# Проверка инициализации
echo ""
echo "🔍 Проверка инициализации Replica Set..."
docker-compose logs mongo-init | grep -i "success"

echo ""
echo "⏳ Дополнительная задержка для запуска микросервисов и Dashboard..."
sleep 15

# Проверка микросервисов
echo ""
echo "🧪 Проверка работоспособности микросервисов..."
echo ""

services=(
    "8001:Consensus Service"
    "8002:Replication Monitoring"
    "8003:Health Check"
    "8004:Transaction Log"
    "8005:Recovery Service"
    "3000:Dashboard Web UI"
)

all_healthy=true
for service in "${services[@]}"; do
    port="${service%%:*}"
    name="${service#*:}"
    
    echo -n "Проверка $name (port $port)... "
    
    if [ "$port" = "3000" ]; then
        # Для Dashboard просто проверяем доступность порта
        response=$(timeout 5 bash -c "</dev/tcp/localhost/$port" 2>/dev/null && echo "200" || echo "000")
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/ 2>/dev/null)
    fi
    
    if [ "$response" = "200" ]; then
        echo "✅ OK"
    else
        echo "⏳ Загружается... (это нормально для Dashboard)"
        if [ "$port" != "3000" ]; then
            all_healthy=false
        fi
    fi
done

echo ""
echo "=========================================="

if [ "$all_healthy" = true ]; then
    echo "✅ Система успешно запущена!"
    echo ""
    echo "🎨 WEB DASHBOARD (ГЛАВНОЕ):"
    echo "  👉 http://localhost:3000"
    echo "     Откройте в браузере для визуального управления"
    echo ""
    echo "📱 API Сервисы:"
    echo "  • Consensus Service:         http://localhost:8001"
    echo "  • Replication Monitoring:    http://localhost:8002"
    echo "  • Health Check:              http://localhost:8003"
    echo "  • Transaction Log:           http://localhost:8004"
    echo "  • Recovery Service:          http://localhost:8005"
    echo ""
    echo "🎮 Демонстрация защиты:"
    echo "  1. Откройте Dashboard: http://localhost:3000"
    echo "  2. Нажмите 'Отключить узел' на любом узле"
    echo "  3. Наблюдайте за реакцией системы"
    echo "  4. Система продолжит работать!"
    echo ""
    echo "🧪 Запустите API тесты:"
    echo "  ./test_api.sh"
    echo ""
    echo "📊 Просмотр логов:"
    echo "  docker-compose logs -f"
    echo "  docker-compose logs -f dashboard"
    echo ""
    echo "🛑 Остановка системы:"
    echo "  docker-compose down"
    echo ""
else
    echo "⚠️  Некоторые сервисы не запустились"
    echo ""
    echo "📋 Проверьте логи:"
    echo "  docker-compose logs"
    echo ""
    echo "🔄 Попробуйте перезапустить:"
    echo "  docker-compose restart"
    echo ""
    echo "ℹ️  Dashboard может загружаться дольше (30-60 секунд)"
    echo "   Попробуйте открыть http://localhost:3000 через минуту"
fi

echo "=========================================="
echo ""
echo "🎯 ДЛЯ ЗАЩИТЫ КУРСОВОЙ:"
echo "   Откройте http://localhost:3000 и продемонстрируйте:"
echo "   • Визуализацию кластера"
echo "   • Симуляцию отказа узла"
echo "   • Автоматическое восстановление"
echo "   • Защиту от потери данных"
echo ""
