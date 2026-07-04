package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JugadorRepository extends JpaRepository<Jugador, Long> {
    Optional<Jugador> findTopBySessionTokenAndSalaIdOrderByIdDesc(String sessionToken, Long salaId);
}
