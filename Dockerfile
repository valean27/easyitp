# Build stage
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
# Dependintele intr-un layer separat: se refolosesc cat timp pom.xml nu se schimba
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B clean package -DskipTests

# Run stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# Fara root in container
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /app/target/*.jar app.jar
USER app
EXPOSE 8080
# Render free are 512 MB: heap-ul la 75% din memoria containerului; ora Romaniei inca de la pornirea JVM
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-Duser.timezone=Europe/Bucharest","-jar","app.jar"]
