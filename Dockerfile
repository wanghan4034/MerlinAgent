FROM mcr.microsoft.com/playwright/python:v1.50.0-jammy

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN mkdir -p /app/data /app/output /app/logs

EXPOSE 8000

CMD ["python3", "web_app.py"]
