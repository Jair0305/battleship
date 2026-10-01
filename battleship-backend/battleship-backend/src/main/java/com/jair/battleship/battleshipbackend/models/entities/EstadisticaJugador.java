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
public class EstadisticaJugador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "jugador_id", unique = true)
    private Jugador jugador;

    private int partidasJugadas;
    private int ganadas;
    private int perdidas;
    private int empates;

    private int puntosTotales;
    private int impactos;
    private int fallos;
    private int barcosHundidos;

    private int rachaActual;
    private int mejorRacha;

    private Instant ultimoJuegoAt;
}