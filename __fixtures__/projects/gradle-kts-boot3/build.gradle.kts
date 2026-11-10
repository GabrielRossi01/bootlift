plugins {
    java
    groovy
    id("org.springframework.boot") version "3.4.1"
    id("io.spring.dependency-management") version "1.1.7"
}

group = "dev.rossi.fixtures"
version = "0.0.1-SNAPSHOT"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-aop")
    implementation("org.springframework.boot:spring-boot-starter-data-mongodb")
    implementation("org.springframework.session:spring-session-data-mongodb")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation(libs.spock.spring)
}

tasks.withType<Test> {
    useJUnitPlatform()
}
