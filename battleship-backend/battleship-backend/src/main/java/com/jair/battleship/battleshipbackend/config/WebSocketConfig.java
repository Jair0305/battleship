package com.jair.battleship.battleshipbackend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(org.springframework.messaging.simp.config.MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(org.springframework.web.socket.config.annotation.StompEndpointRegistry registry) {
        // No se puede usar "*" con credenciales; usar patrones/orígenes explícitos.
        registry.addEndpoint("/ws").setAllowedOriginPatterns(
            "http://localhost:3002",
            "http://localhost:3001",
            "http://localhost:3000"
        ).withSockJS();
    }
}
