package com.jair.battleship.battleshipbackend;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;
import org.springframework.messaging.SubscribableChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.messaging.simp.broker.SimpleBrokerMessageHandler;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static java.nio.charset.StandardCharsets.UTF_8;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class RetiredLegacyApiTests {
    private static final List<String> LEGACY_ROOTS = List.of(
            "/api/partidas", "/api/sala", "/api/juego", "/api/chat");

    @Autowired
    private WebApplicationContext context;
    @Autowired
    private SimpAnnotationMethodMessageHandler messageHandlers;
    @Autowired
    private SimpleBrokerMessageHandler broker;
    @Autowired
    private SimpMessagingTemplate serverMessages;
    @Autowired
    @Qualifier("clientInboundChannel")
    private MessageChannel inbound;
    @Autowired
    @Qualifier("clientOutboundChannel")
    private SubscribableChannel outbound;
    private MockMvc mvc;

    @BeforeEach
    void configureMvc() {
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void noLegacyHttpOrStompHandlerIsRegistered() {
        var mappings = context.getBean("requestMappingHandlerMapping", RequestMappingHandlerMapping.class);
        assertThat(mappings.getHandlerMethods().keySet().stream()
                .flatMap(mapping -> mapping.getPatternValues().stream()).toList())
                .noneMatch(path -> LEGACY_ROOTS.stream()
                        .anyMatch(root -> path.equals(root) || path.startsWith(root + "/")));
        assertThat(messageHandlers.getHandlerMethods().keySet().stream()
                .flatMap(mapping -> mapping.getDestinationConditions().getPatterns().stream()).toList())
                .doesNotContain("/juego/disparo");
    }

    @Test
    void everyRetiredHttpOperationReturnsNotFound() throws Exception {
        for (String operation : List.of(
                "POST /api/partidas", "POST /api/partidas/0/unirse",
                "POST /api/partidas/0/tablero/0", "POST /api/partidas/0/disparar",
                "POST /api/partidas/0/deshacer", "POST /api/partidas/0/cancelar",
                "POST /api/partidas/0/empate", "GET /api/partidas/0",
                "POST /api/partidas/0/espectadores", "GET /api/partidas/sala/0/activa",
                "GET /api/partidas/0/estado", "POST /api/partidas/0/revancha",
                "POST /api/partidas/0/revancha/rechazar", "GET /api/sala",
                "GET /api/sala/todas", "POST /api/sala", "PUT /api/sala/0/ocupar",
                "PUT /api/sala/0/liberar", "PUT /api/sala/0/entrarEspectador",
                "PUT /api/sala/0/salirEspectador", "PUT /api/sala/0/puesto/0/ocupar",
                "PUT /api/sala/0/puesto/0/liberar", "POST /api/juego/registrar",
                "POST /api/juego/tablero/0", "POST /api/juego/disparo/0",
                "POST /api/juego/ready/0", "GET /api/juego/estado/0", "POST /api/chat/0")) {
            String[] parts = operation.split(" ", 2);
            mvc.perform(request(HttpMethod.valueOf(parts[0]), parts[1])
                    .contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void modernLobbyAndSessionProtectedOperationsRemainAvailable() throws Exception {
        mvc.perform(get("/api/lobby")).andExpect(status().isOk());
        mvc.perform(post("/api/mesas/0/resign").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/mesas/0/resign").header("X-Session-Token", "retirement-invalid-session")
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void clientCannotPublishToTopicsWhileServerMessagesStillReachSubscribers() throws Exception {
        String topic = "/topic/security-retirement-" + UUID.randomUUID();
        String session = UUID.randomUUID().toString();
        var received = new LinkedBlockingQueue<Message<?>>();
        MessageHandler listener = message -> {
            if (topic.equals(SimpMessageHeaderAccessor.getDestination(message.getHeaders()))
                    && session.equals(SimpMessageHeaderAccessor.getSessionId(message.getHeaders()))) {
                received.add(message);
            }
        };
        outbound.subscribe(listener);
        try {
            var connect = SimpMessageHeaderAccessor.create(SimpMessageType.CONNECT);
            connect.setSessionId(session);
            broker.handleMessage(MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()));
            var subscribe = SimpMessageHeaderAccessor.create(SimpMessageType.SUBSCRIBE);
            subscribe.setSessionId(session);
            subscribe.setSubscriptionId("security-control");
            subscribe.setDestination(topic);
            broker.handleMessage(MessageBuilder.createMessage(new byte[0], subscribe.getMessageHeaders()));

            byte[] control = "server-control".getBytes(UTF_8);
            serverMessages.send(topic, MessageBuilder.withPayload(control).build());
            Message<?> delivered = received.poll(5, TimeUnit.SECONDS);
            assertThat(delivered).as("server publication reaches a subscriber").isNotNull();
            assertThat(delivered.getPayload()).isEqualTo(control);

            for (String destination : List.of(topic, "/app/juego/disparo")) {
                var clientSend = StompHeaderAccessor.create(StompCommand.SEND);
                clientSend.setSessionId(session);
                clientSend.setDestination(destination);
                boolean accepted = inbound.send(MessageBuilder.createMessage(
                        "forged-control".getBytes(UTF_8), clientSend.getMessageHeaders()));
                Message<?> forged = received.poll(1, TimeUnit.SECONDS);
                assertThat(accepted).as("client SEND must be rejected at ingress: %s", destination).isFalse();
                assertThat(forged).as("client publication never reaches subscribers").isNull();
            }
        } finally {
            var unsubscribe = SimpMessageHeaderAccessor.create(SimpMessageType.UNSUBSCRIBE);
            unsubscribe.setSessionId(session);
            unsubscribe.setSubscriptionId("security-control");
            broker.handleMessage(MessageBuilder.createMessage(new byte[0], unsubscribe.getMessageHeaders()));
            var disconnect = SimpMessageHeaderAccessor.create(SimpMessageType.DISCONNECT);
            disconnect.setSessionId(session);
            broker.handleMessage(MessageBuilder.createMessage(new byte[0], disconnect.getMessageHeaders()));
            outbound.unsubscribe(listener);
        }
    }
}
