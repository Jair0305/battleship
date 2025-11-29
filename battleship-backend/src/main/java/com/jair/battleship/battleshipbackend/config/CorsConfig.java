package com.jair.battleship.battleshipbackend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/**")
                        // Next.js dev corre en 3001/3002 (cuando un puerto está ocupado Next elige
                        // otro)
                        .allowedOriginPatterns("http://localhost:3002", "http://localhost:3001",
                                "http://localhost:3000")
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .exposedHeaders("Location")
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
