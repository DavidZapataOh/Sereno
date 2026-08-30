/**
 * Las pruebas corren en UTC en cualquier máquina, como en CI.
 *
 * Existe por un fallo concreto: una comparación de fechas del portal pasaba
 * en la máquina de desarrollo (zona -05, la de Colombia) y fallaba en CI
 * (UTC). Fijar la zona aquí hace que el fallo se vea antes de subir nada.
 * Los workers de Jest heredan el entorno de este proceso.
 */
module.exports = () => {
  process.env.TZ = 'UTC';
};
