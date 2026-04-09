package com.jair.battleship.battleshipbackend.repositories;

import com.jair.battleship.battleshipbackend.models.entities.Puntuacion;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PuntuacionRepository extends JpaRepository<Puntuacion, Long> {

        // Group by nombre (username) to aggregate scores across different Jugador
        // entities for the same person
        @Query("SELECT p.jugador.nombre, p.jugador.nombre, SUM(p.total) as totalPuntos " +
                        "FROM Puntuacion p " +
                        "WHERE p.fecha >= :startDate " +
                        "GROUP BY p.jugador.nombre " +
                        "ORDER BY totalPuntos DESC")
        List<Object[]> findLeaderboardSince(@Param("startDate") Instant startDate, Pageable pageable);

        @Query("SELECT p.jugador.nombre, p.jugador.nombre, SUM(p.total) as totalPuntos " +
                        "FROM Puntuacion p " +
                        "GROUP BY p.jugador.nombre " +
                        "ORDER BY totalPuntos DESC")
        List<Object[]> findGlobalLeaderboard(Pageable pageable);

        Optional<Puntuacion> findByPartidaIdAndJugadorId(Long partidaId, Long jugadorId);
}
