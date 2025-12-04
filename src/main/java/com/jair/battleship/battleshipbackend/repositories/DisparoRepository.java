package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Disparo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DisparoRepository extends JpaRepository<Disparo, Long> {
    List<Disparo> findByPartidaIdOrderByTimestampAsc(Long partidaId);
    Optional<Disparo> findTopByPartidaIdOrderByTimestampDesc(Long partidaId);
}