package com.jair.battleship.battleshipbackend.models.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.jair.battleship.battleshipbackend.models.enums.EstadoPartida;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Mesa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String nombre;

    @Enumerated(EnumType.STRING)
    private EstadoPartida estado = EstadoPartida.WAITING_FOR_PLAYERS;

    @ManyToOne
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @ManyToOne
    @JoinColumn(name = "seat_a_jugador_id")
    private Jugador seatA;

    @ManyToOne
    @JoinColumn(name = "seat_b_jugador_id")
    private Jugador seatB;

    private boolean readyA = false;
    private boolean readyB = false;
    private boolean rematchA = false;
    private boolean rematchB = false;

    @JsonIgnore
    @ElementCollection
    private Set<Long> spectatorSessionIds = new HashSet<>();

    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();

    @PrePersist
    @PreUpdate
    private void touch() {
        updatedAt = Instant.now();
        if (estado == null) {
            estado = EstadoPartida.WAITING_FOR_PLAYERS;
        }
        if (spectatorSessionIds == null) {
            spectatorSessionIds = new HashSet<>();
        }
    }
}
