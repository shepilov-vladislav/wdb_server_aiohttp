FROM python:3.10.7-alpine

ARG requirements=requirements/production.txt
ARG WDB_SERVER_VERSION="1.1.0-dev1"
ARG WDB_VERSION="3.3.0"

RUN \
    apk add --no-cache --virtual .build-deps build-base linux-headers && \
    python3 -m pip install wdb.server.aiohttp==$WDB_SERVER_VERSION && \
    python3 -m pip install wdb==$WDB_VERSION && \
    apk --purge del .build-deps

EXPOSE 19840
EXPOSE 1984
CMD ["wdb.server.py", "--server-host=0.0.0.0", "--socket-host=0.0.0.0", "--detached_session"]
