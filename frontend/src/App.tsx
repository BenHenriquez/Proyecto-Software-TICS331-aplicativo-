import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Buscador from './pages/Buscador';
import Backoffice from './pages/Backoffice';
import Carrito from './pages/Carrito';
import NoEncontrada from './pages/NoEncontrada';
import Ingresar from './pages/Ingresar';
import MisPedidos from './pages/MisPedidos';
import { SesionProvider } from './lib/sesion';

export default function App() {
  return (
    <SesionProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Buscador />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route path="/ingresar" element={<Ingresar />} />
          <Route path="/mis-pedidos" element={<MisPedidos />} />
          <Route path="/backoffice" element={<Backoffice />} />
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Routes>
    </SesionProvider>
  );
}
