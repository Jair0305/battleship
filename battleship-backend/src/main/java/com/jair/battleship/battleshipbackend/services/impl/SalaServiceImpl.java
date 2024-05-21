package com.jair.battleship.battleshipbackend.services.impl;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import com.jair.battleship.battleshipbackend.repositories.SalaRepository;
import com.jair.battleship.battleshipbackend.services.SalaService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SalaServiceImpl implements SalaService {

    @Autowired
    private SalaRepository salaRepository;

    @Override
    public List<Sala> obtenerSalasDisponibles() {
        return salaRepository.findByDisponible(true);
    }

    @Override
    public Sala crearSala(String nombre) {
        Sala sala = new Sala();
        sala.setNombre(nombre);
        sala.setDisponible(true);
        return salaRepository.save(sala);
    }

    @Override
    public void ocuparSala(Long id) {
        Sala sala = salaRepository.findById(id).orElseThrow();
        sala.setDisponible(false);
        salaRepository.save(sala);
    }
}
