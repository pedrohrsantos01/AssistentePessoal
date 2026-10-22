# Build context: repository root. Digests verified on 2026-10-02.
FROM eclipse-temurin:21-jdk-noble@sha256:70898f0f893a6b772a0f29834d8b022e3ac20b6a0c33a922973cf66342ef56be AS build
WORKDIR /workspace
COPY api/gradlew api/build.gradle api/settings.gradle api/gradle.lockfile ./api/
COPY api/gradle/wrapper/ ./api/gradle/wrapper/
COPY api/src/main/ ./api/src/main/
COPY contracts/primeiro-marco/openapi.json ./contracts/primeiro-marco/openapi.json
COPY contracts/pwa-m1/openapi.json ./contracts/pwa-m1/openapi.json
WORKDIR /workspace/api
RUN --mount=type=cache,target=/root/.gradle chmod +x gradlew && ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-noble@sha256:22138efd69393501fccd8176ae16b01791ed71ff801b28f0359415389b17c766
RUN groupadd --gid 10001 ritmo && useradd --uid 10001 --gid ritmo --no-create-home --shell /usr/sbin/nologin ritmo
WORKDIR /opt/ritmo
COPY --from=build --chown=10001:10001 /workspace/api/build/libs/ritmo-api-0.1.0.jar ./app.jar
USER 10001:10001
ENV SERVER_PORT=8080 SERVER_ADDRESS=0.0.0.0 RITMO_REQUIRE_WAL=true RITMO_RECOVERY_QUARANTINE=true
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/opt/ritmo/app.jar"]
