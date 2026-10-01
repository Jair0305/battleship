package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Partida;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PartidaRepository extends JpaRepository<Partida, Long> {
    List<Partida> findByEstado(EstadoPartida estado);
    List<Partida> findBySalaIdAndEstado(Long salaId, EstadoPartida estado);
}