import Sky from './components/Sky.jsx';
import Desk from './components/Desk.jsx';
import Chat from './components/Chat.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Sky />
      <Desk />
      <main className="stage">
        <Chat />
      </main>
    </div>
  );
}
