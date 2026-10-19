FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd -r -u 10001 alantis
COPY . /srv/
RUN mkdir -p /data && chown -R alantis:alantis /data /srv
USER alantis
EXPOSE 8080
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${ALANTIS_PORT:-8080} --workers 1"]