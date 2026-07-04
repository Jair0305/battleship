package com.jair.battleship.battleshipbackend.models.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Jugador {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String nombre;
    private int puntuacion;

    // Link to the authenticated user (so the same person reuses their stats)
    @Column(name = "username")
    private String username;

    @Column(name = "session_token", length = 96)
    private String sessionToken;

    private boolean invitado = true;

    @ManyToOne
    @JoinColumn(name = "usuario_id")
    private Usuario usuario;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @JsonIgnore
    @OneToMany(mappedBy = "jugador", cascade = CascadeType.ALL)
    private List<Tablero> tableros = new ArrayList<>();
}
