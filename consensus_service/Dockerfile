FROM python:3.11-slim

WORKDIR /app

# Установить Docker CLI + добавить группу docker
RUN apt-get update && apt-get install -y \
    docker.io \
    sudo \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -f docker || true

# Скопировать код
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Дать доступ к docker socket
RUN chmod 666 /var/run/docker.sock 2>/dev/null || true

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]