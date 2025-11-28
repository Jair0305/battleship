package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
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
        // notificar creación
        try {
            messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
        } catch (Exception ignored) {
        }
        return saved;
    }

    @Override
    public Sala ocuparSala(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer oc = sala.getOcupacion();
        int ocupacion = (oc == null ? 0 : oc);

        if (ocupacion >= 2) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La sala ya está llena (2/2)");
        }

        ocupacion++;
        sala.setOcupacion(ocupacion);
        sala.setDisponible(ocupacion < 2);
        Sala saved = salaRepository.save(sala);
        // notificar cambio de salas
        try {
            messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
        } catch (Exception ignored) {
        }
        return saved;
    }

    @Override
    public Sala liberarSala(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer oc = sala.getOcupacion();
        int ocupacion = (oc == null ? 0 : oc);

        if (ocupacion > 0) {
            ocupacion--;
        }
        sala.setOcupacion(Math.max(0, ocupacion));
        sala.setDisponible(ocupacion < 2);
        Sala saved = salaRepository.save(sala);
        // notificar cambio de salas
        try {
            messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
        } catch (Exception ignored) {
        }
        return saved;
    }

    @Override
    public void entrarEspectador(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer esp = sala.getEspectadores();
        int espectadores = (esp == null ? 0 : esp);
        sala.setEspectadores(espectadores + 1);
        salaRepository.save(sala);
        try {
            messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
        } catch (Exception ignored) {
        }
    }

    @Override
    public void salirEspectador(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        Integer esp = sala.getEspectadores();
        int espectadores = (esp == null ? 0 : esp);
        if (espectadores > 0) {
            sala.setEspectadores(espectadores - 1);
            salaRepository.save(sala);
            try {
                messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
            } catch (Exception ignored) {
            }
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
            try {
                messagingTemplate.convertAndSend("/topic/salas", obtenerTodas());
            } catch (Exception ignored) {
            }
        }
    }
}
