"use client";
import Salas from './components/Salas';

const Home = () => {
    return (
        <div className="min-h-screen bg-[url('/grid.svg')] bg-center p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Salas />
            </div>
        </div>
    );
};

export default Home;
