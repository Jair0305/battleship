package com.jair.battleship.battleshipbackend.services;

import com.jair.battleship.battleshipbackend.models.entities.Sala;
import java.util.List;

public interface SalaService {

    List<Sala> obtenerSalasDisponibles();

    List<Sala> obtenerTodas();

    Sala crearSala(String nombre);

    Sala ocuparSala(Long id);

    Sala liberarSala(Long id, Long jugadorId);

    Sala entrarEspectador(Long salaId);

    Sala salirEspectador(Long salaId);

    Sala ocuparPuesto(Long salaId, Long jugadorId, int puesto);

    Sala liberarPuesto(Long salaId, int puesto);
}
