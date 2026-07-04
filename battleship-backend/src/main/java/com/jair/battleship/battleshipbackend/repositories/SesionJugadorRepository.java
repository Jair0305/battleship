package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.SesionJugador;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SesionJugadorRepository extends JpaRepository<SesionJugador, Long> {
    Optional<SesionJugador> findByToken(String token);
}
