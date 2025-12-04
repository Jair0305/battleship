package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Jugador;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JugadorRepository extends JpaRepository<Jugador, Long> {
}
