package com.jair.battleship.battleshipbackend.models.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    @ManyToOne
    @JoinColumn(name = "sala_id")
    private Sala sala;

    @OneToOne(mappedBy = "jugador", cascade = CascadeType.ALL)
    private Tablero tablero;
}
