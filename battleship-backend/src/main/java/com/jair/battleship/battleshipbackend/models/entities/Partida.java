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
    private Instant placementDeadlineAt;
    private Instant turnDeadlineAt;
    private Instant lastAutoActionAt;
    private String ruleset = "SEA_BATTLE_2_CLASSIC";

    // turnoActual: id del jugador que debe jugar
    private Long turnoActualJugadorId;

    private boolean rematchRequestJ1 = false;
    private boolean rematchRequestJ2 = false;

    private Instant rematchDeadline;

    @ManyToOne
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @ManyToOne
    @JoinColumn(name = "mesa_id")
    private Mesa mesa;

    @ManyToOne
    @JoinColumn(name = "ganador_id")
    private Jugador ganador;

    private boolean ratingProcessed = false;

    private boolean abandono = false;

    @OneToMany(mappedBy = "partida", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Participacion> participaciones = new ArrayList<>();

    @OneToMany(mappedBy = "partida", cascade = CascadeType.ALL)
    @JsonIgnore
    private List<Disparo> disparos = new ArrayList<>();

    public List<Disparo> getDisparos() {
        return this.disparos;
    }

    public boolean isRematchRequestJ1() {
        return this.rematchRequestJ1;
    }

    public boolean isRematchRequestJ2() {
        return this.rematchRequestJ2;
    }
}
