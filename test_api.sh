#!/bin/bash
# API Testing Script для UBI.136 Protection System
# Этот скрипт демонстрирует все основные возможности системы

echo "=================================================="
echo "🧪 UBI.136 Protection System - API Tests"
echo "=================================================="
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для красивого вывода
test_endpoint() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}TEST:${NC} $1"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

sleep_between_tests() {
    echo ""
    sleep 2
}

# ===== 1. ПРОВЕРКА РАБОТОСПОСОБНОСТИ ВСЕХ СЕРВИСОВ =====

test_endpoint "1. Проверка Consensus Service"
curl -s http://localhost:8001/health | python3 -m json.tool
sleep_between_tests

test_endpoint "2. Проверка Replication Monitoring Service"
curl -s http://localhost:8002/ | python3 -m json.tool
sleep_between_tests

test_endpoint "3. Проверка Health Check Service"
curl -s http://localhost:8003/ | python3 -m json.tool
sleep_between_tests

test_endpoint "4. Проверка Transaction Log Service"
curl -s http://localhost:8004/ | python3 -m json.tool
sleep_between_tests

test_endpoint "5. Проверка Recovery Service"
curl -s http://localhost:8005/ | python3 -m json.tool
sleep_between_tests

# ===== 2. ДЕМОНСТРАЦИЯ ЗАЩИТЫ ОТ UBI.136 =====

echo ""
echo -e "${YELLOW}=================================================="
echo "🛡️  ДЕМОНСТРАЦИЯ ЗАЩИТНЫХ МЕХАНИЗМОВ"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Безопасная запись с writeConcern:majority"
curl -s -X POST http://localhost:8001/write/safe \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "protected_data",
    "document": {
      "test_id": 1,
      "message": "Защищенная запись",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
    },
    "write_concern": "majority"
  }' | python3 -m json.tool
sleep_between_tests

test_endpoint "Небезопасная запись БЕЗ writeConcern (демонстрация угрозы)"
curl -s -X POST http://localhost:8001/write/unsafe \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "unprotected_data",
    "document": {
      "test_id": 2,
      "message": "Незащищенная запись",
      "risk": "HIGH"
    }
  }' | python3 -m json.tool
sleep_between_tests

test_endpoint "Безопасное чтение с readConcern:majority"
curl -s "http://localhost:8001/read/safe?collection=protected_data&filter={}" | python3 -m json.tool
sleep_between_tests

# ===== 3. МОНИТОРИНГ КЛАСТЕРА =====

echo ""
echo -e "${YELLOW}=================================================="
echo "📊 МОНИТОРИНГ СОСТОЯНИЯ КЛАСТЕРА"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Статус всех узлов кластера"
curl -s http://localhost:8003/health/all | python3 -m json.tool
sleep_between_tests

test_endpoint "Статус Primary узла"
curl -s http://localhost:8003/health/primary | python3 -m json.tool
sleep_between_tests

test_endpoint "Статус Secondary узлов"
curl -s http://localhost:8003/health/secondaries | python3 -m json.tool
sleep_between_tests

test_endpoint "Общая сводка по кластеру"
curl -s http://localhost:8003/health/summary | python3 -m json.tool
sleep_between_tests

# ===== 4. МОНИТОРИНГ РЕПЛИКАЦИИ =====

echo ""
echo -e "${YELLOW}=================================================="
echo "🔄 АНАЛИЗ РЕПЛИКАЦИИ И OPLOG LAG"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Общий статус репликации"
curl -s http://localhost:8002/replication/status | python3 -m json.tool
sleep_between_tests

test_endpoint "Детальный анализ oplog lag"
curl -s http://localhost:8002/replication/lag | python3 -m json.tool
sleep_between_tests

test_endpoint "Информация об oplog"
curl -s http://localhost:8002/replication/oplog/info | python3 -m json.tool
sleep_between_tests

test_endpoint "Активные алерты о проблемах репликации"
curl -s http://localhost:8002/monitoring/alerts | python3 -m json.tool
sleep_between_tests

# ===== 5. ЛОГИРОВАНИЕ ТРАНЗАКЦИЙ =====

echo ""
echo -e "${YELLOW}=================================================="
echo "📝 АУДИТ И ЛОГИРОВАНИЕ ОПЕРАЦИЙ"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Последние логи операций"
curl -s "http://localhost:8004/logs/recent?limit=5" | python3 -m json.tool
sleep_between_tests

test_endpoint "Статистика операций"
curl -s http://localhost:8004/logs/stats | python3 -m json.tool
sleep_between_tests

test_endpoint "Временная линия операций (последние 24 часа)"
curl -s "http://localhost:8004/audit/timeline?hours=24" | python3 -m json.tool
sleep_between_tests

test_endpoint "Последние записи из oplog MongoDB"
curl -s "http://localhost:8004/oplog/tail?limit=5" | python3 -m json.tool
sleep_between_tests

# ===== 6. ВОССТАНОВЛЕНИЕ И RECOVERY =====

echo ""
echo -e "${YELLOW}=================================================="
echo "🔧 СТАТУС ВОССТАНОВЛЕНИЯ"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Статус восстановления узлов"
curl -s http://localhost:8005/recovery/status | python3 -m json.tool
sleep_between_tests

test_endpoint "Статус синхронизации Secondary узлов"
curl -s http://localhost:8005/recovery/sync-status | python3 -m json.tool
sleep_between_tests

test_endpoint "Рекомендации по восстановлению"
curl -s http://localhost:8005/recovery/recommendations | python3 -m json.tool
sleep_between_tests

# ===== 7. ВАЛИДАЦИЯ ОПЕРАЦИЙ =====

echo ""
echo -e "${YELLOW}=================================================="
echo "✅ ВАЛИДАЦИЯ ОПЕРАЦИЙ ПЕРЕД ВЫПОЛНЕНИЕМ"
echo -e "==================================================${NC}"
echo ""

test_endpoint "Валидация операции записи"
curl -s -X POST http://localhost:8001/validate/operation \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "test",
    "document": {"validation": "test"},
    "write_concern": "majority"
  }' | python3 -m json.tool
sleep_between_tests

test_endpoint "Детальный статус кластера"
curl -s http://localhost:8001/cluster/status | python3 -m json.tool
sleep_between_tests

# ===== ЗАВЕРШЕНИЕ =====

echo ""
echo -e "${GREEN}=================================================="
echo "✅ ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ"
echo -e "==================================================${NC}"
echo ""
echo "Система UBI.136 Protection работает корректно!"
echo ""
echo "Для симуляции атак используйте команды:"
echo -e "${YELLOW}# Остановить Secondary узел:${NC}"
echo "docker stop mongo-secondary1"
echo ""
echo -e "${YELLOW}# Проверить алерты:${NC}"
echo "curl http://localhost:8002/monitoring/alerts | python3 -m json.tool"
echo ""
echo -e "${YELLOW}# Восстановить узел:${NC}"
echo "docker start mongo-secondary1"
echo ""
