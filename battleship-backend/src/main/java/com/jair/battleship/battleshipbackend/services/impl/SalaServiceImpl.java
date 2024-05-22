package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
import com.jair.battleship.battleshipbackend.services.SalaService;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;

@Service
public class SalaServiceImpl implements SalaService {

    @Autowired
    private SalaRepository salaRepository;

    public List<Sala> obtenerSalasDisponibles() {
        return salaRepository.findByDisponible(true);
    }

    public Sala crearSala(String nombre) {
        Sala sala = new Sala();
        sala.setNombre(nombre);
        sala.setDisponible(true);
        return salaRepository.save(sala);
    }

    public void ocuparSala(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        sala.setDisponible(false);
        salaRepository.save(sala);
    }

    @PostConstruct
    public void init() {
        if (salaRepository.count() == 0) {
            Sala sala1 = new Sala("Sala 1", true);
            Sala sala2 = new Sala("Sala 2", true);
            Sala sala3 = new Sala("Sala 3", true);
            salaRepository.saveAll(Arrays.asList(sala1, sala2, sala3));
        }
    }
}
