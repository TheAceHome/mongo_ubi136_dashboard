from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure
import os
import logging
from typing import Optional, Dict, Any
import subprocess
import json
import threading
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Consensus Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
client = None

class WriteRequest(BaseModel):
    collection: str
    document: Dict[str, Any]
    write_concern: Optional[str] = "majority"

class DockerRequest(BaseModel):
    node: str
    duration: Optional[int] = 30

@app.on_event("startup")
async def startup_db_client():
    global client
    try:
        client = MongoClient(MONGO_URI)
        client.admin.command('ping')
        logger.info("✅ Подключено к MongoDB Replica Set")
    except ConnectionFailure as e:
        logger.error(f"❌ Ошибка подключения к MongoDB: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()

@app.get("/")
async def root():
    return {
        "service": "Consensus Service",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    try:
        client.admin.command('ping')
        rs_status = client.admin.command('replSetGetStatus')
        primary_count = sum(1 for member in rs_status['members'] if member['stateStr'] == 'PRIMARY')
        secondary_count = sum(1 for member in rs_status['members'] if member['stateStr'] == 'SECONDARY')
        
        return {
            "status": "healthy",
            "database": "connected",
            "replica_set": {
                "name": rs_status.get('set'),
                "primary_nodes": primary_count,
                "secondary_nodes": secondary_count,
                "total_members": len(rs_status['members'])
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))

@app.get("/cluster/status")
async def get_cluster_status():
    try:
        rs_status = client.admin.command('replSetGetStatus')
        members_info = []
        for member in rs_status['members']:
            members_info.append({
                "name": member['name'],
                "state": member['stateStr'],
                "health": "healthy" if member['health'] == 1 else "unhealthy",
                "uptime": member.get('uptime', 0),
                "lag": member.get('optimeDate', None)
            })
        
        return {
            "replica_set": rs_status.get('set'),
            "members": members_info,
            "date": str(rs_status.get('date')),
            "health_percentage": 100 * sum(1 for m in rs_status['members'] if m['health'] == 1) / len(rs_status['members']),
            "total_nodes": len(rs_status['members']),
            "healthy_nodes": sum(1 for m in rs_status['members'] if m['health'] == 1)
        }
    except Exception as e:
        logger.error(f"Ошибка получения статуса кластера: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/write/safe")
async def safe_write(request: WriteRequest):
    try:
        db = client['protected_db']
        collection = db[request.collection]
        from pymongo import WriteConcern
        
        if request.write_concern == "majority":
            collection_with_concern = collection.with_options(
                write_concern=WriteConcern(w="majority", wtimeout=5000)
            )
        else:
            collection_with_concern = collection
        
        rs_status = client.admin.command('replSetGetStatus')
        primary_count = sum(1 for member in rs_status['members'] if member['stateStr'] == 'PRIMARY')
        
        if primary_count == 0:
            raise HTTPException(status_code=503, detail="Нет доступного Primary узла")
        
        result = collection_with_concern.insert_one(request.document)
        logger.info(f"✅ Безопасная запись выполнена: {result.inserted_id}")
        
        return {
            "status": "success",
            "message": "Документ записан с гарантией согласованности",
            "inserted_id": str(result.inserted_id),
            "write_concern": request.write_concern
        }
    except Exception as e:
        logger.error(f"❌ Ошибка записи: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/docker/status")
async def get_docker_status():
    """Получить статус Docker контейнеров"""
    try:
        # ✅ ИСПРАВЛЕНО: Используем shell=True и более длинный timeout
        result = subprocess.run(
            'docker ps -a --format json',
            shell=True,
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode != 0:
            logger.error(f"Docker error: {result.stderr}")
            return {
                "success": False,
                "docker_available": False,
                "error": "Cannot connect to Docker daemon"
            }
        
        containers = []
        if result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                if line.strip():
                    try:
                        containers.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        
        mongo_containers = {
            'mongo-primary': None,
            'mongo-secondary1': None,
            'mongo-secondary2': None,
        }
        
        for container in containers:
            name = container.get('Names', '')
            if 'mongo-primary' in name:
                mongo_containers['mongo-primary'] = {
                    'status': container.get('State'),
                    'running': container.get('State') == 'running'
                }
            elif 'mongo-secondary1' in name:
                mongo_containers['mongo-secondary1'] = {
                    'status': container.get('State'),
                    'running': container.get('State') == 'running'
                }
            elif 'mongo-secondary2' in name:
                mongo_containers['mongo-secondary2'] = {
                    'status': container.get('State'),
                    'running': container.get('State') == 'running'
                }
        
        logger.info(f"✅ Docker status: {mongo_containers}")
        
        return {
            "success": True,
            "data": {
                "docker_available": True,
                "containers": mongo_containers
            }
        }
    except Exception as e:
        logger.error(f"Docker status error: {e}")
        return {
            "success": False,
            "docker_available": False,
            "error": str(e)
        }

@app.post("/docker/stop")
async def stop_container(request: DockerRequest):
    """Остановить контейнер на определенный период"""
    try:
        logger.info(f"🛑 Stopping container: {request.node}")
        
        # ✅ ИСПРАВЛЕНО: shell=True + более длинный timeout (30 секунд)
        result = subprocess.run(
            f'docker stop {request.node}',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            logger.error(f"Failed to stop {request.node}: {result.stderr}")
            return {
                "success": False,
                "error": f"Failed to stop container: {result.stderr}"
            }
        
        logger.info(f"✅ Container {request.node} stopped successfully")
        
        # Запланировать перезагрузку
        if request.duration:
            def restart_after_delay():
                try:
                    logger.info(f"⏳ Waiting {request.duration}s before restart...")
                    time.sleep(request.duration)
                    
                    logger.info(f"🔄 Auto-restarting {request.node}...")
                    restart_result = subprocess.run(
                        f'docker start {request.node}',
                        shell=True,
                        capture_output=True,
                        text=True,
                        timeout=30
                    )
                    
                    if restart_result.returncode == 0:
                        logger.info(f"✅ Container {request.node} restarted automatically after {request.duration}s")
                    else:
                        logger.error(f"Failed to restart {request.node}: {restart_result.stderr}")
                except Exception as e:
                    logger.error(f"Error in auto-restart: {e}")
            
            thread = threading.Thread(target=restart_after_delay, daemon=True)
            thread.start()
            logger.info(f"✅ Auto-restart thread started")
        
        return {
            "success": True,
            "data": {
                "message": f"Container {request.node} stopped successfully",
                "node": request.node,
                "auto_restart_in": f"{request.duration}s" if request.duration else "manual"
            }
        }
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout stopping {request.node}")
        return {
            "success": False,
            "error": "Operation timeout (30s)"
        }
    except Exception as e:
        logger.error(f"Error stopping container: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/docker/start")
async def start_container(request: DockerRequest):
    """Запустить контейнер"""
    try:
        logger.info(f"Starting container: {request.node}")
        
        result = subprocess.run(
            f'docker start {request.node}',
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            logger.error(f"Failed to start {request.node}: {result.stderr}")
            return {
                "success": False,
                "error": f"Failed to start container: {result.stderr}"
            }
        
        logger.info(f"✅ Container {request.node} started successfully")
        
        return {
            "success": True,
            "data": {
                "message": f"Container {request.node} started successfully",
                "node": request.node
            }
        }
    except subprocess.TimeoutExpired:
        logger.error(f"Timeout starting {request.node}")
        return {
            "success": False,
            "error": "Operation timeout"
        }
    except Exception as e:
        logger.error(f"Error starting container: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.get("/alerts")
async def get_alerts():
    try:
        rs_status = client.admin.command('replSetGetStatus')
        alerts = []
        
        primary_count = sum(1 for m in rs_status['members'] if m['stateStr'] == 'PRIMARY')
        if primary_count == 0:
            alerts.append({
                "level": "CRITICAL",
                "type": "NO_PRIMARY",
                "message": "Primary узел не найден"
            })
        elif primary_count > 1:
            alerts.append({
                "level": "CRITICAL",
                "type": "SPLIT_BRAIN",
                "message": "Обнаружено более одного Primary"
            })
        
        unhealthy = [m for m in rs_status['members'] if m['health'] != 1]
        for member in unhealthy:
            alerts.append({
                "level": "WARNING",
                "type": "UNHEALTHY_NODE",
                "message": f"{member['name']} недоступен"
            })
        
        return {
            "success": True,
            "data": {
                "alerts": alerts
            }
        }
    except Exception as e:
        logger.error(f"Error getting alerts: {e}")
        return {
            "success": True,
            "data": {
                "alerts": []
            }
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)