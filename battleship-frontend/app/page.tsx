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
        <div className="py-3 md:py-6">
            <Salas />
        </div>
    );
};

export default Home;
