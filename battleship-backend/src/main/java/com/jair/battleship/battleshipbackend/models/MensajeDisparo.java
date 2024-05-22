package com.jair.battleship.battleshipbackend.models;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.bind.annotation.GetMapping;

@Getter
@Setter
public class MensajeDisparo {
    private Long jugadorId;
    private String posicion;

}
