package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Participacion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ParticipacionRepository extends JpaRepository<Participacion, Long> {
    List<Participacion> findByPartidaId(Long partidaId);
    Optional<Participacion> findByPartidaIdAndJugadorId(Long partidaId, Long jugadorId);
    long countByPartidaId(Long partidaId);
}