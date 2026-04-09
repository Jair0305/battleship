package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
import com.jair.battleship.battleshipbackend.repositories.JugadorRepository;
import com.jair.battleship.battleshipbackend.services.SalaService;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Arrays;
import java.util.List;

@Service
public class SalaServiceImpl implements SalaService {

    @Autowired
    private SalaRepository salaRepository;

    @Autowired
    private JugadorRepository jugadorRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public List<Sala> obtenerSalasDisponibles() {
        return salaRepository.findByDisponible(true);
    }

    public List<Sala> obtenerTodas() {
        return salaRepository.findAll();
    }

    public Sala crearSala(String nombre) {
        Sala sala = new Sala();
        sala.setNombre(nombre);
        sala.setDisponible(true);
        sala.setOcupacion(0);
        Sala saved = salaRepository.save(sala);
        broadcastUpdate();
        return saved;
    }

    @Override
    public Sala ocuparSala(Long id) {
        // Deprecated or mapped to seat logic if needed, but keeping for compatibility
        // For now, just return the sala
        return salaRepository.findById(id).orElseThrow();
    }

    @Override
    public Sala liberarSala(Long id, Long jugadorId) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        if (jugadorId != null) {
            if (sala.getJugador1() != null && sala.getJugador1().getId().equals(jugadorId)) {
                sala.setJugador1(null);
            } else if (sala.getJugador2() != null && sala.getJugador2().getId().equals(jugadorId)) {
                sala.setJugador2(null);
            }
            updateOcupacion(sala);
            sala = salaRepository.save(sala);
            broadcastUpdate();
        }
        return sala;
    }

    @Override
    public Sala entrarEspectador(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer esp = sala.getEspectadores();
        int espectadores = (esp == null ? 0 : esp);
        sala.setEspectadores(espectadores + 1);
        Sala saved = salaRepository.save(sala);
        broadcastUpdate();
        return saved;
    }

    @Override
    public Sala salirEspectador(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer esp = sala.getEspectadores();
        int espectadores = (esp == null ? 0 : esp);
        if (espectadores > 0) {
            sala.setEspectadores(espectadores - 1);
            sala = salaRepository.save(sala);
            broadcastUpdate();
        }
        return sala;
    }

    @Override
    public Sala ocuparPuesto(Long salaId, Long jugadorId, int puesto) {
        Sala sala = salaRepository.findById(salaId).orElseThrow();
        com.jair.battleship.battleshipbackend.models.entities.Jugador jugador = jugadorRepository.findById(jugadorId)
                .orElseThrow();

        if (puesto == 1) {
            if (sala.getJugador1() != null && !sala.getJugador1().getId().equals(jugadorId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Puesto 1 ocupado");
            }
            sala.setJugador1(jugador);
        } else if (puesto == 2) {
            if (sala.getJugador2() != null && !sala.getJugador2().getId().equals(jugadorId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Puesto 2 ocupado");
            }
            sala.setJugador2(jugador);
        } else {
            throw new IllegalArgumentException("Puesto inválido (1 o 2)");
        }

        updateOcupacion(sala);
        Sala saved = salaRepository.save(sala);
        broadcastUpdate();
        return saved;
    }

    @Override
    public Sala liberarPuesto(Long salaId, int puesto) {
        Sala sala = salaRepository.findById(salaId).orElseThrow();
        if (puesto == 1) {
            sala.setJugador1(null);
        } else if (puesto == 2) {
            sala.setJugador2(null);
        }
        updateOcupacion(sala);
        Sala saved = salaRepository.save(sala);
        broadcastUpdate();
        return saved;
    }

    private void updateOcupacion(Sala sala) {
        int count = 0;
        if (sala.getJugador1() != null)
            count++;
        if (sala.getJugador2() != null)
            count++;
        sala.setOcupacion(count);
        sala.setDisponible(count < 2);
    }

    private void broadcastUpdate() {
        try {
            messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
        } catch (Exception ignored) {
        }
    }

    @PostConstruct
    public void init() {
        if (salaRepository.count() == 0) {
            Sala sala1 = new Sala("Sala 1", true);
            sala1.setOcupacion(0);
            Sala sala2 = new Sala("Sala 2", true);
            sala2.setOcupacion(0);
            Sala sala3 = new Sala("Sala 3", true);
            sala3.setOcupacion(0);
            salaRepository.saveAll(Arrays.asList(sala1, sala2, sala3));
            broadcastUpdate();
        }
    }
}
