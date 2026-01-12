from fastapi import FastAPI, HTTPException
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
import os
import logging
from datetime import datetime
from typing import List, Dict
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Health Check Service", description="Проверка здоровья узлов кластера")
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
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        logger.info("✅ Health Check: Подключено к MongoDB")
    except ConnectionFailure as e:
        logger.error(f"❌ Ошибка подключения: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

@app.get("/")
async def root():
    return {
        "service": "Health Check Service",
        "status": "running",
        "description": "Проверка доступности и здоровья узлов кластера"
    }

@app.get("/health/all")
async def check_all_nodes():
    """
    Проверить здоровье всех узлов в Replica Set
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        nodes_health = []
        healthy_count = 0
        unhealthy_count = 0
        
        for member in rs_status['members']:
            is_healthy = member['health'] == 1
            
            if is_healthy:
                healthy_count += 1
            else:
                unhealthy_count += 1
            
            # Определяем время недоступности
            uptime = member.get('uptime', 0)
            
            nodes_health.append({
                "name": member['name'],
                "state": member['stateStr'],
                "health": "healthy" if is_healthy else "unhealthy",
                "uptime_seconds": uptime,
                "uptime_formatted": f"{uptime // 3600}h {(uptime % 3600) // 60}m",
                "ping_ms": member.get('pingMs', 'N/A'),
                "last_heartbeat": str(member.get('lastHeartbeat', 'N/A')),
                "sync_source": member.get('syncSourceHost', 'N/A')
            })
        
        # Общая оценка здоровья кластера
        total_nodes = len(rs_status['members'])
        health_percentage = (healthy_count / total_nodes * 100) if total_nodes > 0 else 0
        
        cluster_status = "HEALTHY" if healthy_count == total_nodes else "DEGRADED" if healthy_count > total_nodes // 2 else "CRITICAL"
        
        return {
            "timestamp": str(datetime.now()),
            "cluster_status": cluster_status,
            "health_percentage": round(health_percentage, 1),
            "total_nodes": total_nodes,
            "healthy_nodes": healthy_count,
            "unhealthy_nodes": unhealthy_count,
            "nodes": nodes_health,
            "threat_assessment": {
                "UBI.136_risk": "LOW" if cluster_status == "HEALTHY" else "MEDIUM" if cluster_status == "DEGRADED" else "HIGH",
                "description": self._get_threat_description(cluster_status)
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки здоровья: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_threat_description(status: str) -> str:
    """Получить описание угрозы на основе статуса"""
    if status == "HEALTHY":
        return "✅ Все узлы доступны, данные защищены"
    elif status == "DEGRADED":
        return "⚠️ Некоторые узлы недоступны, избыточность снижена"
    else:
        return "🔴 Критическая ситуация, высокий риск потери данных"

app._get_threat_description = _get_threat_description

@app.get("/health/primary")
async def check_primary():
    """
    Проверить статус Primary узла
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        primary_nodes = [m for m in rs_status['members'] if m['stateStr'] == 'PRIMARY']
        
        if len(primary_nodes) == 0:
            return {
                "status": "CRITICAL",
                "message": "🔴 Primary узел не найден!",
                "threat": "Записи в базу невозможны",
                "impact": "UBI.136: Полная блокировка операций записи",
                "action_required": "Немедленно проверить конфигурацию кластера"
            }
        
        if len(primary_nodes) > 1:
            return {
                "status": "CRITICAL",
                "message": "🔴 Обнаружено более одного Primary узла (Split-Brain)!",
                "primary_nodes": [p['name'] for p in primary_nodes],
                "threat": "Критический риск расхождения данных",
                "impact": "UBI.136: Данные могут быть записаны в разные узлы несогласованно",
                "action_required": "НЕМЕДЛЕННО изолировать сегменты и провести восстановление"
            }
        
        primary = primary_nodes[0]
        
        return {
            "status": "HEALTHY",
            "message": "✅ Primary узел работает нормально",
            "primary_node": {
                "name": primary['name'],
                "health": "healthy" if primary['health'] == 1 else "unhealthy",
                "uptime_seconds": primary.get('uptime', 0),
                "optime": str(primary.get('optimeDate', 'N/A')),
                "election_date": str(primary.get('electionDate', 'N/A'))
            },
            "threat": "Нет угрозы",
            "protection_level": "Полная защита от UBI.136"
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки Primary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health/secondaries")
async def check_secondaries():
    """
    Проверить статус Secondary узлов
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        secondary_nodes = [m for m in rs_status['members'] if m['stateStr'] == 'SECONDARY']
        
        if len(secondary_nodes) == 0:
            return {
                "status": "CRITICAL",
                "message": "🔴 Secondary узлы не найдены!",
                "threat": "Отсутствует избыточность данных",
                "impact": "UBI.136: Критический риск потери данных при отказе Primary",
                "action_required": "Восстановить Secondary узлы как можно скорее"
            }
        
        secondaries_info = []
        healthy_secondaries = 0
        
        for secondary in secondary_nodes:
            is_healthy = secondary['health'] == 1
            if is_healthy:
                healthy_secondaries += 1
            
            secondaries_info.append({
                "name": secondary['name'],
                "health": "healthy" if is_healthy else "unhealthy",
                "state": secondary['stateStr'],
                "uptime_seconds": secondary.get('uptime', 0),
                "sync_source": secondary.get('syncSourceHost', 'N/A'),
                "ping_ms": secondary.get('pingMs', 'N/A')
            })
        
        redundancy_level = "FULL" if healthy_secondaries == len(secondary_nodes) else "PARTIAL" if healthy_secondaries > 0 else "NONE"
        
        return {
            "status": "HEALTHY" if redundancy_level == "FULL" else "DEGRADED",
            "total_secondaries": len(secondary_nodes),
            "healthy_secondaries": healthy_secondaries,
            "redundancy_level": redundancy_level,
            "secondaries": secondaries_info,
            "protection_assessment": {
                "data_redundancy": f"{healthy_secondaries + 1} копии данных" if healthy_secondaries > 0 else "Только 1 копия (Primary)",
                "UBI.136_protection": "Активна" if healthy_secondaries > 0 else "Отсутствует"
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки Secondary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health/network")
async def check_network_connectivity():
    """
    Проверить сетевую связность между узлами
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        connectivity_issues = []
        
        for member in rs_status['members']:
            ping_ms = member.get('pingMs')
            
            # Проверяем задержку ping
            if ping_ms is not None:
                if ping_ms > 100:
                    connectivity_issues.append({
                        "node": member['name'],
                        "issue": "HIGH_LATENCY",
                        "ping_ms": ping_ms,
                        "severity": "WARNING",
                        "description": f"⚠️ Высокая задержка сети: {ping_ms}ms"
                    })
            else:
                if member['health'] != 1:
                    connectivity_issues.append({
                        "node": member['name'],
                        "issue": "NO_CONNECTION",
                        "severity": "CRITICAL",
                        "description": "🔴 Узел недоступен по сети"
                    })
        
        network_status = "CRITICAL" if any(i['severity'] == 'CRITICAL' for i in connectivity_issues) else "WARNING" if connectivity_issues else "HEALTHY"
        
        return {
            "timestamp": str(datetime.now()),
            "network_status": network_status,
            "issues_count": len(connectivity_issues),
            "issues": connectivity_issues if connectivity_issues else [{"message": "✅ Сетевая связность в норме"}],
            "split_brain_risk": "HIGH" if network_status == "CRITICAL" else "LOW",
            "recommendations": [
                "Проверьте сетевое оборудование" if network_status != "HEALTHY" else "Сеть работает нормально",
                "Риск Split-Brain сценария" if network_status == "CRITICAL" else "Топология кластера стабильна"
            ]
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка проверки сети: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health/summary")
async def get_health_summary():
    """
    Общая сводка по здоровью кластера
    """
    try:
        rs_status = client.admin.command('replSetGetStatus')
        
        # Считаем узлы по статусам
        primary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'PRIMARY')
        secondary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'SECONDARY')
        healthy_count = sum(1 for m in rs_status['members'] if m['health'] == 1)
        total_count = len(rs_status['members'])
        
        # Определяем общий статус
        if primary_count == 1 and secondary_count >= 1 and healthy_count == total_count:
            overall_status = "EXCELLENT"
            status_icon = "✅"
            threat_level = "NONE"
        elif primary_count == 1 and healthy_count >= (total_count // 2 + 1):
            overall_status = "GOOD"
            status_icon = "✅"
            threat_level = "LOW"
        elif primary_count == 1:
            overall_status = "DEGRADED"
            status_icon = "⚠️"
            threat_level = "MEDIUM"
        else:
            overall_status = "CRITICAL"
            status_icon = "🔴"
            threat_level = "HIGH"
        
        return {
            "timestamp": str(datetime.now()),
            "overall_status": f"{status_icon} {overall_status}",
            "replica_set": rs_status.get('set'),
            "cluster_health": {
                "total_nodes": total_count,
                "healthy_nodes": healthy_count,
                "primary_nodes": primary_count,
                "secondary_nodes": secondary_count
            },
            "threat_assessment": {
                "UBI.136_threat_level": threat_level,
                "description": self._get_summary_description(overall_status),
                "data_safety": "PROTECTED" if threat_level in ["NONE", "LOW"] else "AT_RISK"
            },
            "recommendations": self._get_recommendations(overall_status, primary_count, secondary_count)
        }
        
    except Exception as e:
        logger.error(f"❌ Ошибка получения сводки: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _get_summary_description(status: str) -> str:
    descriptions = {
        "EXCELLENT": "Кластер работает идеально, все защитные механизмы активны",
        "GOOD": "Кластер работает нормально, данные защищены",
        "DEGRADED": "Избыточность снижена, требуется внимание",
        "CRITICAL": "Критическая ситуация, высокий риск потери данных"
    }
    return descriptions.get(status, "Неизвестный статус")

def _get_recommendations(status: str, primary: int, secondary: int) -> List[str]:
    recommendations = []
    
    if status == "EXCELLENT":
        recommendations.append("✅ Все системы работают оптимально")
    elif status == "GOOD":
        recommendations.append("✅ Продолжайте мониторинг")
    elif status == "DEGRADED":
        recommendations.append("⚠️ Восстановите недоступные узлы")
        if secondary < 1:
            recommendations.append("⚠️ Критично: нет Secondary узлов для репликации")
    else:
        recommendations.append("🔴 ТРЕБУЕТСЯ НЕМЕДЛЕННОЕ ВМЕШАТЕЛЬСТВО")
        if primary == 0:
            recommendations.append("🔴 Восстановите Primary узел")
        if primary > 1:
            recommendations.append("🔴 Разрешите Split-Brain ситуацию")
    
    return recommendations

app._get_summary_description = _get_summary_description
app._get_recommendations = _get_recommendations

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
