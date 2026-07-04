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
public class SesionJugador {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 96)
    private String token;

    @Column(nullable = false, length = 64)
    private String displayName;

    private boolean guest = true;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    private Instant createdAt = Instant.now();
    private Instant lastSeenAt = Instant.now();
}
