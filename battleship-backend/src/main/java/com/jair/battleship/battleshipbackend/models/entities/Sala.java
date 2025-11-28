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
public class Sala {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;
    private boolean disponible = true;

    // Ocupación actual de la sala (0, 1 o 2)
    @Column(nullable = true) // tolerar datos antiguos con NULL; normalizamos en @PrePersist/@PreUpdate
    private Integer ocupacion = 0;

    // @JsonIgnore - Removed to show players in lobby
    @OneToMany(mappedBy = "sala")
    private List<Jugador> jugadores = new ArrayList<>();

    @PrePersist
    @PreUpdate
    private void normalize() {
        if (ocupacion == null) ocupacion = 0;
        if (ocupacion < 0) ocupacion = 0;
        if (ocupacion > 2) ocupacion = 2;
    }

    public Sala(Long id) {
        this.id = id;
    }

    public Sala(String nombre, boolean disponible) {
        this.nombre = nombre;
        this.disponible = disponible;
    }
}
