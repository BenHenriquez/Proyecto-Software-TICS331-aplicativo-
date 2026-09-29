import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Buscador from './pages/Buscador';
import Backoffice from './pages/Backoffice';
import NoEncontrada from './pages/NoEncontrada';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Buscador />} />
        <Route path="/backoffice" element={<Backoffice />} />
        <Route path="*" element={<NoEncontrada />} />
      </Route>
    </Routes>
  );
}
