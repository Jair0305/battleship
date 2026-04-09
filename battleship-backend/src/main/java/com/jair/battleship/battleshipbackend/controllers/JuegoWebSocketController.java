package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.MensajeDisparo;
import com.jair.battleship.battleshipbackend.models.ResultadoDisparo;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;

@Controller
public class JuegoWebSocketController {

    @Autowired
    private JuegoService juegoService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private JugadorRepository jugadorRepository;

    @MessageMapping("/juego/disparo")
    public void realizarDisparo(MensajeDisparo mensaje) throws Exception {
        // Lógica para manejar el disparo
        boolean acierto = juegoService.realizarDisparo(mensaje.getJugadorId(), mensaje.getPosicion());

        // Obtener sala del jugador para enviar solo a esa sala
        var jugador = jugadorRepository.findById(mensaje.getJugadorId()).orElseThrow();
        Long salaId = jugador.getSala().getId();

        ResultadoDisparo res = new ResultadoDisparo(mensaje.getJugadorId(), mensaje.getPosicion(), acierto,
                System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/resultados", res);
    }
}