package com.jair.battleship.battleshipbackend.models.entities;

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
public class Puntuacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "jugador_id")
    private Jugador jugador;

    @ManyToOne
    @JoinColumn(name = "partida_id")
    private Partida partida;

    private int puntosBase;
    private int puntosPrecision;
    private int puntosBarcos;
    private int puntosRacha;
    private int puntosSupervivencia;

    // Total points earned in this specific game
    private int total;

    private Instant fecha;
}
