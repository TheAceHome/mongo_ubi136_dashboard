from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict
from fastapi.middleware.cors import CORSMiddleware
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Replication Monitoring Service", description="Мониторинг репликации и oplog lag")
# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
client = None

@app.on_event("startup")
async def startup_db_client():
    global client
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        logger.info("✅ Replication Monitoring: Подключено к MongoDB")
    except ConnectionFailure as e:
        logger.error(f"❌ Ошибка подключения: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

@app.get("/")
async def root():
    return {
        "service": "Replication Monitoring Service",
        "status": "running",
        "description": "Мониторинг статуса репликации и oplog lag"
    }

@app.get("/replication/status")
async def get_replication_status():
    """Получить общий статус репликации"""
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        replication_info = []
        primary_optime = None
        
        # Находим Primary узел и его optime
        for member in rs_status['members']:
            if member['stateStr'] == 'PRIMARY':
                primary_optime = member.get('optimeDate')
                break
        
        # Собираем информацию о репликации для каждого узла
        for member in rs_status['members']:
            member_optime = member.get('optimeDate')
            
            # Вычисляем задержку репликации (lag)
            lag_seconds = 0
            if primary_optime and member_optime and member['stateStr'] != 'PRIMARY':
                lag = primary_optime - member_optime
                lag_seconds = lag.total_seconds()
            
            replication_info.append({
                "name": member['name'],
                "state": member['stateStr'],
                "health": "healthy" if member['health'] == 1 else "unhealthy",
                "optime": str(member_optime) if member_optime else None,
                "lag_seconds": lag_seconds,
                "lag_status": "OK" if lag_seconds < 10 else "WARNING" if lag_seconds < 30 else "CRITICAL"
            })
        
        return {
            "replica_set": rs_status.get('set'),
            "members": replication_info,
            "timestamp": str(datetime.now())
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения статуса репликации: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/replication/lag")
async def get_replication_lag():
    """
    Детальный анализ oplog lag - задержки репликации между узлами
    КРИТИЧНО для обнаружения угрозы UBI.136
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        primary_member = None
        secondary_members = []
        
        # Разделяем узлы
        for member in rs_status['members']:
            if member['stateStr'] == 'PRIMARY':
                primary_member = member
            elif member['stateStr'] == 'SECONDARY':
                secondary_members.append(member)
        
        if not primary_member:
            return {
                "status": "error",
                "message": "Primary узел не найден",
                "threat_level": "CRITICAL"
            }
        
        primary_optime = primary_member.get('optimeDate')
        
        lag_analysis = []
        max_lag = 0
        
        for secondary in secondary_members:
            secondary_optime = secondary.get('optimeDate')
            
            if primary_optime and secondary_optime:
                lag = primary_optime - secondary_optime
                lag_seconds = lag.total_seconds()
                max_lag = max(max_lag, lag_seconds)
                
                # Оценка критичности задержки
                if lag_seconds < 5:
                    status = "EXCELLENT"
                    threat = "Нет угрозы"
                elif lag_seconds < 10:
                    status = "GOOD"
                    threat = "Минимальная задержка"
                elif lag_seconds < 30:
                    status = "WARNING"
                    threat = "⚠️ Повышенная задержка репликации"
                else:
                    status = "CRITICAL"
                    threat = "🔴 КРИТИЧЕСКАЯ задержка - риск потери данных!"
                
                lag_analysis.append({
                    "node": secondary['name'],
                    "lag_seconds": round(lag_seconds, 2),
                    "lag_formatted": str(timedelta(seconds=int(lag_seconds))),
                    "status": status,
                    "threat_assessment": threat,
                    "last_optime": str(secondary_optime)
                })
        
        # Общая оценка
        overall_status = "CRITICAL" if max_lag > 30 else "WARNING" if max_lag > 10 else "GOOD"
        
        return {
            "primary_node": primary_member['name'],
            "primary_optime": str(primary_optime),
            "secondary_nodes_count": len(secondary_members),
            "max_lag_seconds": round(max_lag, 2),
            "overall_status": overall_status,
            "lag_details": lag_analysis,
            "recommendations": [
                "✅ Репликация в норме" if overall_status == "GOOD" else "⚠️ Проверьте сетевое соединение",
                "✅ Консистентность данных обеспечена" if max_lag < 10 else "🔴 Риск несогласованности данных"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка анализа lag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/replication/oplog/info")
async def get_oplog_info():
    """Получить информацию об oplog (журнал операций)"""
    try:
        # Подключаемся к local БД где хранится oplog
        local_db = client['local']
        oplog = local_db['oplog.rs']
        
        # Получаем размер oplog
        stats = local_db.command('collStats', 'oplog.rs')
        
        # Первая и последняя записи
        first_entry = oplog.find().sort('$natural', 1).limit(1)
        last_entry = oplog.find().sort('$natural', -1).limit(1)
        
        first_ts = None
        last_ts = None
        
        for entry in first_entry:
            first_ts = entry['ts'].as_datetime()
        
        for entry in last_entry:
            last_ts = entry['ts'].as_datetime()
        
        # Вычисляем временное окно oplog
        oplog_window = None
        if first_ts and last_ts:
            oplog_window = last_ts - first_ts
        
        return {
            "oplog_size_mb": round(stats['size'] / (1024 * 1024), 2),
            "oplog_max_size_mb": round(stats.get('maxSize', 0) / (1024 * 1024), 2),
            "document_count": stats['count'],
            "first_timestamp": str(first_ts) if first_ts else None,
            "last_timestamp": str(last_ts) if last_ts else None,
            "oplog_window": str(oplog_window) if oplog_window else None,
            "oplog_window_hours": round(oplog_window.total_seconds() / 3600, 2) if oplog_window else None,
            "description": "Oplog содержит историю операций для репликации"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения oplog info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/monitoring/alerts")
async def get_monitoring_alerts():
    """
    Получить активные алерты о проблемах репликации
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        alerts = []
        
        # Проверяем наличие Primary
        primary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'PRIMARY')
        if primary_count == 0:
            alerts.append({
                "level": "CRITICAL",
                "type": "NO_PRIMARY",
                "message": "🔴 Отсутствует Primary узел - записи невозможны!",
                "threat": "UBI.136: Полная блокировка записей",
                "action": "Требуется немедленное восстановление кластера"
            })
        elif primary_count > 1:
            alerts.append({
                "level": "CRITICAL",
                "type": "SPLIT_BRAIN",
                "message": "🔴 Обнаружено более одного Primary узла!",
                "threat": "UBI.136: Критический риск расхождения данных",
                "action": "Немедленно изолировать сегменты сети"
            })
        
        # Проверяем здоровье узлов
        unhealthy = [m for m in rs_status['members'] if m['health'] != 1]
        if unhealthy:
            for member in unhealthy:
                alerts.append({
                    "level": "WARNING",
                    "type": "UNHEALTHY_NODE",
                    "message": f"⚠️ Узел {member['name']} недоступен",
                    "threat": "Потеря избыточности данных",
                    "action": "Проверить доступность узла"
                })
        
        # Проверяем lag (используем предыдущую логику)
        primary_member = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
        if primary_member:
            primary_optime = primary_member.get('optimeDate')
            for member in rs_status['members']:
                if member['stateStr'] == 'SECONDARY':
                    member_optime = member.get('optimeDate')
                    if primary_optime and member_optime:
                        lag = (primary_optime - member_optime).total_seconds()
                        if lag > 30:
                            alerts.append({
                                "level": "WARNING",
                                "type": "HIGH_REPLICATION_LAG",
                                "message": f"⚠️ Высокая задержка репликации на {member['name']}: {round(lag, 2)}s",
                                "threat": "Риск устаревших данных при чтении с Secondary",
                                "action": "Проверить сетевую производительность"
                            })
        
        return {
            "timestamp": str(datetime.now()),
            "alerts_count": len(alerts),
            "status": "CRITICAL" if any(a['level'] == 'CRITICAL' for a in alerts) else "WARNING" if alerts else "OK",
            "alerts": alerts if alerts else [{"level": "INFO", "message": "✅ Все системы работают нормально"}]
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения алертов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
