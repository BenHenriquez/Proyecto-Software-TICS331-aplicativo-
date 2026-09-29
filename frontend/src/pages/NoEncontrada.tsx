import { Link } from 'react-router-dom';

export default function NoEncontrada() {
  return (
    <section aria-labelledby="titulo-no-encontrada">
      <h1 id="titulo-no-encontrada">No encontramos esta página</h1>
      <p>
        <Link to="/">Volver a buscar un medicamento</Link>
      </p>
    </section>
  );
}
