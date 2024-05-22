package com.jair.battleship.battleshipbackend.models.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Sala {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;
    private boolean disponible = true;

    @OneToMany(mappedBy = "sala")
    private List<Jugador> jugadores = new ArrayList<>();

    public Sala(Long id) {
        this.id = id;
    }

    public Sala(String nombre, boolean disponible) {
        this.nombre = nombre;
        this.disponible = disponible;
    }
}
