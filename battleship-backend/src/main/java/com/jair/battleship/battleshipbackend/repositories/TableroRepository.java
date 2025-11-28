package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Tablero;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface TableroRepository extends JpaRepository<Tablero, Long> {
    Optional<Tablero> findByJugadorId(Long jugadorId);
    Optional<Tablero> findByJugadorIdAndPartidaId(Long jugadorId, Long partidaId);
    Optional<Tablero> findByJugadorIdAndPartidaIsNull(Long jugadorId);
}
