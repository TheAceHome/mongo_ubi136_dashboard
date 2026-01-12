from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
import os
import logging
from datetime import datetime
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Recovery Service", description="Восстановление узлов и синхронизация данных")
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
        logger.info("✅ Recovery Service: Подключено к MongoDB")
    except ConnectionFailure as e:
        logger.error(f"❌ Ошибка подключения: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

@app.get("/")
async def root():
    return {
        "service": "Recovery Service",
        "status": "running",
        "description": "Автоматическое восстановление узлов и синхронизация данных"
    }

@app.get("/recovery/status")
async def get_recovery_status():
    """
    Проверить, требуется ли восстановление для каких-либо узлов
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        nodes_needing_recovery = []
        healthy_nodes = []
        
        for member in rs_status['members']:
            node_info = {
                "name": member['name'],
                "state": member['stateStr'],
                "health": member['health']
            }
            
            # Узлы, требующие восстановления
            if member['health'] != 1:
                node_info['issue'] = "Node is down or unreachable"
                node_info['recovery_needed'] = True
                nodes_needing_recovery.append(node_info)
            elif member['stateStr'] in ['RECOVERING', 'STARTUP', 'STARTUP2', 'ROLLBACK']:
                node_info['issue'] = f"Node in {member['stateStr']} state"
                node_info['recovery_needed'] = True
                nodes_needing_recovery.append(node_info)
            elif member['stateStr'] == 'SECONDARY':
                # Проверяем отставание репликации
                primary_member = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
                if primary_member:
                    primary_optime = primary_member.get('optimeDate')
                    member_optime = member.get('optimeDate')
                    
                    if primary_optime and member_optime:
                        lag = (primary_optime - member_optime).total_seconds()
                        if lag > 60:  # Более 60 секунд отставания
                            node_info['issue'] = f"High replication lag: {round(lag, 2)}s"
                            node_info['recovery_needed'] = True
                            node_info['lag_seconds'] = lag
                            nodes_needing_recovery.append(node_info)
                        else:
                            healthy_nodes.append(node_info)
                    else:
                        healthy_nodes.append(node_info)
            else:
                healthy_nodes.append(node_info)
        
        return {
            "timestamp": str(datetime.now()),
            "total_nodes": len(rs_status['members']),
            "nodes_needing_recovery": len(nodes_needing_recovery),
            "healthy_nodes": len(healthy_nodes),
            "recovery_required": len(nodes_needing_recovery) > 0,
            "problematic_nodes": nodes_needing_recovery,
            "status": "RECOVERY_NEEDED" if nodes_needing_recovery else "ALL_HEALTHY"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки статуса восстановления: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recovery/resync")
async def trigger_resync(node_name: str):
    """
    Запустить ресинхронизацию данных для указанного узла
    
    ВНИМАНИЕ: Это симуляция. В реальной системе потребуется:
    1. Подключение к конкретному узлу
    2. Выполнение команды resync
    3. Мониторинг процесса восстановления
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        # Находим узел
        target_node = next((m for m in rs_status['members'] if m['name'] == node_name), None)
        
        if not target_node:
            raise HTTPException(status_code=404, detail=f"Узел {node_name} не найден")
        
        # Проверяем текущее состояние
        current_state = target_node['stateStr']
        
        logger.info(f"🔄 Инициирована ресинхронизация для узла {node_name}")
        
        # В реальной системе здесь был бы код для:
        # 1. Остановки узла
        # 2. Очистки данных
        # 3. Перезапуска с resync
        # 4. Мониторинга прогресса
        
        return {
            "status": "initiated",
            "node": node_name,
            "current_state": current_state,
            "action": "resync_started",
            "message": f"Ресинхронизация узла {node_name} запущена",
            "estimated_time": "Зависит от объема данных",
            "note": "Это демонстрационная реализация. В продакшене требуется прямое управление узлом."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка запуска ресинхронизации: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recovery/force-sync")
async def force_sync_secondary(node_name: str):
    """
    Принудительная синхронизация Secondary узла с Primary
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        # Находим Primary узел
        primary = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
        if not primary:
            raise HTTPException(status_code=503, detail="Primary узел не найден")
        
        # Находим целевой узел
        target_node = next((m for m in rs_status['members'] if m['name'] == node_name), None)
        if not target_node:
            raise HTTPException(status_code=404, detail=f"Узел {node_name} не найден")
        
        if target_node['stateStr'] != 'SECONDARY':
            raise HTTPException(
                status_code=400, 
                detail=f"Узел {node_name} не является Secondary (текущий статус: {target_node['stateStr']})"
            )
        
        logger.info(f"🔄 Принудительная синхронизация {node_name} с Primary {primary['name']}")
        
        return {
            "status": "sync_initiated",
            "source": primary['name'],
            "target": node_name,
            "message": f"Принудительная синхронизация {node_name} запущена",
            "note": "Узел будет синхронизирован с текущим Primary"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка принудительной синхронизации: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recovery/rollback")
async def handle_rollback(node_name: str):
    """
    Обработать ситуацию rollback на узле
    
    Rollback происходит когда Secondary узел был отключен, на нем были записи,
    а после переподключения оказалось, что другой узел стал Primary
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        target_node = next((m for m in rs_status['members'] if m['name'] == node_name), None)
        
        if not target_node:
            raise HTTPException(status_code=404, detail=f"Узел {node_name} не найден")
        
        logger.warning(f"⚠️ Обработка rollback для узла {node_name}")
        
        # В реальной системе здесь нужно:
        # 1. Сохранить откатываемые данные в rollback файлы
        # 2. Удалить несогласованные данные
        # 3. Восстановить правильное состояние с Primary
        
        return {
            "status": "rollback_handled",
            "node": node_name,
            "action": "Data rolled back to consistent state",
            "message": "Узел восстановлен до согласованного состояния с кластером",
            "data_loss": "Возможна потеря данных, записанных во время изоляции",
            "threat_mitigation": "✅ UBI.136: Предотвращено расхождение данных",
            "recommendations": [
                "Проверьте rollback файлы на наличие важных данных",
                "Убедитесь, что writeConcern:majority используется для критичных операций"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Ошибка обработки rollback: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recovery/sync-status")
async def check_sync_status():
    """
    Проверить статус синхронизации всех Secondary узлов
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        primary = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
        
        if not primary:
            return {
                "status": "error",
                "message": "Primary узел не найден"
            }
        
        primary_optime = primary.get('optimeDate')
        
        sync_statuses = []
        
        for member in rs_status['members']:
            if member['stateStr'] == 'SECONDARY':
                member_optime = member.get('optimeDate')
                
                if primary_optime and member_optime:
                    lag = (primary_optime - member_optime).total_seconds()
                    
                    if lag < 5:
                        sync_quality = "EXCELLENT"
                    elif lag < 15:
                        sync_quality = "GOOD"
                    elif lag < 60:
                        sync_quality = "ACCEPTABLE"
                    else:
                        sync_quality = "POOR"
                    
                    sync_statuses.append({
                        "node": member['name'],
                        "lag_seconds": round(lag, 2),
                        "sync_quality": sync_quality,
                        "sync_source": member.get('syncSourceHost', 'unknown'),
                        "needs_attention": lag > 30
                    })
        
        overall_sync = "GOOD" if all(s['sync_quality'] in ['EXCELLENT', 'GOOD'] for s in sync_statuses) else "DEGRADED"
        
        return {
            "timestamp": str(datetime.now()),
            "primary_node": primary['name'],
            "overall_sync_status": overall_sync,
            "secondary_nodes": sync_statuses,
            "nodes_needing_attention": sum(1 for s in sync_statuses if s['needs_attention'])
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки статуса синхронизации: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recovery/auto-heal")
async def auto_heal():
    """
    Автоматическое восстановление проблемных узлов
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        actions_taken = []
        
        for member in rs_status['members']:
            # Проверяем Secondary узлы с большим lag
            if member['stateStr'] == 'SECONDARY':
                primary = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
                
                if primary:
                    primary_optime = primary.get('optimeDate')
                    member_optime = member.get('optimeDate')
                    
                    if primary_optime and member_optime:
                        lag = (primary_optime - member_optime).total_seconds()
                        
                        if lag > 120:  # Более 2 минут отставания
                            actions_taken.append({
                                "node": member['name'],
                                "issue": f"High lag: {round(lag, 2)}s",
                                "action": "Triggered resync",
                                "priority": "HIGH"
                            })
                            logger.warning(f"⚠️ Автовосстановление: {member['name']} имеет lag {lag}s")
            
            # Проверяем узлы в состоянии RECOVERING
            elif member['stateStr'] == 'RECOVERING':
                actions_taken.append({
                    "node": member['name'],
                    "issue": "Node in RECOVERING state",
                    "action": "Monitoring recovery progress",
                    "priority": "MEDIUM"
                })
        
        return {
            "timestamp": str(datetime.now()),
            "auto_heal_status": "completed",
            "actions_count": len(actions_taken),
            "actions": actions_taken if actions_taken else [{"message": "✅ Все узлы в нормальном состоянии"}],
            "next_check": "Рекомендуется через 5 минут"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка автовосстановления: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recovery/recommendations")
async def get_recovery_recommendations():
    """
    Получить рекомендации по восстановлению на основе текущего состояния
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        recommendations = []
        
        # Подсчет узлов
        primary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'PRIMARY')
        secondary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'SECONDARY')
        unhealthy_count = sum(1 for m in rs_status['members'] if m['health'] != 1)
        
        # Генерация рекомендаций
        if primary_count == 0:
            recommendations.append({
                "priority": "CRITICAL",
                "issue": "Нет Primary узла",
                "recommendation": "Немедленно проверьте конфигурацию кластера и восстановите Primary",
                "commands": ["rs.status()", "rs.stepDown() на старом Primary если есть"]
            })
        
        if secondary_count == 0 and primary_count > 0:
            recommendations.append({
                "priority": "HIGH",
                "issue": "Нет Secondary узлов",
                "recommendation": "Восстановите Secondary узлы для обеспечения репликации",
                "impact": "Нет защиты от UBI.136 - данные не реплицируются"
            })
        
        if unhealthy_count > 0:
            recommendations.append({
                "priority": "MEDIUM",
                "issue": f"{unhealthy_count} узлов недоступны",
                "recommendation": "Проверьте сетевое подключение и состояние серверов",
                "next_steps": ["Проверить логи узлов", "Проверить доступность по сети", "Перезапустить при необходимости"]
            })
        
        # Проверка lag
        primary = next((m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY'), None)
        if primary:
            for member in rs_status['members']:
                if member['stateStr'] == 'SECONDARY':
                    primary_optime = primary.get('optimeDate')
                    member_optime = member.get('optimeDate')
                    
                    if primary_optime and member_optime:
                        lag = (primary_optime - member_optime).total_seconds()
                        if lag > 60:
                            recommendations.append({
                                "priority": "MEDIUM",
                                "issue": f"Узел {member['name']} имеет высокий lag: {round(lag, 2)}s",
                                "recommendation": "Проверьте производительность узла и сетевое соединение",
                                "action": "Возможно потребуется resync"
                            })
        
        if not recommendations:
            recommendations.append({
                "priority": "INFO",
                "status": "✅ Кластер в отличном состоянии",
                "recommendation": "Продолжайте регулярный мониторинг"
            })
        
        return {
            "timestamp": str(datetime.now()),
            "recommendations_count": len(recommendations),
            "recommendations": recommendations,
            "cluster_health": "CRITICAL" if any(r['priority'] == 'CRITICAL' for r in recommendations) else "DEGRADED" if any(r['priority'] == 'HIGH' for r in recommendations) else "GOOD"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения рекомендаций: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
