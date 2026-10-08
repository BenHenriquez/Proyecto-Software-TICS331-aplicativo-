// Lee una cookie del header Cookie sin depender de cookie-parser. Devuelve null si no está.
export function leerCookie(req, nombre) {
  const cabecera = req.get('cookie');
  if (!cabecera) return null;

  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0 || parte.slice(0, i).trim() !== nombre) continue;
    try {
      return decodeURIComponent(parte.slice(i + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}
