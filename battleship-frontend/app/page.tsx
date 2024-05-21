"use cliente";
import Salas from "@/app/components/Salas";

export default function Home() {
  return (
      <div className="App">
        <header className="App-header">
          <h1>Juego de Battle Ship</h1>
        </header>
        <Salas />
      </div>
  );
}