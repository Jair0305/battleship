package com.jair.battleship.battleshipbackend.models;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ResultadoDisparo {
    private Long jugadorId;
    private String posicion;
    private boolean acierto;

}

