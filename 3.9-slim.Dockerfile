FROM python:3.10.1-slim

ARG WDB_SERVER_VERSION="1.1.0-dev1"
ARG WDB_VERSION="3.3.0"

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc make musl-dev python3-dev \
&& rm -rf /var/lib/apt/lists/*

RUN pip install wdb.server.aiohttp==$WDB_SERVER_VERSION
RUN pip install wdb==$WDB_VERSION

EXPOSE 19840
EXPOSE 1984
CMD ["wdb.server.py", "--server-host=0.0.0.0", "--socket-host=0.0.0.0", "--detached_session"]
