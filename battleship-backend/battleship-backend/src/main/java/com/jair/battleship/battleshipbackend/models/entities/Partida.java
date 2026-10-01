package com.jair.battleship.battleshipbackend.models.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Partida {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private EstadoPartida estado = EstadoPartida.CREADA;

    private Instant inicio;
    private Instant fin;

    // turnoActual: id del jugador que debe jugar
    private Long turnoActualJugadorId;

    private boolean rematchRequestJ1 = false;
    private boolean rematchRequestJ2 = false;

    private Instant rematchDeadline;

    @ManyToOne
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @ManyToOne
    @JoinColumn(name = "ganador_id")
    private Jugador ganador;

    @OneToMany(mappedBy = "partida", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Participacion> participaciones = new ArrayList<>();

    @OneToMany(mappedBy = "partida", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Disparo> disparos = new ArrayList<>();
}