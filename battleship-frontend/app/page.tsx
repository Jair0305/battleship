"use client";
import EntryScreen from './components/EntryScreen';
import Salas from './components/Salas';
import { useSessionUser } from './hooks/useSessionUser';

const Home = () => {
    const session = useSessionUser();

    if (!session) {
        return <EntryScreen />;
    }

    return (
        <div className="min-h-screen bg-[url('/grid.svg')] bg-center p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <Salas />
            </div>
        </div>
    );
};

export default Home;
