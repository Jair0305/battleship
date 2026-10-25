ARG UBUNTU_IMAGE=ubuntu@sha256:0a9887931b0e38af2e3487ed39e29436b0535c4f3f52e57745baaf79d1898956
FROM ${UBUNTU_IMAGE} AS java-download
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gzip \
    && rm -rf /var/lib/apt/lists/*
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

FROM ${UBUNTU_IMAGE}

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata libfontconfig1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 appuser

COPY --from=java-download /opt/java/jre /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"

COPY --from=build /workspace/target/*.jar /app/app.jar

ENV JAVA_OPTS=""
EXPOSE 8080

USER appuser

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
