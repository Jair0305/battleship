package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public interface SalaService {

    List<Sala> obtenerSalasDisponibles();

    Sala crearSala(String nombre);

    void ocuparSala(Long id);
}
