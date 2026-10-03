FROM postgres@sha256:5a5a84b19854a9ffaa54082c166ff4ec27473a361e496e5ea167f298f2da9722
RUN apt-get update && apt-get install -y --no-install-recommends systemd python3 dbus \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin ritmo-receiver
ENV container=docker
ENTRYPOINT []
CMD ["/lib/systemd/systemd"]
