from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
import os
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Transaction Log Service", description="Логирование операций и аудит транзакций")
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
        logger.info("✅ Transaction Log: Подключено к MongoDB")
        
        # Создаем коллекцию для логов, если её нет
        db = client['protected_db']
        if 'transaction_logs' not in db.list_collection_names():
            db.create_collection('transaction_logs')
            logger.info("📝 Создана коллекция transaction_logs")
            
    except ConnectionFailure as e:
        logger.error(f"❌ Ошибка подключения: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

@app.get("/")
async def root():
    return {
        "service": "Transaction Log Service",
        "status": "running",
        "description": "Логирование всех операций записи и аудит транзакций"
    }

@app.post("/log/write")
async def log_write_operation(
    operation_type: str,
    collection: str,
    document: Dict[str, Any],
    write_concern: str,
    result: str,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Залогировать операцию записи
    """
    try:
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        log_entry = {
            "timestamp": datetime.now(),
            "operation_type": operation_type,
            "target_collection": collection,
            "document": document,
            "write_concern": write_concern,
            "result": result,
            "metadata": metadata or {},
            "replica_set_status": self._get_replica_status()
        }
        
        # Записываем лог с гарантией согласованности
        from pymongo import WriteConcern
        logs_with_concern = logs_collection.with_options(
            write_concern=WriteConcern(w="majority")
        )
        
        log_result = logs_with_concern.insert_one(log_entry)
        
        logger.info(f"📝 Операция залогирована: {operation_type} на {collection}")
        
        return {
            "status": "logged",
            "log_id": str(log_result.inserted_id),
            "timestamp": str(log_entry['timestamp'])
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка логирования: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_replica_status():
    """Получить текущий статус реплика-сета для лога"""
    try:
        rs_status = client.admin.command('replSetGetStatus')
        return {
            "primary": next((m['name'] for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None),
            "healthy_nodes": sum(1 for m in rs_status['members'] if m['health'] == 1),
            "total_nodes": len(rs_status['members'])
        }
    except:
        return {"status": "unknown"}

app._get_replica_status = _get_replica_status

@app.get("/logs/recent")
async def get_recent_logs(limit: int = 20):
    """
    Получить последние логи операций
    """
    try:
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        logs = list(logs_collection.find().sort('timestamp', -1).limit(limit))
        
        # Конвертируем ObjectId в строки
        for log in logs:
            log['_id'] = str(log['_id'])
            log['timestamp'] = str(log['timestamp'])
        
        return {
            "count": len(logs),
            "logs": logs
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/logs/by-collection")
async def get_logs_by_collection(collection: str, limit: int = 20):
    """
    Получить логи для конкретной коллекции
    """
    try:
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        logs = list(
            logs_collection.find({"target_collection": collection})
            .sort('timestamp', -1)
            .limit(limit)
        )
        
        for log in logs:
            log['_id'] = str(log['_id'])
            log['timestamp'] = str(log['timestamp'])
        
        return {
            "collection": collection,
            "count": len(logs),
            "logs": logs
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/logs/stats")
async def get_log_statistics():
    """
    Получить статистику по логам операций
    """
    try:
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        total_logs = logs_collection.count_documents({})
        
        # Статистика по типам операций
        pipeline = [
            {"$group": {
                "_id": "$operation_type",
                "count": {"$sum": 1}
            }}
        ]
        operation_stats = list(logs_collection.aggregate(pipeline))
        
        # Статистика по write_concern
        pipeline_wc = [
            {"$group": {
                "_id": "$write_concern",
                "count": {"$sum": 1}
            }}
        ]
        write_concern_stats = list(logs_collection.aggregate(pipeline_wc))
        
        # Статистика успешности
        pipeline_result = [
            {"$group": {
                "_id": "$result",
                "count": {"$sum": 1}
            }}
        ]
        result_stats = list(logs_collection.aggregate(pipeline_result))
        
        return {
            "total_operations": total_logs,
            "operations_by_type": operation_stats,
            "operations_by_write_concern": write_concern_stats,
            "operations_by_result": result_stats,
            "collection_name": "transaction_logs"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения статистики: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audit/timeline")
async def get_audit_timeline(hours: int = 24):
    """
    Получить временную линию операций за последние N часов
    """
    try:
        from datetime import timedelta
        
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        logs = list(
            logs_collection.find({"timestamp": {"$gte": cutoff_time}})
            .sort('timestamp', 1)
        )
        
        timeline = []
        for log in logs:
            timeline.append({
                "timestamp": str(log['timestamp']),
                "operation": log['operation_type'],
                "collection": log['target_collection'],
                "write_concern": log['write_concern'],
                "result": log['result'],
                "cluster_state": log.get('replica_set_status', {})
            })
        
        return {
            "period_hours": hours,
            "operations_count": len(timeline),
            "timeline": timeline
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/audit/failed-operations")
async def get_failed_operations(limit: int = 20):
    """
    Получить список неудачных операций
    """
    try:
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        failed_logs = list(
            logs_collection.find({"result": {"$ne": "success"}})
            .sort('timestamp', -1)
            .limit(limit)
        )
        
        for log in failed_logs:
            log['_id'] = str(log['_id'])
            log['timestamp'] = str(log['timestamp'])
        
        return {
            "failed_count": len(failed_logs),
            "operations": failed_logs,
            "threat_assessment": "⚠️ Неудачные операции могут указывать на проблемы с UBI.136" if failed_logs else "✅ Нет неудачных операций"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения неудачных операций: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/logs/clear")
async def clear_old_logs(days: int = 30):
    """
    Очистить старые логи (старше N дней)
    """
    try:
        from datetime import timedelta
        
        db = client['protected_db']
        logs_collection = db['transaction_logs']
        
        cutoff_time = datetime.now() - timedelta(days=days)
        
        result = logs_collection.delete_many({"timestamp": {"$lt": cutoff_time}})
        
        logger.info(f"🗑️ Удалено старых логов: {result.deleted_count}")
        
        return {
            "status": "cleaned",
            "deleted_count": result.deleted_count,
            "cutoff_date": str(cutoff_time)
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка очистки логов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/oplog/tail")
async def tail_oplog(limit: int = 10):
    """
    Показать последние записи из oplog (журнал операций MongoDB)
    """
    try:
        local_db = client['local']
        oplog = local_db['oplog.rs']
        
        entries = list(oplog.find().sort('$natural', -1).limit(limit))
        
        oplog_entries = []
        for entry in entries:
            oplog_entries.append({
                "timestamp": str(entry['ts'].as_datetime()),
                "operation": entry['op'],
                "namespace": entry['ns'],
                "details": str(entry.get('o', {}))[:100]  # Первые 100 символов
            })
        
        return {
            "count": len(oplog_entries),
            "entries": oplog_entries,
            "description": "Последние операции из oplog MongoDB"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка чтения oplog: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
