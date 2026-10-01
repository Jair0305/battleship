package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Espectador;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EspectadorRepository extends JpaRepository<Espectador, Long> {
    List<Espectador> findByPartidaId(Long partidaId);
}