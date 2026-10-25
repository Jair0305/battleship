ARG ALPINE_IMAGE=alpine@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
FROM ${ALPINE_IMAGE} AS java-download
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl gzip libstdc++ zlib
COPY docker/ /tmp/java-install/
RUN sh /tmp/java-install/install-temurin.sh jdk "$TARGETARCH" /opt/java/jdk \
    && sh /tmp/java-install/install-temurin.sh jre "$TARGETARCH" /opt/java/jre

FROM java-download AS build
ENV JAVA_HOME=/opt/java/jdk
ENV PATH="/opt/java/jdk/bin:${PATH}"
ARG MAVEN_SKIP_TESTS=true

WORKDIR /workspace

COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY src src

RUN chmod +x mvnw && ./mvnw -B -DskipTests=${MAVEN_SKIP_TESTS} package

FROM ${ALPINE_IMAGE}

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata \
        musl-locales musl-locales-lang libstdc++ zlib \
    && addgroup -S -g 10001 appuser \
    && adduser -S -D -u 10001 -G appuser -h /home/appuser appuser

COPY --from=java-download /opt/java/jre /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8

COPY --from=build /workspace/target/*.jar /app/app.jar

ENV JAVA_OPTS=""
EXPOSE 8080

USER appuser

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
