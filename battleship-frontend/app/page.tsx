"use client";
import { useEffect, useState } from 'react';

type Sala = {
    id: number;
    nombre: string;
    disponible: boolean;
};

const Home = () => {
    const [salas, setSalas] = useState<Sala[]>([]);

    useEffect(() => {
        fetch('http://localhost:8080/api/sala')
            .then(response => response.json())
            .then(data => setSalas(data));
    }, []);

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Salas de Juego</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {salas.map(sala => (
                    <div key={sala.id} className="p-4 border rounded shadow">
                        <h2 className="text-xl font-semibold">{sala.nombre}</h2>
                        <p>{sala.disponible ? 'Disponible' : 'Ocupada'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Home;
