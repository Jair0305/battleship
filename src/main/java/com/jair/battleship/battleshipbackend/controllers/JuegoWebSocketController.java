package com.jair.battleship.battleshipbackend.controllers;

import com.jair.battleship.battleshipbackend.models.MensajeDisparo;
import com.jair.battleship.battleshipbackend.models.ResultadoDisparo;
import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.services.JuegoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;

@Controller
public class JuegoWebSocketController {

    @Autowired
    private JuegoService juegoService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private JugadorRepository jugadorRepository;

    @Autowired
    private SalaRepository salaRepository;

    @MessageMapping("/juego/disparo")
    public void realizarDisparo(MensajeDisparo mensaje) throws Exception {
        // Lógica para manejar el disparo
        boolean acierto = juegoService.realizarDisparo(mensaje.getJugadorId(), mensaje.getPosicion());

        // Obtener sala del jugador - first try the direct relation, then search all
        // salas
        Jugador jugador = jugadorRepository.findById(mensaje.getJugadorId()).orElseThrow();
        Long salaId = null;

        // Try direct sala relation
        if (jugador.getSala() != null) {
            salaId = jugador.getSala().getId();
        }

        // If no direct relation, find sala where this player is seated
        if (salaId == null) {
            for (Sala s : salaRepository.findAll()) {
                if ((s.getJugador1() != null && s.getJugador1().getId().equals(mensaje.getJugadorId())) ||
                        (s.getJugador2() != null && s.getJugador2().getId().equals(mensaje.getJugadorId()))) {
                    salaId = s.getId();
                    break;
                }
            }
        }

        if (salaId == null) {
            throw new IllegalStateException("No se pudo encontrar la sala del jugador");
        }

        ResultadoDisparo res = new ResultadoDisparo(mensaje.getJugadorId(), mensaje.getPosicion(), acierto,
                System.currentTimeMillis());
        messagingTemplate.convertAndSend("/topic/sala/" + salaId + "/resultados", res);
    }
}