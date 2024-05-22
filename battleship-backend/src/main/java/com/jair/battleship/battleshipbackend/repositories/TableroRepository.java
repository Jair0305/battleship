package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Tablero;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TableroRepository extends JpaRepository<Tablero, Long> {
}
