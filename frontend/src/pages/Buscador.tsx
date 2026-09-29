// US-02 Consultar medicamento (#1). Aquí se implementan la búsqueda y los estados
// cargando, vacío, error y sin stock.
export default function Buscador() {
  return (
    <section aria-labelledby="titulo-buscador">
      <h1 id="titulo-buscador">Buscar medicamento</h1>
      <p>Escribe el nombre del medicamento o su principio activo.</p>
      <form className="formulario" role="search" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="consulta">Nombre o principio activo</label>
        <input id="consulta" name="q" type="search" autoComplete="off" />
        <button type="submit">Buscar</button>
      </form>
      <p className="aviso" role="status">
        La búsqueda estará disponible muy pronto.
      </p>
    </section>
  );
}
