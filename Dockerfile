FROM eclipse-temurin:25-jre

WORKDIR /app

# Puerto interno del backend
EXPOSE 8000

# Flags opcionales de JVM y ruta del JAR montado por volumen
ENV JAVA_OPTS=""
ENV JAR_FILE="/app/agora.jar"

# Ejecuta el jar montado (fallará explícitamente si no está presente)
ENTRYPOINT ["sh", "-c", "if [ ! -f \"$JAR_FILE\" ]; then echo 'JAR no encontrado en '$JAR_FILE; ls -la /app; exit 1; fi; java $JAVA_OPTS -jar \"$JAR_FILE\""]