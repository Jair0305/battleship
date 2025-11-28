package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public interface SalaService {

    List<Sala> obtenerSalasDisponibles();

    // Nuevo: listar todas
    List<Sala> obtenerTodas();

    Sala crearSala(String nombre);

    Sala ocuparSala(Long id);

    Sala liberarSala(Long id);

    void entrarEspectador(Long id);

    void salirEspectador(Long id);
}
