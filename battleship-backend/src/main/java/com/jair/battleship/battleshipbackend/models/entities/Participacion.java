package com.jair.battleship.battleshipbackend.models.entities;

import com.jair.battleship.battleshipbackend.models.enums.ResultadoParticipacion;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Participacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "partida_id")
    private Partida partida;

    @ManyToOne
    @JoinColumn(name = "jugador_id")
    private Jugador jugador;

    private int puntosObtenidos;

    @Enumerated(EnumType.STRING)
    private ResultadoParticipacion resultado;

    private Integer orden; // 1 host, 2 guest

    private Instant createdAt = Instant.now();
}