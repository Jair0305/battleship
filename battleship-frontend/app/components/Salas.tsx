"use client";
import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Sala {
    id: number;
    nombre: string;
}

const Salas = () => {
    const [salas, setSalas] = useState<Sala[]>([]);

    useEffect(() => {
        axios.get<Sala[]>('/api/salas')
            .then(response => {
                setSalas(response.data);
            })
            .catch(error => {
                console.error('Hubo un error!', error);
            });
    }, []);

    const crearSala = () => {
        const nombre = prompt("Nombre de la nueva sala:");
        if (nombre) {
            axios.post<Sala>('/api/salas', null, { params: { nombre } })
                .then(response => {
                    setSalas([...salas, response.data]);
                })
                .catch(error => {
                    console.error('Hubo un error al crear la sala!', error);
                });
        }
    };

    return (
        <div>
            <h1>Salas Disponibles</h1>
            <button onClick={crearSala}>Crear Sala</button>
            <ul>
                {salas.map(sala => (
                    <li key={sala.id}>{sala.nombre}</li>
                ))}
            </ul>
        </div>
    );
};

export default Salas;
